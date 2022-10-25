var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* components/Head.svelte generated by Svelte v3.29.0 */

    const file = "components/Head.svelte";

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-j0wa5z-style";
    	style.textContent = ".blue.svelte-j0wa5z{color:#69c}.goleft.svelte-j0wa5z{align-self:flex-start}.f1.svelte-j0wa5z{font-size:0.8rem}.m3.svelte-j0wa5z{margin-left:3rem;margin-top:1rem;margin-bottom:1rem}a.svelte-j0wa5z{color:#69c;cursor:pointer;padding:1px;text-decoration:none;border-bottom:1px solid #69c}.link.svelte-j0wa5z:hover{text-decoration-color:#cc7066;font-weight:500;border-bottom:1px solid #23415a}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSGVhZC5zdmVsdGUiLCJzb3VyY2VzIjpbIkhlYWQuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGxldCB5ZWFyID0gbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpXG4gIGV4cG9ydCBsZXQgbnVtID0gJzAxJ1xuICBleHBvcnQgbGV0IHRpdGxlID0gJydcbiAgZXhwb3J0IGxldCBzdWIgPSAnJ1xuPC9zY3JpcHQ+XG5cbjxzdHlsZT5cbiAgLmJsdWUge1xuICAgIGNvbG9yOiAjNjljO1xuICB9XG4gIC5nb2xlZnQge1xuICAgIGFsaWduLXNlbGY6IGZsZXgtc3RhcnQ7XG4gIH1cbiAgLmYxIHtcbiAgICBmb250LXNpemU6IDAuOHJlbTtcbiAgfVxuICAubTMge1xuICAgIG1hcmdpbi1sZWZ0OiAzcmVtO1xuICAgIG1hcmdpbi10b3A6IDFyZW07XG4gICAgbWFyZ2luLWJvdHRvbTogMXJlbTtcbiAgfVxuICBhIHtcbiAgICBjb2xvcjogIzY5YztcbiAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgcGFkZGluZzogMXB4O1xuICAgIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcbiAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgIzY5YztcbiAgfVxuICAubGluazpob3ZlciB7XG4gICAgdGV4dC1kZWNvcmF0aW9uLWNvbG9yOiAjY2M3MDY2O1xuICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gICAgLyogYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkI2NjNzA2NjsgKi9cbiAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgIzIzNDE1YTtcbiAgfVxuPC9zdHlsZT5cblxuPCEtLSB0aXRsZSAtLT5cbjxkaXYgY2xhc3M9XCJibHVlIG1sMSBnb2xlZnQgbGVmdFwiPlxuICA8YSBjbGFzcz1cImxpbmsgZjEgYmx1ZVwiIGhyZWY9XCIuLi8uLi9cIj7jgLEgLi97eWVhcn0vIHtudW19PC9hPlxuPC9kaXY+XG57I2lmIHRpdGxlfVxuICA8ZGl2IGNsYXNzPVwibTNcIj5cbiAgICA8c3BhbiBjbGFzcz1cIm1sMiBncmV5XCI+e3RpdGxlfTwvc3Bhbj5cbiAgICA8ZGl2IGNsYXNzPVwiYnJvd24gbWwxXCI+e3N1Yn08L2Rpdj5cbiAgPC9kaXY+XG57L2lmfVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVFFLEtBQUssY0FBQyxDQUFDLEFBQ0wsS0FBSyxDQUFFLElBQUksQUFDYixDQUFDLEFBQ0QsT0FBTyxjQUFDLENBQUMsQUFDUCxVQUFVLENBQUUsVUFBVSxBQUN4QixDQUFDLEFBQ0QsR0FBRyxjQUFDLENBQUMsQUFDSCxTQUFTLENBQUUsTUFBTSxBQUNuQixDQUFDLEFBQ0QsR0FBRyxjQUFDLENBQUMsQUFDSCxXQUFXLENBQUUsSUFBSSxDQUNqQixVQUFVLENBQUUsSUFBSSxDQUNoQixhQUFhLENBQUUsSUFBSSxBQUNyQixDQUFDLEFBQ0QsQ0FBQyxjQUFDLENBQUMsQUFDRCxLQUFLLENBQUUsSUFBSSxDQUNYLE1BQU0sQ0FBRSxPQUFPLENBQ2YsT0FBTyxDQUFFLEdBQUcsQ0FDWixlQUFlLENBQUUsSUFBSSxDQUNyQixhQUFhLENBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEFBQy9CLENBQUMsQUFDRCxtQkFBSyxNQUFNLEFBQUMsQ0FBQyxBQUNYLHFCQUFxQixDQUFFLE9BQU8sQ0FDOUIsV0FBVyxDQUFFLEdBQUcsQ0FFaEIsYUFBYSxDQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxBQUNsQyxDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    // (42:0) {#if title}
    function create_if_block(ctx) {
    	let div1;
    	let span;
    	let t0;
    	let t1;
    	let div0;
    	let t2;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			span = element("span");
    			t0 = text(/*title*/ ctx[1]);
    			t1 = space();
    			div0 = element("div");
    			t2 = text(/*sub*/ ctx[2]);
    			attr_dev(span, "class", "ml2 grey");
    			add_location(span, file, 43, 4, 779);
    			attr_dev(div0, "class", "brown ml1");
    			add_location(div0, file, 44, 4, 821);
    			attr_dev(div1, "class", "m3 svelte-j0wa5z");
    			add_location(div1, file, 42, 2, 758);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, span);
    			append_dev(span, t0);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*title*/ 2) set_data_dev(t0, /*title*/ ctx[1]);
    			if (dirty & /*sub*/ 4) set_data_dev(t2, /*sub*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(42:0) {#if title}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div;
    	let a;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let if_block_anchor;
    	let if_block = /*title*/ ctx[1] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			a = element("a");
    			t0 = text("〱 ./");
    			t1 = text(/*year*/ ctx[3]);
    			t2 = text("/ ");
    			t3 = text(/*num*/ ctx[0]);
    			t4 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(a, "class", "link f1 blue svelte-j0wa5z");
    			attr_dev(a, "href", "../../");
    			add_location(a, file, 39, 2, 677);
    			attr_dev(div, "class", "blue ml1 goleft left svelte-j0wa5z");
    			add_location(div, file, 38, 0, 640);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, a);
    			append_dev(a, t0);
    			append_dev(a, t1);
    			append_dev(a, t2);
    			append_dev(a, t3);
    			insert_dev(target, t4, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*num*/ 1) set_data_dev(t3, /*num*/ ctx[0]);

    			if (/*title*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t4);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Head", slots, []);
    	let year = new Date().getFullYear();
    	let { num = "01" } = $$props;
    	let { title = "" } = $$props;
    	let { sub = "" } = $$props;
    	const writable_props = ["num", "title", "sub"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Head> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("num" in $$props) $$invalidate(0, num = $$props.num);
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(2, sub = $$props.sub);
    	};

    	$$self.$capture_state = () => ({ year, num, title, sub });

    	$$self.$inject_state = $$props => {
    		if ("year" in $$props) $$invalidate(3, year = $$props.year);
    		if ("num" in $$props) $$invalidate(0, num = $$props.num);
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(2, sub = $$props.sub);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [num, title, sub, year];
    }

    class Head extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-j0wa5z-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, { num: 0, title: 1, sub: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Head",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get num() {
    		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set num(value) {
    		throw new Error("<Head>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get title() {
    		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Head>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get sub() {
    		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set sub(value) {
    		throw new Error("<Head>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/Foot.svelte generated by Svelte v3.29.0 */

    const file$1 = "components/Foot.svelte";

    function add_css$1() {
    	var style = element("style");
    	style.id = "svelte-1xt868z-style";
    	style.textContent = ".footer.svelte-1xt868z{display:flex;margin:auto 1rem 1rem auto;padding:0.5rem;justify-content:flex-end;align-content:flex-end;align-items:center;padding-top:5rem;width:100%;font-size:0.8rem}.m2.svelte-1xt868z{margin:1.5rem}a.svelte-1xt868z{color:#69c;cursor:pointer;text-decoration:underline}a.svelte-1xt868z:hover{text-decoration-color:#cc7066}.name.svelte-1xt868z{margin-right:4rem}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRm9vdC5zdmVsdGUiLCJzb3VyY2VzIjpbIkZvb3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGV4cG9ydCBsZXQgbnVtID0gJydcbiAgZXhwb3J0IGxldCB5ZWFyID0gJydcbjwvc2NyaXB0PlxuXG48c3R5bGU+XG4gIC5mb290ZXIge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgbWFyZ2luOiBhdXRvIDFyZW0gMXJlbSBhdXRvO1xuICAgIHBhZGRpbmc6IDAuNXJlbTtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kO1xuICAgIGFsaWduLWNvbnRlbnQ6IGZsZXgtZW5kO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgcGFkZGluZy10b3A6IDVyZW07XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgZm9udC1zaXplOiAwLjhyZW07XG4gIH1cbiAgLm0yIHtcbiAgICBtYXJnaW46IDEuNXJlbTtcbiAgfVxuICBhIHtcbiAgICBjb2xvcjogIzY5YztcbiAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgdGV4dC1kZWNvcmF0aW9uOiB1bmRlcmxpbmU7XG4gIH1cbiAgYTpob3ZlciB7XG4gICAgdGV4dC1kZWNvcmF0aW9uLWNvbG9yOiAjY2M3MDY2O1xuICB9XG4gIC5uYW1lIHtcbiAgICBtYXJnaW4tcmlnaHQ6IDRyZW07XG4gIH1cbjwvc3R5bGU+XG5cbjwhLS0gZm9vdGVyIC0tPlxuPGRpdiBjbGFzcz1cImZvb3RlclwiPlxuICB7I2lmIG51bSAmJiB5ZWFyfVxuICAgIDxhIGNsYXNzPVwibTJcIiBocmVmPVwiaHR0cHM6Ly9naXRodWIuY29tL3NwZW5jZXJtb3VudGFpbi90aGVuc29tZS90cmVlL2doLXBhZ2VzL3t5ZWFyfS97bnVtfVwiPlxuICAgICAgc291cmNlXG4gICAgPC9hPlxuICB7OmVsc2V9XG4gICAgPGEgY2xhc3M9XCJtMlwiIGhyZWY9XCJodHRwczovL2dpdGh1Yi5jb20vc3BlbmNlcm1vdW50YWluL3RoZW5zb21lXCI+c291cmNlPC9hPlxuICB7L2lmfVxuICA8YSBjbGFzcz1cIm5hbWVcIiBocmVmPVwiaHR0cDovL3R3aXR0ZXIuY29tL3NwZW5jZXJtb3VudGFpbi9cIj5Ac3BlbmNlcm1vdW50YWluPC9hPlxuPC9kaXY+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBTUUsT0FBTyxlQUFDLENBQUMsQUFDUCxPQUFPLENBQUUsSUFBSSxDQUNiLE1BQU0sQ0FBRSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQzNCLE9BQU8sQ0FBRSxNQUFNLENBQ2YsZUFBZSxDQUFFLFFBQVEsQ0FDekIsYUFBYSxDQUFFLFFBQVEsQ0FDdkIsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsV0FBVyxDQUFFLElBQUksQ0FDakIsS0FBSyxDQUFFLElBQUksQ0FDWCxTQUFTLENBQUUsTUFBTSxBQUNuQixDQUFDLEFBQ0QsR0FBRyxlQUFDLENBQUMsQUFDSCxNQUFNLENBQUUsTUFBTSxBQUNoQixDQUFDLEFBQ0QsQ0FBQyxlQUFDLENBQUMsQUFDRCxLQUFLLENBQUUsSUFBSSxDQUNYLE1BQU0sQ0FBRSxPQUFPLENBQ2YsZUFBZSxDQUFFLFNBQVMsQUFDNUIsQ0FBQyxBQUNELGdCQUFDLE1BQU0sQUFBQyxDQUFDLEFBQ1AscUJBQXFCLENBQUUsT0FBTyxBQUNoQyxDQUFDLEFBQ0QsS0FBSyxlQUFDLENBQUMsQUFDTCxZQUFZLENBQUUsSUFBSSxBQUNwQixDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    // (40:2) {:else}
    function create_else_block(ctx) {
    	let a;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "source";
    			attr_dev(a, "class", "m2 svelte-1xt868z");
    			attr_dev(a, "href", "https://github.com/spencermountain/thensome");
    			add_location(a, file$1, 40, 4, 712);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(40:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (36:2) {#if num && year}
    function create_if_block$1(ctx) {
    	let a;
    	let t;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t = text("source");
    			attr_dev(a, "class", "m2 svelte-1xt868z");
    			attr_dev(a, "href", a_href_value = "https://github.com/spencermountain/thensome/tree/gh-pages/" + /*year*/ ctx[1] + "/" + /*num*/ ctx[0]);
    			add_location(a, file$1, 36, 4, 583);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*year, num*/ 3 && a_href_value !== (a_href_value = "https://github.com/spencermountain/thensome/tree/gh-pages/" + /*year*/ ctx[1] + "/" + /*num*/ ctx[0])) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(36:2) {#if num && year}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div;
    	let t0;
    	let a;

    	function select_block_type(ctx, dirty) {
    		if (/*num*/ ctx[0] && /*year*/ ctx[1]) return create_if_block$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			t0 = space();
    			a = element("a");
    			a.textContent = "@spencermountain";
    			attr_dev(a, "class", "name svelte-1xt868z");
    			attr_dev(a, "href", "http://twitter.com/spencermountain/");
    			add_location(a, file$1, 42, 2, 798);
    			attr_dev(div, "class", "footer svelte-1xt868z");
    			add_location(div, file$1, 34, 0, 538);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    			append_dev(div, t0);
    			append_dev(div, a);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, t0);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Foot", slots, []);
    	let { num = "" } = $$props;
    	let { year = "" } = $$props;
    	const writable_props = ["num", "year"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Foot> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("num" in $$props) $$invalidate(0, num = $$props.num);
    		if ("year" in $$props) $$invalidate(1, year = $$props.year);
    	};

    	$$self.$capture_state = () => ({ num, year });

    	$$self.$inject_state = $$props => {
    		if ("num" in $$props) $$invalidate(0, num = $$props.num);
    		if ("year" in $$props) $$invalidate(1, year = $$props.year);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [num, year];
    }

    class Foot extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1xt868z-style")) add_css$1();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { num: 0, year: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Foot",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get num() {
    		throw new Error("<Foot>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set num(value) {
    		throw new Error("<Foot>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get year() {
    		throw new Error("<Foot>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set year(value) {
    		throw new Error("<Foot>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var byColor = {
      'Frances Nunziata': '#6699cc',//blue
      'John Filion': '#978BA3', //red
      'Denzil Minnan-Wong': '#335799',//navy
      'Maria Augimeri': '#D68881', //red
      'Joe Mihevc': '#F2C0BB',
      'David Shiner': '#2D85A8',
      'Paula Fletcher': '#d8b3e6',
      'Michael Thompson': '#7f9c6c',
      'Gloria Lindsay Luby': '#735873',
      'Raymond Cho': '#e6d7b3',
      'Frank Di Giorgio': '#9c896c',
      'Mark Grimes': '#2D85A8',
      'Anthony Perruzza': '#303b50',
      'Gord Perks': '#cc6966',
      // 'Paul Ainslie': '#275291',
      // 'Doug Holyday': '#cc6966',
      // 'Howard Moscoe': '#e6b3bc',
      // 'Joe Pantalone': '#D68881',
      // 'Michael Walker': '#AB5850',
      // 'Kyle Rae': '#72697D',
      // 'Case Ootes': '#8BA3A2',
      // 'Sandra Bussin': '#978BA3',
      // 'Brian Ashton': '#6D5685',
      // 'Norm Kelly': '#6699cc',
      // 'Giorgio Mammoliti': '#6accb2',
      // 'Cesar Palacio': '#e1e6b3',
      // 'Janet Davis': '#cc7066',
      // 'Shelley Carroll': '#F2C0BB',
      // 'Glenn De Baeremaeker': '#cc8a66',
      // 'James Pasternak': '#d8b3e6',
      // 'Josh Matlow': '#7f9c6c',
      // 'Jaye Robinson': '#735873',
      // 'Gary Crawford': '#e6d7b3',
      // 'Peter Li Preti': '#9c896c',
      // 'Olivia Chow': '#2D85A8',
      // 'Gerry Altobello': '#303b50',
      // 'Bas Balkissoon': '#914045',
      // 'Ron Moeser': '#275291',
      // 'Suzan Hall': '#cc6966',
      // 'Rob Ford': '#e6b3bc',
      // 'Peter Milczyn': '#D68881',
      // 'Karen Stintz': '#AB5850',
      // 'Chin Lee': '#72697D',
      // 'Ana Bailão': '#8BA3A2',
      // 'Mike Layton': '#978BA3',
      // 'Stephen Holyday': '#6D5685',
      // 'Irene Jones': '#6699cc',
      // 'George Mammoliti': '#6accb2',
      // 'Mike Feldman': '#e1e6b3',
      // 'David Miller': '#cc7066',
      // 'Chris Korwin-Kuczynski': '#F2C0BB',
      // 'Anne Johnston': '#cc8a66',
      // 'Betty Disero': '#d8b3e6',
      // 'Mario Silva': '#7f9c6c',
      // 'Joanne Flint': '#735873',
      // 'Pam McConnell': '#e6d7b3',
      // 'Jack Layton': '#9c896c',
      // 'Michael Prue': '#2D85A8',
      // 'Lorenzo Berardinetti': '#303b50',
      // 'Brad Duguid': '#914045',
      // 'Sherene Shaw': '#275291',
      // 'Jane Pitfield': '#cc6966',
      // 'David Soknacki': '#e6b3bc',
      // 'Michael Feldman': '#D68881',
      // 'Bill Saundercook': '#AB5850',
      // 'Adam Giambrone': '#72697D',
      // 'Pam Mcconnell': '#8BA3A2',
      // 'Mike Del Grande': '#978BA3',
      // 'John Parker': '#6D5685',
      // 'Vincent Crisanti': '#6699cc',
      // 'Sarah Doucette': '#6accb2',
      // 'Josh Colle': '#e1e6b3',
      // 'Kristyn Wong-Tam': '#cc7066',
      // 'Mary Fragedakis': '#F2C0BB',
      // 'Mary-Margaret McMahon': '#cc8a66',
      // 'Michelle Berardinetti': '#d8b3e6',
      // 'Joe Cressy': '#7f9c6c',
      // 'Mike Colle': '#735873',
      // 'Brad Bradford': '#e6d7b3',
      // 'Nick Mantas': '#9c896c',
      // 'Jennifer McKelvie': '#2D85A8'
    };

    var data = {
      '2022': [
        'Vincent Crisanti',
        'Stephen Holyday',
        'Amber Morley',
        'Anthony Perruzza',
        'James Pasternak',
        'Frances Nunziata',
        'Mike Colle',
        'Gord Perks',
        'Alejandra Bravo',
        'Ausma Malik',
        'Dianne Saxe',
        'Josh Matlow',
        'Chris Moise',
        'Jaye Robinson',
        'Jon Burnside',
        'Shelley Carroll',
        'Paula Fletcher',
        'Lily Cheng',
        'Brad Bradford',
        'Gary Crawford',
        'Michael Thompson',
        'Nick Mantas',
        'Jamaal Myers',
        'Paul Ainslie',
        'Jennifer McKelvie',
      ],
      '2018': [
        'Rose Milczyn',
        'Stephen Holyday',
        'Mark Grimes',
        'Anthony Perruzza',
        'James Pasternak',
        'Frances Nunziata',
        'Mike Colle',
        'Gord Perks',
        'Ana Bailão',
        'Joe Cressy',
        'Mike Layton',
        'Josh Matlow',
        'John Filion',
        'Robin Buxton Potts',
        'Jaye Robinson',
        'Shelley Carroll',
        'Paula Fletcher',
        'Brad Bradford',
        'Gary Crawford',
        'Denzil Minnan-Wong',
        'Michael Thompson',
        'Nick Mantas',
        'Cynthia Lai',
        'Paul Ainslie',
        'Jennifer McKelvie',
      ],
      '2014': [
        'Vincent Crisanti',
        'Michael Ford',
        'Stephen Holyday',
        'John Campbell',
        'Justin Di Ciano',
        'Mark Grimes',
        'Giorgio Mammoliti',
        'Anthony Perruzza',
        'Maria Augimeri',
        'James Pasternak',
        'Frances Nunziata',
        'Frank Di Giorgio',
        'Sarah Doucette',
        'Gord Perks',
        'Josh Colle',
        'Christin Carmichael Greb',
        'Cesar Palacio',
        'Ana Bailão',
        'Mike Layton',
        'Joe Cressy',
        'Joe Mihevc',
        'Josh Matlow',
        'John Filion',
        'David Shiner',
        'Jaye Robinson',
        'Jon Burnside',
        'Kristyn Wong-Tam',
        'Lucy Troisi',
        'Mary Fragedakis',
        'Paula Fletcher',
        'Janet Davis',
        'Mary-Margaret McMahon',
        'Jonathan Tsao',
        'Denzil Minnan-Wong',
        'Michelle Berardinetti',
        'Gary Crawford',
        'Michael Thompson',
        'Glenn De Baeremaeker',
        'Jim Karygiannis',
        'Norm Kelly',
        'Chin Lee',
        'Neethan Shan',
        'Paul Ainslie',
        'Jim Hart',
      ],
      '2010': [
        'Vincent Crisanti',
        'Doug Ford',
        'Peter Leon',
        'Gloria Lindsay Luby',
        'James Maloney',
        'Mark Grimes',
        'Giorgio Mammoliti',
        'Anthony Perruzza',
        'Maria Augimeri',
        'James Pasternak',
        'Frances Nunziata',
        'Frank Di Giorgio',
        'Sarah Doucette',
        'Gord Perks',
        'Josh Colle',
        'Karen Stintz',
        'Cesar Palacio',
        'Ana Bailão',
        'Mike Layton',
        'Ceta Ramkhalawansingh',
        'Joe Mihevc',
        'Josh Matlow',
        'John Filion',
        'David Shiner',
        'Jaye Robinson',
        'John Parker',
        'Kristyn Wong-Tam',
        'Pam McConnell',
        'Mary Fragedakis',
        'Paula Fletcher',
        'Janet Davis',
        'Mary-Margaret McMahon',
        'Shelley Carroll',
        'Denzil Minnan-Wong',
        'Michelle Berardinetti',
        'Gary Crawford',
        'Michael Thompson',
        'Glenn De Baeremaeker',
        'Michael Del Grande',
        'Norm Kelly',
        'Chin Lee',
        'Raymond Cho',
        'Paul Ainslie',
        'Ron Moeser',
      ],
      '2006': [
        'Suzan Hall',
        'Rob Ford',
        'Doug Holyday',
        'Gloria Lindsay Luby',
        'Peter Milczyn',
        'Mark Grimes',
        'Giorgio Mammoliti',
        'Anthony Perruzza',
        'Maria Augimeri',
        'Michael Feldman',
        'Frances Nunziata',
        'Frank Di Giorgio',
        'Bill Saundercook',
        'Gord Perks',
        'Howard Moscoe',
        'Karen Stintz',
        'Cesar Palacio',
        'Adam Giambrone',
        'Joe Pantalone',
        'Adam Vaughan',
        'Joe Mihevc',
        'Michael Walker',
        'John Filion',
        'David Shiner',
        'Cliff Jenkins',
        'John Parker',
        'Kyle Rae',
        'Pam Mcconnell',
        'Case Ootes',
        'Paula Fletcher',
        'Janet Davis',
        'Sandra Bussin',
        'Shelley Carroll',
        'Denzil Minnan-Wong',
        'Adrian Heaps',
        'Brian Ashton',
        'Michael Thompson',
        'Glenn De Baeremaeker',
        'Mike Del Grande',
        'Norm Kelly',
        'Chin Lee',
        'Raymond Cho',
        'Paul Ainslie',
        'Ron Moeser',
      ],
      '2003': [
        'Suzan Hall',
        'Rob Ford',
        'Doug Holyday',
        'Gloria Lindsay Luby',
        'Peter Milczyn',
        'Mark Grimes',
        'Giorgio Mammoliti',
        'Peter Li Preti',
        'Maria Augimeri',
        'Michael Feldman',
        'Frances Nunziata',
        'Frank Di Giorgio',
        'Bill Saundercook',
        'Sylvia Watson',
        'Howard Moscoe',
        'Karen Stintz',
        'Cesar Palacio',
        'Adam Giambrone',
        'Joe Pantalone',
        'Olivia Chow',
        'Joe Mihevc',
        'Michael Walker',
        'John Filion',
        'David Shiner',
        'Clifford Jenkins',
        'Jane Pitfield',
        'Kyle Rae',
        'Pam Mcconnell',
        'Case Ootes',
        'Paula Fletcher',
        'Janet Davis',
        'Sandra Bussin',
        'Shelley Carroll',
        'Denzil Minnan-Wong',
        'Gerry Altobello',
        'Brian Ashton',
        'Michael Thompson',
        'Glenn De Baeremaeker',
        'Mike Del Grande',
        'Norman Kelly',
        'Bas Balkissoon',
        'Raymond Cho',
        'David Soknacki',
        'Gay Cowbourne',
      ],
      '2000': [
        'Suzan Hall',
        'Rob Ford',
        'Doug Holyday',
        'Gloria Lindsay Luby',
        'Peter Milczyn',
        'Irene Jones',
        'George Mammoliti',
        'Peter Li Preti',
        'Maria Augimeri',
        'Mike Feldman',
        'Frances Nunziata',
        'Frank Di Giorgio',
        'David Miller',
        'Chris Korwin-Kuczynski',
        'Howard Moscoe',
        'Anne Johnston',
        'Betty Disero',
        'Mario Silva',
        'Joe Pantalone',
        'Olivia Chow',
        'Joe Mihevc',
        'Michael Walker',
        'John Filion',
        'David Shiner',
        'Joanne Flint',
        'Jane Pitfield',
        'Kyle Rae',
        'Pam McConnell',
        'Case Ootes',
        'Jack Layton',
        'Michael Prue',
        'Sandra Bussin',
        'Paul Sutherland',
        'Denzil Minnan-Wong',
        'Gerry Altobello',
        'Brian Ashton',
        'Lorenzo Berardinetti',
        'Brad Duguid',
        'Sherene Shaw',
        'Norm Kelly',
        'Bas Balkissoon',
        'Raymond Cho',
        'David Soknacki',
        'Ron Moeser',
      ],
      '1997': [
        'Michael Prue',
        'Case Ootes',
        'Irene Jones',
        'Blake Kinahan',
        'Gloria Lindsay Luby',
        'Mario Giansante',
        'Doug Holyday',
        'Dick O\'Brien',
        'Elizabeth Brown',
        'George Mammoliti',
        'Bruce Sinclair',
        'Maria Augimeri',
        'Peter Li Preti',
        'Judy Sgro',
        'Frances Nunziata',
        'Howard Moscoe',
        'Mike Feldman',
        'Joanne Flint',
        'Milton Berger',
        'Norman Gardner',
        'Gordon Chong',
        'Joan King',
        'Brian Ashton',
        'Gerry Altobello',
        'Norm Kelly',
        'Joe Mihevc',
        'Mike Tzekas',
        'Brad Duguid',
        'John Filion',
        'Lorenzo Berardinetti',
        'David Shiner',
        'Frank Faubert',
        'Ron Moeser',
        'Sherene Shaw',
        'Doug Mahood',
        'Bas Balkissoon',
        'David Miller',
        'Chris Korwin-Kuczynski',
        'Joe Pantalone',
        'Mario Silva',
        'Betty Disero',
        'Dennis Fotinos',
        'Denzil Minnan-Wong',
        'Anne Johnston',
        'Michael Walker',
        'John Adams',
        'Ila Bossons',
        'Olivia Chow',
        'Kyle Rae',
        'Jack Layton',
        'Pam McConnell',
        'Tom Jakobek',
        'Raymond Cho',
        'Sandra Bussin',
        'Bill Saundercook',
        'Rob Davis',
      ]
    };

    var counts = {
      'Frances Nunziata': 8,
      'John Filion': 7,
      'Denzil Minnan-Wong': 7,
      'Maria Augimeri': 6,
      'Joe Mihevc': 6,
      'David Shiner': 6,
      'Paula Fletcher': 6,
      'Michael Thompson': 6,
      'Gloria Lindsay Luby': 5,
      'Raymond Cho': 5,
      'Frank Di Giorgio': 5,
      'Mark Grimes': 5,
      'Anthony Perruzza': 5,
      'Gord Perks': 5,
      'Paul Ainslie': 5,
      'Doug Holyday': 4,
      'Howard Moscoe': 4,
      'Joe Pantalone': 4,
      'Michael Walker': 4,
      'Kyle Rae': 4,
      'Case Ootes': 4,
      'Sandra Bussin': 4,
      'Brian Ashton': 4,
      'Norm Kelly': 4,
      'Giorgio Mammoliti': 4,
      'Cesar Palacio': 4,
      'Janet Davis': 4,
      'Shelley Carroll': 4,
      'Glenn De Baeremaeker': 4,
      'James Pasternak': 4,
      'Josh Matlow': 4,
      'Jaye Robinson': 4,
      'Gary Crawford': 4,
      'Peter Li Preti': 3,
      'Olivia Chow': 3,
      'Gerry Altobello': 3,
      'Bas Balkissoon': 3,
      'Ron Moeser': 3,
      'Suzan Hall': 3,
      'Rob Ford': 3,
      'Peter Milczyn': 3,
      'Karen Stintz': 3,
      'Chin Lee': 3,
      'Ana Bailão': 3,
      'Mike Layton': 3,
      'Stephen Holyday': 3,
      'Irene Jones': 2,
      'George Mammoliti': 2,
      'Mike Feldman': 2,
      'David Miller': 2,
      'Chris Korwin-Kuczynski': 2,
      'Anne Johnston': 2,
      'Betty Disero': 2,
      'Mario Silva': 2,
      'Joanne Flint': 2,
      'Pam McConnell': 2,
      'Jack Layton': 2,
      'Michael Prue': 2,
      'Lorenzo Berardinetti': 2,
      'Brad Duguid': 2,
      'Sherene Shaw': 2,
      'Jane Pitfield': 2,
      'David Soknacki': 2,
      'Michael Feldman': 2,
      'Bill Saundercook': 2,
      'Adam Giambrone': 2,
      'Pam Mcconnell': 2,
      'Mike Del Grande': 2,
      'John Parker': 2,
      'Vincent Crisanti': 2,
      'Sarah Doucette': 2,
      'Josh Colle': 2,
      'Kristyn Wong-Tam': 2,
      'Mary Fragedakis': 2,
      'Mary-Margaret McMahon': 2,
      'Michelle Berardinetti': 2,
      'Joe Cressy': 2,
      'Mike Colle': 2,
      'Brad Bradford': 2,
      'Nick Mantas': 2,
      'Jennifer McKelvie': 2
    };

    /* 2022/toronto-council/Post.svelte generated by Svelte v3.29.0 */

    const { Object: Object_1 } = globals;
    const file$2 = "2022/toronto-council/Post.svelte";

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-x9a7pn-style";
    	style.textContent = ".term.svelte-x9a7pn{flex:1;display:flex;flex-direction:row;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch;box-sizing:content-box}.person.svelte-x9a7pn{margin-bottom:20px;min-height:100px;height:100%;border-left:4px solid lightgrey;box-sizing:content-box}.highlight.svelte-x9a7pn{margin-bottom:0px !important;min-height:120px}.aside.svelte-x9a7pn{min-width:100px;max-width:100px;color:grey;font-size:12px}.year.svelte-x9a7pn{min-width:60px;max-width:60px;color:grey;font-size:12px;text-align:left;align-self:flex-start}.container.svelte-x9a7pn{margin:3rem;padding:3rem;min-height:800px;display:flex;flex-direction:column;justify-content:space-around;align-items:center;text-align:center;flex-wrap:nowrap;align-self:stretch}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBIZWFkIGZyb20gJy4uLy4uL2NvbXBvbmVudHMvSGVhZC5zdmVsdGUnXG4gIGltcG9ydCBGb290IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvRm9vdC5zdmVsdGUnXG4gIGltcG9ydCBieUNvbG9yIGZyb20gJy4vY29sb3JzLmpzJ1xuICBpbXBvcnQgZGF0YSBmcm9tICcuL2RhdGEuanMnXG4gIGltcG9ydCBjb3VudHMgZnJvbSAnLi9jb3VudHMuanMnXG5cbiAgZXhwb3J0IGxldCB0aXRsZSA9ICdMb25nZXN0LXNlcnZpbmcgVG9yb250byBjb3VuY2lsb3JzJ1xuICBleHBvcnQgbGV0IHN1YiA9ICcnXG4gIGxldCBtaW5UZXJtcyA9IDJcbjwvc2NyaXB0PlxuXG48ZGl2PlxuICA8SGVhZCB7dGl0bGV9IHtzdWJ9IC8+XG4gIDxkaXYgY2xhc3M9XCJjb250YWluZXJcIj5cbiAgICA8ZGl2IGNsYXNzPVwidGVybVwiPlxuICAgICAgPGRpdiBjbGFzcz1cInllYXJcIiBzdHlsZT1cInRleHQtYWxpZ246bGVmdDsgdGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZTtcIj4obWVnYWNpdHkpPC9kaXY+XG4gICAgICA8ZGl2IHN0eWxlPVwiZmxleC1ncm93OjFcIiAvPlxuICAgIDwvZGl2PlxuICAgIHsjZWFjaCBPYmplY3Qua2V5cyhkYXRhKSBhcyB5ZWFyfVxuICAgICAgeyNpZiB5ZWFyID09PSAnMjAxOCd9XG4gICAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOjMwcHg7XCIgLz5cbiAgICAgIHsvaWZ9XG4gICAgICB7I2lmIHllYXIgPT09ICcyMDAwJ31cbiAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6NDBweDtcIiAvPlxuICAgICAgey9pZn1cbiAgICAgIDxkaXYgY2xhc3M9XCJ0ZXJtXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ5ZWFyXCI+e3llYXJ9PC9kaXY+XG4gICAgICAgIHsjZWFjaCBkYXRhW1N0cmluZyh5ZWFyKV0gYXMgc3RyfVxuICAgICAgICAgIHsjaWYgY291bnRzW3N0cl0gPj0gbWluVGVybXN9XG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgIGNsYXNzPVwicGVyc29uIGhpZ2hsaWdodFwiXG4gICAgICAgICAgICAgIHN0eWxlPVwiYm9yZGVyLWxlZnQ6NHB4IHNvbGlkIHtieUNvbG9yW3N0cl19O1wiXG4gICAgICAgICAgICAgIHRpdGxlPXtzdHJ9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgIHs6ZWxzZX1cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwZXJzb25cIiB0aXRsZT17c3RyfSAvPlxuICAgICAgICAgIHsvaWZ9XG4gICAgICAgIHsvZWFjaH1cbiAgICAgICAgPGRpdiBjbGFzcz1cImFzaWRlXCI+XG4gICAgICAgICAgeyNpZiB5ZWFyID09PSAnMTk5NycgfHwgeWVhciA9PT0gJzIwMDAnIHx8IHllYXIgPT09ICcyMDE4J31cbiAgICAgICAgICAgIHtkYXRhW1N0cmluZyh5ZWFyKV0ubGVuZ3RofSBzZWF0c1xuICAgICAgICAgICAgPGJyIC8+XG4gICAgICAgICAgICDihpNcbiAgICAgICAgICB7L2lmfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIHsvZWFjaH1cbiAgPC9kaXY+XG4gIDxGb290IHt0aXRsZX0gLz5cbjwvZGl2PlxuXG48c3R5bGU+XG4gIC50ZXJtIHtcbiAgICBmbGV4OiAxO1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWFyb3VuZDtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgYWxpZ24tc2VsZjogc3RyZXRjaDtcbiAgICBib3gtc2l6aW5nOiBjb250ZW50LWJveDtcbiAgfVxuICAucGVyc29uIHtcbiAgICBtYXJnaW4tYm90dG9tOiAyMHB4O1xuICAgIG1pbi1oZWlnaHQ6IDEwMHB4O1xuICAgIGhlaWdodDogMTAwJTtcbiAgICBib3JkZXItbGVmdDogNHB4IHNvbGlkIGxpZ2h0Z3JleTtcbiAgICBib3gtc2l6aW5nOiBjb250ZW50LWJveDtcbiAgfVxuICAuaGlnaGxpZ2h0IHtcbiAgICBtYXJnaW4tYm90dG9tOiAwcHggIWltcG9ydGFudDtcbiAgICBtaW4taGVpZ2h0OiAxMjBweDtcbiAgICAvKiBib3gtc2hhZG93OiAycHggMnB4IDhweCAwcHggcmdiYSgwLCAwLCAwLCAwLjIpOyAqL1xuICB9XG4gIC5hc2lkZSB7XG4gICAgbWluLXdpZHRoOiAxMDBweDtcbiAgICBtYXgtd2lkdGg6IDEwMHB4O1xuICAgIGNvbG9yOiBncmV5O1xuICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgfVxuICAueWVhciB7XG4gICAgbWluLXdpZHRoOiA2MHB4O1xuICAgIG1heC13aWR0aDogNjBweDtcbiAgICBjb2xvcjogZ3JleTtcbiAgICBmb250LXNpemU6IDEycHg7XG4gICAgdGV4dC1hbGlnbjogbGVmdDtcbiAgICBhbGlnbi1zZWxmOiBmbGV4LXN0YXJ0O1xuICAgIC8qIHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lOyAqL1xuICB9XG4gIC5jb250YWluZXIge1xuICAgIG1hcmdpbjogM3JlbTtcbiAgICBwYWRkaW5nOiAzcmVtO1xuICAgIC8qIGJvcmRlcjogMXB4IHNvbGlkIGdyZXk7ICovXG4gICAgbWluLWhlaWdodDogODAwcHg7XG5cbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1hcm91bmQ7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgZmxleC13cmFwOiBub3dyYXA7XG4gICAgYWxpZ24tc2VsZjogc3RyZXRjaDtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFxREUsS0FBSyxjQUFDLENBQUMsQUFDTCxJQUFJLENBQUUsQ0FBQyxDQUNQLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLEdBQUcsQ0FDbkIsZUFBZSxDQUFFLFlBQVksQ0FDN0IsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsVUFBVSxDQUFFLE1BQU0sQ0FDbEIsU0FBUyxDQUFFLElBQUksQ0FDZixVQUFVLENBQUUsT0FBTyxDQUNuQixVQUFVLENBQUUsV0FBVyxBQUN6QixDQUFDLEFBQ0QsT0FBTyxjQUFDLENBQUMsQUFDUCxhQUFhLENBQUUsSUFBSSxDQUNuQixVQUFVLENBQUUsS0FBSyxDQUNqQixNQUFNLENBQUUsSUFBSSxDQUNaLFdBQVcsQ0FBRSxHQUFHLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FDaEMsVUFBVSxDQUFFLFdBQVcsQUFDekIsQ0FBQyxBQUNELFVBQVUsY0FBQyxDQUFDLEFBQ1YsYUFBYSxDQUFFLEdBQUcsQ0FBQyxVQUFVLENBQzdCLFVBQVUsQ0FBRSxLQUFLLEFBRW5CLENBQUMsQUFDRCxNQUFNLGNBQUMsQ0FBQyxBQUNOLFNBQVMsQ0FBRSxLQUFLLENBQ2hCLFNBQVMsQ0FBRSxLQUFLLENBQ2hCLEtBQUssQ0FBRSxJQUFJLENBQ1gsU0FBUyxDQUFFLElBQUksQUFDakIsQ0FBQyxBQUNELEtBQUssY0FBQyxDQUFDLEFBQ0wsU0FBUyxDQUFFLElBQUksQ0FDZixTQUFTLENBQUUsSUFBSSxDQUNmLEtBQUssQ0FBRSxJQUFJLENBQ1gsU0FBUyxDQUFFLElBQUksQ0FDZixVQUFVLENBQUUsSUFBSSxDQUNoQixVQUFVLENBQUUsVUFBVSxBQUV4QixDQUFDLEFBQ0QsVUFBVSxjQUFDLENBQUMsQUFDVixNQUFNLENBQUUsSUFBSSxDQUNaLE9BQU8sQ0FBRSxJQUFJLENBRWIsVUFBVSxDQUFFLEtBQUssQ0FFakIsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxDQUN0QixlQUFlLENBQUUsWUFBWSxDQUM3QixXQUFXLENBQUUsTUFBTSxDQUNuQixVQUFVLENBQUUsTUFBTSxDQUNsQixTQUFTLENBQUUsTUFBTSxDQUNqQixVQUFVLENBQUUsT0FBTyxBQUNyQixDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    // (21:6) {#if year === '2018'}
    function create_if_block_3(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			set_style(div, "margin-top", "30px");
    			add_location(div, file$2, 21, 8, 614);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(21:6) {#if year === '2018'}",
    		ctx
    	});

    	return block;
    }

    // (24:6) {#if year === '2000'}
    function create_if_block_2(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			set_style(div, "margin-top", "40px");
    			add_location(div, file$2, 24, 8, 695);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(24:6) {#if year === '2000'}",
    		ctx
    	});

    	return block;
    }

    // (36:10) {:else}
    function create_else_block$1(ctx) {
    	let div;
    	let div_title_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "person svelte-x9a7pn");
    			attr_dev(div, "title", div_title_value = /*str*/ ctx[6]);
    			add_location(div, file$2, 36, 12, 1073);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(36:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (30:10) {#if counts[str] >= minTerms}
    function create_if_block_1(ctx) {
    	let div;
    	let div_title_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "person highlight svelte-x9a7pn");
    			set_style(div, "border-left", "4px solid " + byColor[/*str*/ ctx[6]]);
    			attr_dev(div, "title", div_title_value = /*str*/ ctx[6]);
    			add_location(div, file$2, 30, 12, 898);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(30:10) {#if counts[str] >= minTerms}",
    		ctx
    	});

    	return block;
    }

    // (29:8) {#each data[String(year)] as str}
    function create_each_block_1(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (counts[/*str*/ ctx[6]] >= /*minTerms*/ ctx[2]) return create_if_block_1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if_block.p(ctx, dirty);
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(29:8) {#each data[String(year)] as str}",
    		ctx
    	});

    	return block;
    }

    // (41:10) {#if year === '1997' || year === '2000' || year === '2018'}
    function create_if_block$2(ctx) {
    	let t0_value = data[String(/*year*/ ctx[3])].length + "";
    	let t0;
    	let t1;
    	let br;
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = text(" seats\n            ");
    			br = element("br");
    			t2 = text("\n            ↓");
    			add_location(br, file$2, 42, 12, 1296);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(41:10) {#if year === '1997' || year === '2000' || year === '2018'}",
    		ctx
    	});

    	return block;
    }

    // (20:4) {#each Object.keys(data) as year}
    function create_each_block(ctx) {
    	let t0;
    	let t1;
    	let div2;
    	let div0;
    	let t2_value = /*year*/ ctx[3] + "";
    	let t2;
    	let t3;
    	let t4;
    	let div1;
    	let t5;
    	let if_block0 = /*year*/ ctx[3] === "2018" && create_if_block_3(ctx);
    	let if_block1 = /*year*/ ctx[3] === "2000" && create_if_block_2(ctx);
    	let each_value_1 = data[String(/*year*/ ctx[3])];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let if_block2 = (/*year*/ ctx[3] === "1997" || /*year*/ ctx[3] === "2000" || /*year*/ ctx[3] === "2018") && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			div2 = element("div");
    			div0 = element("div");
    			t2 = text(t2_value);
    			t3 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			div1 = element("div");
    			if (if_block2) if_block2.c();
    			t5 = space();
    			attr_dev(div0, "class", "year svelte-x9a7pn");
    			add_location(div0, file$2, 27, 8, 773);
    			attr_dev(div1, "class", "aside svelte-x9a7pn");
    			add_location(div1, file$2, 39, 8, 1148);
    			attr_dev(div2, "class", "term svelte-x9a7pn");
    			add_location(div2, file$2, 26, 6, 746);
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, t2);
    			append_dev(div2, t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append_dev(div2, t4);
    			append_dev(div2, div1);
    			if (if_block2) if_block2.m(div1, null);
    			append_dev(div2, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*byColor, data, String, Object, counts, minTerms*/ 4) {
    				each_value_1 = data[String(/*year*/ ctx[3])];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, t4);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}

    			if (/*year*/ ctx[3] === "1997" || /*year*/ ctx[3] === "2000" || /*year*/ ctx[3] === "2018") if_block2.p(ctx, dirty);
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    			if (if_block2) if_block2.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(20:4) {#each Object.keys(data) as year}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div4;
    	let head;
    	let t0;
    	let div3;
    	let div2;
    	let div0;
    	let t2;
    	let div1;
    	let t3;
    	let t4;
    	let foot;
    	let current;

    	head = new Head({
    			props: {
    				title: /*title*/ ctx[0],
    				sub: /*sub*/ ctx[1]
    			},
    			$$inline: true
    		});

    	let each_value = Object.keys(data);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	foot = new Foot({
    			props: { title: /*title*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			create_component(head.$$.fragment);
    			t0 = space();
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "(megacity)";
    			t2 = space();
    			div1 = element("div");
    			t3 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			create_component(foot.$$.fragment);
    			attr_dev(div0, "class", "year svelte-x9a7pn");
    			set_style(div0, "text-align", "left");
    			set_style(div0, "text-decoration", "underline");
    			add_location(div0, file$2, 16, 6, 408);
    			set_style(div1, "flex-grow", "1");
    			add_location(div1, file$2, 17, 6, 501);
    			attr_dev(div2, "class", "term svelte-x9a7pn");
    			add_location(div2, file$2, 15, 4, 383);
    			attr_dev(div3, "class", "container svelte-x9a7pn");
    			add_location(div3, file$2, 14, 2, 355);
    			add_location(div4, file$2, 12, 0, 322);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			mount_component(head, div4, null);
    			append_dev(div4, t0);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div3, t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}

    			append_dev(div4, t4);
    			mount_component(foot, div4, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const head_changes = {};
    			if (dirty & /*title*/ 1) head_changes.title = /*title*/ ctx[0];
    			if (dirty & /*sub*/ 2) head_changes.sub = /*sub*/ ctx[1];
    			head.$set(head_changes);

    			if (dirty & /*data, String, Object, byColor, counts, minTerms*/ 4) {
    				each_value = Object.keys(data);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div3, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			const foot_changes = {};
    			if (dirty & /*title*/ 1) foot_changes.title = /*title*/ ctx[0];
    			foot.$set(foot_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(head.$$.fragment, local);
    			transition_in(foot.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(head.$$.fragment, local);
    			transition_out(foot.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			destroy_component(head);
    			destroy_each(each_blocks, detaching);
    			destroy_component(foot);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Post", slots, []);
    	let { title = "Longest-serving Toronto councilors" } = $$props;
    	let { sub = "" } = $$props;
    	let minTerms = 2;
    	const writable_props = ["title", "sub"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    	};

    	$$self.$capture_state = () => ({
    		Head,
    		Foot,
    		byColor,
    		data,
    		counts,
    		title,
    		sub,
    		minTerms
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    		if ("minTerms" in $$props) $$invalidate(2, minTerms = $$props.minTerms);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, sub, minTerms];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-x9a7pn-style")) add_css$2();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { title: 0, sub: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get title() {
    		throw new Error("<Post>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Post>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get sub() {
    		throw new Error("<Post>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set sub(value) {
    		throw new Error("<Post>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    let name = '';
    // wire-in query params
    const URLSearchParams = window.URLSearchParams;
    if (typeof URLSearchParams !== undefined) {
      const urlParams = new URLSearchParams(window.location.search);
      const myParam = urlParams.get('name');
      if (myParam) {
        name = myParam;
      }
    }

    const app = new Post({
      target: document.body,
      props: {
        name: name,
      },
    });

    return app;

}());
