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
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
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
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
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

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
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

    var historical = [
      ['January 1991', 17459],
      ['February 1991', 15417],
      ['March 1991', 17052],
      ['April 1991', 16042],
      ['May 1991', 16414],
      ['June 1991', 15369],
      ['July 1991', 15636],
      ['August 1991', 15504],
      ['September 1991', 15189],
      ['October 1991', 16531],
      ['November 1991', 16413],
      ['December 1991', 18543],
      ['January 1992', 18353],
      ['February 1992', 16298],
      ['March 1992', 16785],
      ['April 1992', 15931],
      ['May 1992', 16404],
      ['June 1992', 15380],
      ['July 1992', 15837],
      ['August 1992', 15737],
      ['September 1992', 15316],
      ['October 1992', 16737],
      ['November 1992', 16349],
      ['December 1992', 17408],
      ['January 1993', 18441],
      ['February 1993', 16333],
      ['March 1993', 19430],
      ['April 1993', 17473],
      ['May 1993', 16955],
      ['June 1993', 15792],
      ['July 1993', 16125],
      ['August 1993', 16234],
      ['September 1993', 15776],
      ['October 1993', 17196],
      ['November 1993', 16709],
      ['December 1993', 18448],
      ['January 1994', 20954],
      ['February 1994', 17035],
      ['March 1994', 17860],
      ['April 1994', 16589],
      ['May 1994', 16930],
      ['June 1994', 16609],
      ['July 1994', 16569],
      ['August 1994', 15919],
      ['September 1994', 16118],
      ['October 1994', 17274],
      ['November 1994', 16981],
      ['December 1994', 18239],
      ['January 1995', 19005],
      ['February 1995', 17766],
      ['March 1995', 19552],
      ['April 1995', 17785],
      ['May 1995', 17781],
      ['June 1995', 16399],
      ['July 1995', 16788],
      ['August 1995', 16403],
      ['September 1995', 16028],
      ['October 1995', 17306],
      ['November 1995', 17244],
      ['December 1995', 18676],
      ['January 1996', 19534],
      ['February 1996', 17805],
      ['March 1996', 18623],
      ['April 1996', 17547],
      ['May 1996', 17460],
      ['June 1996', 16352],
      ['July 1996', 16753],
      ['August 1996', 16739],
      ['September 1996', 16405],
      ['October 1996', 18001],
      ['November 1996', 17784],
      ['December 1996', 19877],
      ['January 1997', 21617],
      ['February 1997', 17840],
      ['March 1997', 19652],
      ['April 1997', 17998],
      ['May 1997', 17859],
      ['June 1997', 16696],
      ['July 1997', 16782],
      ['August 1997', 16593],
      ['September 1997', 16311],
      ['October 1997', 17880],
      ['November 1997', 17536],
      ['December 1997', 18905],
      ['January 1998', 20578],
      ['February 1998', 20015],
      ['March 1998', 21144],
      ['April 1998', 17706],
      ['May 1998', 17673],
      ['June 1998', 16565],
      ['July 1998', 16866],
      ['August 1998', 16763],
      ['September 1998', 16318],
      ['October 1998', 17730],
      ['November 1998', 17672],
      ['December 1998', 19061],
      ['January 1999', 21207],
      ['February 1999', 19678],
      ['March 1999', 20347],
      ['April 1999', 17551],
      ['May 1999', 17827],
      ['June 1999', 16612],
      ['July 1999', 16950],
      ['August 1999', 16810],
      ['September 1999', 16445],
      ['October 1999', 18057],
      ['November 1999', 17741],
      ['December 1999', 20305],
      ['January 2000', 22661],
      ['February 2000', 17923],
      ['March 2000', 18428],
      ['April 2000', 17326],
      ['May 2000', 17673],
      ['June 2000', 16910],
      ['July 2000', 17362],
      ['August 2000', 16962],
      ['September 2000', 16868],
      ['October 2000', 18299],
      ['November 2000', 17898],
      ['December 2000', 19752],
      ['January 2001', 20429],
      ['February 2001', 18046],
      ['March 2001', 19511],
      ['April 2001', 18170],
      ['May 2001', 18215],
      ['June 2001', 17602],
      ['July 2001', 17541],
      ['August 2001', 17676],
      ['September 2001', 16942],
      ['October 2001', 18524],
      ['November 2001', 17872],
      ['December 2001', 19010],
      ['January 2002', 20165],
      ['February 2002', 18546],
      ['March 2002', 20088],
      ['April 2002', 18314],
      ['May 2002', 18542],
      ['June 2002', 17274],
      ['July 2002', 18448],
      ['August 2002', 17983],
      ['September 2002', 17010],
      ['October 2002', 18414],
      ['November 2002', 18733],
      ['December 2002', 20086],
      ['January 2003', 20621],
      ['February 2003', 17850],
      ['March 2003', 19919],
      ['April 2003', 18414],
      ['May 2003', 18575],
      ['June 2003', 17852],
      ['July 2003', 17922],
      ['August 2003', 17961],
      ['September 2003', 17528],
      ['October 2003', 19291],
      ['November 2003', 18984],
      ['December 2003', 21252],
      ['January 2004', 21796],
      ['February 2004', 19343],
      ['March 2004', 19913],
      ['April 2004', 18935],
      ['May 2004', 18152],
      ['June 2004', 17752],
      ['July 2004', 17921],
      ['August 2004', 17313],
      ['September 2004', 17547],
      ['October 2004', 19204],
      ['November 2004', 18507],
      ['December 2004', 20201],
      ['January 2005', 22604],
      ['February 2005', 19657],
      ['March 2005', 20854],
      ['April 2005', 19173],
      ['May 2005', 19132],
      ['June 2005', 17793],
      ['July 2005', 18119],
      ['August 2005', 17980],
      ['September 2005', 17353],
      ['October 2005', 18850],
      ['November 2005', 18638],
      ['December 2005', 19979],
      ['January 2006', 20120],
      ['February 2006', 18388],
      ['March 2006', 20350],
      ['April 2006', 18786],
      ['May 2006', 19143],
      ['June 2006', 17783],
      ['July 2006', 18043],
      ['August 2006', 18237],
      ['September 2006', 17926],
      ['October 2006', 19652],
      ['November 2006', 19126],
      ['December 2006', 20525],
      ['January 2007', 21924],
      ['February 2007', 20217],
      ['March 2007', 21328],
      ['April 2007', 19393],
      ['May 2007', 19284],
      ['June 2007', 18170],
      ['July 2007', 18717],
      ['August 2007', 18156],
      ['September 2007', 18165],
      ['October 2007', 19162],
      ['November 2007', 19331],
      ['December 2007', 21370],
      ['January 2008', 21310],
      ['February 2008', 19988],
      ['March 2008', 21586],
      ['April 2008', 20678],
      ['May 2008', 19811],
      ['June 2008', 18251],
      ['July 2008', 18705],
      ['August 2008', 18544],
      ['September 2008', 18397],
      ['October 2008', 20135],
      ['November 2008', 19905],
      ['December 2008', 21307],
      ['January 2009', 22250],
      ['February 2009', 19233],
      ['March 2009', 21141],
      ['April 2009', 19629],
      ['May 2009', 19891],
      ['June 2009', 18571],
      ['July 2009', 18735],
      ['August 2009', 18813],
      ['September 2009', 18351],
      ['October 2009', 20569],
      ['November 2009', 20250],
      ['December 2009', 20985],
      ['January 2010', 21316],
      ['February 2010', 18908],
      ['March 2010', 20953],
      ['April 2010', 19944],
      ['May 2010', 19830],
      ['June 2010', 18484],
      ['July 2010', 19554],
      ['August 2010', 19113],
      ['September 2010', 19061],
      ['October 2010', 20937],
      ['November 2010', 19997],
      ['December 2010', 21978],
      ['January 2011', 23150],
      ['February 2011', 20204],
      ['March 2011', 21967],
      ['April 2011', 20350],
      ['May 2011', 20208],
      ['June 2011', 18976],
      ['July 2011', 19295],
      ['August 2011', 19137],
      ['September 2011', 18772],
      ['October 2011', 20280],
      ['November 2011', 20012],
      ['December 2011', 21160],
      ['January 2012', 22399],
      ['February 2012', 20178],
      ['March 2012', 21467],
      ['April 2012', 20407],
      ['May 2012', 20382],
      ['June 2012', 18921],
      ['July 2012', 19482],
      ['August 2012', 19742],
      ['September 2012', 19118],
      ['October 2012', 20786],
      ['November 2012', 20380],
      ['December 2012', 23334],
      ['January 2013', 25596],
      ['February 2013', 20730],
      ['March 2013', 21832],
      ['April 2013', 20882],
      ['May 2013', 20603],
      ['June 2013', 19171],
      ['July 2013', 20087],
      ['August 2013', 19561],
      ['September 2013', 19355],
      ['October 2013', 20852],
      ['November 2013', 20857],
      ['December 2013', 22812],
      ['January 2014', 23808],
      ['February 2014', 20563],
      ['March 2014', 22530],
      ['April 2014', 21378],
      ['May 2014', 21316],
      ['June 2014', 19933],
      ['July 2014', 20027],
      ['August 2014', 20350],
      ['September 2014', 20494],
      ['October 2014', 21771],
      ['November 2014', 21977],
      ['December 2014', 24674],
      ['January 2015', 26946],
      ['February 2015', 22453],
      ['March 2015', 23758],
      ['April 2015', 22073],
      ['May 2015', 21827],
      ['June 2015', 19811],
      ['July 2015', 20451],
      ['August 2015', 20323],
      ['September 2015', 20189],
      ['October 2015', 22284],
      ['November 2015', 21415],
      ['December 2015', 22803],
      ['January 2016', 23719],
      ['February 2016', 22273],
      ['March 2016', 23950],
      ['April 2016', 22271],
      ['May 2016', 22008],
      ['June 2016', 20401],
      ['July 2016', 20850],
      ['August 2016', 21235],
      ['September 2016', 20783],
      ['October 2016', 22952],
      ['November 2016', 22349],
      ['December 2016', 24422],
      ['January 2017', 27177],
      ['February 2017', 23225],
      ['March 2017', 24641],
      ['April 2017', 22590],
      ['May 2017', 22484],
      ['June 2017', 20992],
      ['July 2017', 21503],
      ['August 2017', 21578],
      ['September 2017', 21451],
      ['October 2017', 22774],
      ['November 2017', 23133],
      ['December 2017', 25141],
      ['January 2018', 28814],
      ['February 2018', 24061],
      ['March 2018', 25271],
      ['April 2018', 23547],
      ['May 2018', 22975],
      ['June 2018', 21654],
      ['July 2018', 21941],
      ['August 2018', 21865],
      ['September 2018', 21842],
      ['October 2018', 23664],
      ['November 2018', 23403],
      ['December 2018', 24669],
    ];

    function noop$1() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location$1(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run$1(fn) {
        return fn();
    }
    function blank_object$1() {
        return Object.create(null);
    }
    function run_all$1(fns) {
        fns.forEach(run$1);
    }
    function is_function$1(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal$1(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty$1(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop$1;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }

    function append$1(target, node) {
        target.appendChild(node);
    }
    function insert$1(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach$1(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each$1(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element$1(name) {
        return document.createElement(name);
    }
    function text$1(data) {
        return document.createTextNode(data);
    }
    function space$1() {
        return text$1(' ');
    }
    function attr$1(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children$1(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event$1(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component$1;
    function set_current_component$1(component) {
        current_component$1 = component;
    }
    function get_current_component() {
        if (!current_component$1)
            throw new Error(`Function called outside component initialization`);
        return current_component$1;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }

    const dirty_components$1 = [];
    const binding_callbacks$1 = [];
    const render_callbacks$1 = [];
    const flush_callbacks$1 = [];
    const resolved_promise$1 = Promise.resolve();
    let update_scheduled$1 = false;
    function schedule_update$1() {
        if (!update_scheduled$1) {
            update_scheduled$1 = true;
            resolved_promise$1.then(flush$1);
        }
    }
    function add_render_callback$1(fn) {
        render_callbacks$1.push(fn);
    }
    let flushing$1 = false;
    const seen_callbacks$1 = new Set();
    function flush$1() {
        if (flushing$1)
            return;
        flushing$1 = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components$1.length; i += 1) {
                const component = dirty_components$1[i];
                set_current_component$1(component);
                update$1(component.$$);
            }
            dirty_components$1.length = 0;
            while (binding_callbacks$1.length)
                binding_callbacks$1.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks$1.length; i += 1) {
                const callback = render_callbacks$1[i];
                if (!seen_callbacks$1.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks$1.add(callback);
                    callback();
                }
            }
            render_callbacks$1.length = 0;
        } while (dirty_components$1.length);
        while (flush_callbacks$1.length) {
            flush_callbacks$1.pop()();
        }
        update_scheduled$1 = false;
        flushing$1 = false;
        seen_callbacks$1.clear();
    }
    function update$1($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all$1($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback$1);
        }
    }
    const outroing$1 = new Set();
    let outros$1;
    function transition_in$1(block, local) {
        if (block && block.i) {
            outroing$1.delete(block);
            block.i(local);
        }
    }
    function transition_out$1(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing$1.has(block))
                return;
            outroing$1.add(block);
            outros$1.c.push(() => {
                outroing$1.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals$1 = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component$1(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback$1(() => {
            const new_on_destroy = on_mount.map(run$1).filter(is_function$1);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all$1(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback$1);
    }
    function destroy_component$1(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all$1($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty$1(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components$1.push(component);
            schedule_update$1();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init$1(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component$1;
        set_current_component$1(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop$1,
            not_equal,
            bound: blank_object$1(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object$1(),
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
                        make_dirty$1(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all$1($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children$1(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach$1);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in$1(component.$$.fragment);
            mount_component$1(component, options.target, options.anchor);
            flush$1();
        }
        set_current_component$1(parent_component);
    }
    class SvelteComponent$1 {
        $destroy() {
            destroy_component$1(this, 1);
            this.$destroy = noop$1;
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
            if (this.$$set && !is_empty$1($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev$1(type, detail) {
        document.dispatchEvent(custom_event$1(type, Object.assign({ version: '3.24.1' }, detail)));
    }
    function append_dev$1(target, node) {
        dispatch_dev$1("SvelteDOMInsert", { target, node });
        append$1(target, node);
    }
    function insert_dev$1(target, node, anchor) {
        dispatch_dev$1("SvelteDOMInsert", { target, node, anchor });
        insert$1(target, node, anchor);
    }
    function detach_dev$1(node) {
        dispatch_dev$1("SvelteDOMRemove", { node });
        detach$1(node);
    }
    function attr_dev$1(node, attribute, value) {
        attr$1(node, attribute, value);
        if (value == null)
            dispatch_dev$1("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev$1("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev$1(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev$1("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument$1(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots$1(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev$1 extends SvelteComponent$1 {
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

    const getMax = function (arr) {
      let max = arr[0];
      for (let i = 1; i < arr.length; ++i) {
        if (arr[i] > max) {
          max = arr[i];
        }
      }
      return max
    };

    const linear = function (obj) {
      let world = obj.world || [];
      let minmax = obj.minmax || obj.minMax || [];
      const calc = (num) => {
        let range = minmax[1] - minmax[0];
        let percent = (num - minmax[0]) / range;
        let size = world[1] - world[0];
        return size * percent
      };

      return calc
    };

    const layout = function (arr, max) {
      // compuate a stacked layout
      // if (arr && arr[0] && arr[0].stack) {
      //   return layoutByStack(arr, max)
      // }
      max = max || getMax(arr.map((a) => a.value));
      let scale = linear({
        world: [0, 100],
        minmax: [0, max]
      });
      let percent = 1 / arr.length;
      arr.forEach((o) => {
        o.size = scale(o.value);
        o.share = percent * 100;
        o.already = 0;
      });
      // convert to stacked format
      // arr = arr.map((o) => [o])
      return arr
    };

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop$1) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal$1(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop$1) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop$1;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    /* Users/spencer/mountain/somehow-barchart/src/Vertical.svelte generated by Svelte v3.29.0 */

    const { console: console_1 } = globals$1;
    const file$2 = "Users/spencer/mountain/somehow-barchart/src/Vertical.svelte";

    function add_css$2() {
    	var style = element$1("style");
    	style.id = "svelte-1vakm3c-style";
    	style.textContent = ".barchart.svelte-1vakm3c{position:relative;width:100%;display:flex;flex-direction:row;justify-content:flex-start;align-items:flex-start;text-align:right;flex-wrap:nowrap;align-self:stretch;min-height:50px}.item.svelte-1vakm3c{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-align:center;flex-wrap:nowrap;align-self:stretch;margin:5px}.label.svelte-1vakm3c{color:#a6a4a4;min-height:20px;max-height:20px;font-size:12px;width:100%;flex:1;margin-top:0.5rem;text-align:center;opacity:0.7}.bar.svelte-1vakm3c{align-self:center;min-width:20px;width:100%;margin-top:5px;border-radius:2px;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2)}.bar.svelte-1vakm3c:hover{box-shadow:2px 2px 8px 0px steelblue}.container.svelte-1vakm3c{height:100%;width:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}.title.svelte-1vakm3c{position:relative;color:#949a9e;font-size:0.7rem;margin-bottom:0.3rem}.value.svelte-1vakm3c{color:#949a9e;opacity:0.5;font-size:0.5rem}.axis.svelte-1vakm3c{height:90%;top:5%;width:2px;margin-right:5px;background-color:lightgrey}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVmVydGljYWwuc3ZlbHRlIiwic291cmNlcyI6WyJWZXJ0aWNhbC5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbiAgaW1wb3J0IHsgc2V0Q29udGV4dCwgb25Nb3VudCB9IGZyb20gJ3N2ZWx0ZSdcbiAgaW1wb3J0IGxheW91dCBmcm9tICcuL2xheW91dCdcbiAgaW1wb3J0IHsgd3JpdGFibGUgfSBmcm9tICdzdmVsdGUvc3RvcmUnXG4gIGV4cG9ydCBjb25zdCBiYXJzID0gd3JpdGFibGUoW10pXG4gIHNldENvbnRleHQoJ2JhcnMnLCBiYXJzKVxuXG4gIGV4cG9ydCBsZXQgbGFiZWwgPSAnJ1xuICBleHBvcnQgbGV0IG1heCA9IG51bGxcbiAgZXhwb3J0IGxldCBheGlzID0gZmFsc2VcbiAgZXhwb3J0IGxldCBoZWlnaHQgPSAnMTAwJSdcbiAgZXhwb3J0IGxldCBudW1iZXJzID0gZmFsc2VcblxuICBsZXQgYXJyID0gW11cbiAgb25Nb3VudCgoKSA9PiB7XG4gICAgYXJyID0gbGF5b3V0KCRiYXJzLCBtYXgpXG4gICAgY29uc29sZS5sb2coYXJyKVxuICB9KVxuPC9zY3JpcHQ+XG5cbjxzdHlsZT5cbiAgLmJhcmNoYXJ0IHtcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcbiAgICB0ZXh0LWFsaWduOiByaWdodDtcbiAgICBmbGV4LXdyYXA6IG5vd3JhcDtcbiAgICBhbGlnbi1zZWxmOiBzdHJldGNoO1xuICAgIG1pbi1oZWlnaHQ6IDUwcHg7XG4gIH1cbiAgLml0ZW0ge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgLyogZmxleDogMTsgKi9cbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgIGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgZmxleC13cmFwOiBub3dyYXA7XG4gICAgLyogZmxleC1ncm93OiAxOyAqL1xuICAgIGFsaWduLXNlbGY6IHN0cmV0Y2g7XG4gICAgbWFyZ2luOiA1cHg7XG4gICAgLyogb3ZlcmZsb3c6IGhpZGRlbjsgKi9cbiAgfVxuICAubGFiZWwge1xuICAgIGNvbG9yOiAjYTZhNGE0O1xuICAgIG1pbi1oZWlnaHQ6IDIwcHg7XG4gICAgbWF4LWhlaWdodDogMjBweDtcbiAgICBmb250LXNpemU6IDEycHg7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgZmxleDogMTtcbiAgICBtYXJnaW4tdG9wOiAwLjVyZW07XG4gICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIG9wYWNpdHk6IDAuNztcbiAgfVxuICAuYmFyIHtcbiAgICBhbGlnbi1zZWxmOiBjZW50ZXI7XG4gICAgbWluLXdpZHRoOiAyMHB4O1xuICAgIHdpZHRoOiAxMDAlO1xuICAgIG1hcmdpbi10b3A6IDVweDtcbiAgICBib3JkZXItcmFkaXVzOiAycHg7XG4gICAgYm94LXNoYWRvdzogMnB4IDJweCA4cHggMHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcbiAgfVxuICAuYmFyOmhvdmVyIHtcbiAgICBib3gtc2hhZG93OiAycHggMnB4IDhweCAwcHggc3RlZWxibHVlO1xuICB9XG4gIC5jb250YWluZXIge1xuICAgIGhlaWdodDogMTAwJTtcbiAgICB3aWR0aDogMTAwJTtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gIH1cbiAgLnRpdGxlIHtcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgY29sb3I6ICM5NDlhOWU7XG4gICAgZm9udC1zaXplOiAwLjdyZW07XG4gICAgbWFyZ2luLWJvdHRvbTogMC4zcmVtO1xuICB9XG4gIC52YWx1ZSB7XG4gICAgY29sb3I6ICM5NDlhOWU7XG4gICAgb3BhY2l0eTogMC41O1xuICAgIGZvbnQtc2l6ZTogMC41cmVtO1xuICB9XG4gIC5heGlzIHtcbiAgICBoZWlnaHQ6IDkwJTtcbiAgICB0b3A6IDUlO1xuICAgIHdpZHRoOiAycHg7XG4gICAgbWFyZ2luLXJpZ2h0OiA1cHg7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogbGlnaHRncmV5O1xuICB9XG48L3N0eWxlPlxuXG48ZGl2IGNsYXNzPVwiY29udGFpbmVyXCIgc3R5bGU9XCJoZWlnaHQ6e2hlaWdodH07XCI+XG4gIHsjaWYgbGFiZWx9XG4gICAgPGRpdiBjbGFzcz1cInRpdGxlXCI+e2xhYmVsfTwvZGl2PlxuICB7L2lmfVxuICA8ZGl2IGNsYXNzPVwiYmFyY2hhcnRcIiBzdHlsZT1cIndpZHRoOjEwMCU7IGhlaWdodDoxMDAlO1wiPlxuICAgIHsjaWYgYXhpc31cbiAgICAgIDxkaXYgY2xhc3M9XCJheGlzXCIgLz5cbiAgICB7L2lmfVxuICAgIDwhLS0geyNlYWNoIGFyciBhcyBzdGFja30gLS0+XG4gICAgeyNlYWNoIGFyciBhcyBiYXJ9XG4gICAgICA8ZGl2IGNsYXNzPVwiaXRlbVwiIHN0eWxlPVwibWF4LXdpZHRoOntiYXIuc2hhcmV9JTsgbWluLXdpZHRoOntiYXIuc2hhcmV9JTtcIj5cbiAgICAgICAgeyNpZiBudW1iZXJzfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJ2YWx1ZVwiPntiYXIudmFsdWV9PC9kaXY+XG4gICAgICAgIHsvaWZ9XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBjbGFzcz1cImJhclwiXG4gICAgICAgICAgdGl0bGU9e2Jhci50aXRsZX1cbiAgICAgICAgICBzdHlsZT1cImJhY2tncm91bmQtY29sb3I6e2Jhci5jb2xvcn07IGhlaWdodDp7YmFyLnNpemV9JTsgXCIgLz5cbiAgICAgICAgPGRpdiBjbGFzcz1cImxhYmVsXCIgc3R5bGU9XCJjb2xvcjp7YmFyLmNvbG9yfTtcIj57YmFyLmxhYmVsIHx8ICcnfTwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8IS0tIHsvZWFjaH0gLS0+XG4gICAgey9lYWNofVxuICA8L2Rpdj5cbjwvZGl2PlxuPHNsb3QgLz5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFxQkUsU0FBUyxlQUFDLENBQUMsQUFDVCxRQUFRLENBQUUsUUFBUSxDQUNsQixLQUFLLENBQUUsSUFBSSxDQUNYLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLEdBQUcsQ0FDbkIsZUFBZSxDQUFFLFVBQVUsQ0FDM0IsV0FBVyxDQUFFLFVBQVUsQ0FDdkIsVUFBVSxDQUFFLEtBQUssQ0FDakIsU0FBUyxDQUFFLE1BQU0sQ0FDakIsVUFBVSxDQUFFLE9BQU8sQ0FDbkIsVUFBVSxDQUFFLElBQUksQUFDbEIsQ0FBQyxBQUNELEtBQUssZUFBQyxDQUFDLEFBQ0wsT0FBTyxDQUFFLElBQUksQ0FFYixjQUFjLENBQUUsTUFBTSxDQUN0QixlQUFlLENBQUUsUUFBUSxDQUN6QixXQUFXLENBQUUsTUFBTSxDQUNuQixVQUFVLENBQUUsTUFBTSxDQUNsQixTQUFTLENBQUUsTUFBTSxDQUVqQixVQUFVLENBQUUsT0FBTyxDQUNuQixNQUFNLENBQUUsR0FBRyxBQUViLENBQUMsQUFDRCxNQUFNLGVBQUMsQ0FBQyxBQUNOLEtBQUssQ0FBRSxPQUFPLENBQ2QsVUFBVSxDQUFFLElBQUksQ0FDaEIsVUFBVSxDQUFFLElBQUksQ0FDaEIsU0FBUyxDQUFFLElBQUksQ0FDZixLQUFLLENBQUUsSUFBSSxDQUNYLElBQUksQ0FBRSxDQUFDLENBQ1AsVUFBVSxDQUFFLE1BQU0sQ0FDbEIsVUFBVSxDQUFFLE1BQU0sQ0FDbEIsT0FBTyxDQUFFLEdBQUcsQUFDZCxDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixVQUFVLENBQUUsTUFBTSxDQUNsQixTQUFTLENBQUUsSUFBSSxDQUNmLEtBQUssQ0FBRSxJQUFJLENBQ1gsVUFBVSxDQUFFLEdBQUcsQ0FDZixhQUFhLENBQUUsR0FBRyxDQUNsQixVQUFVLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEFBQ2hELENBQUMsQUFDRCxtQkFBSSxNQUFNLEFBQUMsQ0FBQyxBQUNWLFVBQVUsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxBQUN2QyxDQUFDLEFBQ0QsVUFBVSxlQUFDLENBQUMsQUFDVixNQUFNLENBQUUsSUFBSSxDQUNaLEtBQUssQ0FBRSxJQUFJLENBQ1gsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxDQUN0QixlQUFlLENBQUUsTUFBTSxDQUN2QixXQUFXLENBQUUsTUFBTSxDQUNuQixVQUFVLENBQUUsTUFBTSxBQUNwQixDQUFDLEFBQ0QsTUFBTSxlQUFDLENBQUMsQUFDTixRQUFRLENBQUUsUUFBUSxDQUNsQixLQUFLLENBQUUsT0FBTyxDQUNkLFNBQVMsQ0FBRSxNQUFNLENBQ2pCLGFBQWEsQ0FBRSxNQUFNLEFBQ3ZCLENBQUMsQUFDRCxNQUFNLGVBQUMsQ0FBQyxBQUNOLEtBQUssQ0FBRSxPQUFPLENBQ2QsT0FBTyxDQUFFLEdBQUcsQ0FDWixTQUFTLENBQUUsTUFBTSxBQUNuQixDQUFDLEFBQ0QsS0FBSyxlQUFDLENBQUMsQUFDTCxNQUFNLENBQUUsR0FBRyxDQUNYLEdBQUcsQ0FBRSxFQUFFLENBQ1AsS0FBSyxDQUFFLEdBQUcsQ0FDVixZQUFZLENBQUUsR0FBRyxDQUNqQixnQkFBZ0IsQ0FBRSxTQUFTLEFBQzdCLENBQUMifQ== */";
    	append_dev$1(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    // (99:2) {#if label}
    function create_if_block_2(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			t = text$1(/*label*/ ctx[1]);
    			attr_dev$1(div, "class", "title svelte-1vakm3c");
    			add_location$1(div, file$2, 99, 4, 1955);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);
    			append_dev$1(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*label*/ 2) set_data_dev$1(t, /*label*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(99:2) {#if label}",
    		ctx
    	});

    	return block;
    }

    // (103:4) {#if axis}
    function create_if_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			attr_dev$1(div, "class", "axis svelte-1vakm3c");
    			add_location$1(div, file$2, 103, 6, 2075);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(103:4) {#if axis}",
    		ctx
    	});

    	return block;
    }

    // (109:8) {#if numbers}
    function create_if_block$2(ctx) {
    	let div;
    	let t_value = /*bar*/ ctx[10].value + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			t = text$1(t_value);
    			attr_dev$1(div, "class", "value svelte-1vakm3c");
    			add_location$1(div, file$2, 109, 10, 2276);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);
    			append_dev$1(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*arr*/ 32 && t_value !== (t_value = /*bar*/ ctx[10].value + "")) set_data_dev$1(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(109:8) {#if numbers}",
    		ctx
    	});

    	return block;
    }

    // (107:4) {#each arr as bar}
    function create_each_block(ctx) {
    	let div2;
    	let t0;
    	let div0;
    	let div0_title_value;
    	let t1;
    	let div1;
    	let t2_value = (/*bar*/ ctx[10].label || "") + "";
    	let t2;
    	let t3;
    	let if_block = /*numbers*/ ctx[4] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			div2 = element$1("div");
    			if (if_block) if_block.c();
    			t0 = space$1();
    			div0 = element$1("div");
    			t1 = space$1();
    			div1 = element$1("div");
    			t2 = text$1(t2_value);
    			t3 = space$1();
    			attr_dev$1(div0, "class", "bar svelte-1vakm3c");
    			attr_dev$1(div0, "title", div0_title_value = /*bar*/ ctx[10].title);
    			set_style(div0, "background-color", /*bar*/ ctx[10].color);
    			set_style(div0, "height", /*bar*/ ctx[10].size + "%");
    			add_location$1(div0, file$2, 111, 8, 2335);
    			attr_dev$1(div1, "class", "label svelte-1vakm3c");
    			set_style(div1, "color", /*bar*/ ctx[10].color);
    			add_location$1(div1, file$2, 115, 8, 2470);
    			attr_dev$1(div2, "class", "item svelte-1vakm3c");
    			set_style(div2, "max-width", /*bar*/ ctx[10].share + "%");
    			set_style(div2, "min-width", /*bar*/ ctx[10].share + "%");
    			add_location$1(div2, file$2, 107, 6, 2169);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div2, anchor);
    			if (if_block) if_block.m(div2, null);
    			append_dev$1(div2, t0);
    			append_dev$1(div2, div0);
    			append_dev$1(div2, t1);
    			append_dev$1(div2, div1);
    			append_dev$1(div1, t2);
    			insert_dev$1(target, t3, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*numbers*/ ctx[4]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(div2, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*arr*/ 32 && div0_title_value !== (div0_title_value = /*bar*/ ctx[10].title)) {
    				attr_dev$1(div0, "title", div0_title_value);
    			}

    			if (dirty & /*arr*/ 32) {
    				set_style(div0, "background-color", /*bar*/ ctx[10].color);
    			}

    			if (dirty & /*arr*/ 32) {
    				set_style(div0, "height", /*bar*/ ctx[10].size + "%");
    			}

    			if (dirty & /*arr*/ 32 && t2_value !== (t2_value = (/*bar*/ ctx[10].label || "") + "")) set_data_dev$1(t2, t2_value);

    			if (dirty & /*arr*/ 32) {
    				set_style(div1, "color", /*bar*/ ctx[10].color);
    			}

    			if (dirty & /*arr*/ 32) {
    				set_style(div2, "max-width", /*bar*/ ctx[10].share + "%");
    			}

    			if (dirty & /*arr*/ 32) {
    				set_style(div2, "min-width", /*bar*/ ctx[10].share + "%");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div2);
    			if (if_block) if_block.d();
    			if (detaching) detach_dev$1(t3);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(107:4) {#each arr as bar}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div1;
    	let t0;
    	let div0;
    	let t1;
    	let t2;
    	let current;
    	let if_block0 = /*label*/ ctx[1] && create_if_block_2(ctx);
    	let if_block1 = /*axis*/ ctx[2] && create_if_block_1(ctx);
    	let each_value = /*arr*/ ctx[5];
    	validate_each_argument$1(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const default_slot_template = /*#slots*/ ctx[8].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[7], null);

    	const block = {
    		c: function create() {
    			div1 = element$1("div");
    			if (if_block0) if_block0.c();
    			t0 = space$1();
    			div0 = element$1("div");
    			if (if_block1) if_block1.c();
    			t1 = space$1();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space$1();
    			if (default_slot) default_slot.c();
    			attr_dev$1(div0, "class", "barchart svelte-1vakm3c");
    			set_style(div0, "width", "100%");
    			set_style(div0, "height", "100%");
    			add_location$1(div0, file$2, 101, 2, 1998);
    			attr_dev$1(div1, "class", "container svelte-1vakm3c");
    			set_style(div1, "height", /*height*/ ctx[3]);
    			add_location$1(div1, file$2, 97, 0, 1888);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div1, anchor);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev$1(div1, t0);
    			append_dev$1(div1, div0);
    			if (if_block1) if_block1.m(div0, null);
    			append_dev$1(div0, t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			insert_dev$1(target, t2, anchor);

    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*label*/ ctx[1]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					if_block0.m(div1, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*axis*/ ctx[2]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(div0, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*arr, numbers*/ 48) {
    				each_value = /*arr*/ ctx[5];
    				validate_each_argument$1(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (!current || dirty & /*height*/ 8) {
    				set_style(div1, "height", /*height*/ ctx[3]);
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 128) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[7], dirty, null, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in$1(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out$1(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div1);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			destroy_each$1(each_blocks, detaching);
    			if (detaching) detach_dev$1(t2);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $bars,
    		$$unsubscribe_bars = noop$1,
    		$$subscribe_bars = () => ($$unsubscribe_bars(), $$unsubscribe_bars = subscribe(bars, $$value => $$invalidate(9, $bars = $$value)), bars);

    	$$self.$$.on_destroy.push(() => $$unsubscribe_bars());
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots$1("Vertical", slots, ['default']);
    	const bars = writable([]);
    	validate_store(bars, "bars");
    	$$subscribe_bars();
    	setContext("bars", bars);
    	let { label = "" } = $$props;
    	let { max = null } = $$props;
    	let { axis = false } = $$props;
    	let { height = "100%" } = $$props;
    	let { numbers = false } = $$props;
    	let arr = [];

    	onMount(() => {
    		$$invalidate(5, arr = layout($bars, max));
    		console.log(arr);
    	});

    	const writable_props = ["label", "max", "axis", "height", "numbers"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Vertical> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("label" in $$props) $$invalidate(1, label = $$props.label);
    		if ("max" in $$props) $$invalidate(6, max = $$props.max);
    		if ("axis" in $$props) $$invalidate(2, axis = $$props.axis);
    		if ("height" in $$props) $$invalidate(3, height = $$props.height);
    		if ("numbers" in $$props) $$invalidate(4, numbers = $$props.numbers);
    		if ("$$scope" in $$props) $$invalidate(7, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		setContext,
    		onMount,
    		layout,
    		writable,
    		bars,
    		label,
    		max,
    		axis,
    		height,
    		numbers,
    		arr,
    		$bars
    	});

    	$$self.$inject_state = $$props => {
    		if ("label" in $$props) $$invalidate(1, label = $$props.label);
    		if ("max" in $$props) $$invalidate(6, max = $$props.max);
    		if ("axis" in $$props) $$invalidate(2, axis = $$props.axis);
    		if ("height" in $$props) $$invalidate(3, height = $$props.height);
    		if ("numbers" in $$props) $$invalidate(4, numbers = $$props.numbers);
    		if ("arr" in $$props) $$invalidate(5, arr = $$props.arr);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [bars, label, axis, height, numbers, arr, max, $$scope, slots];
    }

    class Vertical extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1vakm3c-style")) add_css$2();

    		init$1(this, options, instance$2, create_fragment$2, safe_not_equal$1, {
    			bars: 0,
    			label: 1,
    			max: 6,
    			axis: 2,
    			height: 3,
    			numbers: 4
    		});

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Vertical",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get bars() {
    		return this.$$.ctx[0];
    	}

    	set bars(value) {
    		throw new Error("<Vertical>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label() {
    		throw new Error("<Vertical>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<Vertical>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get max() {
    		throw new Error("<Vertical>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set max(value) {
    		throw new Error("<Vertical>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get axis() {
    		throw new Error("<Vertical>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set axis(value) {
    		throw new Error("<Vertical>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Vertical>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Vertical>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get numbers() {
    		throw new Error("<Vertical>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set numbers(value) {
    		throw new Error("<Vertical>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    		path: basedir,
    		exports: {},
    		require: function (path, base) {
    			return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    		}
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var spencerColor = createCommonjsModule(function (module, exports) {
    !function(e){module.exports=e();}(function(){return function u(i,a,c){function f(r,e){if(!a[r]){if(!i[r]){var o="function"==typeof commonjsRequire&&commonjsRequire;if(!e&&o)return o(r,!0);if(d)return d(r,!0);var n=new Error("Cannot find module '"+r+"'");throw n.code="MODULE_NOT_FOUND",n}var t=a[r]={exports:{}};i[r][0].call(t.exports,function(e){return f(i[r][1][e]||e)},t,t.exports,u,i,a,c);}return a[r].exports}for(var d="function"==typeof commonjsRequire&&commonjsRequire,e=0;e<c.length;e++)f(c[e]);return f}({1:[function(e,r,o){r.exports={blue:"#6699cc",green:"#6accb2",yellow:"#e1e6b3",red:"#cc7066",pink:"#F2C0BB",brown:"#705E5C",orange:"#cc8a66",purple:"#d8b3e6",navy:"#335799",olive:"#7f9c6c",fuscia:"#735873",beige:"#e6d7b3",slate:"#8C8C88",suede:"#9c896c",burnt:"#603a39",sea:"#50617A",sky:"#2D85A8",night:"#303b50",rouge:"#914045",grey:"#838B91",mud:"#C4ABAB",royal:"#275291",cherry:"#cc6966",tulip:"#e6b3bc",rose:"#D68881",fire:"#AB5850",greyblue:"#72697D",greygreen:"#8BA3A2",greypurple:"#978BA3",burn:"#6D5685",slategrey:"#bfb0b3",light:"#a3a5a5",lighter:"#d7d5d2",fudge:"#4d4d4d",lightgrey:"#949a9e",white:"#fbfbfb",dimgrey:"#606c74",softblack:"#463D4F",dark:"#443d3d",black:"#333333"};},{}],2:[function(e,r,o){var n=e("./colors"),t={juno:["blue","mud","navy","slate","pink","burn"],barrow:["rouge","red","orange","burnt","brown","greygreen"],roma:["#8a849a","#b5b0bf","rose","lighter","greygreen","mud"],palmer:["red","navy","olive","pink","suede","sky"],mark:["#848f9a","#9aa4ac","slate","#b0b8bf","mud","grey"],salmon:["sky","sea","fuscia","slate","mud","fudge"],dupont:["green","brown","orange","red","olive","blue"],bloor:["night","navy","beige","rouge","mud","grey"],yukon:["mud","slate","brown","sky","beige","red"],david:["blue","green","yellow","red","pink","light"],neste:["mud","cherry","royal","rouge","greygreen","greypurple"],ken:["red","sky","#c67a53","greygreen","#dfb59f","mud"]};Object.keys(t).forEach(function(e){t[e]=t[e].map(function(e){return n[e]||e});}),r.exports=t;},{"./colors":1}],3:[function(e,r,o){var n=e("./colors"),t=e("./combos"),u={colors:n,list:Object.keys(n).map(function(e){return n[e]}),combos:t};r.exports=u;},{"./colors":1,"./combos":2}]},{},[3])(3)});
    });

    /* Users/spencer/mountain/somehow-barchart/src/Bar.svelte generated by Svelte v3.29.0 */
    const file$3 = "Users/spencer/mountain/somehow-barchart/src/Bar.svelte";

    function create_fragment$3(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			add_location$1(div, file$3, 23, 0, 439);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);
    		},
    		p: noop$1,
    		i: noop$1,
    		o: noop$1,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $bars;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots$1("Bar", slots, []);
    	let { color = "steelblue" } = $$props;
    	let { label = "" } = $$props;
    	let { value = "0" } = $$props;
    	let { title = "" } = $$props;
    	let bars = getContext("bars");
    	validate_store(bars, "bars");
    	component_subscribe($$self, bars, value => $$invalidate(5, $bars = value));
    	let colors = spencerColor.colors;
    	color = colors[color] || color;
    	let stack = getContext("stack");

    	$bars.push({
    		color,
    		value: Number(value),
    		label,
    		title,
    		stack
    	});

    	const writable_props = ["color", "label", "value", "title"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Bar> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("color" in $$props) $$invalidate(1, color = $$props.color);
    		if ("label" in $$props) $$invalidate(2, label = $$props.label);
    		if ("value" in $$props) $$invalidate(3, value = $$props.value);
    		if ("title" in $$props) $$invalidate(4, title = $$props.title);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		color,
    		label,
    		value,
    		title,
    		bars,
    		c: spencerColor,
    		colors,
    		stack,
    		$bars
    	});

    	$$self.$inject_state = $$props => {
    		if ("color" in $$props) $$invalidate(1, color = $$props.color);
    		if ("label" in $$props) $$invalidate(2, label = $$props.label);
    		if ("value" in $$props) $$invalidate(3, value = $$props.value);
    		if ("title" in $$props) $$invalidate(4, title = $$props.title);
    		if ("bars" in $$props) $$invalidate(0, bars = $$props.bars);
    		if ("colors" in $$props) colors = $$props.colors;
    		if ("stack" in $$props) stack = $$props.stack;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [bars, color, label, value, title];
    }

    class Bar extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$3, create_fragment$3, safe_not_equal$1, { color: 1, label: 2, value: 3, title: 4 });

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Bar",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get color() {
    		throw new Error("<Bar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Bar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label() {
    		throw new Error("<Bar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<Bar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Bar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Bar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get title() {
    		throw new Error("<Bar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Bar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function noop$2() { }
    function add_location$2(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run$2(fn) {
        return fn();
    }
    function blank_object$2() {
        return Object.create(null);
    }
    function run_all$2(fns) {
        fns.forEach(run$2);
    }
    function is_function$2(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal$2(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty$2(obj) {
        return Object.keys(obj).length === 0;
    }

    function append$2(target, node) {
        target.appendChild(node);
    }
    function insert$2(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach$2(node) {
        node.parentNode.removeChild(node);
    }
    function element$2(name) {
        return document.createElement(name);
    }
    function text$2(data) {
        return document.createTextNode(data);
    }
    function space$2() {
        return text$2(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr$2(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children$2(element) {
        return Array.from(element.childNodes);
    }
    function set_style$1(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event$2(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component$2;
    function set_current_component$2(component) {
        current_component$2 = component;
    }

    const dirty_components$2 = [];
    const binding_callbacks$2 = [];
    const render_callbacks$2 = [];
    const flush_callbacks$2 = [];
    const resolved_promise$2 = Promise.resolve();
    let update_scheduled$2 = false;
    function schedule_update$2() {
        if (!update_scheduled$2) {
            update_scheduled$2 = true;
            resolved_promise$2.then(flush$2);
        }
    }
    function add_render_callback$2(fn) {
        render_callbacks$2.push(fn);
    }
    let flushing$2 = false;
    const seen_callbacks$2 = new Set();
    function flush$2() {
        if (flushing$2)
            return;
        flushing$2 = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components$2.length; i += 1) {
                const component = dirty_components$2[i];
                set_current_component$2(component);
                update$2(component.$$);
            }
            dirty_components$2.length = 0;
            while (binding_callbacks$2.length)
                binding_callbacks$2.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks$2.length; i += 1) {
                const callback = render_callbacks$2[i];
                if (!seen_callbacks$2.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks$2.add(callback);
                    callback();
                }
            }
            render_callbacks$2.length = 0;
        } while (dirty_components$2.length);
        while (flush_callbacks$2.length) {
            flush_callbacks$2.pop()();
        }
        update_scheduled$2 = false;
        flushing$2 = false;
        seen_callbacks$2.clear();
    }
    function update$2($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all$2($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback$2);
        }
    }
    const outroing$2 = new Set();
    function transition_in$2(block, local) {
        if (block && block.i) {
            outroing$2.delete(block);
            block.i(local);
        }
    }
    function mount_component$2(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback$2(() => {
            const new_on_destroy = on_mount.map(run$2).filter(is_function$2);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all$2(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback$2);
    }
    function destroy_component$2(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all$2($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty$2(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components$2.push(component);
            schedule_update$2();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init$2(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component$2;
        set_current_component$2(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop$2,
            not_equal,
            bound: blank_object$2(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object$2(),
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
                        make_dirty$2(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all$2($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children$2(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach$2);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in$2(component.$$.fragment);
            mount_component$2(component, options.target, options.anchor);
            flush$2();
        }
        set_current_component$2(parent_component);
    }
    class SvelteComponent$2 {
        $destroy() {
            destroy_component$2(this, 1);
            this.$destroy = noop$2;
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
            if (this.$$set && !is_empty$2($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev$2(type, detail) {
        document.dispatchEvent(custom_event$2(type, Object.assign({ version: '3.24.1' }, detail)));
    }
    function append_dev$2(target, node) {
        dispatch_dev$2("SvelteDOMInsert", { target, node });
        append$2(target, node);
    }
    function insert_dev$2(target, node, anchor) {
        dispatch_dev$2("SvelteDOMInsert", { target, node, anchor });
        insert$2(target, node, anchor);
    }
    function detach_dev$2(node) {
        dispatch_dev$2("SvelteDOMRemove", { node });
        detach$2(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev$2("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev$2("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev$2(node, attribute, value) {
        attr$2(node, attribute, value);
        if (value == null)
            dispatch_dev$2("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev$2("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev$2(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev$2("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_slots$2(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev$2 extends SvelteComponent$2 {
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

    const scaleLinear = function (obj) {
      let world = obj.world || [];
      let minmax = obj.minmax || [];
      const calc = (num) => {
        let range = minmax[1] - minmax[0];
        let percent = (num - minmax[0]) / range;
        let size = world[1] - world[0];
        let res = size * percent;
        if (res > minmax.max) {
          return minmax.max
        }
        if (res < minmax.min) {
          return minmax.min
        }
        return Math.round(res)
      };
      // invert the calculation. return a %?
      calc.backward = (num) => {
        let size = world[1] - world[0];
        let range = minmax[1] - minmax[0];
        let percent = (num - world[0]) / size;
        return Math.round(percent * range)
      };
      return calc
    };

    const getBox = function (e) {
      let el = e.target;
      for (let i = 0; i < 7; i += 1) {
        if (el.classList.contains('container') === true) {
          break
        }
        el = el.parentNode || el;
      }
      return el.getBoundingClientRect()
    };

    // handle initial click
    const goHere = function (e, cb) {
      let outside = getBox(e);
      let res = {
        start: {},
        diff: {},
        value: {
          x: e.pageX - outside.left, //seems to work?
          y: e.clientY - outside.top,
        },
      };
      res.percent = {
        x: res.value.x / outside.width,
        y: res.value.y / outside.height,
      };
      cb(res);
    };

    const onFirstClick = function (e, cb) {
      let outside = getBox(e);
      let start = {
        x: e.pageX - outside.left,
        y: e.clientY - outside.top,
      };
      const onDrag = function (event) {
        let res = {
          start: start,
          diff: {
            x: event.pageX - start.x - outside.left,
            y: event.clientY - start.y - outside.top,
          },
        };
        res.value = {
          x: event.pageX - outside.left,
          y: event.clientY - outside.top,
        };
        // ensure values are within bounds
        if (res.value.x > outside.width) {
          res.value.x = outside.width;
        }
        if (res.value.y > outside.height) {
          res.value.y = outside.height;
        }
        if (res.value.x < 0) {
          res.value.x = 0;
        }
        if (res.value.y < 0) {
          res.value.y = 0;
        }
        // finally, calculate percents
        res.percent = {
          x: res.value.x / outside.width,
          y: res.value.y / outside.height,
        };
        cb(res);
      };

      // stop event
      window.addEventListener('pointerup', () => {
        window.removeEventListener('pointermove', onDrag);
        window.removeEventListener('pointerup', this);
      });
      window.addEventListener('pointermove', onDrag);
      // fire first
      goHere(e, cb);
    };

    var dragHandler = onFirstClick;

    /* Users/spencer/mountain/somehow-slider/src/Horizontal/Horizontal.svelte generated by Svelte v3.29.0 */
    const file$4 = "Users/spencer/mountain/somehow-slider/src/Horizontal/Horizontal.svelte";

    function add_css$3() {
    	var style = element$2("style");
    	style.id = "svelte-sjpf61-style";
    	style.textContent = ".container.svelte-sjpf61{position:relative;height:40px;width:100%;cursor:pointer;outline:none}.background.svelte-sjpf61{position:absolute;background-color:lightgrey;border-radius:8px;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2);top:33%;height:33%;width:100%;touch-action:none;padding-right:15px}.handle.svelte-sjpf61{position:relative;border-radius:8px;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2);position:absolute;width:15px;height:100%;cursor:col-resize;border:1px solid grey;position:relative;background-color:steelblue;touch-action:none}.number.svelte-sjpf61{position:absolute;top:50px;user-select:none}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSG9yaXpvbnRhbC5zdmVsdGUiLCJzb3VyY2VzIjpbIkhvcml6b250YWwuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBzY2FsZUxpbmVhciBmcm9tICcuLi9zY2FsZSdcbiAgaW1wb3J0IG9uRmlyc3RDbGljayBmcm9tICcuLi9kcmFnSGFuZGxlcidcbiAgZXhwb3J0IGxldCB2YWx1ZSA9IDBcbiAgZXhwb3J0IGxldCBtYXggPSAxMDBcbiAgZXhwb3J0IGxldCBtaW4gPSAwXG4gIGxldCBzY2FsZSA9IHNjYWxlTGluZWFyKHsgd29ybGQ6IFswLCAxMDBdLCBtaW5tYXg6IFttaW4sIG1heF0gfSlcbiAgbGV0IHBlcmNlbnQgPSBzY2FsZSh2YWx1ZSlcblxuICBmdW5jdGlvbiBzdGFydENsaWNrKGUpIHtcbiAgICBvbkZpcnN0Q2xpY2soZSwgcmVzID0+IHtcbiAgICAgIHBlcmNlbnQgPSByZXMucGVyY2VudC54ICogMTAwXG4gICAgICB2YWx1ZSA9IHNjYWxlLmJhY2t3YXJkKHBlcmNlbnQpXG4gICAgfSlcbiAgfVxuICBmdW5jdGlvbiBoYW5kbGVLZXlkb3duKGV2ZW50KSB7XG4gICAgaWYgKGV2ZW50LmtleSA9PT0gJ0Fycm93TGVmdCcpIHtcbiAgICAgIHBlcmNlbnQgLT0gMVxuICAgICAgdmFsdWUgPSBzY2FsZS5iYWNrd2FyZChwZXJjZW50KVxuICAgIH1cbiAgICBpZiAoZXZlbnQua2V5ID09PSAnQXJyb3dSaWdodCcpIHtcbiAgICAgIHBlcmNlbnQgKz0gMVxuICAgICAgdmFsdWUgPSBzY2FsZS5iYWNrd2FyZChwZXJjZW50KVxuICAgIH1cbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gIH1cbjwvc2NyaXB0PlxuXG48c3R5bGU+XG4gIC5jb250YWluZXIge1xuICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICBoZWlnaHQ6IDQwcHg7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgY3Vyc29yOiBwb2ludGVyO1xuICAgIG91dGxpbmU6IG5vbmU7XG4gIH1cbiAgLmJhY2tncm91bmQge1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiBsaWdodGdyZXk7XG4gICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgIGJveC1zaGFkb3c6IDJweCAycHggOHB4IDBweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gICAgdG9wOiAzMyU7XG4gICAgaGVpZ2h0OiAzMyU7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgdG91Y2gtYWN0aW9uOiBub25lO1xuICAgIHBhZGRpbmctcmlnaHQ6IDE1cHg7XG4gIH1cbiAgLmhhbmRsZSB7XG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICBib3gtc2hhZG93OiAycHggMnB4IDhweCAwcHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICB3aWR0aDogMTVweDtcbiAgICBoZWlnaHQ6IDEwMCU7XG4gICAgY3Vyc29yOiBjb2wtcmVzaXplO1xuICAgIGJvcmRlcjogMXB4IHNvbGlkIGdyZXk7XG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgIGJhY2tncm91bmQtY29sb3I6IHN0ZWVsYmx1ZTtcbiAgICB0b3VjaC1hY3Rpb246IG5vbmU7XG4gIH1cbiAgLm51bWJlciB7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIHRvcDogNTBweDtcbiAgICB1c2VyLXNlbGVjdDogbm9uZTtcbiAgfVxuPC9zdHlsZT5cblxuPCEtLSA8ZGl2Pnt2YWx1ZX08L2Rpdj5cbjxkaXY+e3BlcmNlbnR9PC9kaXY+IC0tPlxuPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiIG9uOnBvaW50ZXJkb3duPXtzdGFydENsaWNrfSBvbjprZXlkb3duPXtoYW5kbGVLZXlkb3dufT5cbiAgPGRpdiBjbGFzcz1cImJhY2tncm91bmRcIiAvPlxuICA8ZGl2IGNsYXNzPVwiaGFuZGxlXCIgc3R5bGU9XCJsZWZ0OntwZXJjZW50fSU7XCIgb246cG9pbnRlcmRvd249e3N0YXJ0Q2xpY2t9PlxuICAgIDxkaXYgY2xhc3M9XCJudW1iZXJcIj57TWF0aC5yb3VuZCh2YWx1ZSl9PC9kaXY+XG4gIDwvZGl2PlxuPC9kaXY+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBNkJFLFVBQVUsY0FBQyxDQUFDLEFBQ1YsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsTUFBTSxDQUFFLElBQUksQ0FDWixLQUFLLENBQUUsSUFBSSxDQUNYLE1BQU0sQ0FBRSxPQUFPLENBQ2YsT0FBTyxDQUFFLElBQUksQUFDZixDQUFDLEFBQ0QsV0FBVyxjQUFDLENBQUMsQUFDWCxRQUFRLENBQUUsUUFBUSxDQUNsQixnQkFBZ0IsQ0FBRSxTQUFTLENBQzNCLGFBQWEsQ0FBRSxHQUFHLENBQ2xCLFVBQVUsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FDOUMsR0FBRyxDQUFFLEdBQUcsQ0FDUixNQUFNLENBQUUsR0FBRyxDQUNYLEtBQUssQ0FBRSxJQUFJLENBQ1gsWUFBWSxDQUFFLElBQUksQ0FDbEIsYUFBYSxDQUFFLElBQUksQUFDckIsQ0FBQyxBQUNELE9BQU8sY0FBQyxDQUFDLEFBQ1AsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsYUFBYSxDQUFFLEdBQUcsQ0FDbEIsVUFBVSxDQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUM5QyxRQUFRLENBQUUsUUFBUSxDQUNsQixLQUFLLENBQUUsSUFBSSxDQUNYLE1BQU0sQ0FBRSxJQUFJLENBQ1osTUFBTSxDQUFFLFVBQVUsQ0FDbEIsTUFBTSxDQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUN0QixRQUFRLENBQUUsUUFBUSxDQUNsQixnQkFBZ0IsQ0FBRSxTQUFTLENBQzNCLFlBQVksQ0FBRSxJQUFJLEFBQ3BCLENBQUMsQUFDRCxPQUFPLGNBQUMsQ0FBQyxBQUNQLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLEdBQUcsQ0FBRSxJQUFJLENBQ1QsV0FBVyxDQUFFLElBQUksQUFDbkIsQ0FBQyJ9 */";
    	append_dev$2(document.head, style);
    }

    function create_fragment$4(ctx) {
    	let div3;
    	let div0;
    	let t0;
    	let div2;
    	let div1;
    	let t1_value = Math.round(/*value*/ ctx[0]) + "";
    	let t1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element$2("div");
    			div0 = element$2("div");
    			t0 = space$2();
    			div2 = element$2("div");
    			div1 = element$2("div");
    			t1 = text$2(t1_value);
    			attr_dev$2(div0, "class", "background svelte-sjpf61");
    			add_location$2(div0, file$4, 70, 2, 1574);
    			attr_dev$2(div1, "class", "number svelte-sjpf61");
    			add_location$2(div1, file$4, 72, 4, 1681);
    			attr_dev$2(div2, "class", "handle svelte-sjpf61");
    			set_style$1(div2, "left", /*percent*/ ctx[1] + "%");
    			add_location$2(div2, file$4, 71, 2, 1603);
    			attr_dev$2(div3, "class", "container svelte-sjpf61");
    			add_location$2(div3, file$4, 69, 0, 1493);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$2(target, div3, anchor);
    			append_dev$2(div3, div0);
    			append_dev$2(div3, t0);
    			append_dev$2(div3, div2);
    			append_dev$2(div2, div1);
    			append_dev$2(div1, t1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div2, "pointerdown", /*startClick*/ ctx[2], false, false, false),
    					listen_dev(div3, "pointerdown", /*startClick*/ ctx[2], false, false, false),
    					listen_dev(div3, "keydown", /*handleKeydown*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*value*/ 1 && t1_value !== (t1_value = Math.round(/*value*/ ctx[0]) + "")) set_data_dev$2(t1, t1_value);

    			if (dirty & /*percent*/ 2) {
    				set_style$1(div2, "left", /*percent*/ ctx[1] + "%");
    			}
    		},
    		i: noop$2,
    		o: noop$2,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$2(div3);
    			mounted = false;
    			run_all$2(dispose);
    		}
    	};

    	dispatch_dev$2("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots$2("Horizontal", slots, []);
    	let { value = 0 } = $$props;
    	let { max = 100 } = $$props;
    	let { min = 0 } = $$props;
    	let scale = scaleLinear({ world: [0, 100], minmax: [min, max] });
    	let percent = scale(value);

    	function startClick(e) {
    		dragHandler(e, res => {
    			$$invalidate(1, percent = res.percent.x * 100);
    			$$invalidate(0, value = scale.backward(percent));
    		});
    	}

    	function handleKeydown(event) {
    		if (event.key === "ArrowLeft") {
    			$$invalidate(1, percent -= 1);
    			$$invalidate(0, value = scale.backward(percent));
    		}

    		if (event.key === "ArrowRight") {
    			$$invalidate(1, percent += 1);
    			$$invalidate(0, value = scale.backward(percent));
    		}

    		event.preventDefault();
    	}

    	const writable_props = ["value", "max", "min"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Horizontal> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("max" in $$props) $$invalidate(4, max = $$props.max);
    		if ("min" in $$props) $$invalidate(5, min = $$props.min);
    	};

    	$$self.$capture_state = () => ({
    		scaleLinear,
    		onFirstClick: dragHandler,
    		value,
    		max,
    		min,
    		scale,
    		percent,
    		startClick,
    		handleKeydown
    	});

    	$$self.$inject_state = $$props => {
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("max" in $$props) $$invalidate(4, max = $$props.max);
    		if ("min" in $$props) $$invalidate(5, min = $$props.min);
    		if ("scale" in $$props) scale = $$props.scale;
    		if ("percent" in $$props) $$invalidate(1, percent = $$props.percent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [value, percent, startClick, handleKeydown, max, min];
    }

    class Horizontal extends SvelteComponentDev$2 {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-sjpf61-style")) add_css$3();
    		init$2(this, options, instance$4, create_fragment$4, safe_not_equal$2, { value: 0, max: 4, min: 5 });

    		dispatch_dev$2("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Horizontal",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get value() {
    		throw new Error("<Horizontal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Horizontal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get max() {
    		throw new Error("<Horizontal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set max(value) {
    		throw new Error("<Horizontal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get min() {
    		throw new Error("<Horizontal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set min(value) {
    		throw new Error("<Horizontal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var spencerColor$1 = createCommonjsModule(function (module, exports) {
    !function(e){module.exports=e();}(function(){return function u(i,a,c){function f(r,e){if(!a[r]){if(!i[r]){var o="function"==typeof commonjsRequire&&commonjsRequire;if(!e&&o)return o(r,!0);if(d)return d(r,!0);var n=new Error("Cannot find module '"+r+"'");throw n.code="MODULE_NOT_FOUND",n}var t=a[r]={exports:{}};i[r][0].call(t.exports,function(e){return f(i[r][1][e]||e)},t,t.exports,u,i,a,c);}return a[r].exports}for(var d="function"==typeof commonjsRequire&&commonjsRequire,e=0;e<c.length;e++)f(c[e]);return f}({1:[function(e,r,o){r.exports={blue:"#6699cc",green:"#6accb2",yellow:"#e1e6b3",red:"#cc7066",pink:"#F2C0BB",brown:"#705E5C",orange:"#cc8a66",purple:"#d8b3e6",navy:"#335799",olive:"#7f9c6c",fuscia:"#735873",beige:"#e6d7b3",slate:"#8C8C88",suede:"#9c896c",burnt:"#603a39",sea:"#50617A",sky:"#2D85A8",night:"#303b50",rouge:"#914045",grey:"#838B91",mud:"#C4ABAB",royal:"#275291",cherry:"#cc6966",tulip:"#e6b3bc",rose:"#D68881",fire:"#AB5850",greyblue:"#72697D",greygreen:"#8BA3A2",greypurple:"#978BA3",burn:"#6D5685",slategrey:"#bfb0b3",light:"#a3a5a5",lighter:"#d7d5d2",fudge:"#4d4d4d",lightgrey:"#949a9e",white:"#fbfbfb",dimgrey:"#606c74",softblack:"#463D4F",dark:"#443d3d",black:"#333333"};},{}],2:[function(e,r,o){var n=e("./colors"),t={juno:["blue","mud","navy","slate","pink","burn"],barrow:["rouge","red","orange","burnt","brown","greygreen"],roma:["#8a849a","#b5b0bf","rose","lighter","greygreen","mud"],palmer:["red","navy","olive","pink","suede","sky"],mark:["#848f9a","#9aa4ac","slate","#b0b8bf","mud","grey"],salmon:["sky","sea","fuscia","slate","mud","fudge"],dupont:["green","brown","orange","red","olive","blue"],bloor:["night","navy","beige","rouge","mud","grey"],yukon:["mud","slate","brown","sky","beige","red"],david:["blue","green","yellow","red","pink","light"],neste:["mud","cherry","royal","rouge","greygreen","greypurple"],ken:["red","sky","#c67a53","greygreen","#dfb59f","mud"]};Object.keys(t).forEach(function(e){t[e]=t[e].map(function(e){return n[e]||e});}),r.exports=t;},{"./colors":1}],3:[function(e,r,o){var n=e("./colors"),t=e("./combos"),u={colors:n,list:Object.keys(n).map(function(e){return n[e]}),combos:t};r.exports=u;},{"./colors":1,"./combos":2}]},{},[3])(3)});
    });

    //  latitude / longitude
    //  (-90|90) /  (-180|180)
    //
    // places with more than 5m people
    var cities = {
      tokyo: [35.68972, 139.69222],
      delhi: [28.61, 77.23],
      shanghai: [31.22861, 121.47472],
      'sao paulo': [-23.55, -46.63333],
      'mexico city': [19.43333, -99.13333],
      cairo: [30.03333, 31.23333],
      mumbai: [18.975, 72.82583],
      beijing: [39.9069, 116.3976],
      dhaka: [23.76389, 90.38889],
      osaka: [34.69389, 135.50222],
      'new york city': [40.661, -73.944],
      karachi: [24.86, 67.01],
      'buenos aires': [-34.60333, -58.38167],
      chongqing: [29.5637, 106.5504],
      istanbul: [41.01361, 28.955],
      kolkata: [22.5726, 88.3639],
      manila: [14.58, 121],
      lagos: [6.45503, 3.38408],
      'rio de janeiro': [-22.90833, -43.19639],
      tianjin: [39.1336, 117.2054],
      kinshasa: [-4.325, 15.32222],
      guangzhou: [23.132, 113.266],
      'los angeles': [34.05, -118.25],
      moscow: [55.75583, 37.61722],
      shenzhen: [22.5415, 114.0596],
      lahore: [31.54972, 74.34361],
      bangalore: [12.98333, 77.58333],
      paris: [48.85661, 2.35222],
      bogotá: [4.71111, -74.07222],
      jakarta: [-6.2, 106.81667],
      chennai: [13.08333, 80.26667],
      lima: [-12.05, -77.03333],
      bangkok: [13.7525, 100.49417],
      seoul: [37.56667, 126.96667],
      nagoya: [35.18333, 136.9],
      hyderabad: [17.37, 78.48],
      london: [51.50722, -0.1275],
      tehran: [35.68917, 51.38889],
      chicago: [41.82192, -87.70304],
      chengdu: [30.657, 104.066],
      nanjing: [32.0614, 118.7636],
      wuhan: [30.5934, 114.3046],
      'ho chi minh city': [10.8, 106.65],
      luanda: [-8.83833, 13.23444],
      ahmedabad: [23.03, 72.58],
      'kuala lumpur': [3.14778, 101.69528],
      "xi'an": [34.265, 108.954],
      'hong kong': [22.3, 114.2],
      dongguan: [23.021, 113.752],
      hangzhou: [30.267, 120.153],
      foshan: [23.0214, 113.1216],
      shenyang: [41.8047, 123.434],
      riyadh: [24.63333, 46.71667],
      baghdad: [33.33333, 44.38333],
      santiago: [-33.45, -70.66667],
      surat: [21.17024, 72.83106],
      madrid: [40.38333, -3.71667],
      suzhou: [31.2998, 120.5853],
      pune: [18.52028, 73.85667],
      harbin: [45.7576, 126.6409],
      houston: [29.76278, -95.38306],
      dallas: [32.77917, -96.80889],
      toronto: [43.74167, -79.37333],
      'dar es salaam': [-6.8, 39.28333],
      miami: [25.77528, -80.20889],
      'belo horizonte': [-19.91667, -43.93333],
      singapore: [1.28333, 103.83333],
      philadelphia: [39.95278, -75.16361],
      atlanta: [33.755, -84.39],
      fukuoka: [33.58333, 130.4],
      khartoum: [15.50056, 32.56],
      barcelona: [41.38333, 2.18333],
      johannesburg: [-26.20444, 28.04556],
      'saint petersburg': [59.9375, 30.30861],
      qingdao: [36.0669, 120.3827],
      dalian: [38.914, 121.6148],
      'washington, d.c.': [38.90472, -77.01639],
      yangon: [16.85, 96.18333],
      alexandria: [31.2, 29.91667],
      jinan: [36.6702, 117.0207],
      guadalajara: [20.67667, -103.3475]
    };

    var ontario = {
      brampton: [43.68333, -79.76667],
      barrie: [44.37111, -79.67694],
      belleville: [44.16667, -77.38333],
      brantford: [43.16667, -80.25],
      cornwall: [45.0275, -74.74],
      brockville: [44.58333, -75.68333],
      burlington: [43.31667, -79.8],
      cambridge: [43.36667, -80.31667],
      'clarence-rockland': [45.48333, -75.2],
      guelph: [43.55, -80.25],
      dryden: [49.78333, -92.83333],
      'elliot lake': [46.38333, -82.65],
      'greater sudbury': [46.49, -81.01],
      'haldimand county': [42.93333, -79.88333],
      hamilton: [43.25667, -79.86917],
      kitchener: [43.41861, -80.47278],
      kingston: [44.23333, -76.5],
      kenora: [49.76667, -94.48333],
      'kawartha lakes': [44.35, -78.75],
      london: [42.98361, -81.24972],
      mississauga: [43.6, -79.65],
      markham: [43.87667, -79.26333],
      'niagara falls': [43.06, -79.10667],
      'norfolk county': [42.85, -80.26667],
      ottawa: [45.42472, -75.695],
      'north bay': [46.3, -79.45],
      orillia: [44.6, -79.41667],
      oshawa: [43.9, -78.85],
      'owen sound': [44.56667, -80.93333],
      pickering: [43.83944, -79.08139],
      peterborough: [44.3, -78.31667],
      'port colborne': [42.88333, -79.25],
      pembroke: [45.81667, -77.1],
      sarnia: [42.99944, -82.30889],
      'st. catharines': [43.18333, -79.23333],
      'richmond hill': [43.86667, -79.43333],
      'quinte west': [44.18333, -77.56667],
      'sault ste. marie': [46.53333, -84.35],
      'thunder bay': [48.38222, -89.24611],
      stratford: [43.37083, -80.98194],
      'st. thomas': [42.775, -81.18333],
      thorold: [43.11667, -79.2],
      'temiskaming shores': [47.51667, -79.68333],
      toronto: [43.74167, -79.37333],
      waterloo: [43.46667, -80.51667],
      timmins: [48.46667, -81.33333],
      vaughan: [43.83333, -79.5],
      welland: [42.98333, -79.23333],
      windsor: [42.28333, -83],
      woodstock: [43.13056, -80.74667]
    };

    var northAmerica = {
      'mexico city': [19.43333, -99.13333],
      'new york city': [40.661, -73.944],
      'los angeles': [34.05, -118.25],
      toronto: [43.74167, -79.37333],
      chicago: [41.82192, -87.70304],
      houston: [29.76278, -95.38306],
      havana: [23.13667, -82.35889],
      montreal: [45.50889, -73.56167],
      'ecatepec de morelos': [19.60972, -99.06],
      philadelphia: [39.95278, -75.16361],
      'san antonio': [29.425, -98.49389],
      guadalajara: [20.67667, -103.3475],
      puebla: [19, -97.88333],
      'san diego': [32.715, -117.1625],
      dallas: [32.77917, -96.80889],
      tijuana: [32.525, -117.03333],
      calgary: [51.05, -114.06667],
      tegucigalpa: [14.1, -87.21667],
      zapopan: [20.72028, -103.39194],
      monterrey: [25.66667, -100.3],
      managua: [12.13639, -86.25139],
      'santo domingo': [18.46667, -69.95],
      'guatemala city': [14.61333, -90.53528],
      'port-au-prince': [18.53333, -72.33333],
      naucalpan: [19.47528, -99.23778],
      ottawa: [45.42472, -75.695],
      austin: [30.26722, -97.74306],
      edmonton: [53.53444, -113.49028],
      querétaro: [20.58333, -100.38333],
      toluca: [19.2925, -99.65694],
      jacksonville: [30.33694, -81.66139],
      'san francisco': [37.7775, -122.41639],
      indianapolis: [39.76861, -86.15806],
      'fort worth': [32.75, -97.33333],
      charlotte: [35.22722, -80.84306],
      hermosillo: [29.09889, -110.95417],
      saltillo: [25.43333, -101],
      aguascalientes: [22.01667, -102.35],
      mississauga: [43.6, -79.65],
      'san luis potosí': [22.6, -100.43333],
      veracruz: [19.43333, -96.38333],
      'san pedro sula': [15.5, -88.03333],
      'santiago de los caballeros': [19.45726, -70.6888],
      culiacán: [24.80694, -107.39389],
      winnipeg: [49.88444, -97.14639],
      mexicali: [32.66333, -115.46778],
      cancún: [21.16056, -86.8475],
      acapulco: [16.86361, -99.8825],
      tlalnepantla: [19.53667, -99.19472],
      seattle: [47.60972, -122.33306],
      denver: [39.73917, -104.99028],
      'el paso': [31.75917, -106.48861],
      chimalhuacán: [19.4375, -98.95417],
      detroit: [42.33139, -83.04583],
      'washington, d.c.': [38.90472, -77.01639],
      boston: [42.35806, -71.06361],
      tlaquepaque: [20.61667, -103.31667],
      nashville: [36.16667, -86.78333],
      torreón: [25.53944, -103.44861],
      vancouver: [49.25, -123.1],
      reynosa: [26.09222, -98.27778],
      'oklahoma city': [35.46861, -97.52139],
      'las vegas': [36.175, -115.13639],
      baltimore: [39.28333, -76.61667],
      brampton: [43.68333, -79.76667],
      louisville: [38.22533, -85.74167],
      morelia: [19.76833, -101.18944],
      milwaukee: [43.05, -87.95],
      'tuxtla gutiérrez': [16.75278, -93.11667],
      apodaca: [25.78333, -100.18333],
      durango: [24.93333, -104.91667],
      albuquerque: [35.11083, -106.61],
      'quebec city': [46.81389, -71.20806],
      tucson: [32.22167, -110.92639],
      'cuautitlán izcalli': [19.64611, -99.21139],
      surrey: [51.25, -0.41667],
      'ciudad lópez mateos': [19.56111, -99.24694],
      tultitlán: [19.645, -99.16944],
      fresno: [36.75, -119.76667]
    };

    const points = [
      ['afghanistan', 'kabul', 34.28, 69.11],
      ['albania', 'tirane', 41.18, 19.49],
      ['algeria', 'algiers', 36.42, 3.08],
      ['american samoa', 'pago pago', -14.16, -170.43],
      ['andorra', 'andorra la vella', 42.31, 1.32],
      ['angola', 'luanda', -8.5, 13.15],
      ['antigua and barbuda', 'west indies', 17.2, -61.48],
      ['argentina', 'buenos aires', -36.3, -60.0],
      ['armenia', 'yerevan', 40.1, 44.31],
      ['aruba', 'oranjestad', 12.32, -70.02],
      ['australia', 'canberra', -35.15, 149.08],
      ['austria', 'vienna', 48.12, 16.22],
      ['azerbaijan', 'baku', 40.29, 49.56],
      ['bahamas', 'nassau', 25.05, -77.2],
      ['bahrain', 'manama', 26.1, 50.3],
      ['bangladesh', 'dhaka', 23.43, 90.26],
      ['barbados', 'bridgetown', 13.05, -59.3],
      ['belarus', 'minsk', 53.52, 27.3],
      ['belgium', 'brussels', 50.51, 4.21],
      ['belize', 'belmopan', 17.18, -88.3],
      ['benin', 'porto novo', 6.23, 2.42],
      ['bhutan', 'thimphu', 27.31, 89.45],
      ['bolivia', 'la paz', -16.2, -68.1],
      ['bosnia and herzegovina', 'sarajevo', 43.52, 18.26],
      ['botswana', 'gaborone', -24.45, 25.57],
      ['brazil', 'brasilia', -15.47, -47.55],
      ['british virgin islands', 'road town', 18.27, -64.37],
      ['brunei darussalam', 'bandar seri begawan', 4.52, 115.0],
      ['bulgaria', 'sofia', 42.45, 23.2],
      ['burkina faso', 'ouagadougou', 12.15, -1.3],
      ['burundi', 'bujumbura', -3.16, 29.18],
      ['cambodia', 'phnom penh', 11.33, 104.55],
      ['cameroon', 'yaounde', 3.5, 11.35],
      ['canada', 'ottawa', 45.27, -75.42],
      ['cape verde', 'praia', 15.02, -23.34],
      ['cayman islands', 'george town', 19.2, -81.24],
      ['central african republic', 'bangui', 4.23, 18.35],
      ['chad', "n'djamena", 12.1, 14.59],
      ['chile', 'santiago', -33.24, -70.4],
      ['china', 'beijing', 39.55, 116.2],
      ['colombia', 'bogota', 4.34, -74.0],
      ['comros', 'moroni', -11.4, 43.16],
      ['congo', 'brazzaville', -4.09, 15.12],
      ['costa rica', 'san jose', 9.55, -84.02],
      ["cote d'ivoire", 'yamoussoukro', 6.49, -5.17],
      ['croatia', 'zagreb', 45.5, 15.58],
      ['cuba', 'havana', 23.08, -82.22],
      ['cyprus', 'nicosia', 35.1, 33.25],
      ['czech republic', 'prague', 50.05, 14.22],
      ['democratic republic of the congo', 'kinshasa', -4.2, 15.15],
      ['denmark', 'copenhagen', 55.41, 12.34],
      ['djibouti', 'djibouti', 11.08, 42.2],
      ['dominica', 'roseau', 15.2, -61.24],
      ['dominica republic', 'santo domingo', 18.3, -69.59],
      ['east timor', 'dili', -8.29, 125.34],
      ['ecuador', 'quito', -0.15, -78.35],
      ['egypt', 'cairo', 30.01, 31.14],
      ['el salvador', 'san salvador', 13.4, -89.1],
      ['equatorial guinea', 'malabo', 3.45, 8.5],
      ['eritrea', 'asmara', 15.19, 38.55],
      ['estonia', 'tallinn', 59.22, 24.48],
      ['ethiopia', 'addis ababa', 9.02, 38.42],
      ['falkland islands', 'stanley', -51.4, -59.51],
      ['faroe islands', 'torshavn', 62.05, -6.56],
      ['fiji', 'suva', -18.06, 178.3],
      ['finland', 'helsinki', 60.15, 25.03],
      ['france', 'paris', 48.5, 2.2],
      ['french guiana', 'cayenne', 5.05, -52.18],
      ['french polynesia', 'papeete', -17.32, -149.34],
      ['gabon', 'libreville', 0.25, 9.26],
      ['gambia', 'banjul', 13.28, -16.4],
      ['georgia', 'tbilisi', 41.43, 44.5],
      ['germany', 'berlin', 52.3, 13.25],
      ['ghana', 'accra', 5.35, -0.06],
      ['greece', 'athens', 37.58, 23.46],
      ['greenland', 'nuuk', 64.1, -51.35],
      ['guadeloupe', 'basse-terre', 16.0, -61.44],
      ['guatemala', 'guatemala', 14.4, -90.22],
      ['guernsey', 'st. peter port', 49.26, -2.33],
      ['guinea', 'conakry', 9.29, -13.49],
      ['guinea-bissau', 'bissau', 11.45, -15.45],
      ['guyana', 'georgetown', 6.5, -58.12],
      ['haiti', 'port-au-prince', 18.4, -72.2],
      ['honduras', 'tegucigalpa', 14.05, -87.14],
      ['hungary', 'budapest', 47.29, 19.05],
      ['iceland', 'reykjavik', 64.1, -21.57],
      ['india', 'new delhi', 28.37, 77.13],
      ['indonesia', 'jakarta', -6.09, 106.49],
      ['iran', 'tehran', 35.44, 51.3],
      ['iraq', 'baghdad', 33.2, 44.3],
      ['ireland', 'dublin', 53.21, -6.15],
      ['israel', 'jerusalem', 31.71, -35.1],
      ['italy', 'rome', 41.54, 12.29],
      ['jamaica', 'kingston', 18.0, -76.5],
      ['jordan', 'amman', 31.57, 35.52],
      ['kazakhstan', 'astana', 51.1, 71.3],
      ['kenya', 'nairobi', -1.17, 36.48],
      ['kiribati', 'tarawa', 1.3, 173.0],
      ['kuwait', 'kuwait', 29.3, 48.0],
      ['kyrgyzstan', 'bishkek', 42.54, 74.46],
      ['laos', 'vientiane', 17.58, 102.36],
      ['latvia', 'riga', 56.53, 24.08],
      ['lebanon', 'beirut', 33.53, 35.31],
      ['lesotho', 'maseru', -29.18, 27.3],
      ['liberia', 'monrovia', 6.18, -10.47],
      ['libyan arab jamahiriya', 'tripoli', 32.49, 13.07],
      ['liechtenstein', 'vaduz', 47.08, 9.31],
      ['lithuania', 'vilnius', 54.38, 25.19],
      ['luxembourg', 'luxembourg', 49.37, 6.09],
      ['macao, china', 'macau', 22.12, 113.33],
      ['madagascar', 'antananarivo', -18.55, 47.31],
      ['macedonia', 'skopje', 42.01, 21.26],
      ['malawi', 'lilongwe', -14.0, 33.48],
      ['malaysia', 'kuala lumpur', 3.09, 101.41],
      ['maldives', 'male', 4.0, 73.28],
      ['mali', 'bamako', 12.34, -7.55],
      ['malta', 'valletta', 35.54, 14.31],
      ['martinique', 'fort-de-france', 14.36, -61.02],
      ['mauritania', 'nouakchott', -20.1, 57.3],
      ['mayotte', 'mamoudzou', -12.48, 45.14],
      ['mexico', 'mexico', 19.2, -99.1],
      ['micronesia', 'palikir', 6.55, 158.09],
      ['moldova, republic of', 'chisinau', 47.02, 28.5],
      ['mozambique', 'maputo', -25.58, 32.32],
      ['myanmar', 'yangon', 16.45, 96.2],
      ['namibia', 'windhoek', -22.35, 17.04],
      ['nepal', 'kathmandu', 27.45, 85.2],
      ['netherlands', 'amsterdam', 52.23, 4.54],
      ['netherlands antilles', 'willemstad', 12.05, -69.0],
      ['new caledonia', 'noumea', -22.17, 166.3],
      ['new zealand', 'wellington', -41.19, 174.46],
      ['nicaragua', 'managua', 12.06, -86.2],
      ['niger', 'niamey', 13.27, 2.06],
      ['nigeria', 'abuja', 9.05, 7.32],
      ['norfolk island', 'kingston', -45.2, 168.43],
      ['north korea', 'pyongyang', 39.09, 125.3],
      ['northern mariana islands', 'saipan', 15.12, 145.45],
      ['norway', 'oslo', 59.55, 10.45],
      ['oman', 'masqat', 23.37, 58.36],
      ['pakistan', 'islamabad', 33.4, 73.1],
      ['palau', 'koror', 7.2, 134.28],
      ['panama', 'panama', 9.0, -79.25],
      ['papua new guinea', 'port moresby', -9.24, 147.08],
      ['paraguay', 'asuncion', -25.1, -57.3],
      ['peru', 'lima', -12.0, -77.0],
      ['philippines', 'manila', 14.4, 121.03],
      ['poland', 'warsaw', 52.13, 21.0],
      ['portugal', 'lisbon', 38.42, -9.1],
      ['puerto rico', 'san juan', 18.28, -66.07],
      ['qatar', 'doha', 25.15, 51.35],
      ['republic of korea', 'seoul', 37.31, 126.58],
      ['romania', 'bucuresti', 44.27, 26.1],
      ['russia', 'moscow', 55.45, 37.35],
      ['rawanda', 'kigali', -1.59, 30.04],
      ['saint kitts and nevis', 'basseterre', 17.17, -62.43],
      ['saint lucia', 'castries', 14.02, -60.58],
      ['saint pierre and miquelon', 'saint-pierre', 46.46, -56.12],
      ['saint vincent and the greenadines', 'kingstown', 13.1, -61.1],
      ['samoa', 'apia', -13.5, -171.5],
      ['san marino', 'san marino', 43.55, 12.3],
      ['sao tome and principe', 'sao tome', 0.1, 6.39],
      ['saudi arabia', 'riyadh', 24.41, 46.42],
      ['senegal', 'dakar', 14.34, -17.29],
      ['sierra leone', 'freetown', 8.3, -13.17],
      ['slovakia', 'bratislava', 48.1, 17.07],
      ['slovenia', 'ljubljana', 46.04, 14.33],
      ['solomon islands', 'honiara', -9.27, 159.57],
      ['somalia', 'mogadishu', 2.02, 45.25],
      ['south africa', 'pretoria', -25.44, 28.12],
      ['spain', 'madrid', 40.25, -3.45],
      ['sudan', 'khartoum', 15.31, 32.35],
      ['suriname', 'paramaribo', 5.5, -55.1],
      ['swaziland', 'mbabane', -26.18, 31.06],
      ['sweden', 'stockholm', 59.2, 18.03],
      ['switzerland', 'bern', 46.57, 7.28],
      ['syria', 'damascus', 33.3, 36.18],
      ['tajikistan', 'dushanbe', 38.33, 68.48],
      ['thailand', 'bangkok', 13.45, 100.35],
      ['togo', 'lome', 6.09, 1.2],
      ['tonga', "nuku'alofa", -21.1, -174.0],
      ['tunisia', 'tunis', 36.5, 10.11],
      ['turkey', 'ankara', 39.57, 32.54],
      ['turkmenistan', 'ashgabat', 38.0, 57.5],
      ['tuvalu', 'funafuti', -8.31, 179.13],
      ['uganda', 'kampala', 0.2, 32.3],
      ['ukraine', 'kiev', 50.3, 30.28],
      ['united arab emirates', 'abu dhabi', 24.28, 54.22],
      ['united kingdom', 'london', 51.36, -0.05],
      ['united republic of tanzania', 'dodoma', -6.08, 35.45],
      ['united states of america', 'washington dc', 39.91, -77.02],
      ['united states of virgin islands', 'charlotte amalie', 18.21, -64.56],
      ['uruguay', 'montevideo', -34.5, -56.11],
      ['uzbekistan', 'tashkent', 41.2, 69.1],
      ['vanuatu', 'port-vila', -17.45, 168.18],
      ['venezuela', 'caracas', 10.3, -66.55],
      ['viet nam', 'hanoi', 21.05, 105.55],
      ['yugoslavia', 'belgrade', 44.5, 20.37],
      ['zambia', 'lusaka', -15.28, 28.16],
      ['zimbabwe', 'harare', -17.43, 31.02]
    ];

    let obj = {};
    points.forEach(a => {
      obj[a[0]] = [a[2], a[3]];
      obj[a[1]] = [a[2], a[3]];
    });
    var countries = obj;

    var points$1 = Object.assign({}, cities, ontario, northAmerica, countries);

    /* drafts/covid-canada/Post.svelte generated by Svelte v3.29.0 */

    const { Object: Object_1 } = globals;
    const file$5 = "drafts/covid-canada/Post.svelte";

    function add_css$4() {
    	var style = element("style");
    	style.id = "svelte-90rlg8-style";
    	style.textContent = ".m3.svelte-90rlg8{margin:3rem}.h8.svelte-90rlg8{height:18rem}.year.svelte-90rlg8{color:grey;margin-top:5rem}.w80p.svelte-90rlg8{width:50%}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBIZWFkIGZyb20gJy4uLy4uL2NvbXBvbmVudHMvSGVhZC5zdmVsdGUnXG4gIGltcG9ydCBGb290IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvRm9vdC5zdmVsdGUnXG4gIGltcG9ydCBoaXN0b3JpY2FsIGZyb20gJy4vZGF0YS9oaXN0b3JpY2FsLmpzJ1xuICBleHBvcnQgbGV0IHRpdGxlID0gJydcbiAgZXhwb3J0IGxldCBzdWIgPSAnJ1xuICBpbXBvcnQgeyBWZXJ0aWNhbCwgQmFyIH0gZnJvbSAnL1VzZXJzL3NwZW5jZXIvbW91bnRhaW4vc29tZWhvdy1iYXJjaGFydCdcbiAgaW1wb3J0IHsgSG9yaXpvbnRhbCB9IGZyb20gJy9Vc2Vycy9zcGVuY2VyL21vdW50YWluL3NvbWVob3ctc2xpZGVyJ1xuICBsZXQgYnlZZWFyID0ge31cbiAgaGlzdG9yaWNhbC5mb3JFYWNoKGEgPT4ge1xuICAgIGxldCB5ZWFyID0gYVswXS5tYXRjaCgvWzAtOV0rLylbMF1cbiAgICBieVllYXJbeWVhcl0gPSBieVllYXJbeWVhcl0gfHwgW11cbiAgICBieVllYXJbeWVhcl0ucHVzaChhKVxuICB9KVxuICBieVllYXIgPSBPYmplY3Qua2V5cyhieVllYXIpLm1hcChrID0+IGJ5WWVhcltrXSlcbiAgbGV0IGluZGV4ID0gMVxuICAvLyAkOiBpbmRleCA9ICgpID0+IHllYXJcbjwvc2NyaXB0PlxuXG48c3R5bGU+XG4gIC5tMyB7XG4gICAgbWFyZ2luOiAzcmVtO1xuICB9XG4gIC5oOCB7XG4gICAgaGVpZ2h0OiAxOHJlbTtcbiAgfVxuICAueWVhciB7XG4gICAgY29sb3I6IGdyZXk7XG4gICAgbWFyZ2luLXRvcDogNXJlbTtcbiAgfVxuICAudzgwcCB7XG4gICAgd2lkdGg6IDUwJTtcbiAgfVxuPC9zdHlsZT5cblxuPGRpdj5cbiAgPEhlYWQge3RpdGxlfSB7c3VifSBudW09XCIyOFwiIC8+XG4gIDxkaXYgY2xhc3M9XCJtMyBoOCB3ODBwXCI+XG4gICAgPEhvcml6b250YWwgbWluPXsxfSBtYXg9ezI3fSBiaW5kOnZhbHVlPXtpbmRleH0gLz5cbiAgICA8IS0tIHsjZWFjaCBieVllYXIgYXMgbW9udGhzfSAtLT5cbiAgICA8ZGl2IGNsYXNzPVwieWVhclwiPntpbmRleCArIDE5OTF9PC9kaXY+XG5cbiAgICA8VmVydGljYWwgbWF4PVwiMjcxNzdcIj5cbiAgICAgIHsjZWFjaCBieVllYXJbaW5kZXhdIHx8IFtdIGFzIG1vbnRofVxuICAgICAgICA8QmFyIGNvbG9yPVwibGlnaHRibHVlXCIgdmFsdWU9e21vbnRoWzFdfSBsYWJlbD17bW9udGhbMF19IC8+XG4gICAgICB7L2VhY2h9XG4gICAgPC9WZXJ0aWNhbD5cbiAgICA8IS0tIHsvZWFjaH0gLS0+XG4gIDwvZGl2PlxuICA8IS0tIDxGb290IHt0aXRsZX0gLz4gLS0+XG48L2Rpdj5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFvQkUsR0FBRyxjQUFDLENBQUMsQUFDSCxNQUFNLENBQUUsSUFBSSxBQUNkLENBQUMsQUFDRCxHQUFHLGNBQUMsQ0FBQyxBQUNILE1BQU0sQ0FBRSxLQUFLLEFBQ2YsQ0FBQyxBQUNELEtBQUssY0FBQyxDQUFDLEFBQ0wsS0FBSyxDQUFFLElBQUksQ0FDWCxVQUFVLENBQUUsSUFBSSxBQUNsQixDQUFDLEFBQ0QsS0FBSyxjQUFDLENBQUMsQUFDTCxLQUFLLENBQUUsR0FBRyxBQUNaLENBQUMifQ== */";
    	append_dev(document.head, style);
    }

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (44:6) {#each byYear[index] || [] as month}
    function create_each_block$1(ctx) {
    	let bar;
    	let current;

    	bar = new Bar({
    			props: {
    				color: "lightblue",
    				value: /*month*/ ctx[5][1],
    				label: /*month*/ ctx[5][0]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(bar.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(bar, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const bar_changes = {};
    			if (dirty & /*byYear, index*/ 12) bar_changes.value = /*month*/ ctx[5][1];
    			if (dirty & /*byYear, index*/ 12) bar_changes.label = /*month*/ ctx[5][0];
    			bar.$set(bar_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(bar.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(bar.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(bar, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(44:6) {#each byYear[index] || [] as month}",
    		ctx
    	});

    	return block;
    }

    // (43:4) <Vertical max="27177">
    function create_default_slot(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*byYear*/ ctx[2][/*index*/ ctx[3]] || [];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*byYear, index*/ 12) {
    				each_value = /*byYear*/ ctx[2][/*index*/ ctx[3]] || [];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(43:4) <Vertical max=\\\"27177\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div2;
    	let head;
    	let t0;
    	let div1;
    	let horizontal;
    	let updating_value;
    	let t1;
    	let div0;
    	let t2_value = /*index*/ ctx[3] + 1991 + "";
    	let t2;
    	let t3;
    	let vertical;
    	let current;

    	head = new Head({
    			props: {
    				title: /*title*/ ctx[0],
    				sub: /*sub*/ ctx[1],
    				num: "28"
    			},
    			$$inline: true
    		});

    	function horizontal_value_binding(value) {
    		/*horizontal_value_binding*/ ctx[4].call(null, value);
    	}

    	let horizontal_props = { min: 1, max: 27 };

    	if (/*index*/ ctx[3] !== void 0) {
    		horizontal_props.value = /*index*/ ctx[3];
    	}

    	horizontal = new Horizontal({ props: horizontal_props, $$inline: true });
    	binding_callbacks.push(() => bind(horizontal, "value", horizontal_value_binding));

    	vertical = new Vertical({
    			props: {
    				max: "27177",
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			create_component(head.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			create_component(horizontal.$$.fragment);
    			t1 = space();
    			div0 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			create_component(vertical.$$.fragment);
    			attr_dev(div0, "class", "year svelte-90rlg8");
    			add_location(div0, file$5, 40, 4, 932);
    			attr_dev(div1, "class", "m3 h8 w80p svelte-90rlg8");
    			add_location(div1, file$5, 37, 2, 810);
    			add_location(div2, file$5, 35, 0, 768);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			mount_component(head, div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			mount_component(horizontal, div1, null);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, t2);
    			append_dev(div1, t3);
    			mount_component(vertical, div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const head_changes = {};
    			if (dirty & /*title*/ 1) head_changes.title = /*title*/ ctx[0];
    			if (dirty & /*sub*/ 2) head_changes.sub = /*sub*/ ctx[1];
    			head.$set(head_changes);
    			const horizontal_changes = {};

    			if (!updating_value && dirty & /*index*/ 8) {
    				updating_value = true;
    				horizontal_changes.value = /*index*/ ctx[3];
    				add_flush_callback(() => updating_value = false);
    			}

    			horizontal.$set(horizontal_changes);
    			if ((!current || dirty & /*index*/ 8) && t2_value !== (t2_value = /*index*/ ctx[3] + 1991 + "")) set_data_dev(t2, t2_value);
    			const vertical_changes = {};

    			if (dirty & /*$$scope, byYear, index*/ 268) {
    				vertical_changes.$$scope = { dirty, ctx };
    			}

    			vertical.$set(vertical_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(head.$$.fragment, local);
    			transition_in(horizontal.$$.fragment, local);
    			transition_in(vertical.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(head.$$.fragment, local);
    			transition_out(horizontal.$$.fragment, local);
    			transition_out(vertical.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(head);
    			destroy_component(horizontal);
    			destroy_component(vertical);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Post", slots, []);
    	let { title = "" } = $$props;
    	let { sub = "" } = $$props;
    	let byYear = {};

    	historical.forEach(a => {
    		let year = a[0].match(/[0-9]+/)[0];
    		$$invalidate(2, byYear[year] = byYear[year] || [], byYear);
    		byYear[year].push(a);
    	});

    	byYear = Object.keys(byYear).map(k => byYear[k]);
    	let index = 1;
    	const writable_props = ["title", "sub"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	function horizontal_value_binding(value) {
    		index = value;
    		$$invalidate(3, index);
    	}

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    	};

    	$$self.$capture_state = () => ({
    		Head,
    		Foot,
    		historical,
    		title,
    		sub,
    		Vertical,
    		Bar,
    		Horizontal,
    		byYear,
    		index
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    		if ("byYear" in $$props) $$invalidate(2, byYear = $$props.byYear);
    		if ("index" in $$props) $$invalidate(3, index = $$props.index);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, sub, byYear, index, horizontal_value_binding];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-90rlg8-style")) add_css$4();
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { title: 0, sub: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$5.name
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
