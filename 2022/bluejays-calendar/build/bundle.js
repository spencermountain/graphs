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
    function destroy_each(iterations, detaching) {
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
    function empty$1() {
        return text$1('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
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
    function set_style$1(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
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
            set_current_component$1(null);
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
    function group_outros() {
        outros$1 = {
            r: 0,
            c: [],
            p: outros$1 // parent group
        };
    }
    function check_outros() {
        if (!outros$1.r) {
            run_all$1(outros$1.c);
        }
        outros$1 = outros$1.p;
    }
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
    function create_component$1(block) {
        block && block.c();
    }
    function mount_component$1(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
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
        }
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
            on_disconnect: [],
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
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
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
            mount_component$1(component, options.target, options.anchor, options.customElement);
            flush$1();
        }
        set_current_component$1(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
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
        document.dispatchEvent(custom_event$1(type, Object.assign({ version: '3.35.0' }, detail)));
    }
    function append_dev$1(target, node) {
        dispatch_dev$1('SvelteDOMInsert', { target, node });
        append$1(target, node);
    }
    function insert_dev$1(target, node, anchor) {
        dispatch_dev$1('SvelteDOMInsert', { target, node, anchor });
        insert$1(target, node, anchor);
    }
    function detach_dev$1(node) {
        dispatch_dev$1('SvelteDOMRemove', { node });
        detach$1(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev$1('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev$1('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev$1(node, attribute, value) {
        attr$1(node, attribute, value);
        if (value == null)
            dispatch_dev$1('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev$1('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev$1(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev$1('SvelteDOMSetData', { node: text, data });
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
    function validate_slots$1(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev$1 extends SvelteComponent$1 {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* spencermountain/spacetime 6.13.0 Apache 2.0 */
    function _typeof(obj) {
      "@babel/helpers - typeof";

      if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
        _typeof = function (obj) {
          return typeof obj;
        };
      } else {
        _typeof = function (obj) {
          return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
        };
      }

      return _typeof(obj);
    }

    function _slicedToArray(arr, i) {
      return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
    }

    function _arrayWithHoles(arr) {
      if (Array.isArray(arr)) return arr;
    }

    function _iterableToArrayLimit(arr, i) {
      if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return;
      var _arr = [];
      var _n = true;
      var _d = false;
      var _e = undefined;

      try {
        for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
          _arr.push(_s.value);

          if (i && _arr.length === i) break;
        }
      } catch (err) {
        _d = true;
        _e = err;
      } finally {
        try {
          if (!_n && _i["return"] != null) _i["return"]();
        } finally {
          if (_d) throw _e;
        }
      }

      return _arr;
    }

    function _unsupportedIterableToArray(o, minLen) {
      if (!o) return;
      if (typeof o === "string") return _arrayLikeToArray(o, minLen);
      var n = Object.prototype.toString.call(o).slice(8, -1);
      if (n === "Object" && o.constructor) n = o.constructor.name;
      if (n === "Map" || n === "Set") return Array.from(o);
      if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
    }

    function _arrayLikeToArray(arr, len) {
      if (len == null || len > arr.length) len = arr.length;

      for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

      return arr2;
    }

    function _nonIterableRest() {
      throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }

    var MSEC_IN_HOUR = 60 * 60 * 1000; //convert our local date syntax a javascript UTC date

    var toUtc = function toUtc(dstChange, offset, year) {
      var _dstChange$split = dstChange.split('/'),
          _dstChange$split2 = _slicedToArray(_dstChange$split, 2),
          month = _dstChange$split2[0],
          rest = _dstChange$split2[1];

      var _rest$split = rest.split(':'),
          _rest$split2 = _slicedToArray(_rest$split, 2),
          day = _rest$split2[0],
          hour = _rest$split2[1];

      return Date.UTC(year, month - 1, day, hour) - offset * MSEC_IN_HOUR;
    }; // compare epoch with dst change events (in utc)


    var inSummerTime = function inSummerTime(epoch, start, end, summerOffset, winterOffset) {
      var year = new Date(epoch).getUTCFullYear();
      var startUtc = toUtc(start, winterOffset, year);
      var endUtc = toUtc(end, summerOffset, year); // simple number comparison now

      return epoch >= startUtc && epoch < endUtc;
    };

    var summerTime = inSummerTime;

    // it reproduces some things in ./index.js, but speeds up spacetime considerably

    var quickOffset = function quickOffset(s) {
      var zones = s.timezones;
      var obj = zones[s.tz];

      if (obj === undefined) {
        console.warn("Warning: couldn't find timezone " + s.tz);
        return 0;
      }

      if (obj.dst === undefined) {
        return obj.offset;
      } //get our two possible offsets


      var jul = obj.offset;
      var dec = obj.offset + 1; // assume it's the same for now

      if (obj.hem === 'n') {
        dec = jul - 1;
      }

      var split = obj.dst.split('->');
      var inSummer = summerTime(s.epoch, split[0], split[1], jul, dec);

      if (inSummer === true) {
        return jul;
      }

      return dec;
    };

    var quick = quickOffset;

    var _build = {
    	"9|s": "2/dili,2/jayapura",
    	"9|n": "2/chita,2/khandyga,2/pyongyang,2/seoul,2/tokyo,11/palau",
    	"9.5|s|04/04:03->10/03:02": "4/adelaide,4/broken_hill,4/south,4/yancowinna",
    	"9.5|s": "4/darwin,4/north",
    	"8|s|03/08:01->10/04:00": "12/casey",
    	"8|s": "2/kuala_lumpur,2/makassar,2/singapore,4/perth,4/west",
    	"8|n|03/25:03->09/29:23": "2/ulan_bator",
    	"8|n": "2/brunei,2/choibalsan,2/chongqing,2/chungking,2/harbin,2/hong_kong,2/irkutsk,2/kuching,2/macao,2/macau,2/manila,2/shanghai,2/taipei,2/ujung_pandang,2/ulaanbaatar",
    	"8.75|s": "4/eucla",
    	"7|s": "12/davis,2/jakarta,9/christmas",
    	"7|n": "2/bangkok,2/barnaul,2/ho_chi_minh,2/hovd,2/krasnoyarsk,2/novokuznetsk,2/novosibirsk,2/phnom_penh,2/pontianak,2/saigon,2/tomsk,2/vientiane",
    	"6|s": "12/vostok",
    	"6|n": "2/almaty,2/bishkek,2/dacca,2/dhaka,2/kashgar,2/omsk,2/qyzylorda,2/qostanay,2/thimbu,2/thimphu,2/urumqi,9/chagos",
    	"6.5|n": "2/rangoon,2/yangon,9/cocos",
    	"5|s": "12/mawson,9/kerguelen",
    	"5|n": "2/aqtau,2/aqtobe,2/ashgabat,2/ashkhabad,2/atyrau,2/baku,2/dushanbe,2/karachi,2/oral,2/samarkand,2/tashkent,2/yekaterinburg,9/maldives",
    	"5.75|n": "2/kathmandu,2/katmandu",
    	"5.5|n": "2/calcutta,2/colombo,2/kolkata",
    	"4|s": "9/reunion",
    	"4|n": "2/dubai,2/muscat,2/tbilisi,2/yerevan,8/astrakhan,8/samara,8/saratov,8/ulyanovsk,8/volgograd,2/volgograd,9/mahe,9/mauritius",
    	"4.5|n|03/22:00->09/21:24": "2/tehran",
    	"4.5|n": "2/kabul",
    	"3|s": "12/syowa,9/antananarivo",
    	"3|n|03/28:03->10/31:04": "2/famagusta,2/nicosia,8/athens,8/bucharest,8/helsinki,8/kiev,8/mariehamn,8/nicosia,8/riga,8/sofia,8/tallinn,8/uzhgorod,8/vilnius,8/zaporozhye",
    	"3|n|03/28:02->10/31:03": "8/chisinau,8/tiraspol",
    	"3|n|03/28:00->10/30:24": "2/beirut",
    	"3|n|03/27:00->10/30:01": "2/gaza,2/hebron",
    	"3|n|03/26:02->10/31:02": "2/jerusalem,2/tel_aviv",
    	"3|n|03/26:00->10/29:01": "2/amman",
    	"3|n|03/26:00->10/28:24": "2/damascus",
    	"3|n": "0/addis_ababa,0/asmara,0/asmera,0/dar_es_salaam,0/djibouti,0/juba,0/kampala,0/mogadishu,0/nairobi,2/aden,2/baghdad,2/bahrain,2/istanbul,2/kuwait,2/qatar,2/riyadh,8/istanbul,8/kirov,8/minsk,8/moscow,8/simferopol,9/comoro,9/mayotte",
    	"2|s|03/28:02->10/31:02": "12/troll",
    	"2|s": "0/gaborone,0/harare,0/johannesburg,0/lubumbashi,0/lusaka,0/maputo,0/maseru,0/mbabane",
    	"2|n|03/28:02->10/31:03": "0/ceuta,arctic/longyearbyen,3/jan_mayen,8/amsterdam,8/andorra,8/belgrade,8/berlin,8/bratislava,8/brussels,8/budapest,8/busingen,8/copenhagen,8/gibraltar,8/ljubljana,8/luxembourg,8/madrid,8/malta,8/monaco,8/oslo,8/paris,8/podgorica,8/prague,8/rome,8/san_marino,8/sarajevo,8/skopje,8/stockholm,8/tirane,8/vaduz,8/vatican,8/vienna,8/warsaw,8/zagreb,8/zurich",
    	"2|n": "0/blantyre,0/bujumbura,0/cairo,0/khartoum,0/kigali,0/tripoli,8/kaliningrad",
    	"1|s|04/02:01->09/03:03": "0/windhoek",
    	"1|s": "0/kinshasa,0/luanda",
    	"1|n|04/11:03->05/16:02": "0/casablanca,0/el_aaiun",
    	"1|n|03/28:01->10/31:02": "3/canary,3/faeroe,3/faroe,3/madeira,8/belfast,8/dublin,8/guernsey,8/isle_of_man,8/jersey,8/lisbon,8/london",
    	"1|n": "0/algiers,0/bangui,0/brazzaville,0/douala,0/lagos,0/libreville,0/malabo,0/ndjamena,0/niamey,0/porto-novo,0/tunis",
    	"14|n": "11/kiritimati",
    	"13|s|04/04:04->09/26:03": "11/apia",
    	"13|s|01/15:02->11/05:03": "11/tongatapu",
    	"13|n": "11/enderbury,11/fakaofo",
    	"12|s|04/04:03->09/26:02": "12/mcmurdo,12/south_pole,11/auckland",
    	"12|s|01/17:03->11/14:02": "11/fiji",
    	"12|n": "2/anadyr,2/kamchatka,2/srednekolymsk,11/funafuti,11/kwajalein,11/majuro,11/nauru,11/tarawa,11/wake,11/wallis",
    	"12.75|s|04/04:03->04/04:02": "11/chatham",
    	"11|s|04/04:03->10/03:02": "12/macquarie",
    	"11|s": "11/bougainville",
    	"11|n": "2/magadan,2/sakhalin,11/efate,11/guadalcanal,11/kosrae,11/noumea,11/pohnpei,11/ponape",
    	"11.5|n|04/04:03->10/03:02": "11/norfolk",
    	"10|s|04/04:03->10/03:02": "4/act,4/canberra,4/currie,4/hobart,4/melbourne,4/nsw,4/sydney,4/tasmania,4/victoria",
    	"10|s": "12/dumontdurville,4/brisbane,4/lindeman,4/queensland",
    	"10|n": "2/ust-nera,2/vladivostok,2/yakutsk,11/chuuk,11/guam,11/port_moresby,11/saipan,11/truk,11/yap",
    	"10.5|s|04/04:01->10/03:02": "4/lhi,4/lord_howe",
    	"0|n|03/28:00->10/31:01": "1/scoresbysund,3/azores",
    	"0|n": "0/abidjan,0/accra,0/bamako,0/banjul,0/bissau,0/conakry,0/dakar,0/freetown,0/lome,0/monrovia,0/nouakchott,0/ouagadougou,0/sao_tome,0/timbuktu,1/danmarkshavn,3/reykjavik,3/st_helena,13/gmt,13/gmt+0,13/gmt-0,13/gmt0,13/greenwich,13/utc,13/universal,13/zulu",
    	"-9|n|03/14:02->11/07:02": "1/adak,1/atka",
    	"-9|n": "11/gambier",
    	"-9.5|n": "11/marquesas",
    	"-8|n|03/14:02->11/07:02": "1/anchorage,1/juneau,1/metlakatla,1/nome,1/sitka,1/yakutat",
    	"-8|n": "11/pitcairn",
    	"-7|n|03/14:02->11/07:02": "1/ensenada,1/los_angeles,1/santa_isabel,1/tijuana,1/vancouver,6/pacific,10/bajanorte",
    	"-7|n|03/08:02->11/01:01": "1/dawson,1/whitehorse,6/yukon",
    	"-7|n": "1/creston,1/dawson_creek,1/fort_nelson,1/hermosillo,1/phoenix",
    	"-6|s|04/03:22->09/04:22": "7/easterisland,11/easter",
    	"-6|n|04/04:02->10/31:02": "1/chihuahua,1/mazatlan,10/bajasur",
    	"-6|n|03/14:02->11/07:02": "1/boise,1/cambridge_bay,1/denver,1/edmonton,1/inuvik,1/ojinaga,1/shiprock,1/yellowknife,6/mountain",
    	"-6|n": "1/belize,1/costa_rica,1/el_salvador,1/guatemala,1/managua,1/regina,1/swift_current,1/tegucigalpa,6/east-saskatchewan,6/saskatchewan,11/galapagos",
    	"-5|s": "1/lima,1/rio_branco,5/acre",
    	"-5|n|04/04:02->10/31:02": "1/bahia_banderas,1/merida,1/mexico_city,1/monterrey,10/general",
    	"-5|n|03/14:02->11/07:02": "1/chicago,1/knox_in,1/matamoros,1/menominee,1/rainy_river,1/rankin_inlet,1/resolute,1/winnipeg,6/central",
    	"-5|n|03/12:03->11/05:01": "1/north_dakota",
    	"-5|n": "1/atikokan,1/bogota,1/cancun,1/cayman,1/coral_harbour,1/eirunepe,1/guayaquil,1/jamaica,1/panama,1/porto_acre",
    	"-4|s|05/13:23->08/13:01": "12/palmer",
    	"-4|s|04/03:24->09/05:00": "1/santiago,7/continental",
    	"-4|s|03/27:24->10/03:00": "1/asuncion",
    	"-4|s|02/16:24->11/03:00": "1/campo_grande,1/cuiaba",
    	"-4|s": "1/la_paz,1/manaus,5/west",
    	"-4|n|03/14:02->11/07:02": "1/detroit,1/fort_wayne,1/grand_turk,1/indianapolis,1/iqaluit,1/louisville,1/montreal,1/nassau,1/new_york,1/nipigon,1/pangnirtung,1/port-au-prince,1/thunder_bay,1/toronto,6/eastern",
    	"-4|n|03/14:00->11/07:01": "1/havana",
    	"-4|n|03/12:03->11/05:01": "1/indiana,1/kentucky",
    	"-4|n": "1/anguilla,1/antigua,1/aruba,1/barbados,1/blanc-sablon,1/boa_vista,1/caracas,1/curacao,1/dominica,1/grenada,1/guadeloupe,1/guyana,1/kralendijk,1/lower_princes,1/marigot,1/martinique,1/montserrat,1/port_of_spain,1/porto_velho,1/puerto_rico,1/santo_domingo,1/st_barthelemy,1/st_kitts,1/st_lucia,1/st_thomas,1/st_vincent,1/tortola,1/virgin",
    	"-3|s": "1/argentina,1/buenos_aires,1/cordoba,1/fortaleza,1/montevideo,1/punta_arenas,1/sao_paulo,12/rothera,3/stanley,5/east",
    	"-3|n|03/27:22->10/30:23": "1/nuuk",
    	"-3|n|03/14:02->11/07:02": "1/glace_bay,1/goose_bay,1/halifax,1/moncton,1/thule,3/bermuda,6/atlantic",
    	"-3|n": "1/araguaina,1/bahia,1/belem,1/catamarca,1/cayenne,1/jujuy,1/maceio,1/mendoza,1/paramaribo,1/recife,1/rosario,1/santarem",
    	"-2|s": "5/denoronha",
    	"-2|n|03/27:22->10/30:23": "1/godthab",
    	"-2|n|03/14:02->11/07:02": "1/miquelon",
    	"-2|n": "1/noronha,3/south_georgia",
    	"-2.5|n|03/14:02->11/07:02": "1/st_johns,6/newfoundland",
    	"-1|n": "3/cape_verde",
    	"-11|n": "11/midway,11/niue,11/pago_pago,11/samoa",
    	"-10|n": "11/honolulu,11/johnston,11/rarotonga,11/tahiti"
    };

    var _build$1 = /*#__PURE__*/Object.freeze({
      __proto__: null,
      'default': _build
    });

    //prefixes for iana names..
    var _prefixes = ['africa', 'america', 'asia', 'atlantic', 'australia', 'brazil', 'canada', 'chile', 'europe', 'indian', 'mexico', 'pacific', 'antarctica', 'etc'];

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    function getCjsExportFromNamespace (n) {
    	return n && n['default'] || n;
    }

    var data = getCjsExportFromNamespace(_build$1);

    var all = {};
    Object.keys(data).forEach(function (k) {
      var split = k.split('|');
      var obj = {
        offset: Number(split[0]),
        hem: split[1]
      };

      if (split[2]) {
        obj.dst = split[2];
      }

      var names = data[k].split(',');
      names.forEach(function (str) {
        str = str.replace(/(^[0-9]+)\//, function (before, num) {
          num = Number(num);
          return _prefixes[num] + '/';
        });
        all[str] = obj;
      });
    });
    all['utc'] = {
      offset: 0,
      hem: 'n' //default to northern hemisphere - (sorry!)

    }; //add etc/gmt+n

    for (var i = -14; i <= 14; i += 0.5) {
      var num = i;

      if (num > 0) {
        num = '+' + num;
      }

      var name = 'etc/gmt' + num;
      all[name] = {
        offset: i * -1,
        //they're negative!
        hem: 'n' //(sorry)

      };
      name = 'utc/gmt' + num; //this one too, why not.

      all[name] = {
        offset: i * -1,
        hem: 'n'
      };
    }

    var unpack = all;

    //find the implicit iana code for this machine.
    //safely query the Intl object
    //based on - https://bitbucket.org/pellepim/jstimezonedetect/src
    var fallbackTZ = 'utc'; //
    //this Intl object is not supported often, yet

    var safeIntl = function safeIntl() {
      if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat === 'undefined') {
        return null;
      }

      var format = Intl.DateTimeFormat();

      if (typeof format === 'undefined' || typeof format.resolvedOptions === 'undefined') {
        return null;
      }

      var timezone = format.resolvedOptions().timeZone;

      if (!timezone) {
        return null;
      }

      return timezone.toLowerCase();
    };

    var guessTz = function guessTz() {
      var timezone = safeIntl();

      if (timezone === null) {
        return fallbackTZ;
      }

      return timezone;
    }; //do it once per computer


    var guessTz_1 = guessTz;

    var isOffset = /(\-?[0-9]+)h(rs)?/i;
    var isNumber = /(\-?[0-9]+)/;
    var utcOffset = /utc([\-+]?[0-9]+)/i;
    var gmtOffset = /gmt([\-+]?[0-9]+)/i;

    var toIana = function toIana(num) {
      num = Number(num);

      if (num >= -13 && num <= 13) {
        num = num * -1; //it's opposite!

        num = (num > 0 ? '+' : '') + num; //add plus sign

        return 'etc/gmt' + num;
      }

      return null;
    };

    var parseOffset$1 = function parseOffset(tz) {
      // '+5hrs'
      var m = tz.match(isOffset);

      if (m !== null) {
        return toIana(m[1]);
      } // 'utc+5'


      m = tz.match(utcOffset);

      if (m !== null) {
        return toIana(m[1]);
      } // 'GMT-5' (not opposite)


      m = tz.match(gmtOffset);

      if (m !== null) {
        var num = Number(m[1]) * -1;
        return toIana(num);
      } // '+5'


      m = tz.match(isNumber);

      if (m !== null) {
        return toIana(m[1]);
      }

      return null;
    };

    var parseOffset_1$1 = parseOffset$1;

    var local = guessTz_1(); //add all the city names by themselves

    var cities = Object.keys(unpack).reduce(function (h, k) {
      var city = k.split('/')[1] || '';
      city = city.replace(/_/g, ' ');
      h[city] = k;
      return h;
    }, {}); //try to match these against iana form

    var normalize = function normalize(tz) {
      tz = tz.replace(/ time/g, '');
      tz = tz.replace(/ (standard|daylight|summer)/g, '');
      tz = tz.replace(/\b(east|west|north|south)ern/g, '$1');
      tz = tz.replace(/\b(africa|america|australia)n/g, '$1');
      tz = tz.replace(/\beuropean/g, 'europe');
      tz = tz.replace(/\islands/g, 'island');
      return tz;
    }; // try our best to reconcile the timzone to this given string


    var lookupTz = function lookupTz(str, zones) {
      if (!str) {
        return local;
      }

      if (typeof str !== 'string') {
        console.error("Timezone must be a string - recieved: '", str, "'\n");
      }

      var tz = str.trim();
      var split = str.split('/'); //support long timezones like 'America/Argentina/Rio_Gallegos'

      if (split.length > 2 && zones.hasOwnProperty(tz) === false) {
        tz = split[0] + '/' + split[1];
      }

      tz = tz.toLowerCase();

      if (zones.hasOwnProperty(tz) === true) {
        return tz;
      } //lookup more loosely..


      tz = normalize(tz);

      if (zones.hasOwnProperty(tz) === true) {
        return tz;
      } //try city-names


      if (cities.hasOwnProperty(tz) === true) {
        return cities[tz];
      } // //try to parse '-5h'


      if (/[0-9]/.test(tz) === true) {
        var id = parseOffset_1$1(tz);

        if (id) {
          return id;
        }
      }

      throw new Error("Spacetime: Cannot find timezone named: '" + str + "'. Please enter an IANA timezone id.");
    };

    var find = lookupTz;

    var o = {
      millisecond: 1
    };
    o.second = 1000;
    o.minute = 60000;
    o.hour = 3.6e6; // dst is supported post-hoc

    o.day = 8.64e7; //

    o.date = o.day;
    o.month = 8.64e7 * 29.5; //(average)

    o.week = 6.048e8;
    o.year = 3.154e10; // leap-years are supported post-hoc
    //add plurals

    Object.keys(o).forEach(function (k) {
      o[k + 's'] = o[k];
    });
    var milliseconds = o;

    var walk = function walk(s, n, fn, unit, previous) {
      var current = s.d[fn]();

      if (current === n) {
        return; //already there
      }

      var startUnit = previous === null ? null : s.d[previous]();
      var original = s.epoch; //try to get it as close as we can

      var diff = n - current;
      s.epoch += milliseconds[unit] * diff; //DST edge-case: if we are going many days, be a little conservative
      // console.log(unit, diff)

      if (unit === 'day') {
        // s.epoch -= ms.minute
        //but don't push it over a month
        if (Math.abs(diff) > 28 && n < 28) {
          s.epoch += milliseconds.hour;
        }
      } // 1st time: oops, did we change previous unit? revert it.


      if (previous !== null && startUnit !== s.d[previous]()) {
        // console.warn('spacetime warning: missed setting ' + unit)
        s.epoch = original; // s.epoch += ms[unit] * diff * 0.89 // maybe try and make it close...?
      } //repair it if we've gone too far or something
      //(go by half-steps, just in case)


      var halfStep = milliseconds[unit] / 2;

      while (s.d[fn]() < n) {
        s.epoch += halfStep;
      }

      while (s.d[fn]() > n) {
        s.epoch -= halfStep;
      } // 2nd time: did we change previous unit? revert it.


      if (previous !== null && startUnit !== s.d[previous]()) {
        // console.warn('spacetime warning: missed setting ' + unit)
        s.epoch = original;
      }
    }; //find the desired date by a increment/check while loop


    var units$3 = {
      year: {
        valid: function valid(n) {
          return n > -4000 && n < 4000;
        },
        walkTo: function walkTo(s, n) {
          return walk(s, n, 'getFullYear', 'year', null);
        }
      },
      month: {
        valid: function valid(n) {
          return n >= 0 && n <= 11;
        },
        walkTo: function walkTo(s, n) {
          var d = s.d;
          var current = d.getMonth();
          var original = s.epoch;
          var startUnit = d.getFullYear();

          if (current === n) {
            return;
          } //try to get it as close as we can..


          var diff = n - current;
          s.epoch += milliseconds.day * (diff * 28); //special case
          //oops, did we change the year? revert it.

          if (startUnit !== s.d.getFullYear()) {
            s.epoch = original;
          } //increment by day


          while (s.d.getMonth() < n) {
            s.epoch += milliseconds.day;
          }

          while (s.d.getMonth() > n) {
            s.epoch -= milliseconds.day;
          }
        }
      },
      date: {
        valid: function valid(n) {
          return n > 0 && n <= 31;
        },
        walkTo: function walkTo(s, n) {
          return walk(s, n, 'getDate', 'day', 'getMonth');
        }
      },
      hour: {
        valid: function valid(n) {
          return n >= 0 && n < 24;
        },
        walkTo: function walkTo(s, n) {
          return walk(s, n, 'getHours', 'hour', 'getDate');
        }
      },
      minute: {
        valid: function valid(n) {
          return n >= 0 && n < 60;
        },
        walkTo: function walkTo(s, n) {
          return walk(s, n, 'getMinutes', 'minute', 'getHours');
        }
      },
      second: {
        valid: function valid(n) {
          return n >= 0 && n < 60;
        },
        walkTo: function walkTo(s, n) {
          //do this one directly
          s.epoch = s.seconds(n).epoch;
        }
      },
      millisecond: {
        valid: function valid(n) {
          return n >= 0 && n < 1000;
        },
        walkTo: function walkTo(s, n) {
          //do this one directly
          s.epoch = s.milliseconds(n).epoch;
        }
      }
    };

    var walkTo = function walkTo(s, wants) {
      var keys = Object.keys(units$3);
      var old = s.clone();

      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var n = wants[k];

        if (n === undefined) {
          n = old[k]();
        }

        if (typeof n === 'string') {
          n = parseInt(n, 10);
        } //make-sure it's valid


        if (!units$3[k].valid(n)) {
          s.epoch = null;

          if (s.silent === false) {
            console.warn('invalid ' + k + ': ' + n);
          }

          return;
        }

        units$3[k].walkTo(s, n);
      }

      return;
    };

    var walk_1 = walkTo;

    var shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'oct', 'nov', 'dec'];
    var longMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

    function buildMapping() {
      var obj = {
        sep: 8 //support this format

      };

      for (var i = 0; i < shortMonths.length; i++) {
        obj[shortMonths[i]] = i;
      }

      for (var _i = 0; _i < longMonths.length; _i++) {
        obj[longMonths[_i]] = _i;
      }

      return obj;
    }

    var months$1 = {
      "short": function short() {
        return shortMonths;
      },
      "long": function long() {
        return longMonths;
      },
      mapping: function mapping() {
        return buildMapping();
      },
      set: function set(i18n) {
        shortMonths = i18n["short"] || shortMonths;
        longMonths = i18n["long"] || longMonths;
      }
    };

    //pull-apart ISO offsets, like "+0100"
    var parseOffset = function parseOffset(s, offset) {
      if (!offset) {
        return s;
      } //this is a fancy-move


      if (offset === 'Z' || offset === 'z') {
        offset = '+0000';
      } // according to ISO8601, tz could be hh:mm, hhmm or hh
      // so need few more steps before the calculation.


      var num = 0; // for (+-)hh:mm

      if (/^[\+-]?[0-9]{2}:[0-9]{2}$/.test(offset)) {
        //support "+01:00"
        if (/:00/.test(offset) === true) {
          offset = offset.replace(/:00/, '');
        } //support "+01:30"


        if (/:30/.test(offset) === true) {
          offset = offset.replace(/:30/, '.5');
        }
      } // for (+-)hhmm


      if (/^[\+-]?[0-9]{4}$/.test(offset)) {
        offset = offset.replace(/30$/, '.5');
      }

      num = parseFloat(offset); //divide by 100 or 10 - , "+0100", "+01"

      if (Math.abs(num) > 100) {
        num = num / 100;
      } //okay, try to match it to a utc timezone
      //remember - this is opposite! a -5 offset maps to Etc/GMT+5  ¯\_(:/)_/¯
      //https://askubuntu.com/questions/519550/why-is-the-8-timezone-called-gmt-8-in-the-filesystem


      num *= -1;

      if (num >= 0) {
        num = '+' + num;
      }

      var tz = 'etc/gmt' + num;
      var zones = s.timezones;

      if (zones[tz]) {
        // log a warning if we're over-writing a given timezone?
        // console.log('changing timezone to: ' + tz)
        s.tz = tz;
      }

      return s;
    };

    var parseOffset_1 = parseOffset;

    var parseTime = function parseTime(s) {
      var str = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
      str = str.replace(/^\s+/, '').toLowerCase(); //trim
      //formal time formats - 04:30.23

      var arr = str.match(/([0-9]{1,2}):([0-9]{1,2}):?([0-9]{1,2})?[:\.]?([0-9]{1,4})?/);

      if (arr !== null) {
        //validate it a little
        var h = Number(arr[1]);

        if (h < 0 || h > 24) {
          return s.startOf('day');
        }

        var m = Number(arr[2]); //don't accept '5:3pm'

        if (arr[2].length < 2 || m < 0 || m > 59) {
          return s.startOf('day');
        }

        if (arr[4] > 999) {
          // fix overflow issue with milliseconds, if input is longer than standard (e.g. 2017-08-06T09:00:00.123456Z)
          arr[4] = parseInt("".concat(arr[4]).substring(0, 3), 10);
        }

        s = s.hour(h);
        s = s.minute(m);
        s = s.seconds(arr[3] || 0);
        s = s.millisecond(arr[4] || 0); //parse-out am/pm

        var ampm = str.match(/[\b0-9](am|pm)\b/);

        if (ampm !== null && ampm[1]) {
          s = s.ampm(ampm[1]);
        }

        return s;
      } //try an informal form - 5pm (no minutes)


      arr = str.match(/([0-9]+) ?(am|pm)/);

      if (arr !== null && arr[1]) {
        var _h = Number(arr[1]); //validate it a little..


        if (_h > 12 || _h < 1) {
          return s.startOf('day');
        }

        s = s.hour(arr[1] || 0);
        s = s.ampm(arr[2]);
        s = s.startOf('hour');
        return s;
      } //no time info found, use start-of-day


      s = s.startOf('day');
      return s;
    };

    var parseTime_1 = parseTime;

    var monthLengths = [31, // January - 31 days
    28, // February - 28 days in a common year and 29 days in leap years
    31, // March - 31 days
    30, // April - 30 days
    31, // May - 31 days
    30, // June - 30 days
    31, // July - 31 days
    31, // August - 31 days
    30, // September - 30 days
    31, // October - 31 days
    30, // November - 30 days
    31 // December - 31 days
    ];
    var monthLengths_1 = monthLengths; // 28 - feb

    var fns = createCommonjsModule(function (module, exports) {
      //git:blame @JuliasCaesar https://www.timeanddate.com/date/leapyear.html
      exports.isLeapYear = function (year) {
        return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
      }; // unsurprisingly-nasty `typeof date` call


      exports.isDate = function (d) {
        return Object.prototype.toString.call(d) === '[object Date]' && !isNaN(d.valueOf());
      };

      exports.isArray = function (input) {
        return Object.prototype.toString.call(input) === '[object Array]';
      };

      exports.isObject = function (input) {
        return Object.prototype.toString.call(input) === '[object Object]';
      };

      exports.isBoolean = function (input) {
        return Object.prototype.toString.call(input) === '[object Boolean]';
      };

      exports.zeroPad = function (str) {
        var len = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 2;
        var pad = '0';
        str = str + '';
        return str.length >= len ? str : new Array(len - str.length + 1).join(pad) + str;
      };

      exports.titleCase = function (str) {
        if (!str) {
          return '';
        }

        return str[0].toUpperCase() + str.substr(1);
      };

      exports.ordinal = function (i) {
        var j = i % 10;
        var k = i % 100;

        if (j === 1 && k !== 11) {
          return i + 'st';
        }

        if (j === 2 && k !== 12) {
          return i + 'nd';
        }

        if (j === 3 && k !== 13) {
          return i + 'rd';
        }

        return i + 'th';
      }; //strip 'st' off '1st'..


      exports.toCardinal = function (str) {
        str = String(str);
        str = str.replace(/([0-9])(st|nd|rd|th)$/i, '$1');
        return parseInt(str, 10);
      }; //used mostly for cleanup of unit names, like 'months'


      exports.normalize = function () {
        var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
        str = str.toLowerCase().trim();
        str = str.replace(/ies$/, 'y'); //'centuries'

        str = str.replace(/s$/, '');
        str = str.replace(/-/g, '');

        if (str === 'day' || str === 'days') {
          return 'date';
        }

        if (str === 'min' || str === 'mins') {
          return 'minute';
        }

        return str;
      };

      exports.getEpoch = function (tmp) {
        //support epoch
        if (typeof tmp === 'number') {
          return tmp;
        } //suport date objects


        if (exports.isDate(tmp)) {
          return tmp.getTime();
        }

        if (tmp.epoch) {
          return tmp.epoch;
        }

        return null;
      }; //make sure this input is a spacetime obj


      exports.beADate = function (d, s) {
        if (exports.isObject(d) === false) {
          return s.clone().set(d);
        }

        return d;
      };

      exports.formatTimezone = function (offset) {
        var delimiter = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
        var sign = offset > 0 ? '+' : '-';
        var absOffset = Math.abs(offset);
        var hours = exports.zeroPad(parseInt('' + absOffset, 10));
        var minutes = exports.zeroPad(absOffset % 1 * 60);
        return "".concat(sign).concat(hours).concat(delimiter).concat(minutes);
      };
    });
    fns.isLeapYear;
    fns.isDate;
    fns.isArray;
    fns.isObject;
    fns.isBoolean;
    fns.zeroPad;
    fns.titleCase;
    fns.ordinal;
    fns.toCardinal;
    fns.normalize;
    fns.getEpoch;
    fns.beADate;
    fns.formatTimezone;

    var isLeapYear$2 = fns.isLeapYear; //given a month, return whether day number exists in it

    var hasDate = function hasDate(obj) {
      //invalid values
      if (monthLengths_1.hasOwnProperty(obj.month) !== true) {
        return false;
      } //support leap-year in february


      if (obj.month === 1) {
        if (isLeapYear$2(obj.year) && obj.date <= 29) {
          return true;
        } else {
          return obj.date <= 28;
        }
      } //is this date too-big for this month?


      var max = monthLengths_1[obj.month] || 0;

      if (obj.date <= max) {
        return true;
      }

      return false;
    };

    var hasDate_1 = hasDate;

    var months = months$1.mapping();

    var parseYear = function parseYear() {
      var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
      var today = arguments.length > 1 ? arguments[1] : undefined;
      var year = parseInt(str.trim(), 10); // use a given year from options.today

      if (!year && today) {
        year = today.year;
      } // fallback to this year


      year = year || new Date().getFullYear();
      return year;
    };

    var strFmt = [//iso-this 1998-05-30T22:00:00:000Z, iso-that 2017-04-03T08:00:00-0700
    {
      reg: /^(\-?0?0?[0-9]{3,4})-([0-9]{1,2})-([0-9]{1,2})[T| ]([0-9.:]+)(Z|[0-9\-\+:]+)?$/i,
      parse: function parse(s, arr, givenTz, options) {
        var month = parseInt(arr[2], 10) - 1;
        var obj = {
          year: arr[1],
          month: month,
          date: arr[3]
        };

        if (hasDate_1(obj) === false) {
          s.epoch = null;
          return s;
        }

        parseOffset_1(s, arr[5]);
        walk_1(s, obj);
        s = parseTime_1(s, arr[4]);
        return s;
      }
    }, //iso "2015-03-25" or "2015/03/25" or "2015/03/25 12:26:14 PM"
    {
      reg: /^([0-9]{4})[\-\/.]([0-9]{1,2})[\-\/.]([0-9]{1,2}),?( [0-9]{1,2}:[0-9]{2}:?[0-9]{0,2}? ?(am|pm|gmt))?$/i,
      parse: function parse(s, arr) {
        var obj = {
          year: arr[1],
          month: parseInt(arr[2], 10) - 1,
          date: parseInt(arr[3], 10)
        };

        if (obj.month >= 12) {
          //support yyyy/dd/mm (weird, but ok)
          obj.date = parseInt(arr[2], 10);
          obj.month = parseInt(arr[3], 10) - 1;
        }

        if (hasDate_1(obj) === false) {
          s.epoch = null;
          return s;
        }

        walk_1(s, obj);
        s = parseTime_1(s, arr[4]);
        return s;
      }
    }, //mm/dd/yyyy - uk/canada "6/28/2019, 12:26:14 PM"
    {
      reg: /^([0-9]{1,2})[\-\/.]([0-9]{1,2})[\-\/.]?([0-9]{4})?,?( [0-9]{1,2}:[0-9]{2}:?[0-9]{0,2}? ?(am|pm|gmt))?$/i,
      parse: function parse(s, arr) {
        var month = parseInt(arr[1], 10) - 1;
        var date = parseInt(arr[2], 10); //support dd/mm/yyy

        if (s.british || month >= 12) {
          date = parseInt(arr[1], 10);
          month = parseInt(arr[2], 10) - 1;
        }

        var year = parseYear(arr[3], s._today) || new Date().getFullYear();
        var obj = {
          year: year,
          month: month,
          date: date
        };

        if (hasDate_1(obj) === false) {
          s.epoch = null;
          return s;
        }

        walk_1(s, obj);
        s = parseTime_1(s, arr[4]);
        return s;
      }
    }, // '2012-06' last attempt at iso-like format
    {
      reg: /^([0-9]{4})[\-\/]([0-9]{2})$/i,
      parse: function parse(s, arr, givenTz, options) {
        var month = parseInt(arr[2], 10) - 1;
        var obj = {
          year: arr[1],
          month: month,
          date: 1
        };

        if (hasDate_1(obj) === false) {
          s.epoch = null;
          return s;
        }

        parseOffset_1(s, arr[5]);
        walk_1(s, obj);
        s = parseTime_1(s, arr[4]);
        return s;
      }
    }, //common british format - "25-feb-2015"
    {
      reg: /^([0-9]{1,2})[\-\/]([a-z]+)[\-\/]?([0-9]{4})?$/i,
      parse: function parse(s, arr) {
        var month = months[arr[2].toLowerCase()];
        var year = parseYear(arr[3], s._today);
        var obj = {
          year: year,
          month: month,
          date: fns.toCardinal(arr[1] || '')
        };

        if (hasDate_1(obj) === false) {
          s.epoch = null;
          return s;
        }

        walk_1(s, obj);
        s = parseTime_1(s, arr[4]);
        return s;
      }
    }, //alt short format - "feb-25-2015"
    {
      reg: /^([a-z]+)[\-\/]([0-9]{1,2})[\-\/]?([0-9]{4})?$/i,
      parse: function parse(s, arr) {
        var month = months[arr[1].toLowerCase()];
        var year = parseYear(arr[3], s._today);
        var obj = {
          year: year,
          month: month,
          date: fns.toCardinal(arr[2] || '')
        };

        if (hasDate_1(obj) === false) {
          s.epoch = null;
          return s;
        }

        walk_1(s, obj);
        s = parseTime_1(s, arr[4]);
        return s;
      }
    }, //Long "Mar 25 2015"
    //February 22, 2017 15:30:00
    {
      reg: /^([a-z]+) ([0-9]{1,2}(?:st|nd|rd|th)?),?( [0-9]{4})?( ([0-9:]+( ?am| ?pm| ?gmt)?))?$/i,
      parse: function parse(s, arr) {
        var month = months[arr[1].toLowerCase()];
        var year = parseYear(arr[3], s._today);
        var obj = {
          year: year,
          month: month,
          date: fns.toCardinal(arr[2] || '')
        };

        if (hasDate_1(obj) === false) {
          s.epoch = null;
          return s;
        }

        walk_1(s, obj);
        s = parseTime_1(s, arr[4]);
        return s;
      }
    }, //February 2017 (implied date)
    {
      reg: /^([a-z]+) ([0-9]{4})$/i,
      parse: function parse(s, arr) {
        var month = months[arr[1].toLowerCase()];
        var year = parseYear(arr[2], s._today);
        var obj = {
          year: year,
          month: month,
          date: s._today.date || 1
        };

        if (hasDate_1(obj) === false) {
          s.epoch = null;
          return s;
        }

        walk_1(s, obj);
        s = parseTime_1(s, arr[4]);
        return s;
      }
    }, //Long "25 Mar 2015"
    {
      reg: /^([0-9]{1,2}(?:st|nd|rd|th)?) ([a-z]+),?( [0-9]{4})?,? ?([0-9]{1,2}:[0-9]{2}:?[0-9]{0,2}? ?(am|pm|gmt))?$/i,
      parse: function parse(s, arr) {
        var month = months[arr[2].toLowerCase()];

        if (!month) {
          return null;
        }

        var year = parseYear(arr[3], s._today);
        var obj = {
          year: year,
          month: month,
          date: fns.toCardinal(arr[1])
        };

        if (hasDate_1(obj) === false) {
          s.epoch = null;
          return s;
        }

        walk_1(s, obj);
        s = parseTime_1(s, arr[4]);
        return s;
      }
    }, {
      // 'q2 2002'
      reg: /^(q[0-9])( of)?( [0-9]{4})?/i,
      parse: function parse(s, arr) {
        var quarter = arr[1] || '';
        s = s.quarter(quarter);
        var year = arr[3] || '';

        if (year) {
          year = year.trim();
          s = s.year(year);
        }

        return s;
      }
    }, {
      // 'summer 2002'
      reg: /^(spring|summer|winter|fall|autumn)( of)?( [0-9]{4})?/i,
      parse: function parse(s, arr) {
        var season = arr[1] || '';
        s = s.season(season);
        var year = arr[3] || '';

        if (year) {
          year = year.trim();
          s = s.year(year);
        }

        return s;
      }
    }, {
      // '200bc'
      reg: /^[0-9,]+ ?b\.?c\.?$/i,
      parse: function parse(s, arr) {
        var str = arr[0] || ''; //make negative-year

        str = str.replace(/^([0-9,]+) ?b\.?c\.?$/i, '-$1'); //remove commas

        str = str.replace(/,/g, '');
        var year = parseInt(str.trim(), 10);
        var d = new Date();
        var obj = {
          year: year,
          month: d.getMonth(),
          date: d.getDate()
        };

        if (hasDate_1(obj) === false) {
          s.epoch = null;
          return s;
        }

        walk_1(s, obj);
        s = parseTime_1(s);
        return s;
      }
    }, {
      // '200ad'
      reg: /^[0-9,]+ ?(a\.?d\.?|c\.?e\.?)$/i,
      parse: function parse(s, arr) {
        var str = arr[0] || ''; //remove commas

        str = str.replace(/,/g, '');
        var year = parseInt(str.trim(), 10);
        var d = new Date();
        var obj = {
          year: year,
          month: d.getMonth(),
          date: d.getDate()
        };

        if (hasDate_1(obj) === false) {
          s.epoch = null;
          return s;
        }

        walk_1(s, obj);
        s = parseTime_1(s);
        return s;
      }
    }, {
      // '1992'
      reg: /^[0-9]{4}( ?a\.?d\.?)?$/i,
      parse: function parse(s, arr) {
        var today = s._today;
        var year = parseYear(arr[0], today);
        var d = new Date(); // using today's date, but a new month is awkward.

        if (today.month && !today.date) {
          today.date = 1;
        }

        var obj = {
          year: year,
          month: today.month || d.getMonth(),
          date: today.date || d.getDate()
        };

        if (hasDate_1(obj) === false) {
          s.epoch = null;
          return s;
        }

        walk_1(s, obj);
        s = parseTime_1(s);
        return s;
      }
    }];
    var strParse = strFmt;

    // pull in 'today' data for the baseline moment
    var getNow = function getNow(s) {
      s.epoch = Date.now();
      Object.keys(s._today || {}).forEach(function (k) {
        if (typeof s[k] === 'function') {
          s = s[k](s._today[k]);
        }
      });
      return s;
    };

    var dates = {
      now: function now(s) {
        return getNow(s);
      },
      today: function today(s) {
        return getNow(s);
      },
      tonight: function tonight(s) {
        s = getNow(s);
        s = s.hour(18); //6pm

        return s;
      },
      tomorrow: function tomorrow(s) {
        s = getNow(s);
        s = s.add(1, 'day');
        s = s.startOf('day');
        return s;
      },
      yesterday: function yesterday(s) {
        s = getNow(s);
        s = s.subtract(1, 'day');
        s = s.startOf('day');
        return s;
      },
      christmas: function christmas(s) {
        var year = getNow(s).year();
        s = s.set([year, 11, 25, 18, 0, 0]); // Dec 25

        return s;
      },
      'new years': function newYears(s) {
        var year = getNow(s).year();
        s = s.set([year, 11, 31, 18, 0, 0]); // Dec 31

        return s;
      }
    };
    dates['new years eve'] = dates['new years'];
    var namedDates = dates;

    //  -  can't use built-in js parser ;(
    //=========================================
    // ISO Date	  "2015-03-25"
    // Short Date	"03/25/2015" or "2015/03/25"
    // Long Date	"Mar 25 2015" or "25 Mar 2015"
    // Full Date	"Wednesday March 25 2015"
    //=========================================
    //-- also -
    // if the given epoch is really small, they've probably given seconds and not milliseconds
    // anything below this number is likely (but not necessarily) a mistaken input.
    // this may seem like an arbitrary number, but it's 'within jan 1970'
    // this is only really ambiguous until 2054 or so

    var minimumEpoch = 2500000000;
    var defaults = {
      year: new Date().getFullYear(),
      month: 0,
      date: 1
    }; //support [2016, 03, 01] format

    var handleArray = function handleArray(s, arr, today) {
      if (arr.length === 0) {
        return s;
      }

      var order = ['year', 'month', 'date', 'hour', 'minute', 'second', 'millisecond'];

      for (var i = 0; i < order.length; i++) {
        var num = arr[i] || today[order[i]] || defaults[order[i]] || 0;
        s = s[order[i]](num);
      }

      return s;
    }; //support {year:2016, month:3} format


    var handleObject = function handleObject(s, obj, today) {
      // if obj is empty, do nothing
      if (Object.keys(obj).length === 0) {
        return s;
      }

      obj = Object.assign({}, defaults, today, obj);
      var keys = Object.keys(obj);

      for (var i = 0; i < keys.length; i++) {
        var unit = keys[i]; //make sure we have this method

        if (s[unit] === undefined || typeof s[unit] !== 'function') {
          continue;
        } //make sure the value is a number


        if (obj[unit] === null || obj[unit] === undefined || obj[unit] === '') {
          continue;
        }

        var num = obj[unit] || today[unit] || defaults[unit] || 0;
        s = s[unit](num);
      }

      return s;
    }; //find the epoch from different input styles


    var parseInput = function parseInput(s, input, givenTz) {
      var today = s._today || defaults; //if we've been given a epoch number, it's easy

      if (typeof input === 'number') {
        if (input > 0 && input < minimumEpoch && s.silent === false) {
          console.warn('  - Warning: You are setting the date to January 1970.');
          console.warn('       -   did input seconds instead of milliseconds?');
        }

        s.epoch = input;
        return s;
      } //set tmp time


      s.epoch = Date.now(); // overwrite tmp time with 'today' value, if exists

      if (s._today && fns.isObject(s._today) && Object.keys(s._today).length > 0) {
        var res = handleObject(s, today, defaults);

        if (res.isValid()) {
          s.epoch = res.epoch;
        }
      } // null input means 'now'


      if (input === null || input === undefined || input === '') {
        return s; //k, we're good.
      } //support input of Date() object


      if (fns.isDate(input) === true) {
        s.epoch = input.getTime();
        return s;
      } //support [2016, 03, 01] format


      if (fns.isArray(input) === true) {
        s = handleArray(s, input, today);
        return s;
      } //support {year:2016, month:3} format


      if (fns.isObject(input) === true) {
        //support spacetime object as input
        if (input.epoch) {
          s.epoch = input.epoch;
          s.tz = input.tz;
          return s;
        }

        s = handleObject(s, input, today);
        return s;
      } //input as a string..


      if (typeof input !== 'string') {
        return s;
      } //little cleanup..


      input = input.replace(/\b(mon|tues|wed|wednes|thu|thurs|fri|sat|satur|sun)(day)?\b/i, '');
      input = input.replace(/,/g, '');
      input = input.replace(/ +/g, ' ').trim(); //try some known-words, like 'now'

      if (namedDates.hasOwnProperty(input) === true) {
        s = namedDates[input](s);
        return s;
      } //try each text-parse template, use the first good result


      for (var i = 0; i < strParse.length; i++) {
        var m = input.match(strParse[i].reg);

        if (m) {
          // console.log(strFmt[i].reg)
          var _res = strParse[i].parse(s, m, givenTz);

          if (_res !== null && _res.isValid()) {
            return _res;
          }
        }
      }

      if (s.silent === false) {
        console.warn("Warning: couldn't parse date-string: '" + input + "'");
      }

      s.epoch = null;
      return s;
    };

    var input = parseInput;

    var shortDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    var longDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    var days = {
      "short": function short() {
        return shortDays;
      },
      "long": function long() {
        return longDays;
      },
      set: function set(i18n) {
        shortDays = i18n["short"] || shortDays;
        longDays = i18n["long"] || longDays;
      },
      aliases: {
        mo: 1,
        tu: 2,
        we: 3,
        th: 4,
        fr: 5,
        sa: 6,
        su: 7,
        tues: 2,
        weds: 3,
        wedn: 3,
        thur: 4,
        thurs: 4
      }
    };

    var titleCaseEnabled = true;
    var caseFormat = {
      useTitleCase: function useTitleCase() {
        return titleCaseEnabled;
      },
      set: function set(useTitleCase) {
        titleCaseEnabled = useTitleCase;
      }
    };

    // it's kind of nuts how involved this is
    // "+01:00", "+0100", or simply "+01"

    var isoOffset = function isoOffset(s) {
      var offset = s.timezone().current.offset;
      return !offset ? 'Z' : fns.formatTimezone(offset, ':');
    };

    var _offset = isoOffset;

    var applyCaseFormat = function applyCaseFormat(str) {
      if (caseFormat.useTitleCase()) {
        return fns.titleCase(str);
      }

      return str;
    };

    var format = {
      day: function day(s) {
        return applyCaseFormat(s.dayName());
      },
      'day-short': function dayShort(s) {
        return applyCaseFormat(days["short"]()[s.day()]);
      },
      'day-number': function dayNumber(s) {
        return s.day();
      },
      'day-ordinal': function dayOrdinal(s) {
        return fns.ordinal(s.day());
      },
      'day-pad': function dayPad(s) {
        return fns.zeroPad(s.day());
      },
      date: function date(s) {
        return s.date();
      },
      'date-ordinal': function dateOrdinal(s) {
        return fns.ordinal(s.date());
      },
      'date-pad': function datePad(s) {
        return fns.zeroPad(s.date());
      },
      month: function month(s) {
        return applyCaseFormat(s.monthName());
      },
      'month-short': function monthShort(s) {
        return applyCaseFormat(months$1["short"]()[s.month()]);
      },
      'month-number': function monthNumber(s) {
        return s.month();
      },
      'month-ordinal': function monthOrdinal(s) {
        return fns.ordinal(s.month());
      },
      'month-pad': function monthPad(s) {
        return fns.zeroPad(s.month());
      },
      'iso-month': function isoMonth(s) {
        return fns.zeroPad(s.month() + 1);
      },
      //1-based months
      year: function year(s) {
        var year = s.year();

        if (year > 0) {
          return year;
        }

        year = Math.abs(year);
        return year + ' BC';
      },
      'year-short': function yearShort(s) {
        var year = s.year();

        if (year > 0) {
          return "'".concat(String(s.year()).substr(2, 4));
        }

        year = Math.abs(year);
        return year + ' BC';
      },
      'iso-year': function isoYear(s) {
        var year = s.year();
        var isNegative = year < 0;
        var str = fns.zeroPad(Math.abs(year), 4); //0-padded

        if (isNegative) {
          //negative years are for some reason 6-digits ('-00008')
          str = fns.zeroPad(str, 6);
          str = '-' + str;
        }

        return str;
      },
      time: function time(s) {
        return s.time();
      },
      'time-24': function time24(s) {
        return "".concat(s.hour24(), ":").concat(fns.zeroPad(s.minute()));
      },
      hour: function hour(s) {
        return s.hour12();
      },
      'hour-pad': function hourPad(s) {
        return fns.zeroPad(s.hour12());
      },
      'hour-24': function hour24(s) {
        return s.hour24();
      },
      'hour-24-pad': function hour24Pad(s) {
        return fns.zeroPad(s.hour24());
      },
      minute: function minute(s) {
        return s.minute();
      },
      'minute-pad': function minutePad(s) {
        return fns.zeroPad(s.minute());
      },
      second: function second(s) {
        return s.second();
      },
      'second-pad': function secondPad(s) {
        return fns.zeroPad(s.second());
      },
      ampm: function ampm(s) {
        return s.ampm();
      },
      quarter: function quarter(s) {
        return 'Q' + s.quarter();
      },
      season: function season(s) {
        return s.season();
      },
      era: function era(s) {
        return s.era();
      },
      json: function json(s) {
        return s.json();
      },
      timezone: function timezone(s) {
        return s.timezone().name;
      },
      offset: function offset(s) {
        return _offset(s);
      },
      numeric: function numeric(s) {
        return "".concat(s.year(), "/").concat(fns.zeroPad(s.month() + 1), "/").concat(fns.zeroPad(s.date()));
      },
      // yyyy/mm/dd
      'numeric-us': function numericUs(s) {
        return "".concat(fns.zeroPad(s.month() + 1), "/").concat(fns.zeroPad(s.date()), "/").concat(s.year());
      },
      // mm/dd/yyyy
      'numeric-uk': function numericUk(s) {
        return "".concat(fns.zeroPad(s.date()), "/").concat(fns.zeroPad(s.month() + 1), "/").concat(s.year());
      },
      //dd/mm/yyyy
      'mm/dd': function mmDd(s) {
        return "".concat(fns.zeroPad(s.month() + 1), "/").concat(fns.zeroPad(s.date()));
      },
      //mm/dd
      // ... https://en.wikipedia.org/wiki/ISO_8601 ;(((
      iso: function iso(s) {
        var year = s.format('iso-year');
        var month = fns.zeroPad(s.month() + 1); //1-based months

        var date = fns.zeroPad(s.date());
        var hour = fns.zeroPad(s.h24());
        var minute = fns.zeroPad(s.minute());
        var second = fns.zeroPad(s.second());
        var ms = fns.zeroPad(s.millisecond(), 3);
        var offset = _offset(s);
        return "".concat(year, "-").concat(month, "-").concat(date, "T").concat(hour, ":").concat(minute, ":").concat(second, ".").concat(ms).concat(offset); //2018-03-09T08:50:00.000-05:00
      },
      'iso-short': function isoShort(s) {
        var month = fns.zeroPad(s.month() + 1); //1-based months

        var date = fns.zeroPad(s.date());
        return "".concat(s.year(), "-").concat(month, "-").concat(date); //2017-02-15
      },
      'iso-utc': function isoUtc(s) {
        return new Date(s.epoch).toISOString(); //2017-03-08T19:45:28.367Z
      },
      //i made these up
      nice: function nice(s) {
        return "".concat(months$1["short"]()[s.month()], " ").concat(fns.ordinal(s.date()), ", ").concat(s.time());
      },
      'nice-24': function nice24(s) {
        return "".concat(months$1["short"]()[s.month()], " ").concat(fns.ordinal(s.date()), ", ").concat(s.hour24(), ":").concat(fns.zeroPad(s.minute()));
      },
      'nice-year': function niceYear(s) {
        return "".concat(months$1["short"]()[s.month()], " ").concat(fns.ordinal(s.date()), ", ").concat(s.year());
      },
      'nice-day': function niceDay(s) {
        return "".concat(days["short"]()[s.day()], " ").concat(applyCaseFormat(months$1["short"]()[s.month()]), " ").concat(fns.ordinal(s.date()));
      },
      'nice-full': function niceFull(s) {
        return "".concat(s.dayName(), " ").concat(applyCaseFormat(s.monthName()), " ").concat(fns.ordinal(s.date()), ", ").concat(s.time());
      },
      'nice-full-24': function niceFull24(s) {
        return "".concat(s.dayName(), " ").concat(applyCaseFormat(s.monthName()), " ").concat(fns.ordinal(s.date()), ", ").concat(s.hour24(), ":").concat(fns.zeroPad(s.minute()));
      }
    }; //aliases

    var aliases = {
      'day-name': 'day',
      'month-name': 'month',
      'iso 8601': 'iso',
      'time-h24': 'time-24',
      'time-12': 'time',
      'time-h12': 'time',
      tz: 'timezone',
      'day-num': 'day-number',
      'month-num': 'month-number',
      'month-iso': 'iso-month',
      'year-iso': 'iso-year',
      'nice-short': 'nice',
      'nice-short-24': 'nice-24',
      mdy: 'numeric-us',
      dmy: 'numeric-uk',
      ymd: 'numeric',
      'yyyy/mm/dd': 'numeric',
      'mm/dd/yyyy': 'numeric-us',
      'dd/mm/yyyy': 'numeric-us',
      'little-endian': 'numeric-uk',
      'big-endian': 'numeric',
      'day-nice': 'nice-day'
    };
    Object.keys(aliases).forEach(function (k) {
      return format[k] = format[aliases[k]];
    });

    var printFormat = function printFormat(s) {
      var str = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

      //don't print anything if it's an invalid date
      if (s.isValid() !== true) {
        return '';
      } //support .format('month')


      if (format.hasOwnProperty(str)) {
        var out = format[str](s) || '';

        if (str !== 'json') {
          out = String(out);

          if (str !== 'ampm') {
            out = applyCaseFormat(out);
          }
        }

        return out;
      } //support '{hour}:{minute}' notation


      if (str.indexOf('{') !== -1) {
        var sections = /\{(.+?)\}/g;
        str = str.replace(sections, function (_, fmt) {
          fmt = fmt.toLowerCase().trim();

          if (format.hasOwnProperty(fmt)) {
            var _out = String(format[fmt](s));

            if (fmt !== 'ampm') {
              return applyCaseFormat(_out);
            }

            return _out;
          }

          return '';
        });
        return str;
      }

      return s.format('iso-short');
    };

    var format_1 = printFormat;

    var pad = fns.zeroPad;
    var formatTimezone = fns.formatTimezone; //parse this insane unix-time-templating thing, from the 19th century
    //http://unicode.org/reports/tr35/tr35-25.html#Date_Format_Patterns
    //time-symbols we support

    var mapping = {
      G: function G(s) {
        return s.era();
      },
      GG: function GG(s) {
        return s.era();
      },
      GGG: function GGG(s) {
        return s.era();
      },
      GGGG: function GGGG(s) {
        return s.era() === 'AD' ? 'Anno Domini' : 'Before Christ';
      },
      //year
      y: function y(s) {
        return s.year();
      },
      yy: function yy(s) {
        //last two chars
        return parseInt(String(s.year()).substr(2, 4), 10);
      },
      yyy: function yyy(s) {
        return s.year();
      },
      yyyy: function yyyy(s) {
        return s.year();
      },
      yyyyy: function yyyyy(s) {
        return '0' + s.year();
      },
      // u: (s) => {},//extended non-gregorian years
      //quarter
      Q: function Q(s) {
        return s.quarter();
      },
      QQ: function QQ(s) {
        return s.quarter();
      },
      QQQ: function QQQ(s) {
        return s.quarter();
      },
      QQQQ: function QQQQ(s) {
        return s.quarter();
      },
      //month
      M: function M(s) {
        return s.month() + 1;
      },
      MM: function MM(s) {
        return pad(s.month() + 1);
      },
      MMM: function MMM(s) {
        return s.format('month-short');
      },
      MMMM: function MMMM(s) {
        return s.format('month');
      },
      //week
      w: function w(s) {
        return s.week();
      },
      ww: function ww(s) {
        return pad(s.week());
      },
      //week of month
      // W: (s) => s.week(),
      //date of month
      d: function d(s) {
        return s.date();
      },
      dd: function dd(s) {
        return pad(s.date());
      },
      //date of year
      D: function D(s) {
        return s.dayOfYear();
      },
      DD: function DD(s) {
        return pad(s.dayOfYear());
      },
      DDD: function DDD(s) {
        return pad(s.dayOfYear(), 3);
      },
      // F: (s) => {},//date of week in month
      // g: (s) => {},//modified julian day
      //day
      E: function E(s) {
        return s.format('day-short');
      },
      EE: function EE(s) {
        return s.format('day-short');
      },
      EEE: function EEE(s) {
        return s.format('day-short');
      },
      EEEE: function EEEE(s) {
        return s.format('day');
      },
      EEEEE: function EEEEE(s) {
        return s.format('day')[0];
      },
      e: function e(s) {
        return s.day();
      },
      ee: function ee(s) {
        return s.day();
      },
      eee: function eee(s) {
        return s.format('day-short');
      },
      eeee: function eeee(s) {
        return s.format('day');
      },
      eeeee: function eeeee(s) {
        return s.format('day')[0];
      },
      //am/pm
      a: function a(s) {
        return s.ampm().toUpperCase();
      },
      aa: function aa(s) {
        return s.ampm().toUpperCase();
      },
      aaa: function aaa(s) {
        return s.ampm().toUpperCase();
      },
      aaaa: function aaaa(s) {
        return s.ampm().toUpperCase();
      },
      //hour
      h: function h(s) {
        return s.h12();
      },
      hh: function hh(s) {
        return pad(s.h12());
      },
      H: function H(s) {
        return s.hour();
      },
      HH: function HH(s) {
        return pad(s.hour());
      },
      // j: (s) => {},//weird hour format
      m: function m(s) {
        return s.minute();
      },
      mm: function mm(s) {
        return pad(s.minute());
      },
      s: function s(_s) {
        return _s.second();
      },
      ss: function ss(s) {
        return pad(s.second());
      },
      //milliseconds in the day
      A: function A(s) {
        return s.epoch - s.startOf('day').epoch;
      },
      //timezone
      z: function z(s) {
        return s.timezone().name;
      },
      zz: function zz(s) {
        return s.timezone().name;
      },
      zzz: function zzz(s) {
        return s.timezone().name;
      },
      zzzz: function zzzz(s) {
        return s.timezone().name;
      },
      Z: function Z(s) {
        return formatTimezone(s.timezone().current.offset);
      },
      ZZ: function ZZ(s) {
        return formatTimezone(s.timezone().current.offset);
      },
      ZZZ: function ZZZ(s) {
        return formatTimezone(s.timezone().current.offset);
      },
      ZZZZ: function ZZZZ(s) {
        return formatTimezone(s.timezone().current.offset, ':');
      }
    };

    var addAlias = function addAlias(_char, to, n) {
      var name = _char;
      var toName = to;

      for (var i = 0; i < n; i += 1) {
        mapping[name] = mapping[toName];
        name += _char;
        toName += to;
      }
    };

    addAlias('q', 'Q', 4);
    addAlias('L', 'M', 4);
    addAlias('Y', 'y', 4);
    addAlias('c', 'e', 4);
    addAlias('k', 'H', 2);
    addAlias('K', 'h', 2);
    addAlias('S', 's', 2);
    addAlias('v', 'z', 4);
    addAlias('V', 'Z', 4); // support unix-style escaping with ' character

    var escapeChars = function escapeChars(arr) {
      for (var i = 0; i < arr.length; i += 1) {
        if (arr[i] === "'") {
          // greedy-search for next apostrophe
          for (var o = i + 1; o < arr.length; o += 1) {
            if (arr[o]) {
              arr[i] += arr[o];
            }

            if (arr[o] === "'") {
              arr[o] = null;
              break;
            }

            arr[o] = null;
          }
        }
      }

      return arr.filter(function (ch) {
        return ch;
      });
    }; //combine consecutive chars, like 'yyyy' as one.


    var combineRepeated = function combineRepeated(arr) {
      for (var i = 0; i < arr.length; i += 1) {
        var c = arr[i]; // greedy-forward

        for (var o = i + 1; o < arr.length; o += 1) {
          if (arr[o] === c) {
            arr[i] += arr[o];
            arr[o] = null;
          } else {
            break;
          }
        }
      } // '' means one apostrophe


      arr = arr.filter(function (ch) {
        return ch;
      });
      arr = arr.map(function (str) {
        if (str === "''") {
          str = "'";
        }

        return str;
      });
      return arr;
    };

    var unixFmt = function unixFmt(s, str) {
      var arr = str.split(''); // support character escaping

      arr = escapeChars(arr); //combine 'yyyy' as string.

      arr = combineRepeated(arr);
      return arr.reduce(function (txt, c) {
        if (mapping[c] !== undefined) {
          txt += mapping[c](s) || '';
        } else {
          // 'unescape'
          if (/^'.{1,}'$/.test(c)) {
            c = c.replace(/'/g, '');
          }

          txt += c;
        }

        return txt;
      }, '');
    };

    var unixFmt_1 = unixFmt;

    var units$2 = ['year', 'season', 'quarter', 'month', 'week', 'day', 'quarterHour', 'hour', 'minute'];

    var doUnit = function doUnit(s, k) {
      var start = s.clone().startOf(k);
      var end = s.clone().endOf(k);
      var duration = end.epoch - start.epoch;
      var percent = (s.epoch - start.epoch) / duration;
      return parseFloat(percent.toFixed(2));
    }; //how far it is along, from 0-1


    var progress = function progress(s, unit) {
      if (unit) {
        unit = fns.normalize(unit);
        return doUnit(s, unit);
      }

      var obj = {};
      units$2.forEach(function (k) {
        obj[k] = doUnit(s, k);
      });
      return obj;
    };

    var progress_1 = progress;

    var nearest = function nearest(s, unit) {
      //how far have we gone?
      var prog = s.progress();
      unit = fns.normalize(unit); //fix camel-case for this one

      if (unit === 'quarterhour') {
        unit = 'quarterHour';
      }

      if (prog[unit] !== undefined) {
        // go forward one?
        if (prog[unit] > 0.5) {
          s = s.add(1, unit);
        } // go to start


        s = s.startOf(unit);
      } else if (s.silent === false) {
        console.warn("no known unit '" + unit + "'");
      }

      return s;
    };

    var nearest_1 = nearest;

    //increment until dates are the same
    var climb = function climb(a, b, unit) {
      var i = 0;
      a = a.clone();

      while (a.isBefore(b)) {
        //do proper, expensive increment to catch all-the-tricks
        a = a.add(1, unit);
        i += 1;
      } //oops, we went too-far..


      if (a.isAfter(b, unit)) {
        i -= 1;
      }

      return i;
    }; // do a thurough +=1 on the unit, until they match
    // for speed-reasons, only used on day, month, week.


    var diffOne = function diffOne(a, b, unit) {
      if (a.isBefore(b)) {
        return climb(a, b, unit);
      } else {
        return climb(b, a, unit) * -1; //reverse it
      }
    };

    var one = diffOne;

    // 2020 - 2019 may be 1 year, or 0 years
    // - '1 year difference' means 366 days during a leap year

    var fastYear = function fastYear(a, b) {
      var years = b.year() - a.year(); // should we decrement it by 1?

      a = a.year(b.year());

      if (a.isAfter(b)) {
        years -= 1;
      }

      return years;
    }; // use a waterfall-method for computing a diff of any 'pre-knowable' units
    // compute years, then compute months, etc..
    // ... then ms-math for any very-small units


    var diff$1 = function diff(a, b) {
      // an hour is always the same # of milliseconds
      // so these units can be 'pre-calculated'
      var msDiff = b.epoch - a.epoch;
      var obj = {
        milliseconds: msDiff,
        seconds: parseInt(msDiff / 1000, 10)
      };
      obj.minutes = parseInt(obj.seconds / 60, 10);
      obj.hours = parseInt(obj.minutes / 60, 10); //do the year

      var tmp = a.clone();
      obj.years = fastYear(tmp, b);
      tmp = a.add(obj.years, 'year'); //there's always 12 months in a year...

      obj.months = obj.years * 12;
      tmp = a.add(obj.months, 'month');
      obj.months += one(tmp, b, 'month'); // there's always atleast 52 weeks in a year..
      // (month * 4) isn't as close

      obj.weeks = obj.years * 52;
      tmp = a.add(obj.weeks, 'week');
      obj.weeks += one(tmp, b, 'week'); // there's always atleast 7 days in a week

      obj.days = obj.weeks * 7;
      tmp = a.add(obj.days, 'day');
      obj.days += one(tmp, b, 'day');
      return obj;
    };

    var waterfall = diff$1;

    var reverseDiff = function reverseDiff(obj) {
      Object.keys(obj).forEach(function (k) {
        obj[k] *= -1;
      });
      return obj;
    }; // this method counts a total # of each unit, between a, b.
    // '1 month' means 28 days in february
    // '1 year' means 366 days in a leap year


    var main$1 = function main(a, b, unit) {
      b = fns.beADate(b, a); //reverse values, if necessary

      var reversed = false;

      if (a.isAfter(b)) {
        var tmp = a;
        a = b;
        b = tmp;
        reversed = true;
      } //compute them all (i know!)


      var obj = waterfall(a, b);

      if (reversed) {
        obj = reverseDiff(obj);
      } //return just the requested unit


      if (unit) {
        //make sure it's plural-form
        unit = fns.normalize(unit);

        if (/s$/.test(unit) !== true) {
          unit += 's';
        }

        if (unit === 'dates') {
          unit = 'days';
        }

        return obj[unit];
      }

      return obj;
    };

    var diff = main$1;

    //our conceptual 'break-points' for each unit

    var qualifiers = {
      months: {
        almost: 10,
        over: 4
      },
      days: {
        almost: 25,
        over: 10
      },
      hours: {
        almost: 20,
        over: 8
      },
      minutes: {
        almost: 50,
        over: 20
      },
      seconds: {
        almost: 50,
        over: 20
      }
    }; //get number of hours/minutes... between the two dates

    function getDiff(a, b) {
      var isBefore = a.isBefore(b);
      var later = isBefore ? b : a;
      var earlier = isBefore ? a : b;
      earlier = earlier.clone();
      var diff = {
        years: 0,
        months: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
      };
      Object.keys(diff).forEach(function (unit) {
        if (earlier.isSame(later, unit)) {
          return;
        }

        var max = earlier.diff(later, unit);
        earlier = earlier.add(max, unit);
        diff[unit] = max;
      }); //reverse it, if necessary

      if (isBefore) {
        Object.keys(diff).forEach(function (u) {
          if (diff[u] !== 0) {
            diff[u] *= -1;
          }
        });
      }

      return diff;
    } // Expects a plural unit arg


    function pluralize(value, unit) {
      if (value === 1) {
        unit = unit.slice(0, -1);
      }

      return value + ' ' + unit;
    } //create the human-readable diff between the two dates


    var since = function since(start, end) {
      end = fns.beADate(end, start);
      var diff = getDiff(start, end);
      var isNow = Object.keys(diff).every(function (u) {
        return !diff[u];
      });

      if (isNow === true) {
        return {
          diff: diff,
          rounded: 'now',
          qualified: 'now',
          precise: 'now'
        };
      }

      var rounded;
      var qualified;
      var precise;
      var englishValues = []; //go through each value and create its text-representation

      Object.keys(diff).forEach(function (unit, i, units) {
        var value = Math.abs(diff[unit]);

        if (value === 0) {
          return;
        }

        var englishValue = pluralize(value, unit);
        englishValues.push(englishValue);

        if (!rounded) {
          rounded = qualified = englishValue;

          if (i > 4) {
            return;
          } //is it a 'almost' something, etc?


          var nextUnit = units[i + 1];
          var nextValue = Math.abs(diff[nextUnit]);

          if (nextValue > qualifiers[nextUnit].almost) {
            rounded = pluralize(value + 1, unit);
            qualified = 'almost ' + rounded;
          } else if (nextValue > qualifiers[nextUnit].over) qualified = 'over ' + englishValue;
        }
      }); //make them into a string

      precise = englishValues.splice(0, 2).join(', '); //handle before/after logic

      if (start.isAfter(end) === true) {
        rounded += ' ago';
        qualified += ' ago';
        precise += ' ago';
      } else {
        rounded = 'in ' + rounded;
        qualified = 'in ' + qualified;
        precise = 'in ' + precise;
      }

      return {
        diff: diff,
        rounded: rounded,
        qualified: qualified,
        precise: precise
      };
    };

    var since_1 = since;

    //https://www.timeanddate.com/calendar/aboutseasons.html
    // Spring - from March 1 to May 31;
    // Summer - from June 1 to August 31;
    // Fall (autumn) - from September 1 to November 30; and,
    // Winter - from December 1 to February 28 (February 29 in a leap year).
    var seasons = {
      north: [['spring', 2, 1], //spring march 1
      ['summer', 5, 1], //june 1
      ['fall', 8, 1], //sept 1
      ['autumn', 8, 1], //sept 1
      ['winter', 11, 1] //dec 1
      ],
      south: [['fall', 2, 1], //march 1
      ['autumn', 2, 1], //march 1
      ['winter', 5, 1], //june 1
      ['spring', 8, 1], //sept 1
      ['summer', 11, 1] //dec 1
      ]
    };

    var quarters = [null, [0, 1], //jan 1
    [3, 1], //apr 1
    [6, 1], //july 1
    [9, 1] //oct 1
    ];

    var units$1 = {
      minute: function minute(s) {
        walk_1(s, {
          second: 0,
          millisecond: 0
        });
        return s;
      },
      quarterhour: function quarterhour(s) {
        var minute = s.minutes();

        if (minute >= 45) {
          s = s.minutes(45);
        } else if (minute >= 30) {
          s = s.minutes(30);
        } else if (minute >= 15) {
          s = s.minutes(15);
        } else {
          s = s.minutes(0);
        }

        walk_1(s, {
          second: 0,
          millisecond: 0
        });
        return s;
      },
      hour: function hour(s) {
        walk_1(s, {
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s;
      },
      day: function day(s) {
        walk_1(s, {
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s;
      },
      week: function week(s) {
        var original = s.clone();
        s = s.day(s._weekStart); //monday

        if (s.isAfter(original)) {
          s = s.subtract(1, 'week');
        }

        walk_1(s, {
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s;
      },
      month: function month(s) {
        walk_1(s, {
          date: 1,
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s;
      },
      quarter: function quarter(s) {
        var q = s.quarter();

        if (quarters[q]) {
          walk_1(s, {
            month: quarters[q][0],
            date: quarters[q][1],
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0
          });
        }

        return s;
      },
      season: function season(s) {
        var current = s.season();
        var hem = 'north';

        if (s.hemisphere() === 'South') {
          hem = 'south';
        }

        for (var i = 0; i < seasons[hem].length; i++) {
          if (seasons[hem][i][0] === current) {
            //winter goes between years
            var year = s.year();

            if (current === 'winter' && s.month() < 3) {
              year -= 1;
            }

            walk_1(s, {
              year: year,
              month: seasons[hem][i][1],
              date: seasons[hem][i][2],
              hour: 0,
              minute: 0,
              second: 0,
              millisecond: 0
            });
            return s;
          }
        }

        return s;
      },
      year: function year(s) {
        walk_1(s, {
          month: 0,
          date: 1,
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s;
      },
      decade: function decade(s) {
        s = s.startOf('year');
        var year = s.year();
        var decade = parseInt(year / 10, 10) * 10;
        s = s.year(decade);
        return s;
      },
      century: function century(s) {
        s = s.startOf('year');
        var year = s.year(); // near 0AD goes '-1 | +1'

        var decade = parseInt(year / 100, 10) * 100;
        s = s.year(decade);
        return s;
      }
    };
    units$1.date = units$1.day;

    var startOf = function startOf(a, unit) {
      var s = a.clone();
      unit = fns.normalize(unit);

      if (units$1[unit]) {
        return units$1[unit](s);
      }

      if (unit === 'summer' || unit === 'winter') {
        s = s.season(unit);
        return units$1.season(s);
      }

      return s;
    }; //piggy-backs off startOf


    var endOf = function endOf(a, unit) {
      var s = a.clone();
      unit = fns.normalize(unit);

      if (units$1[unit]) {
        // go to beginning, go to next one, step back 1ms
        s = units$1[unit](s); // startof

        s = s.add(1, unit);
        s = s.subtract(1, 'millisecond');
        return s;
      }

      return s;
    };

    var startOf_1 = {
      startOf: startOf,
      endOf: endOf
    };

    var isDay = function isDay(unit) {
      if (days["short"]().find(function (s) {
        return s === unit;
      })) {
        return true;
      }

      if (days["long"]().find(function (s) {
        return s === unit;
      })) {
        return true;
      }

      return false;
    }; // return a list of the weeks/months/days between a -> b
    // returns spacetime objects in the timezone of the input


    var every = function every(start) {
      var unit = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
      var end = arguments.length > 2 ? arguments[2] : undefined;

      if (!unit || !end) {
        return [];
      } //cleanup unit param


      unit = fns.normalize(unit); //cleanup to param

      end = start.clone().set(end); //swap them, if they're backwards

      if (start.isAfter(end)) {
        var tmp = start;
        start = end;
        end = tmp;
      } //support 'every wednesday'


      var d = start.clone();

      if (isDay(unit)) {
        d = d.next(unit);
        unit = 'week';
      } else {
        d = d.next(unit);
      } //okay, actually start doing it


      var result = [];

      while (d.isBefore(end)) {
        result.push(d);
        d = d.add(1, unit);
      }

      return result;
    };

    var every_1 = every;

    var parseDst = function parseDst(dst) {
      if (!dst) {
        return [];
      }

      return dst.split('->');
    };

    var titleCase = function titleCase(str) {
      str = str[0].toUpperCase() + str.substr(1);
      str = str.replace(/\/gmt/, '/GMT');
      str = str.replace(/[\/_]([a-z])/gi, function (s) {
        return s.toUpperCase();
      });
      return str;
    }; //get metadata about this timezone


    var timezone = function timezone(s) {
      var zones = s.timezones;
      var tz = s.tz;

      if (zones.hasOwnProperty(tz) === false) {
        tz = find(s.tz, zones);
      }

      if (tz === null) {
        if (s.silent === false) {
          console.warn("Warn: could not find given or local timezone - '" + s.tz + "'");
        }

        return {
          current: {
            epochShift: 0
          }
        };
      }

      var found = zones[tz];
      var result = {
        name: titleCase(tz),
        hasDst: Boolean(found.dst),
        default_offset: found.offset,
        //do north-hemisphere version as default (sorry!)
        hemisphere: found.hem === 's' ? 'South' : 'North',
        current: {}
      };

      if (result.hasDst) {
        var arr = parseDst(found.dst);
        result.change = {
          start: arr[0],
          back: arr[1]
        };
      } //find the offsets for summer/winter times
      //(these variable names are north-centric)


      var summer = found.offset; // (july)

      var winter = summer; // (january) assume it's the same for now

      if (result.hasDst === true) {
        if (result.hemisphere === 'North') {
          winter = summer - 1;
        } else {
          //southern hemisphere
          winter = found.offset + 1;
        }
      } //find out which offset to use right now
      //use 'summer' time july-time


      if (result.hasDst === false) {
        result.current.offset = summer;
        result.current.isDST = false;
      } else if (summerTime(s.epoch, result.change.start, result.change.back, summer, winter) === true) {
        result.current.offset = summer;
        result.current.isDST = result.hemisphere === 'North'; //dst 'on' in winter in north
      } else {
        //use 'winter' january-time
        result.current.offset = winter;
        result.current.isDST = result.hemisphere === 'South'; //dst 'on' in summer in south
      }

      return result;
    };

    var timezone_1 = timezone;

    var units = ['century', 'decade', 'year', 'month', 'date', 'day', 'hour', 'minute', 'second', 'millisecond']; //the spacetime instance methods (also, the API)

    var methods$4 = {
      set: function set(input$1, tz) {
        var s = this.clone();
        s = input(s, input$1, null);

        if (tz) {
          this.tz = find(tz);
        }

        return s;
      },
      timezone: function timezone() {
        return timezone_1(this);
      },
      isDST: function isDST() {
        return timezone_1(this).current.isDST;
      },
      hasDST: function hasDST() {
        return timezone_1(this).hasDst;
      },
      offset: function offset() {
        return timezone_1(this).current.offset * 60;
      },
      hemisphere: function hemisphere() {
        return timezone_1(this).hemisphere;
      },
      format: function format(fmt) {
        return format_1(this, fmt);
      },
      unixFmt: function unixFmt(fmt) {
        return unixFmt_1(this, fmt);
      },
      startOf: function startOf(unit) {
        return startOf_1.startOf(this, unit);
      },
      endOf: function endOf(unit) {
        return startOf_1.endOf(this, unit);
      },
      leapYear: function leapYear() {
        var year = this.year();
        return fns.isLeapYear(year);
      },
      progress: function progress(unit) {
        return progress_1(this, unit);
      },
      nearest: function nearest(unit) {
        return nearest_1(this, unit);
      },
      diff: function diff$1(d, unit) {
        return diff(this, d, unit);
      },
      since: function since(d) {
        if (!d) {
          d = this.clone().set();
        }

        return since_1(this, d);
      },
      next: function next(unit) {
        var s = this.add(1, unit);
        return s.startOf(unit);
      },
      //the start of the previous year/week/century
      last: function last(unit) {
        var s = this.subtract(1, unit);
        return s.startOf(unit);
      },
      isValid: function isValid() {
        //null/undefined epochs
        if (!this.epoch && this.epoch !== 0) {
          return false;
        }

        return !isNaN(this.d.getTime());
      },
      //travel to this timezone
      "goto": function goto(tz) {
        var s = this.clone();
        s.tz = find(tz, s.timezones); //science!

        return s;
      },
      //get each week/month/day between a -> b
      every: function every(unit, to) {
        // allow swapping these params:
        if (_typeof(unit) === 'object' && typeof to === 'string') {
          var tmp = to;
          to = unit;
          unit = tmp;
        }

        return every_1(this, unit, to);
      },
      isAwake: function isAwake() {
        var hour = this.hour(); //10pm -> 8am

        if (hour < 8 || hour > 22) {
          return false;
        }

        return true;
      },
      isAsleep: function isAsleep() {
        return !this.isAwake();
      },
      //pretty-printing
      log: function log() {
        console.log('');
        console.log(format_1(this, 'nice-short'));
        return this;
      },
      logYear: function logYear() {
        console.log('');
        console.log(format_1(this, 'full-short'));
        return this;
      },
      json: function json() {
        var _this = this;

        return units.reduce(function (h, unit) {
          h[unit] = _this[unit]();
          return h;
        }, {});
      },
      debug: function debug() {
        var tz = this.timezone();
        var date = this.format('MM') + ' ' + this.format('date-ordinal') + ' ' + this.year();
        date += '\n     - ' + this.format('time');
        console.log('\n\n', date + '\n     - ' + tz.name + ' (' + tz.current.offset + ')');
        return this;
      },
      //alias of 'since' but opposite - like moment.js
      from: function from(d) {
        d = this.clone().set(d);
        return d.since(this);
      },
      fromNow: function fromNow() {
        var d = this.clone().set(Date.now());
        return d.since(this);
      },
      weekStart: function weekStart(input) {
        //accept a number directly
        if (typeof input === 'number') {
          this._weekStart = input;
          return this;
        }

        if (typeof input === 'string') {
          // accept 'wednesday'
          input = input.toLowerCase().trim();
          var num = days["short"]().indexOf(input);

          if (num === -1) {
            num = days["long"]().indexOf(input);
          }

          if (num === -1) {
            num = 1; //go back to default
          }

          this._weekStart = num;
        } else {
          console.warn('Spacetime Error: Cannot understand .weekStart() input:', input);
        }

        return this;
      }
    }; // aliases

    methods$4.inDST = methods$4.isDST;
    methods$4.round = methods$4.nearest;
    methods$4.each = methods$4.every;
    var methods_1 = methods$4;

    //these methods wrap around them.

    var isLeapYear$1 = fns.isLeapYear;

    var validate = function validate(n) {
      //handle number as a string
      if (typeof n === 'string') {
        n = parseInt(n, 10);
      }

      return n;
    };

    var order$1 = ['year', 'month', 'date', 'hour', 'minute', 'second', 'millisecond']; //reduce hostile micro-changes when moving dates by millisecond

    var confirm = function confirm(s, tmp, unit) {
      var n = order$1.indexOf(unit);
      var arr = order$1.slice(n, order$1.length);

      for (var i = 0; i < arr.length; i++) {
        var want = tmp[arr[i]]();
        s[arr[i]](want);
      }

      return s;
    };

    var set = {
      milliseconds: function milliseconds(s, n) {
        n = validate(n);
        var current = s.millisecond();
        var diff = current - n; //milliseconds to shift by

        return s.epoch - diff;
      },
      seconds: function seconds(s, n) {
        n = validate(n);
        var diff = s.second() - n;
        var shift = diff * milliseconds.second;
        return s.epoch - shift;
      },
      minutes: function minutes(s, n) {
        n = validate(n);
        var old = s.clone();
        var diff = s.minute() - n;
        var shift = diff * milliseconds.minute;
        s.epoch -= shift; // check against a screw-up
        // if (old.hour() != s.hour()) {
        //   walkTo(old, {
        //     minute: n
        //   })
        //   return old.epoch
        // }

        confirm(s, old, 'second');
        return s.epoch;
      },
      hours: function hours(s, n) {
        n = validate(n);

        if (n >= 24) {
          n = 24;
        } else if (n < 0) {
          n = 0;
        }

        var old = s.clone();
        var diff = s.hour() - n;
        var shift = diff * milliseconds.hour;
        s.epoch -= shift; // oops, did we change the day?

        if (s.date() !== old.date()) {
          s = old.clone();

          if (diff > 1) {
            diff -= 1;
          }

          if (diff < 1) {
            diff += 1;
          }

          shift = diff * milliseconds.hour;
          s.epoch -= shift;
        }

        walk_1(s, {
          hour: n
        });
        confirm(s, old, 'minute');
        return s.epoch;
      },
      //support setting time by '4:25pm' - this isn't very-well developed..
      time: function time(s, str) {
        var m = str.match(/([0-9]{1,2})[:h]([0-9]{1,2})(:[0-9]{1,2})? ?(am|pm)?/);

        if (!m) {
          //fallback to support just '2am'
          m = str.match(/([0-9]{1,2}) ?(am|pm)/);

          if (!m) {
            return s.epoch;
          }

          m.splice(2, 0, '0'); //add implicit 0 minutes

          m.splice(3, 0, ''); //add implicit seconds
        }

        var h24 = false;
        var hour = parseInt(m[1], 10);
        var minute = parseInt(m[2], 10);

        if (hour > 12) {
          h24 = true;
        } //make the hour into proper 24h time


        if (h24 === false) {
          if (m[4] === 'am' && hour === 12) {
            //12am is midnight
            hour = 0;
          }

          if (m[4] === 'pm' && hour < 12) {
            //12pm is noon
            hour += 12;
          }
        } // handle seconds


        m[3] = m[3] || '';
        m[3] = m[3].replace(/:/, '');
        var sec = parseInt(m[3], 10) || 0;
        s = s.hour(hour);
        s = s.minute(minute);
        s = s.second(sec);
        s = s.millisecond(0);
        return s.epoch;
      },
      date: function date(s, n) {
        n = validate(n); //avoid setting february 31st

        if (n > 28) {
          var month = s.month();
          var max = monthLengths_1[month]; // support leap day in february

          if (month === 1 && n === 29 && isLeapYear$1(s.year())) {
            max = 29;
          }

          if (n > max) {
            n = max;
          }
        } //avoid setting < 0


        if (n <= 0) {
          n = 1;
        }

        walk_1(s, {
          date: n
        });
        return s.epoch;
      },
      //this one's tricky
      month: function month(s, n) {
        if (typeof n === 'string') {
          n = months$1.mapping()[n.toLowerCase()];
        }

        n = validate(n); //don't go past december

        if (n >= 12) {
          n = 11;
        }

        if (n <= 0) {
          n = 0;
        }

        var date = s.date(); //there's no 30th of february, etc.

        if (date > monthLengths_1[n]) {
          //make it as close as we can..
          date = monthLengths_1[n];
        }

        walk_1(s, {
          month: n,
          date: date
        });
        return s.epoch;
      },
      year: function year(s, n) {
        // support '97
        if (typeof n === 'string' && /^'[0-9]{2}$/.test(n)) {
          n = n.replace(/'/, '').trim();
          n = Number(n); // '89 is 1989

          if (n > 30) {
            //change this in 10y
            n = 1900 + n;
          } else {
            // '12 is 2012
            n = 2000 + n;
          }
        }

        n = validate(n);
        walk_1(s, {
          year: n
        });
        return s.epoch;
      },
      dayOfYear: function dayOfYear(s, n) {
        n = validate(n);
        var old = s.clone();
        n -= 1; //days are 1-based

        if (n <= 0) {
          n = 0;
        } else if (n >= 365) {
          n = 364;
        }

        s = s.startOf('year');
        s = s.add(n, 'day');
        confirm(s, old, 'hour');
        return s.epoch;
      }
    };

    var methods$3 = {
      millisecond: function millisecond(num) {
        if (num !== undefined) {
          var s = this.clone();
          s.epoch = set.milliseconds(s, num);
          return s;
        }

        return this.d.getMilliseconds();
      },
      second: function second(num) {
        if (num !== undefined) {
          var s = this.clone();
          s.epoch = set.seconds(s, num);
          return s;
        }

        return this.d.getSeconds();
      },
      minute: function minute(num) {
        if (num !== undefined) {
          var s = this.clone();
          s.epoch = set.minutes(s, num);
          return s;
        }

        return this.d.getMinutes();
      },
      hour: function hour(num) {
        var d = this.d;

        if (num !== undefined) {
          var s = this.clone();
          s.epoch = set.hours(s, num);
          return s;
        }

        return d.getHours();
      },
      //'3:30' is 3.5
      hourFloat: function hourFloat(num) {
        if (num !== undefined) {
          var s = this.clone();

          var _minute = num % 1;

          _minute = _minute * 60;

          var _hour = parseInt(num, 10);

          s.epoch = set.hours(s, _hour);
          s.epoch = set.minutes(s, _minute);
          return s;
        }

        var d = this.d;
        var hour = d.getHours();
        var minute = d.getMinutes();
        minute = minute / 60;
        return hour + minute;
      },
      // hour in 12h format
      hour12: function hour12(str) {
        var d = this.d;

        if (str !== undefined) {
          var s = this.clone();
          str = '' + str;
          var m = str.match(/^([0-9]+)(am|pm)$/);

          if (m) {
            var hour = parseInt(m[1], 10);

            if (m[2] === 'pm') {
              hour += 12;
            }

            s.epoch = set.hours(s, hour);
          }

          return s;
        } //get the hour


        var hour12 = d.getHours();

        if (hour12 > 12) {
          hour12 = hour12 - 12;
        }

        if (hour12 === 0) {
          hour12 = 12;
        }

        return hour12;
      },
      //some ambiguity here with 12/24h
      time: function time(str) {
        if (str !== undefined) {
          var s = this.clone();
          str = str.toLowerCase().trim();
          s.epoch = set.time(s, str);
          return s;
        }

        return "".concat(this.h12(), ":").concat(fns.zeroPad(this.minute())).concat(this.ampm());
      },
      // either 'am' or 'pm'
      ampm: function ampm(input) {
        var which = 'am';
        var hour = this.hour();

        if (hour >= 12) {
          which = 'pm';
        }

        if (typeof input !== 'string') {
          return which;
        } //okay, we're doing a setter


        var s = this.clone();
        input = input.toLowerCase().trim(); //ampm should never change the day
        // - so use `.hour(n)` instead of `.minus(12,'hour')`

        if (hour >= 12 && input === 'am') {
          //noon is 12pm
          hour -= 12;
          return s.hour(hour);
        }

        if (hour < 12 && input === 'pm') {
          hour += 12;
          return s.hour(hour);
        }

        return s;
      },
      //some hard-coded times of day, like 'noon'
      dayTime: function dayTime(str) {
        if (str !== undefined) {
          var times = {
            morning: '7:00am',
            breakfast: '7:00am',
            noon: '12:00am',
            lunch: '12:00pm',
            afternoon: '2:00pm',
            evening: '6:00pm',
            dinner: '6:00pm',
            night: '11:00pm',
            midnight: '23:59pm'
          };
          var s = this.clone();
          str = str || '';
          str = str.toLowerCase();

          if (times.hasOwnProperty(str) === true) {
            s = s.time(times[str]);
          }

          return s;
        }

        var h = this.hour();

        if (h < 6) {
          return 'night';
        }

        if (h < 12) {
          //until noon
          return 'morning';
        }

        if (h < 17) {
          //until 5pm
          return 'afternoon';
        }

        if (h < 22) {
          //until 10pm
          return 'evening';
        }

        return 'night';
      },
      //parse a proper iso string
      iso: function iso(num) {
        if (num !== undefined) {
          return this.set(num);
        }

        return this.format('iso');
      }
    };
    var _01Time = methods$3;

    var methods$2 = {
      // # day in the month
      date: function date(num) {
        if (num !== undefined) {
          var s = this.clone();
          s.epoch = set.date(s, num);
          return s;
        }

        return this.d.getDate();
      },
      //like 'wednesday' (hard!)
      day: function day(input) {
        if (input === undefined) {
          return this.d.getDay();
        }

        var original = this.clone();
        var want = input; // accept 'wednesday'

        if (typeof input === 'string') {
          input = input.toLowerCase();

          if (days.aliases.hasOwnProperty(input)) {
            want = days.aliases[input];
          } else {
            want = days["short"]().indexOf(input);

            if (want === -1) {
              want = days["long"]().indexOf(input);
            }
          }
        } //move approx


        var day = this.d.getDay();
        var diff = day - want;
        var s = this.subtract(diff, 'days'); //tighten it back up

        walk_1(s, {
          hour: original.hour(),
          minute: original.minute(),
          second: original.second()
        });
        return s;
      },
      //these are helpful name-wrappers
      dayName: function dayName(input) {
        if (input === undefined) {
          return days["long"]()[this.day()];
        }

        var s = this.clone();
        s = s.day(input);
        return s;
      },
      //either name or number
      month: function month(input) {
        if (input !== undefined) {
          var s = this.clone();
          s.epoch = set.month(s, input);
          return s;
        }

        return this.d.getMonth();
      }
    };
    var _02Date = methods$2;

    var clearMinutes = function clearMinutes(s) {
      s = s.minute(0);
      s = s.second(0);
      s = s.millisecond(1);
      return s;
    };

    var methods$1 = {
      // day 0-366
      dayOfYear: function dayOfYear(num) {
        if (num !== undefined) {
          var s = this.clone();
          s.epoch = set.dayOfYear(s, num);
          return s;
        } //days since newyears - jan 1st is 1, jan 2nd is 2...


        var sum = 0;
        var month = this.d.getMonth();
        var tmp; //count the num days in each month

        for (var i = 1; i <= month; i++) {
          tmp = new Date();
          tmp.setDate(1);
          tmp.setFullYear(this.d.getFullYear()); //the year matters, because leap-years

          tmp.setHours(1);
          tmp.setMinutes(1);
          tmp.setMonth(i);
          tmp.setHours(-2); //the last day of the month

          sum += tmp.getDate();
        }

        return sum + this.d.getDate();
      },
      //since the start of the year
      week: function week(num) {
        // week-setter
        if (num !== undefined) {
          var s = this.clone();
          s = s.month(0);
          s = s.date(1);
          s = s.day('monday');
          s = clearMinutes(s); //first week starts first Thurs in Jan
          // so mon dec 28th is 1st week
          // so mon dec 29th is not the week

          if (s.monthName() === 'december' && s.date() >= 28) {
            s = s.add(1, 'week');
          }

          num -= 1; //1-based

          s = s.add(num, 'weeks');
          return s;
        } //find-out which week it is


        var tmp = this.clone();
        tmp = tmp.month(0);
        tmp = tmp.date(1);
        tmp = clearMinutes(tmp);
        tmp = tmp.day('monday'); //don't go into last-year

        if (tmp.monthName() === 'december' && tmp.date() >= 28) {
          tmp = tmp.add(1, 'week');
        } // is first monday the 1st?


        var toAdd = 1;

        if (tmp.date() === 1) {
          toAdd = 0;
        }

        tmp = tmp.minus(1, 'second');
        var thisOne = this.epoch; //if the week technically hasn't started yet

        if (tmp.epoch > thisOne) {
          return 1;
        } //speed it up, if we can


        var i = 0;
        var skipWeeks = this.month() * 4;
        tmp.epoch += milliseconds.week * skipWeeks;
        i += skipWeeks;

        for (; i <= 52; i++) {
          if (tmp.epoch > thisOne) {
            return i + toAdd;
          }

          tmp = tmp.add(1, 'week');
        }

        return 52;
      },
      //'january'
      monthName: function monthName(input) {
        if (input === undefined) {
          return months$1["long"]()[this.month()];
        }

        var s = this.clone();
        s = s.month(input);
        return s;
      },
      //q1, q2, q3, q4
      quarter: function quarter(num) {
        if (num !== undefined) {
          if (typeof num === 'string') {
            num = num.replace(/^q/i, '');
            num = parseInt(num, 10);
          }

          if (quarters[num]) {
            var s = this.clone();
            var _month = quarters[num][0];
            s = s.month(_month);
            s = s.date(1);
            s = s.startOf('day');
            return s;
          }
        }

        var month = this.d.getMonth();

        for (var i = 1; i < quarters.length; i++) {
          if (month < quarters[i][0]) {
            return i - 1;
          }
        }

        return 4;
      },
      //spring, summer, winter, fall
      season: function season(input) {
        var hem = 'north';

        if (this.hemisphere() === 'South') {
          hem = 'south';
        }

        if (input !== undefined) {
          var s = this.clone();

          for (var i = 0; i < seasons[hem].length; i++) {
            if (input === seasons[hem][i][0]) {
              s = s.month(seasons[hem][i][1]);
              s = s.date(1);
              s = s.startOf('day');
            }
          }

          return s;
        }

        var month = this.d.getMonth();

        for (var _i = 0; _i < seasons[hem].length - 1; _i++) {
          if (month >= seasons[hem][_i][1] && month < seasons[hem][_i + 1][1]) {
            return seasons[hem][_i][0];
          }
        }

        return 'winter';
      },
      //the year number
      year: function year(num) {
        if (num !== undefined) {
          var s = this.clone();
          s.epoch = set.year(s, num);
          return s;
        }

        return this.d.getFullYear();
      },
      //bc/ad years
      era: function era(str) {
        if (str !== undefined) {
          var s = this.clone();
          str = str.toLowerCase(); //TODO: there is no year-0AD i think. may have off-by-1 error here

          var year = s.d.getFullYear(); //make '1992' into 1992bc..

          if (str === 'bc' && year > 0) {
            s.epoch = set.year(s, year * -1);
          } //make '1992bc' into '1992'


          if (str === 'ad' && year < 0) {
            s.epoch = set.year(s, year * -1);
          }

          return s;
        }

        if (this.d.getFullYear() < 0) {
          return 'BC';
        }

        return 'AD';
      },
      // 2019 -> 2010
      decade: function decade(input) {
        if (input !== undefined) {
          input = String(input);
          input = input.replace(/([0-9])'?s$/, '$1'); //1950's

          input = input.replace(/([0-9])(th|rd|st|nd)/, '$1'); //fix ordinals

          if (!input) {
            console.warn('Spacetime: Invalid decade input');
            return this;
          } // assume 20th century?? for '70s'.


          if (input.length === 2 && /[0-9][0-9]/.test(input)) {
            input = '19' + input;
          }

          var year = Number(input);

          if (isNaN(year)) {
            return this;
          } // round it down to the decade


          year = Math.floor(year / 10) * 10;
          return this.year(year); //.startOf('decade')
        }

        return this.startOf('decade').year();
      },
      // 1950 -> 19+1
      century: function century(input) {
        if (input !== undefined) {
          if (typeof input === 'string') {
            input = input.replace(/([0-9])(th|rd|st|nd)/, '$1'); //fix ordinals

            input = input.replace(/([0-9]+) ?(b\.?c\.?|a\.?d\.?)/i, function (a, b, c) {
              if (c.match(/b\.?c\.?/i)) {
                b = '-' + b;
              }

              return b;
            });
            input = input.replace(/c$/, ''); //20thC
          }

          var year = Number(input);

          if (isNaN(input)) {
            console.warn('Spacetime: Invalid century input');
            return this;
          } // there is no century 0


          if (year === 0) {
            year = 1;
          }

          if (year >= 0) {
            year = (year - 1) * 100;
          } else {
            year = (year + 1) * 100;
          }

          return this.year(year);
        } // century getter


        var num = this.startOf('century').year();
        num = Math.floor(num / 100);

        if (num < 0) {
          return num - 1;
        }

        return num + 1;
      },
      // 2019 -> 2+1
      millenium: function millenium(input) {
        if (input !== undefined) {
          if (typeof input === 'string') {
            input = input.replace(/([0-9])(th|rd|st|nd)/, '$1'); //fix ordinals

            input = Number(input);

            if (isNaN(input)) {
              console.warn('Spacetime: Invalid millenium input');
              return this;
            }
          }

          if (input > 0) {
            input -= 1;
          }

          var year = input * 1000; // there is no year 0

          if (year === 0) {
            year = 1;
          }

          return this.year(year);
        } // get the current millenium


        var num = Math.floor(this.year() / 1000);

        if (num >= 0) {
          num += 1;
        }

        return num;
      }
    };
    var _03Year = methods$1;

    var methods = Object.assign({}, _01Time, _02Date, _03Year); //aliases

    methods.milliseconds = methods.millisecond;
    methods.seconds = methods.second;
    methods.minutes = methods.minute;
    methods.hours = methods.hour;
    methods.hour24 = methods.hour;
    methods.h12 = methods.hour12;
    methods.h24 = methods.hour24;
    methods.days = methods.day;

    var addMethods$4 = function addMethods(Space) {
      //hook the methods into prototype
      Object.keys(methods).forEach(function (k) {
        Space.prototype[k] = methods[k];
      });
    };

    var query = addMethods$4;

    var isLeapYear = fns.isLeapYear;

    var getMonthLength = function getMonthLength(month, year) {
      if (month === 1 && isLeapYear(year)) {
        return 29;
      }

      return monthLengths_1[month];
    }; //month is the one thing we 'model/compute'
    //- because ms-shifting can be off by enough


    var rollMonth = function rollMonth(want, old) {
      //increment year
      if (want.month > 0) {
        var years = parseInt(want.month / 12, 10);
        want.year = old.year() + years;
        want.month = want.month % 12;
      } else if (want.month < 0) {
        //decrement year
        var _years = Math.floor(Math.abs(want.month) / 13, 10);

        _years = Math.abs(_years) + 1;
        want.year = old.year() - _years; //ignore extras

        want.month = want.month % 12;
        want.month = want.month + 12;

        if (want.month === 12) {
          want.month = 0;
        }
      }

      return want;
    }; // briefly support day=-2 (this does not need to be perfect.)


    var rollDaysDown = function rollDaysDown(want, old, sum) {
      want.year = old.year();
      want.month = old.month();
      var date = old.date();
      want.date = date - Math.abs(sum);

      while (want.date < 1) {
        want.month -= 1;

        if (want.month < 0) {
          want.month = 11;
          want.year -= 1;
        }

        var max = getMonthLength(want.month, want.year);
        want.date += max;
      }

      return want;
    }; // briefly support day=33 (this does not need to be perfect.)


    var rollDaysUp = function rollDaysUp(want, old, sum) {
      var year = old.year();
      var month = old.month();
      var max = getMonthLength(month, year);

      while (sum > max) {
        sum -= max;
        month += 1;

        if (month >= 12) {
          month -= 12;
          year += 1;
        }

        max = getMonthLength(month, year);
      }

      want.month = month;
      want.date = sum;
      return want;
    };

    var _model = {
      months: rollMonth,
      days: rollDaysUp,
      daysBack: rollDaysDown
    };

    // but briefly:
    // millisecond-math, and some post-processing covers most-things
    // we 'model' the calendar here only a little bit
    // and that usually works-out...

    var order = ['millisecond', 'second', 'minute', 'hour', 'date', 'month'];
    var keep = {
      second: order.slice(0, 1),
      minute: order.slice(0, 2),
      quarterhour: order.slice(0, 2),
      hour: order.slice(0, 3),
      date: order.slice(0, 4),
      month: order.slice(0, 4),
      quarter: order.slice(0, 4),
      season: order.slice(0, 4),
      year: order,
      decade: order,
      century: order
    };
    keep.week = keep.hour;
    keep.season = keep.date;
    keep.quarter = keep.date; // Units need to be dst adjuested

    var dstAwareUnits = {
      year: true,
      quarter: true,
      season: true,
      month: true,
      week: true,
      day: true
    };
    var keepDate = {
      month: true,
      quarter: true,
      season: true,
      year: true
    };

    var addMethods$3 = function addMethods(SpaceTime) {
      SpaceTime.prototype.add = function (num, unit) {
        var s = this.clone();

        if (!unit || num === 0) {
          return s; //don't bother
        }

        var old = this.clone();
        unit = fns.normalize(unit);

        if (unit === 'millisecond') {
          s.epoch += num;
          return s;
        } // support 'fortnight' alias


        if (unit === 'fortnight') {
          num *= 2;
          unit = 'week';
        } //move forward by the estimated milliseconds (rough)


        if (milliseconds[unit]) {
          s.epoch += milliseconds[unit] * num;
        } else if (unit === 'week') {
          s.epoch += milliseconds.day * (num * 7);
        } else if (unit === 'quarter' || unit === 'season') {
          s.epoch += milliseconds.month * (num * 3);
        } else if (unit === 'quarterhour') {
          s.epoch += milliseconds.minute * 15 * num;
        } //now ensure our milliseconds/etc are in-line


        var want = {};

        if (keep[unit]) {
          keep[unit].forEach(function (u) {
            want[u] = old[u]();
          });
        }

        if (dstAwareUnits[unit]) {
          var diff = old.timezone().current.offset - s.timezone().current.offset;
          s.epoch += diff * 3600 * 1000;
        } //ensure month/year has ticked-over


        if (unit === 'month') {
          want.month = old.month() + num; //month is the one unit we 'model' directly

          want = _model.months(want, old);
        } //support coercing a week, too


        if (unit === 'week') {
          var sum = old.date() + num * 7;

          if (sum <= 28 && sum > 1) {
            want.date = sum;
          }
        } //support 25-hour day-changes on dst-changes
        else if (unit === 'date') {
            if (num < 0) {
              want = _model.daysBack(want, old, num);
            } else {
              //specify a naive date number, if it's easy to do...
              var _sum = old.date() + num; // ok, model this one too


              want = _model.days(want, old, _sum);
            } //manually punt it if we haven't moved at all..


            if (num !== 0 && old.isSame(s, 'day')) {
              want.date = old.date() + num;
            }
          } // ensure a quarter is 3 months over
          else if (unit === 'quarter') {
              want.month = old.month() + num * 3;
              want.year = old.year(); // handle rollover

              if (want.month < 0) {
                var years = Math.floor(want.month / 12);
                var remainder = want.month + Math.abs(years) * 12;
                want.month = remainder;
                want.year += years;
              } else if (want.month >= 12) {
                var _years = Math.floor(want.month / 12);

                want.month = want.month % 12;
                want.year += _years;
              }

              want.date = old.date();
            } //ensure year has changed (leap-years)
            else if (unit === 'year') {
                var wantYear = old.year() + num;
                var haveYear = s.year();

                if (haveYear < wantYear) {
                  s.epoch += milliseconds.day;
                } else if (haveYear > wantYear) {
                  s.epoch += milliseconds.day;
                }
              } //these are easier
              else if (unit === 'decade') {
                  want.year = s.year() + 10;
                } else if (unit === 'century') {
                  want.year = s.year() + 100;
                } //keep current date, unless the month doesn't have it.


        if (keepDate[unit]) {
          var max = monthLengths_1[want.month];
          want.date = old.date();

          if (want.date > max) {
            want.date = max;
          }
        }

        if (Object.keys(want).length > 1) {
          walk_1(s, want);
        }

        return s;
      }; //subtract is only add *-1


      SpaceTime.prototype.subtract = function (num, unit) {
        var s = this.clone();
        return s.add(num * -1, unit);
      }; //add aliases


      SpaceTime.prototype.minus = SpaceTime.prototype.subtract;
      SpaceTime.prototype.plus = SpaceTime.prototype.add;
    };

    var add = addMethods$3;

    //make a string, for easy comparison between dates
    var print = {
      millisecond: function millisecond(s) {
        return s.epoch;
      },
      second: function second(s) {
        return [s.year(), s.month(), s.date(), s.hour(), s.minute(), s.second()].join('-');
      },
      minute: function minute(s) {
        return [s.year(), s.month(), s.date(), s.hour(), s.minute()].join('-');
      },
      hour: function hour(s) {
        return [s.year(), s.month(), s.date(), s.hour()].join('-');
      },
      day: function day(s) {
        return [s.year(), s.month(), s.date()].join('-');
      },
      week: function week(s) {
        return [s.year(), s.week()].join('-');
      },
      month: function month(s) {
        return [s.year(), s.month()].join('-');
      },
      quarter: function quarter(s) {
        return [s.year(), s.quarter()].join('-');
      },
      year: function year(s) {
        return s.year();
      }
    };
    print.date = print.day;

    var addMethods$2 = function addMethods(SpaceTime) {
      SpaceTime.prototype.isSame = function (b, unit) {
        var tzAware = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
        var a = this;

        if (!unit) {
          return null;
        } // support swapped params


        if (typeof b === 'string' && _typeof(unit) === 'object') {
          var tmp = b;
          b = unit;
          unit = tmp;
        }

        if (typeof b === 'string' || typeof b === 'number') {
          b = new SpaceTime(b, this.timezone.name);
        } //support 'seconds' aswell as 'second'


        unit = unit.replace(/s$/, ''); // make them the same timezone for proper comparison

        if (tzAware === true && a.tz !== b.tz) {
          b = b.clone();
          b.tz = a.tz;
        }

        if (print[unit]) {
          return print[unit](a) === print[unit](b);
        }

        return null;
      };
    };

    var same = addMethods$2;

    var addMethods$1 = function addMethods(SpaceTime) {
      var methods = {
        isAfter: function isAfter(d) {
          d = fns.beADate(d, this);
          var epoch = fns.getEpoch(d);

          if (epoch === null) {
            return null;
          }

          return this.epoch > epoch;
        },
        isBefore: function isBefore(d) {
          d = fns.beADate(d, this);
          var epoch = fns.getEpoch(d);

          if (epoch === null) {
            return null;
          }

          return this.epoch < epoch;
        },
        isEqual: function isEqual(d) {
          d = fns.beADate(d, this);
          var epoch = fns.getEpoch(d);

          if (epoch === null) {
            return null;
          }

          return this.epoch === epoch;
        },
        isBetween: function isBetween(start, end) {
          var isInclusive = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
          start = fns.beADate(start, this);
          end = fns.beADate(end, this);
          var startEpoch = fns.getEpoch(start);

          if (startEpoch === null) {
            return null;
          }

          var endEpoch = fns.getEpoch(end);

          if (endEpoch === null) {
            return null;
          }

          if (isInclusive) {
            return this.isBetween(start, end) || this.isEqual(start) || this.isEqual(end);
          }

          return startEpoch < this.epoch && this.epoch < endEpoch;
        }
      }; //hook them into proto

      Object.keys(methods).forEach(function (k) {
        SpaceTime.prototype[k] = methods[k];
      });
    };

    var compare = addMethods$1;

    var addMethods = function addMethods(SpaceTime) {
      var methods = {
        i18n: function i18n(data) {
          //change the day names
          if (fns.isObject(data.days)) {
            days.set(data.days);
          } //change the month names


          if (fns.isObject(data.months)) {
            months$1.set(data.months);
          } // change the the display style of the month / day names


          if (fns.isBoolean(data.useTitleCase)) {
            caseFormat.set(data.useTitleCase);
          }
        }
      }; //hook them into proto

      Object.keys(methods).forEach(function (k) {
        SpaceTime.prototype[k] = methods[k];
      });
    };

    var i18n = addMethods;

    var timezones = unpack; //fake timezone-support, for fakers (es5 class)

    var SpaceTime = function SpaceTime(input$1, tz) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      //the holy moment
      this.epoch = null; //the shift for the given timezone

      this.tz = find(tz, timezones); //whether to output warnings to console

      this.silent = options.silent || true; // favour british interpretation of 02/02/2018, etc

      this.british = options.dmy || options.british; //does the week start on sunday, or monday:

      this._weekStart = 1; //default to monday

      if (options.weekStart !== undefined) {
        this._weekStart = options.weekStart;
      } // the reference today date object, (for testing)


      this._today = {};

      if (options.today !== undefined) {
        this._today = options.today;
      } //add getter/setters


      Object.defineProperty(this, 'd', {
        //return a js date object
        get: function get() {
          var offset = quick(this); //every computer is somewhere- get this computer's built-in offset

          var bias = new Date(this.epoch).getTimezoneOffset() || 0; //movement

          var shift = bias + offset * 60; //in minutes

          shift = shift * 60 * 1000; //in ms
          //remove this computer's offset

          var epoch = this.epoch + shift;
          var d = new Date(epoch);
          return d;
        }
      }); //add this data on the object, to allow adding new timezones

      Object.defineProperty(this, 'timezones', {
        get: function get() {
          return timezones;
        },
        set: function set(obj) {
          timezones = obj;
          return obj;
        }
      }); //parse the various formats

      var tmp = input(this, input$1, tz);
      this.epoch = tmp.epoch;
    }; //(add instance methods to prototype)


    Object.keys(methods_1).forEach(function (k) {
      SpaceTime.prototype[k] = methods_1[k];
    }); // ¯\_(ツ)_/¯

    SpaceTime.prototype.clone = function () {
      return new SpaceTime(this.epoch, this.tz, {
        silent: this.silent,
        weekStart: this._weekStart,
        today: this._today
      });
    }; //return native date object at the same epoch


    SpaceTime.prototype.toLocalDate = function () {
      return new Date(this.epoch);
    }; //append more methods


    query(SpaceTime);
    add(SpaceTime);
    same(SpaceTime);
    compare(SpaceTime);
    i18n(SpaceTime);
    var spacetime = SpaceTime;

    var whereIts = function whereIts(a, b) {
      var start = new spacetime(null);
      var end = new spacetime(null);
      start = start.time(a); //if b is undefined, use as 'within one hour'

      if (b) {
        end = end.time(b);
      } else {
        end = start.add(59, 'minutes');
      }

      var startHour = start.hour();
      var endHour = end.hour();
      var tzs = Object.keys(start.timezones).filter(function (tz) {
        if (tz.indexOf('/') === -1) {
          return false;
        }

        var m = new spacetime(null, tz);
        var hour = m.hour(); //do 'calendar-compare' not real-time-compare

        if (hour >= startHour && hour <= endHour) {
          //test minutes too, if applicable
          if (hour === startHour && m.minute() < start.minute()) {
            return false;
          }

          if (hour === endHour && m.minute() > end.minute()) {
            return false;
          }

          return true;
        }

        return false;
      });
      return tzs;
    };

    var whereIts_1 = whereIts;

    var _version = '6.13.0';

    var main = function main(input, tz, options) {
      return new spacetime(input, tz, options);
    }; // set all properties of a given 'today' object


    var setToday = function setToday(s) {
      var today = s._today || {};
      Object.keys(today).forEach(function (k) {
        s = s[k](today[k]);
      });
      return s;
    }; //some helper functions on the main method


    main.now = function (tz, options) {
      var s = new spacetime(new Date().getTime(), tz, options);
      s = setToday(s);
      return s;
    };

    main.today = function (tz, options) {
      var s = new spacetime(new Date().getTime(), tz, options);
      s = setToday(s);
      return s.startOf('day');
    };

    main.tomorrow = function (tz, options) {
      var s = new spacetime(new Date().getTime(), tz, options);
      s = setToday(s);
      return s.add(1, 'day').startOf('day');
    };

    main.yesterday = function (tz, options) {
      var s = new spacetime(new Date().getTime(), tz, options);
      s = setToday(s);
      return s.subtract(1, 'day').startOf('day');
    };

    main.extend = function (obj) {
      Object.keys(obj).forEach(function (k) {
        spacetime.prototype[k] = obj[k];
      });
      return this;
    };

    main.timezones = function () {
      var s = new spacetime();
      return s.timezones;
    }; //find tz by time


    main.whereIts = whereIts_1;
    main.version = _version; //aliases:

    main.plugin = main.extend;
    var src = main;

    // create all day objects
    const calculate = function (date) {
      let start = date.startOf('month');
      let monday = start.startOf('week'); //.minus(1, 'second')
      let weeks = [];
      let d = monday;
      for (let w = 0; w < 6; w += 1) {
        let week = [];
        for (let i = 0; i < 7; i += 1) {
          week.push(d);
          d = d.add(1, 'day');
        }
        weeks.push(week);
        let sunday = week[week.length - 1];
        if (sunday.isSame(start, 'month') === false) {
          return weeks
        }
      }
      return weeks
    };

    function createCommonjsModule$1(fn, basedir, module) {
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

    var spencerColor = createCommonjsModule$1(function (module, exports) {
    !function(e){module.exports=e();}(function(){return function u(i,a,c){function f(r,e){if(!a[r]){if(!i[r]){var o="function"==typeof commonjsRequire&&commonjsRequire;if(!e&&o)return o(r,!0);if(d)return d(r,!0);var n=new Error("Cannot find module '"+r+"'");throw n.code="MODULE_NOT_FOUND",n}var t=a[r]={exports:{}};i[r][0].call(t.exports,function(e){return f(i[r][1][e]||e)},t,t.exports,u,i,a,c);}return a[r].exports}for(var d="function"==typeof commonjsRequire&&commonjsRequire,e=0;e<c.length;e++)f(c[e]);return f}({1:[function(e,r,o){r.exports={blue:"#6699cc",green:"#6accb2",yellow:"#e1e6b3",red:"#cc7066",pink:"#F2C0BB",brown:"#705E5C",orange:"#cc8a66",purple:"#d8b3e6",navy:"#335799",olive:"#7f9c6c",fuscia:"#735873",beige:"#e6d7b3",slate:"#8C8C88",suede:"#9c896c",burnt:"#603a39",sea:"#50617A",sky:"#2D85A8",night:"#303b50",rouge:"#914045",grey:"#838B91",mud:"#C4ABAB",royal:"#275291",cherry:"#cc6966",tulip:"#e6b3bc",rose:"#D68881",fire:"#AB5850",greyblue:"#72697D",greygreen:"#8BA3A2",greypurple:"#978BA3",burn:"#6D5685",slategrey:"#bfb0b3",light:"#a3a5a5",lighter:"#d7d5d2",fudge:"#4d4d4d",lightgrey:"#949a9e",white:"#fbfbfb",dimgrey:"#606c74",softblack:"#463D4F",dark:"#443d3d",black:"#333333"};},{}],2:[function(e,r,o){var n=e("./colors"),t={juno:["blue","mud","navy","slate","pink","burn"],barrow:["rouge","red","orange","burnt","brown","greygreen"],roma:["#8a849a","#b5b0bf","rose","lighter","greygreen","mud"],palmer:["red","navy","olive","pink","suede","sky"],mark:["#848f9a","#9aa4ac","slate","#b0b8bf","mud","grey"],salmon:["sky","sea","fuscia","slate","mud","fudge"],dupont:["green","brown","orange","red","olive","blue"],bloor:["night","navy","beige","rouge","mud","grey"],yukon:["mud","slate","brown","sky","beige","red"],david:["blue","green","yellow","red","pink","light"],neste:["mud","cherry","royal","rouge","greygreen","greypurple"],ken:["red","sky","#c67a53","greygreen","#dfb59f","mud"]};Object.keys(t).forEach(function(e){t[e]=t[e].map(function(e){return n[e]||e});}),r.exports=t;},{"./colors":1}],3:[function(e,r,o){var n=e("./colors"),t=e("./combos"),u={colors:n,list:Object.keys(n).map(function(e){return n[e]}),combos:t};r.exports=u;},{"./colors":1,"./combos":2}]},{},[3])(3)});
    });

    const fmtDays = function (obj) {
      let res = {};
      Object.keys(obj).forEach((k) => {
        let iso = src(k).format('iso-short');

        let color = obj[k];
        color = spencerColor.colors[color] || color;
        res[iso] = color;
      });
      return res
    };

    /* Users/spencer/mountain/somehow-calendar/src/Month.svelte generated by Svelte v3.29.0 */
    const file$2 = "Users/spencer/mountain/somehow-calendar/src/Month.svelte";

    function add_css$2() {
    	var style = element$1("style");
    	style.id = "svelte-1dblamv-style";
    	style.textContent = ".monthName.svelte-1dblamv{font-size:1rem;color:#838b91;text-align:right;margin-bottom:0.2rem;margin-top:0.2rem;margin-right:0.7rem}.week.svelte-1dblamv{display:flex;flex-direction:row;justify-content:space-around;align-items:center;text-align:center;flex-wrap:nowrap;align-self:stretch}.day.svelte-1dblamv{position:relative;flex:1;margin:0.5%;border-radius:3px;box-shadow:2px 1px 6px 0px rgba(0, 0, 0, 0.2);min-width:13px;min-height:12px;box-sizing:border-box;font-size:9px;color:#a3a5a5;overflow:hidden;z-index:1;cursor:pointer}.day.svelte-1dblamv:hover{box-shadow:1px 4px 10px 1px rgba(0, 0, 0, 0.2)}.highlight.svelte-1dblamv{box-shadow:1px 4px 10px 1px rgba(0, 0, 0, 0.4)}.square.svelte-1dblamv{padding-top:15%;position:relative}.noday.svelte-1dblamv{box-shadow:none !important}.today.svelte-1dblamv{background-color:lightsteelblue;border:1px solid lightsteelblue !important;color:white}.topHome.svelte-1dblamv{background:linear-gradient(0deg, #f0f0f0 50%, rgba(81, 115, 166, 0.7) 50%)}.bottomHome.svelte-1dblamv{background:linear-gradient(0deg, rgba(81, 115, 166, 0.9) 50%, #f0f0f0 50%)}.topAway.svelte-1dblamv{background:linear-gradient(0deg, #f0f0f0 50%, rgba(151, 139, 163, 0.7) 50%)}.bottomAway.svelte-1dblamv{background:linear-gradient(0deg, rgba(151, 139, 163, 0.9) 50%, #f0f0f0 50%)}.num.svelte-1dblamv{position:absolute;z-index:4;font-size:14px;color:#949a9e;opacity:0.8;width:100%;height:100%;top:0px;text-align:center;margin:auto;opacity:0;cursor:pointer}.num.svelte-1dblamv:hover{opacity:0.8}.weekend.svelte-1dblamv{background-color:#f0f0f0}@media only screen and (max-width: 400px){.monthName.svelte-1dblamv{font-size:0.7rem}.day.svelte-1dblamv{border-radius:2px;margin:0.5%;box-shadow:1px 1px 1px 0px rgba(0, 0, 0, 0.2)}.num.svelte-1dblamv{display:none}}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTW9udGguc3ZlbHRlIiwic291cmNlcyI6WyJNb250aC5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbiAgaW1wb3J0IHNwYWNldGltZSBmcm9tICdzcGFjZXRpbWUnXG4gIGltcG9ydCBjYWxjTW9udGggZnJvbSAnLi9fY2FsYydcbiAgaW1wb3J0IGZtdERheXMgZnJvbSAnLi9fZm10RGF5cydcbiAgZXhwb3J0IGxldCBkYXlzID0ge31cbiAgZXhwb3J0IGxldCB0b3BzID0ge31cbiAgZXhwb3J0IGxldCBib3R0b21zID0ge31cbiAgZXhwb3J0IGxldCBpc0hvbWUgPSB7fVxuICBleHBvcnQgbGV0IGRhdGUgPSAnJ1xuICBleHBvcnQgbGV0IG9uQ2xpY2sgPSAoKSA9PiB7fVxuICBleHBvcnQgbGV0IHNob3dUb2RheSA9IHRydWVcbiAgbGV0IHRvZGF5ID0gc3BhY2V0aW1lLm5vdygpXG5cbiAgLy8gcmVuZGVyIG1ldGhvZHNcbiAgY29uc3QgaXNUb2RheSA9IGZ1bmN0aW9uIChkKSB7XG4gICAgcmV0dXJuIHNob3dUb2RheSAmJiBkLmlzU2FtZSh0b2RheSwgJ2RheScpXG4gIH1cbiAgY29uc3QgaXNXZWVrZW5kID0gZnVuY3Rpb24gKGQpIHtcbiAgICBsZXQgZGF5ID0gZC5kYXlOYW1lKClcbiAgICByZXR1cm4gZGF5ID09PSAnc2F0dXJkYXknIHx8IGRheSA9PT0gJ3N1bmRheSdcbiAgfVxuXG4gICQ6IHNldHVwID0gY2FsY01vbnRoKGRhdGUpIHx8IFtdXG4gICQ6IGNvbG9ycyA9IGZtdERheXMoZGF5cylcbiAgdG9wcyA9IGZtdERheXModG9wcylcbiAgYm90dG9tcyA9IGZtdERheXMoYm90dG9tcylcbiAgaXNIb21lID0gZm10RGF5cyhpc0hvbWUpXG4gICQ6IHdlZWtzID0gc2V0dXAubWFwKHcgPT4ge1xuICAgIHJldHVybiB3Lm1hcChkYXkgPT4ge1xuICAgICAgbGV0IGlzbyA9IGRheS5mb3JtYXQoJ2lzby1zaG9ydCcpXG4gICAgICBsZXQgb2JqID0ge1xuICAgICAgICBpc286IGlzbyxcbiAgICAgICAgY29sb3I6IGNvbG9yc1tpc29dIHx8IHRvcHNbaXNvXSB8fCAnbm9uZScsXG4gICAgICAgIG51bTogZGF5LmZvcm1hdCgne2RhdGV9JyksXG4gICAgICAgIGlzVG9wOiB0b3BzLmhhc093blByb3BlcnR5KGlzbyksXG4gICAgICAgIGlzSG9tZTogaXNIb21lLmhhc093blByb3BlcnR5KGlzbyksXG4gICAgICAgIGlzQm90dG9tOiBib3R0b21zLmhhc093blByb3BlcnR5KGlzbyksXG4gICAgICAgIGlzVG9kYXk6IGlzVG9kYXkoZGF5KSxcbiAgICAgICAgaXNXZWVrZW5kOiBpc1dlZWtlbmQoZGF5KSxcbiAgICAgICAgaW5Nb250aDogZGF5LmlzU2FtZShkYXRlLCAnbW9udGgnKSxcbiAgICAgIH1cbiAgICAgIHJldHVybiBvYmpcbiAgICB9KVxuICB9KVxuPC9zY3JpcHQ+XG5cbjxkaXYgY2xhc3M9XCJtb250aFwiIHN0eWxlPVwid2lkdGg6MTAwJTtcIj5cbiAgPGRpdiBjbGFzcz1cIm1vbnRoTmFtZVwiPntkYXRlLmZvcm1hdCgnbW9udGgnKX08L2Rpdj5cbiAgeyNlYWNoIHdlZWtzIGFzIHd9XG4gICAgPGRpdiBjbGFzcz1cIndlZWtcIj5cbiAgICAgIHsjZWFjaCB3IGFzIGR9XG4gICAgICAgIHsjaWYgZC5pbk1vbnRofVxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGNsYXNzPVwiZGF5IHNxdWFyZVwiXG4gICAgICAgICAgICBjbGFzczp0b2RheT17ZC5pc1RvZGF5fVxuICAgICAgICAgICAgY2xhc3M6d2Vla2VuZD17ZC5pc1dlZWtlbmR9XG4gICAgICAgICAgICBjbGFzczp0b3BIb21lPXtkLmlzVG9wICYmIGQuaXNIb21lfVxuICAgICAgICAgICAgY2xhc3M6Ym90dG9tSG9tZT17ZC5pc0JvdHRvbSAmJiBkLmlzSG9tZX1cbiAgICAgICAgICAgIGNsYXNzOnRvcEF3YXk9e2QuaXNUb3AgJiYgIWQuaXNIb21lfVxuICAgICAgICAgICAgY2xhc3M6Ym90dG9tQXdheT17ZC5pc0JvdHRvbSAmJiAhZC5pc0hvbWV9XG4gICAgICAgICAgICBjbGFzczpoaWdobGlnaHQ9e2QuY29sb3IgIT09ICdub25lJ31cbiAgICAgICAgICAgIG9uOmNsaWNrPXsoKSA9PiBvbkNsaWNrKGQpfVxuICAgICAgICAgICAgc3R5bGU9eydiYWNrZ3JvdW5kLWNvbG9yOicgKyBkLmNvbG9yfVxuICAgICAgICAgICAgdGl0bGU9e2QuaXNvfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJudW1cIj57ZC5udW19PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIHs6ZWxzZX1cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGF5IG5vZGF5IHNxdWFyZVwiPnsnICd9PC9kaXY+XG4gICAgICAgIHsvaWZ9XG4gICAgICB7L2VhY2h9XG4gICAgPC9kaXY+XG4gIHsvZWFjaH1cbjwvZGl2PlxuPHNsb3QgLz5cblxuPHN0eWxlPlxuICAubW9udGhOYW1lIHtcbiAgICBmb250LXNpemU6IDFyZW07XG4gICAgY29sb3I6ICM4MzhiOTE7XG4gICAgdGV4dC1hbGlnbjogcmlnaHQ7XG4gICAgbWFyZ2luLWJvdHRvbTogMC4ycmVtO1xuICAgIG1hcmdpbi10b3A6IDAuMnJlbTtcbiAgICBtYXJnaW4tcmlnaHQ6IDAuN3JlbTtcbiAgfVxuICAud2VlayB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYXJvdW5kO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIGZsZXgtd3JhcDogbm93cmFwO1xuICAgIGFsaWduLXNlbGY6IHN0cmV0Y2g7XG4gIH1cbiAgLmRheSB7XG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgIGZsZXg6IDE7XG4gICAgbWFyZ2luOiAwLjUlO1xuICAgIGJvcmRlci1yYWRpdXM6IDNweDtcbiAgICBib3gtc2hhZG93OiAycHggMXB4IDZweCAwcHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIG1pbi13aWR0aDogMTNweDtcbiAgICBtaW4taGVpZ2h0OiAxMnB4O1xuICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgZm9udC1zaXplOiA5cHg7XG4gICAgY29sb3I6ICNhM2E1YTU7XG4gICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICB6LWluZGV4OiAxO1xuICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgfVxuICAuZGF5OmhvdmVyIHtcbiAgICBib3gtc2hhZG93OiAxcHggNHB4IDEwcHggMXB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcbiAgfVxuICAuaGlnaGxpZ2h0IHtcbiAgICBib3gtc2hhZG93OiAxcHggNHB4IDEwcHggMXB4IHJnYmEoMCwgMCwgMCwgMC40KTtcbiAgfVxuICAuc3F1YXJlIHtcbiAgICBwYWRkaW5nLXRvcDogMTUlOyAvKiAxOjEgQXNwZWN0IFJhdGlvICovXG4gICAgcG9zaXRpb246IHJlbGF0aXZlOyAvKiBJZiB5b3Ugd2FudCB0ZXh0IGluc2lkZSBvZiBpdCAqL1xuICB9XG4gIC5ub2RheSB7XG4gICAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50O1xuICB9XG4gIC50b2RheSB7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogbGlnaHRzdGVlbGJsdWU7XG4gICAgYm9yZGVyOiAxcHggc29saWQgbGlnaHRzdGVlbGJsdWUgIWltcG9ydGFudDtcbiAgICBjb2xvcjogd2hpdGU7XG4gIH1cbiAgLnRvcEhvbWUge1xuICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgwZGVnLCAjZjBmMGYwIDUwJSwgcmdiYSg4MSwgMTE1LCAxNjYsIDAuNykgNTAlKTtcbiAgfVxuICAuYm90dG9tSG9tZSB7XG4gICAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDBkZWcsIHJnYmEoODEsIDExNSwgMTY2LCAwLjkpIDUwJSwgI2YwZjBmMCA1MCUpO1xuICB9XG4gIC50b3BBd2F5IHtcbiAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMGRlZywgI2YwZjBmMCA1MCUsIHJnYmEoMTUxLCAxMzksIDE2MywgMC43KSA1MCUpO1xuICB9XG4gIC5ib3R0b21Bd2F5IHtcbiAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMGRlZywgcmdiYSgxNTEsIDEzOSwgMTYzLCAwLjkpIDUwJSwgI2YwZjBmMCA1MCUpO1xuICB9XG4gIC5udW0ge1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICB6LWluZGV4OiA0O1xuICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICBjb2xvcjogIzk0OWE5ZTtcbiAgICBvcGFjaXR5OiAwLjg7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgaGVpZ2h0OiAxMDAlO1xuICAgIHRvcDogMHB4O1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBtYXJnaW46IGF1dG87XG4gICAgLyogcGFkZGluZy10b3A6IDQwJTsgKi9cbiAgICAvKiBtYXJnaW4tbGVmdDogNSU7ICovXG4gICAgb3BhY2l0eTogMDtcbiAgICAvKiB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMXM7ICovXG4gICAgY3Vyc29yOiBwb2ludGVyO1xuICB9XG4gIC5udW06aG92ZXIge1xuICAgIG9wYWNpdHk6IDAuODtcbiAgfVxuICAud2Vla2VuZCB7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogI2YwZjBmMDtcbiAgfVxuICBAbWVkaWEgb25seSBzY3JlZW4gYW5kIChtYXgtd2lkdGg6IDQwMHB4KSB7XG4gICAgLm1vbnRoTmFtZSB7XG4gICAgICBmb250LXNpemU6IDAuN3JlbTtcbiAgICB9XG4gICAgLmRheSB7XG4gICAgICBib3JkZXItcmFkaXVzOiAycHg7XG4gICAgICBtYXJnaW46IDAuNSU7XG4gICAgICBib3gtc2hhZG93OiAxcHggMXB4IDFweCAwcHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIH1cbiAgICAubnVtIHtcbiAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgfVxuICB9XG48L3N0eWxlPlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQTZFRSxVQUFVLGVBQUMsQ0FBQyxBQUNWLFNBQVMsQ0FBRSxJQUFJLENBQ2YsS0FBSyxDQUFFLE9BQU8sQ0FDZCxVQUFVLENBQUUsS0FBSyxDQUNqQixhQUFhLENBQUUsTUFBTSxDQUNyQixVQUFVLENBQUUsTUFBTSxDQUNsQixZQUFZLENBQUUsTUFBTSxBQUN0QixDQUFDLEFBQ0QsS0FBSyxlQUFDLENBQUMsQUFDTCxPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxZQUFZLENBQzdCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLFNBQVMsQ0FBRSxNQUFNLENBQ2pCLFVBQVUsQ0FBRSxPQUFPLEFBQ3JCLENBQUMsQUFDRCxJQUFJLGVBQUMsQ0FBQyxBQUNKLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLElBQUksQ0FBRSxDQUFDLENBQ1AsTUFBTSxDQUFFLElBQUksQ0FDWixhQUFhLENBQUUsR0FBRyxDQUNsQixVQUFVLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQzlDLFNBQVMsQ0FBRSxJQUFJLENBQ2YsVUFBVSxDQUFFLElBQUksQ0FDaEIsVUFBVSxDQUFFLFVBQVUsQ0FDdEIsU0FBUyxDQUFFLEdBQUcsQ0FDZCxLQUFLLENBQUUsT0FBTyxDQUNkLFFBQVEsQ0FBRSxNQUFNLENBQ2hCLE9BQU8sQ0FBRSxDQUFDLENBQ1YsTUFBTSxDQUFFLE9BQU8sQUFDakIsQ0FBQyxBQUNELG1CQUFJLE1BQU0sQUFBQyxDQUFDLEFBQ1YsVUFBVSxDQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxBQUNqRCxDQUFDLEFBQ0QsVUFBVSxlQUFDLENBQUMsQUFDVixVQUFVLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEFBQ2pELENBQUMsQUFDRCxPQUFPLGVBQUMsQ0FBQyxBQUNQLFdBQVcsQ0FBRSxHQUFHLENBQ2hCLFFBQVEsQ0FBRSxRQUFRLEFBQ3BCLENBQUMsQUFDRCxNQUFNLGVBQUMsQ0FBQyxBQUNOLFVBQVUsQ0FBRSxJQUFJLENBQUMsVUFBVSxBQUM3QixDQUFDLEFBQ0QsTUFBTSxlQUFDLENBQUMsQUFDTixnQkFBZ0IsQ0FBRSxjQUFjLENBQ2hDLE1BQU0sQ0FBRSxHQUFHLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQzNDLEtBQUssQ0FBRSxLQUFLLEFBQ2QsQ0FBQyxBQUNELFFBQVEsZUFBQyxDQUFDLEFBQ1IsVUFBVSxDQUFFLGdCQUFnQixJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQUFDN0UsQ0FBQyxBQUNELFdBQVcsZUFBQyxDQUFDLEFBQ1gsVUFBVSxDQUFFLGdCQUFnQixJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQUFDN0UsQ0FBQyxBQUNELFFBQVEsZUFBQyxDQUFDLEFBQ1IsVUFBVSxDQUFFLGdCQUFnQixJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQUFDOUUsQ0FBQyxBQUNELFdBQVcsZUFBQyxDQUFDLEFBQ1gsVUFBVSxDQUFFLGdCQUFnQixJQUFJLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQUFDOUUsQ0FBQyxBQUNELElBQUksZUFBQyxDQUFDLEFBQ0osUUFBUSxDQUFFLFFBQVEsQ0FDbEIsT0FBTyxDQUFFLENBQUMsQ0FDVixTQUFTLENBQUUsSUFBSSxDQUNmLEtBQUssQ0FBRSxPQUFPLENBQ2QsT0FBTyxDQUFFLEdBQUcsQ0FDWixLQUFLLENBQUUsSUFBSSxDQUNYLE1BQU0sQ0FBRSxJQUFJLENBQ1osR0FBRyxDQUFFLEdBQUcsQ0FDUixVQUFVLENBQUUsTUFBTSxDQUNsQixNQUFNLENBQUUsSUFBSSxDQUdaLE9BQU8sQ0FBRSxDQUFDLENBRVYsTUFBTSxDQUFFLE9BQU8sQUFDakIsQ0FBQyxBQUNELG1CQUFJLE1BQU0sQUFBQyxDQUFDLEFBQ1YsT0FBTyxDQUFFLEdBQUcsQUFDZCxDQUFDLEFBQ0QsUUFBUSxlQUFDLENBQUMsQUFDUixnQkFBZ0IsQ0FBRSxPQUFPLEFBQzNCLENBQUMsQUFDRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFlBQVksS0FBSyxDQUFDLEFBQUMsQ0FBQyxBQUN6QyxVQUFVLGVBQUMsQ0FBQyxBQUNWLFNBQVMsQ0FBRSxNQUFNLEFBQ25CLENBQUMsQUFDRCxJQUFJLGVBQUMsQ0FBQyxBQUNKLGFBQWEsQ0FBRSxHQUFHLENBQ2xCLE1BQU0sQ0FBRSxJQUFJLENBQ1osVUFBVSxDQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxBQUNoRCxDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxBQUNmLENBQUMsQUFDSCxDQUFDIn0= */";
    	append_dev$1(document.head, style);
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[19] = list[i];
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	return child_ctx;
    }

    // (68:8) {:else}
    function create_else_block$1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			div.textContent = `${" "}`;
    			attr_dev$1(div, "class", "day noday square svelte-1dblamv");
    			add_location$1(div, file$2, 68, 10, 1971);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);
    		},
    		p: noop$1,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(68:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (52:8) {#if d.inMonth}
    function create_if_block$2(ctx) {
    	let div1;
    	let div0;
    	let t_value = /*d*/ ctx[19].num + "";
    	let t;
    	let div1_style_value;
    	let div1_title_value;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[10](/*d*/ ctx[19], ...args);
    	}

    	const block = {
    		c: function create() {
    			div1 = element$1("div");
    			div0 = element$1("div");
    			t = text$1(t_value);
    			attr_dev$1(div0, "class", "num svelte-1dblamv");
    			add_location$1(div0, file$2, 65, 12, 1897);
    			attr_dev$1(div1, "class", "day square svelte-1dblamv");
    			attr_dev$1(div1, "style", div1_style_value = "background-color:" + /*d*/ ctx[19].color);
    			attr_dev$1(div1, "title", div1_title_value = /*d*/ ctx[19].iso);
    			toggle_class(div1, "today", /*d*/ ctx[19].isToday);
    			toggle_class(div1, "weekend", /*d*/ ctx[19].isWeekend);
    			toggle_class(div1, "topHome", /*d*/ ctx[19].isTop && /*d*/ ctx[19].isHome);
    			toggle_class(div1, "bottomHome", /*d*/ ctx[19].isBottom && /*d*/ ctx[19].isHome);
    			toggle_class(div1, "topAway", /*d*/ ctx[19].isTop && !/*d*/ ctx[19].isHome);
    			toggle_class(div1, "bottomAway", /*d*/ ctx[19].isBottom && !/*d*/ ctx[19].isHome);
    			toggle_class(div1, "highlight", /*d*/ ctx[19].color !== "none");
    			add_location$1(div1, file$2, 52, 10, 1390);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div1, anchor);
    			append_dev$1(div1, div0);
    			append_dev$1(div0, t);

    			if (!mounted) {
    				dispose = listen_dev(div1, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*weeks*/ 4 && t_value !== (t_value = /*d*/ ctx[19].num + "")) set_data_dev$1(t, t_value);

    			if (dirty & /*weeks*/ 4 && div1_style_value !== (div1_style_value = "background-color:" + /*d*/ ctx[19].color)) {
    				attr_dev$1(div1, "style", div1_style_value);
    			}

    			if (dirty & /*weeks*/ 4 && div1_title_value !== (div1_title_value = /*d*/ ctx[19].iso)) {
    				attr_dev$1(div1, "title", div1_title_value);
    			}

    			if (dirty & /*weeks*/ 4) {
    				toggle_class(div1, "today", /*d*/ ctx[19].isToday);
    			}

    			if (dirty & /*weeks*/ 4) {
    				toggle_class(div1, "weekend", /*d*/ ctx[19].isWeekend);
    			}

    			if (dirty & /*weeks*/ 4) {
    				toggle_class(div1, "topHome", /*d*/ ctx[19].isTop && /*d*/ ctx[19].isHome);
    			}

    			if (dirty & /*weeks*/ 4) {
    				toggle_class(div1, "bottomHome", /*d*/ ctx[19].isBottom && /*d*/ ctx[19].isHome);
    			}

    			if (dirty & /*weeks*/ 4) {
    				toggle_class(div1, "topAway", /*d*/ ctx[19].isTop && !/*d*/ ctx[19].isHome);
    			}

    			if (dirty & /*weeks*/ 4) {
    				toggle_class(div1, "bottomAway", /*d*/ ctx[19].isBottom && !/*d*/ ctx[19].isHome);
    			}

    			if (dirty & /*weeks*/ 4) {
    				toggle_class(div1, "highlight", /*d*/ ctx[19].color !== "none");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(52:8) {#if d.inMonth}",
    		ctx
    	});

    	return block;
    }

    // (51:6) {#each w as d}
    function create_each_block_1(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*d*/ ctx[19].inMonth) return create_if_block$2;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev$1(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev$1(if_block_anchor);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(51:6) {#each w as d}",
    		ctx
    	});

    	return block;
    }

    // (49:2) {#each weeks as w}
    function create_each_block(ctx) {
    	let div;
    	let t;
    	let each_value_1 = /*w*/ ctx[16];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div = element$1("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space$1();
    			attr_dev$1(div, "class", "week svelte-1dblamv");
    			add_location$1(div, file$2, 49, 4, 1316);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append_dev$1(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*weeks, onClick*/ 6) {
    				each_value_1 = /*w*/ ctx[16];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(49:2) {#each weeks as w}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div1;
    	let div0;
    	let t0_value = /*date*/ ctx[0].format("month") + "";
    	let t0;
    	let t1;
    	let t2;
    	let current;
    	let each_value = /*weeks*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	const block = {
    		c: function create() {
    			div1 = element$1("div");
    			div0 = element$1("div");
    			t0 = text$1(t0_value);
    			t1 = space$1();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space$1();
    			if (default_slot) default_slot.c();
    			attr_dev$1(div0, "class", "monthName svelte-1dblamv");
    			add_location$1(div0, file$2, 47, 2, 1239);
    			attr_dev$1(div1, "class", "month");
    			set_style$1(div1, "width", "100%");
    			add_location$1(div1, file$2, 46, 0, 1197);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div1, anchor);
    			append_dev$1(div1, div0);
    			append_dev$1(div0, t0);
    			append_dev$1(div1, t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			insert_dev$1(target, t2, anchor);

    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*date*/ 1) && t0_value !== (t0_value = /*date*/ ctx[0].format("month") + "")) set_data_dev$1(t0, t0_value);

    			if (dirty & /*weeks, onClick*/ 6) {
    				each_value = /*weeks*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 256) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[8], dirty, null, null);
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
    			destroy_each(each_blocks, detaching);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots$1("Month", slots, ['default']);
    	let { days = {} } = $$props;
    	let { tops = {} } = $$props;
    	let { bottoms = {} } = $$props;
    	let { isHome = {} } = $$props;
    	let { date = "" } = $$props;

    	let { onClick = () => {
    		
    	} } = $$props;

    	let { showToday = true } = $$props;
    	let today = src.now();

    	// render methods
    	const isToday = function (d) {
    		return showToday && d.isSame(today, "day");
    	};

    	const isWeekend = function (d) {
    		let day = d.dayName();
    		return day === "saturday" || day === "sunday";
    	};

    	tops = fmtDays(tops);
    	bottoms = fmtDays(bottoms);
    	isHome = fmtDays(isHome);
    	const writable_props = ["days", "tops", "bottoms", "isHome", "date", "onClick", "showToday"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Month> was created with unknown prop '${key}'`);
    	});

    	const click_handler = d => onClick(d);

    	$$self.$$set = $$props => {
    		if ("days" in $$props) $$invalidate(6, days = $$props.days);
    		if ("tops" in $$props) $$invalidate(3, tops = $$props.tops);
    		if ("bottoms" in $$props) $$invalidate(4, bottoms = $$props.bottoms);
    		if ("isHome" in $$props) $$invalidate(5, isHome = $$props.isHome);
    		if ("date" in $$props) $$invalidate(0, date = $$props.date);
    		if ("onClick" in $$props) $$invalidate(1, onClick = $$props.onClick);
    		if ("showToday" in $$props) $$invalidate(7, showToday = $$props.showToday);
    		if ("$$scope" in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		spacetime: src,
    		calcMonth: calculate,
    		fmtDays,
    		days,
    		tops,
    		bottoms,
    		isHome,
    		date,
    		onClick,
    		showToday,
    		today,
    		isToday,
    		isWeekend,
    		setup,
    		colors,
    		weeks
    	});

    	$$self.$inject_state = $$props => {
    		if ("days" in $$props) $$invalidate(6, days = $$props.days);
    		if ("tops" in $$props) $$invalidate(3, tops = $$props.tops);
    		if ("bottoms" in $$props) $$invalidate(4, bottoms = $$props.bottoms);
    		if ("isHome" in $$props) $$invalidate(5, isHome = $$props.isHome);
    		if ("date" in $$props) $$invalidate(0, date = $$props.date);
    		if ("onClick" in $$props) $$invalidate(1, onClick = $$props.onClick);
    		if ("showToday" in $$props) $$invalidate(7, showToday = $$props.showToday);
    		if ("today" in $$props) today = $$props.today;
    		if ("setup" in $$props) $$invalidate(11, setup = $$props.setup);
    		if ("colors" in $$props) $$invalidate(12, colors = $$props.colors);
    		if ("weeks" in $$props) $$invalidate(2, weeks = $$props.weeks);
    	};

    	let setup;
    	let colors;
    	let weeks;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*date*/ 1) {
    			 $$invalidate(11, setup = calculate(date) || []);
    		}

    		if ($$self.$$.dirty & /*days*/ 64) {
    			 $$invalidate(12, colors = fmtDays(days));
    		}

    		if ($$self.$$.dirty & /*setup, colors, tops, isHome, bottoms, date*/ 6201) {
    			 $$invalidate(2, weeks = setup.map(w => {
    				return w.map(day => {
    					let iso = day.format("iso-short");

    					let obj = {
    						iso,
    						color: colors[iso] || tops[iso] || "none",
    						num: day.format("{date}"),
    						isTop: tops.hasOwnProperty(iso),
    						isHome: isHome.hasOwnProperty(iso),
    						isBottom: bottoms.hasOwnProperty(iso),
    						isToday: isToday(day),
    						isWeekend: isWeekend(day),
    						inMonth: day.isSame(date, "month")
    					};

    					return obj;
    				});
    			}));
    		}
    	};

    	return [
    		date,
    		onClick,
    		weeks,
    		tops,
    		bottoms,
    		isHome,
    		days,
    		showToday,
    		$$scope,
    		slots,
    		click_handler
    	];
    }

    class Month extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1dblamv-style")) add_css$2();

    		init$1(this, options, instance$2, create_fragment$2, safe_not_equal$1, {
    			days: 6,
    			tops: 3,
    			bottoms: 4,
    			isHome: 5,
    			date: 0,
    			onClick: 1,
    			showToday: 7
    		});

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Month",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get days() {
    		throw new Error("<Month>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set days(value) {
    		throw new Error("<Month>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get tops() {
    		throw new Error("<Month>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tops(value) {
    		throw new Error("<Month>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get bottoms() {
    		throw new Error("<Month>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bottoms(value) {
    		throw new Error("<Month>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isHome() {
    		throw new Error("<Month>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isHome(value) {
    		throw new Error("<Month>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get date() {
    		throw new Error("<Month>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set date(value) {
    		throw new Error("<Month>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get onClick() {
    		throw new Error("<Month>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onClick(value) {
    		throw new Error("<Month>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showToday() {
    		throw new Error("<Month>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showToday(value) {
    		throw new Error("<Month>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Users/spencer/mountain/somehow-calendar/src/Quarter.svelte generated by Svelte v3.29.0 */
    const file$3 = "Users/spencer/mountain/somehow-calendar/src/Quarter.svelte";

    function add_css$3() {
    	var style = element$1("style");
    	style.id = "svelte-nw9fxb-style";
    	style.textContent = ".row.svelte-nw9fxb{display:flex;flex-direction:row;justify-content:space-around;align-items:flex-start;text-align:center;flex-wrap:nowrap;align-self:stretch}.gap.svelte-nw9fxb{margin:10px;flex:1;width:100%}@media only screen and (max-width: 340px){.row.svelte-nw9fxb{flex-direction:column;margin-left:0px;margin-right:20px}}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXVhcnRlci5zdmVsdGUiLCJzb3VyY2VzIjpbIlF1YXJ0ZXIuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBzcGFjZXRpbWUgZnJvbSAnc3BhY2V0aW1lJ1xuICBpbXBvcnQgTW9udGggZnJvbSAnLi9Nb250aC5zdmVsdGUnXG4gIGV4cG9ydCBsZXQgZGF0ZSA9ICcnXG4gIGV4cG9ydCBsZXQgZGF5cyA9IHt9XG4gIGV4cG9ydCBsZXQgdG9wcyA9IHt9XG4gIGV4cG9ydCBsZXQgaXNIb21lID0ge31cbiAgZXhwb3J0IGxldCBib3R0b21zID0ge31cbiAgZXhwb3J0IGxldCBzaG93VG9kYXkgPSB0cnVlXG4gIGRhdGUgPSBzcGFjZXRpbWUoZGF0ZSlcbiAgbGV0IHN0YXJ0ID0gZGF0ZS5zdGFydE9mKCdxdWFydGVyJykubWludXMoMSwgJ3NlY29uZCcpXG4gIGxldCBtb250aHMgPSBzdGFydC5ldmVyeSgnbW9udGgnLCBkYXRlLmVuZE9mKCdxdWFydGVyJykpXG48L3NjcmlwdD5cblxuPGRpdiBjbGFzcz1cInJvd1wiPlxuICB7I2VhY2ggbW9udGhzIGFzIG19XG4gICAgPGRpdiBjbGFzcz1cImdhcFwiPlxuICAgICAgPE1vbnRoIGRhdGU9e219IHtkYXlzfSB7c2hvd1RvZGF5fSB7dG9wc30ge2JvdHRvbXN9IHtpc0hvbWV9PlxuICAgICAgICA8c2xvdCAvPlxuICAgICAgPC9Nb250aD5cbiAgICA8L2Rpdj5cbiAgey9lYWNofVxuPC9kaXY+XG5cbjxzdHlsZT5cbiAgLnJvdyB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYXJvdW5kO1xuICAgIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBmbGV4LXdyYXA6IG5vd3JhcDtcbiAgICBhbGlnbi1zZWxmOiBzdHJldGNoO1xuICB9XG4gIC5nYXAge1xuICAgIG1hcmdpbjogMTBweDtcbiAgICBmbGV4OiAxO1xuICAgIHdpZHRoOiAxMDAlO1xuICB9XG4gIEBtZWRpYSBvbmx5IHNjcmVlbiBhbmQgKG1heC13aWR0aDogMzQwcHgpIHtcbiAgICAucm93IHtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBtYXJnaW4tbGVmdDogMHB4O1xuICAgICAgbWFyZ2luLXJpZ2h0OiAyMHB4O1xuICAgIH1cbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUF5QkUsSUFBSSxjQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxZQUFZLENBQzdCLFdBQVcsQ0FBRSxVQUFVLENBQ3ZCLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLFNBQVMsQ0FBRSxNQUFNLENBQ2pCLFVBQVUsQ0FBRSxPQUFPLEFBQ3JCLENBQUMsQUFDRCxJQUFJLGNBQUMsQ0FBQyxBQUNKLE1BQU0sQ0FBRSxJQUFJLENBQ1osSUFBSSxDQUFFLENBQUMsQ0FDUCxLQUFLLENBQUUsSUFBSSxBQUNiLENBQUMsQUFDRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFlBQVksS0FBSyxDQUFDLEFBQUMsQ0FBQyxBQUN6QyxJQUFJLGNBQUMsQ0FBQyxBQUNKLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLFdBQVcsQ0FBRSxHQUFHLENBQ2hCLFlBQVksQ0FBRSxJQUFJLEFBQ3BCLENBQUMsQUFDSCxDQUFDIn0= */";
    	append_dev$1(document.head, style);
    }

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    // (18:6) <Month date={m} {days} {showToday} {tops} {bottoms} {isHome}>
    function create_default_slot(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[7].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 256) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[8], dirty, null, null);
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
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(18:6) <Month date={m} {days} {showToday} {tops} {bottoms} {isHome}>",
    		ctx
    	});

    	return block;
    }

    // (16:2) {#each months as m}
    function create_each_block$1(ctx) {
    	let div;
    	let month;
    	let t;
    	let current;

    	month = new Month({
    			props: {
    				date: /*m*/ ctx[10],
    				days: /*days*/ ctx[0],
    				showToday: /*showToday*/ ctx[4],
    				tops: /*tops*/ ctx[1],
    				bottoms: /*bottoms*/ ctx[3],
    				isHome: /*isHome*/ ctx[2],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			create_component$1(month.$$.fragment);
    			t = space$1();
    			attr_dev$1(div, "class", "gap svelte-nw9fxb");
    			add_location$1(div, file$3, 16, 4, 428);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);
    			mount_component$1(month, div, null);
    			append_dev$1(div, t);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const month_changes = {};
    			if (dirty & /*days*/ 1) month_changes.days = /*days*/ ctx[0];
    			if (dirty & /*showToday*/ 16) month_changes.showToday = /*showToday*/ ctx[4];
    			if (dirty & /*tops*/ 2) month_changes.tops = /*tops*/ ctx[1];
    			if (dirty & /*bottoms*/ 8) month_changes.bottoms = /*bottoms*/ ctx[3];
    			if (dirty & /*isHome*/ 4) month_changes.isHome = /*isHome*/ ctx[2];

    			if (dirty & /*$$scope*/ 256) {
    				month_changes.$$scope = { dirty, ctx };
    			}

    			month.$set(month_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in$1(month.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out$1(month.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div);
    			destroy_component$1(month);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(16:2) {#each months as m}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div;
    	let current;
    	let each_value = /*months*/ ctx[5];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out$1(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div = element$1("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev$1(div, "class", "row svelte-nw9fxb");
    			add_location$1(div, file$3, 14, 0, 384);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*months, days, showToday, tops, bottoms, isHome, $$scope*/ 319) {
    				each_value = /*months*/ ctx[5];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in$1(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in$1(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
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
    				transition_in$1(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out$1(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div);
    			destroy_each(each_blocks, detaching);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots$1("Quarter", slots, ['default']);
    	let { date = "" } = $$props;
    	let { days = {} } = $$props;
    	let { tops = {} } = $$props;
    	let { isHome = {} } = $$props;
    	let { bottoms = {} } = $$props;
    	let { showToday = true } = $$props;
    	date = src(date);
    	let start = date.startOf("quarter").minus(1, "second");
    	let months = start.every("month", date.endOf("quarter"));
    	const writable_props = ["date", "days", "tops", "isHome", "bottoms", "showToday"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Quarter> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("date" in $$props) $$invalidate(6, date = $$props.date);
    		if ("days" in $$props) $$invalidate(0, days = $$props.days);
    		if ("tops" in $$props) $$invalidate(1, tops = $$props.tops);
    		if ("isHome" in $$props) $$invalidate(2, isHome = $$props.isHome);
    		if ("bottoms" in $$props) $$invalidate(3, bottoms = $$props.bottoms);
    		if ("showToday" in $$props) $$invalidate(4, showToday = $$props.showToday);
    		if ("$$scope" in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		spacetime: src,
    		Month,
    		date,
    		days,
    		tops,
    		isHome,
    		bottoms,
    		showToday,
    		start,
    		months
    	});

    	$$self.$inject_state = $$props => {
    		if ("date" in $$props) $$invalidate(6, date = $$props.date);
    		if ("days" in $$props) $$invalidate(0, days = $$props.days);
    		if ("tops" in $$props) $$invalidate(1, tops = $$props.tops);
    		if ("isHome" in $$props) $$invalidate(2, isHome = $$props.isHome);
    		if ("bottoms" in $$props) $$invalidate(3, bottoms = $$props.bottoms);
    		if ("showToday" in $$props) $$invalidate(4, showToday = $$props.showToday);
    		if ("start" in $$props) start = $$props.start;
    		if ("months" in $$props) $$invalidate(5, months = $$props.months);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [days, tops, isHome, bottoms, showToday, months, date, slots, $$scope];
    }

    class Quarter extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-nw9fxb-style")) add_css$3();

    		init$1(this, options, instance$3, create_fragment$3, safe_not_equal$1, {
    			date: 6,
    			days: 0,
    			tops: 1,
    			isHome: 2,
    			bottoms: 3,
    			showToday: 4
    		});

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Quarter",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get date() {
    		throw new Error("<Quarter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set date(value) {
    		throw new Error("<Quarter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get days() {
    		throw new Error("<Quarter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set days(value) {
    		throw new Error("<Quarter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get tops() {
    		throw new Error("<Quarter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tops(value) {
    		throw new Error("<Quarter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isHome() {
    		throw new Error("<Quarter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isHome(value) {
    		throw new Error("<Quarter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get bottoms() {
    		throw new Error("<Quarter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bottoms(value) {
    		throw new Error("<Quarter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showToday() {
    		throw new Error("<Quarter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showToday(value) {
    		throw new Error("<Quarter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var games = [
      {
        "date": "2022-04-08T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Rangers"
      },
      {
        "date": "2022-04-09T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Rangers"
      },
      {
        "date": "2022-04-10T13:37:00.000-04:00",
        "time": "1:37 PM",
        "daytime": true,
        "home": true,
        "vs": "Rangers"
      },
      {
        "date": "2022-04-11T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Yankees"
      },
      {
        "date": "2022-04-12T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Yankees"
      },
      {
        "date": "2022-04-13T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Yankees"
      },
      {
        "date": "2022-04-14T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Yankees"
      },
      {
        "date": "2022-04-15T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Athletics"
      },
      {
        "date": "2022-04-16T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Athletics"
      },
      {
        "date": "2022-04-17T13:37:00.000-04:00",
        "time": "1:37 PM",
        "daytime": true,
        "home": true,
        "vs": "Athletics"
      },
      {
        "date": "2022-04-19T19:10:00.000-04:00",
        "time": "7:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Red Sox"
      },
      {
        "date": "2022-04-20T19:10:00.000-04:00",
        "time": "7:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Red Sox"
      },
      {
        "date": "2022-04-21T13:35:00.000-04:00",
        "time": "1:35 PM",
        "daytime": true,
        "home": false,
        "vs": "Red Sox"
      },
      {
        "date": "2022-04-22T20:10:00.000-04:00",
        "time": "8:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Astros"
      },
      {
        "date": "2022-04-23T16:10:00.000-04:00",
        "time": "4:10 PM",
        "daytime": true,
        "home": false,
        "vs": "Astros"
      },
      {
        "date": "2022-04-24T14:10:00.000-04:00",
        "time": "2:10 PM",
        "daytime": true,
        "home": false,
        "vs": "Astros"
      },
      {
        "date": "2022-04-25T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Red Sox"
      },
      {
        "date": "2022-04-26T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Red Sox"
      },
      {
        "date": "2022-04-27T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Red Sox"
      },
      {
        "date": "2022-04-28T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Red Sox"
      },
      {
        "date": "2022-04-29T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Astros"
      },
      {
        "date": "2022-04-30T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Astros"
      },
      {
        "date": "2022-05-01T13:37:00.000-04:00",
        "time": "1:37 PM",
        "daytime": true,
        "home": true,
        "vs": "Astros"
      },
      {
        "date": "2022-05-02T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Yankees"
      },
      {
        "date": "2022-05-03T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Yankees"
      },
      {
        "date": "2022-05-04T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Yankees"
      },
      {
        "date": "2022-05-05T18:10:00.000-04:00",
        "time": "6:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Guardians"
      },
      {
        "date": "2022-05-06T19:10:00.000-04:00",
        "time": "7:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Guardians"
      },
      {
        "date": "2022-05-07T18:10:00.000-04:00",
        "time": "6:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Guardians"
      },
      {
        "date": "2022-05-08T13:40:00.000-04:00",
        "time": "1:40 PM",
        "daytime": true,
        "home": false,
        "vs": "Guardians"
      },
      {
        "date": "2022-05-10T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Yankees"
      },
      {
        "date": "2022-05-11T12:35:00.000-04:00",
        "time": "12:35 PM",
        "daytime": true,
        "home": false,
        "vs": "Yankees"
      },
      {
        "date": "2022-05-13T19:10:00.000-04:00",
        "time": "7:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Rays"
      },
      {
        "date": "2022-05-14T18:10:00.000-04:00",
        "time": "6:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Rays"
      },
      {
        "date": "2022-05-15T13:40:00.000-04:00",
        "time": "1:40 PM",
        "daytime": true,
        "home": false,
        "vs": "Rays"
      },
      {
        "date": "2022-05-16T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Mariners"
      },
      {
        "date": "2022-05-17T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Mariners"
      },
      {
        "date": "2022-05-18T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Mariners"
      },
      {
        "date": "2022-05-20T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Reds"
      },
      {
        "date": "2022-05-21T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Reds"
      },
      {
        "date": "2022-05-22T13:37:00.000-04:00",
        "time": "1:37 PM",
        "daytime": true,
        "home": true,
        "vs": "Reds"
      },
      {
        "date": "2022-05-23T19:45:00.000-04:00",
        "time": "7:45 PM",
        "daytime": false,
        "home": false,
        "vs": "Cardinals"
      },
      {
        "date": "2022-05-24T19:45:00.000-04:00",
        "time": "7:45 PM",
        "daytime": false,
        "home": false,
        "vs": "Cardinals"
      },
      {
        "date": "2022-05-26T21:38:00.000-04:00",
        "time": "9:38 PM",
        "daytime": false,
        "home": false,
        "vs": "Angels"
      },
      {
        "date": "2022-05-27T21:38:00.000-04:00",
        "time": "9:38 PM",
        "daytime": false,
        "home": false,
        "vs": "Angels"
      },
      {
        "date": "2022-05-28T22:07:00.000-04:00",
        "time": "10:07 PM",
        "daytime": false,
        "home": false,
        "vs": "Angels"
      },
      {
        "date": "2022-05-29T16:07:00.000-04:00",
        "time": "4:07 PM",
        "daytime": true,
        "home": false,
        "vs": "Angels"
      },
      {
        "date": "2022-05-31T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "White Sox"
      },
      {
        "date": "2022-06-01T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "White Sox"
      },
      {
        "date": "2022-06-02T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "White Sox"
      },
      {
        "date": "2022-06-03T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Twins"
      },
      {
        "date": "2022-06-04T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Twins"
      },
      {
        "date": "2022-06-05T13:37:00.000-04:00",
        "time": "1:37 PM",
        "daytime": true,
        "home": true,
        "vs": "Twins"
      },
      {
        "date": "2022-06-06T20:10:00.000-04:00",
        "time": "8:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Royals"
      },
      {
        "date": "2022-06-07T20:10:00.000-04:00",
        "time": "8:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Royals"
      },
      {
        "date": "2022-06-08T14:10:00.000-04:00",
        "time": "2:10 PM",
        "daytime": true,
        "home": false,
        "vs": "Royals"
      },
      {
        "date": "2022-06-10T19:10:00.000-04:00",
        "time": "7:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Tigers"
      },
      {
        "date": "2022-06-11T16:10:00.000-04:00",
        "time": "4:10 PM",
        "daytime": true,
        "home": false,
        "vs": "Tigers"
      },
      {
        "date": "2022-06-12T13:40:00.000-04:00",
        "time": "1:40 PM",
        "daytime": true,
        "home": false,
        "vs": "Tigers"
      },
      {
        "date": "2022-06-13T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Orioles"
      },
      {
        "date": "2022-06-14T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Orioles"
      },
      {
        "date": "2022-06-15T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Orioles"
      },
      {
        "date": "2022-06-16T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Orioles"
      },
      {
        "date": "2022-06-17T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Yankees"
      },
      {
        "date": "2022-06-18T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Yankees"
      },
      {
        "date": "2022-06-19T13:37:00.000-04:00",
        "time": "1:37 PM",
        "daytime": true,
        "home": true,
        "vs": "Yankees"
      },
      {
        "date": "2022-06-20T20:10:00.000-04:00",
        "time": "8:10 PM",
        "daytime": false,
        "home": false,
        "vs": "White Sox"
      },
      {
        "date": "2022-06-21T20:10:00.000-04:00",
        "time": "8:10 PM",
        "daytime": false,
        "home": false,
        "vs": "White Sox"
      },
      {
        "date": "2022-06-22T14:10:00.000-04:00",
        "time": "2:10 PM",
        "daytime": true,
        "home": false,
        "vs": "White Sox"
      },
      {
        "date": "2022-06-24T20:10:00.000-04:00",
        "time": "8:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Brewers"
      },
      {
        "date": "2022-06-25T16:10:00.000-04:00",
        "time": "4:10 PM",
        "daytime": true,
        "home": false,
        "vs": "Brewers"
      },
      {
        "date": "2022-06-26T14:10:00.000-04:00",
        "time": "2:10 PM",
        "daytime": true,
        "home": false,
        "vs": "Brewers"
      },
      {
        "date": "2022-06-27T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Red Sox"
      },
      {
        "date": "2022-06-28T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Red Sox"
      },
      {
        "date": "2022-06-29T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Red Sox"
      },
      {
        "date": "2022-06-30T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Rays"
      },
      {
        "date": "2022-07-01T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Rays"
      },
      {
        "date": "2022-07-02T12:07:00.000-04:00",
        "time": "12:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Rays"
      },
      {
        "date": "2022-07-02T18:07:00.000-04:00",
        "time": "6:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Rays"
      },
      {
        "date": "2022-07-03T13:37:00.000-04:00",
        "time": "1:37 PM",
        "daytime": true,
        "home": true,
        "vs": "Rays"
      },
      {
        "date": "2022-07-04T21:07:00.000-04:00",
        "time": "9:07 PM",
        "daytime": false,
        "home": false,
        "vs": "Athletics"
      },
      {
        "date": "2022-07-05T21:40:00.000-04:00",
        "time": "9:40 PM",
        "daytime": false,
        "home": false,
        "vs": "Athletics"
      },
      {
        "date": "2022-07-06T15:37:00.000-04:00",
        "time": "3:37 PM",
        "daytime": true,
        "home": false,
        "vs": "Athletics"
      },
      {
        "date": "2022-07-07T22:10:00.000-04:00",
        "time": "10:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Mariners"
      },
      {
        "date": "2022-07-08T22:10:00.000-04:00",
        "time": "10:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Mariners"
      },
      {
        "date": "2022-07-09T22:10:00.000-04:00",
        "time": "10:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Mariners"
      },
      {
        "date": "2022-07-10T16:10:00.000-04:00",
        "time": "4:10 PM",
        "daytime": true,
        "home": false,
        "vs": "Mariners"
      },
      {
        "date": "2022-07-12T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Phillies"
      },
      {
        "date": "2022-07-13T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Phillies"
      },
      {
        "date": "2022-07-14T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Royals"
      },
      {
        "date": "2022-07-15T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Royals"
      },
      {
        "date": "2022-07-16T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Royals"
      },
      {
        "date": "2022-07-17T12:05:00.000-04:00",
        "time": "12:05 PM",
        "daytime": true,
        "home": true,
        "vs": "Royals"
      },
      {
        "date": "2022-07-22T19:10:00.000-04:00",
        "time": "7:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Red Sox"
      },
      {
        "date": "2022-07-23T16:10:00.000-04:00",
        "time": "4:10 PM",
        "daytime": true,
        "home": false,
        "vs": "Red Sox"
      },
      {
        "date": "2022-07-24T13:35:00.000-04:00",
        "time": "1:35 PM",
        "daytime": true,
        "home": false,
        "vs": "Red Sox"
      },
      {
        "date": "2022-07-26T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Cardinals"
      },
      {
        "date": "2022-07-27T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Cardinals"
      },
      {
        "date": "2022-07-28T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Tigers"
      },
      {
        "date": "2022-07-29T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Tigers"
      },
      {
        "date": "2022-07-30T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Tigers"
      },
      {
        "date": "2022-07-31T12:05:00.000-04:00",
        "time": "12:05 PM",
        "daytime": true,
        "home": true,
        "vs": "Tigers"
      },
      {
        "date": "2022-08-02T19:10:00.000-04:00",
        "time": "7:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Rays"
      },
      {
        "date": "2022-08-03T12:10:00.000-04:00",
        "time": "12:10 PM",
        "daytime": true,
        "home": false,
        "vs": "Rays"
      },
      {
        "date": "2022-08-04T19:40:00.000-04:00",
        "time": "7:40 PM",
        "daytime": false,
        "home": false,
        "vs": "Twins"
      },
      {
        "date": "2022-08-05T20:10:00.000-04:00",
        "time": "8:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Twins"
      },
      {
        "date": "2022-08-06T19:10:00.000-04:00",
        "time": "7:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Twins"
      },
      {
        "date": "2022-08-07T14:10:00.000-04:00",
        "time": "2:10 PM",
        "daytime": true,
        "home": false,
        "vs": "Twins"
      },
      {
        "date": "2022-08-08T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Orioles"
      },
      {
        "date": "2022-08-09T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Orioles"
      },
      {
        "date": "2022-08-10T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Orioles"
      },
      {
        "date": "2022-08-12T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Guardians"
      },
      {
        "date": "2022-08-13T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Guardians"
      },
      {
        "date": "2022-08-14T13:37:00.000-04:00",
        "time": "1:37 PM",
        "daytime": true,
        "home": true,
        "vs": "Guardians"
      },
      {
        "date": "2022-08-15T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Orioles"
      },
      {
        "date": "2022-08-16T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Orioles"
      },
      {
        "date": "2022-08-17T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Orioles"
      },
      {
        "date": "2022-08-18T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Yankees"
      },
      {
        "date": "2022-08-19T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Yankees"
      },
      {
        "date": "2022-08-20T13:05:00.000-04:00",
        "time": "1:05 PM",
        "daytime": true,
        "home": false,
        "vs": "Yankees"
      },
      {
        "date": "2022-08-21T13:35:00.000-04:00",
        "time": "1:35 PM",
        "daytime": true,
        "home": false,
        "vs": "Yankees"
      },
      {
        "date": "2022-08-23T19:10:00.000-04:00",
        "time": "7:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Red Sox"
      },
      {
        "date": "2022-08-24T19:10:00.000-04:00",
        "time": "7:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Red Sox"
      },
      {
        "date": "2022-08-25T19:10:00.000-04:00",
        "time": "7:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Red Sox"
      },
      {
        "date": "2022-08-26T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Angels"
      },
      {
        "date": "2022-08-27T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Angels"
      },
      {
        "date": "2022-08-28T13:37:00.000-04:00",
        "time": "1:37 PM",
        "daytime": true,
        "home": true,
        "vs": "Angels"
      },
      {
        "date": "2022-08-29T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Cubs"
      },
      {
        "date": "2022-08-30T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Cubs"
      },
      {
        "date": "2022-08-31T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Cubs"
      },
      {
        "date": "2022-09-02T18:35:00.000-04:00",
        "time": "6:35 PM",
        "daytime": false,
        "home": false,
        "vs": "Pirates"
      },
      {
        "date": "2022-09-03T18:35:00.000-04:00",
        "time": "6:35 PM",
        "daytime": false,
        "home": false,
        "vs": "Pirates"
      },
      {
        "date": "2022-09-04T12:05:00.000-04:00",
        "time": "12:05 PM",
        "daytime": true,
        "home": false,
        "vs": "Pirates"
      },
      {
        "date": "2022-09-05T13:05:00.000-04:00",
        "time": "1:05 PM",
        "daytime": true,
        "home": false,
        "vs": "Orioles"
      },
      {
        "date": "2022-09-06T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Orioles"
      },
      {
        "date": "2022-09-07T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Orioles"
      },
      {
        "date": "2022-09-09T20:05:00.000-04:00",
        "time": "8:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Rangers"
      },
      {
        "date": "2022-09-10T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Rangers"
      },
      {
        "date": "2022-09-11T14:35:00.000-04:00",
        "time": "2:35 PM",
        "daytime": true,
        "home": false,
        "vs": "Rangers"
      },
      {
        "date": "2022-09-12T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Rays"
      },
      {
        "date": "2022-09-13T13:07:00.000-04:00",
        "time": "1:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Rays"
      },
      {
        "date": "2022-09-13T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Rays"
      },
      {
        "date": "2022-09-14T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Rays"
      },
      {
        "date": "2022-09-15T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Rays"
      },
      {
        "date": "2022-09-16T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Orioles"
      },
      {
        "date": "2022-09-17T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Orioles"
      },
      {
        "date": "2022-09-18T13:37:00.000-04:00",
        "time": "1:37 PM",
        "daytime": true,
        "home": true,
        "vs": "Orioles"
      },
      {
        "date": "2022-09-20T18:45:00.000-04:00",
        "time": "6:45 PM",
        "daytime": false,
        "home": false,
        "vs": "Phillies"
      },
      {
        "date": "2022-09-21T18:45:00.000-04:00",
        "time": "6:45 PM",
        "daytime": false,
        "home": false,
        "vs": "Phillies"
      },
      {
        "date": "2022-09-22T18:40:00.000-04:00",
        "time": "6:40 PM",
        "daytime": false,
        "home": false,
        "vs": "Rays"
      },
      {
        "date": "2022-09-23T19:10:00.000-04:00",
        "time": "7:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Rays"
      },
      {
        "date": "2022-09-24T18:10:00.000-04:00",
        "time": "6:10 PM",
        "daytime": false,
        "home": false,
        "vs": "Rays"
      },
      {
        "date": "2022-09-25T13:10:00.000-04:00",
        "time": "1:10 PM",
        "daytime": true,
        "home": false,
        "vs": "Rays"
      },
      {
        "date": "2022-09-26T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Yankees"
      },
      {
        "date": "2022-09-27T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Yankees"
      },
      {
        "date": "2022-09-28T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Yankees"
      },
      {
        "date": "2022-09-30T19:07:00.000-04:00",
        "time": "7:07 PM",
        "daytime": false,
        "home": true,
        "vs": "Red Sox"
      },
      {
        "date": "2022-10-01T15:07:00.000-04:00",
        "time": "3:07 PM",
        "daytime": true,
        "home": true,
        "vs": "Red Sox"
      },
      {
        "date": "2022-10-02T13:37:00.000-04:00",
        "time": "1:37 PM",
        "daytime": true,
        "home": true,
        "vs": "Red Sox"
      },
      {
        "date": "2022-10-03T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Orioles"
      },
      {
        "date": "2022-10-04T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Orioles"
      },
      {
        "date": "2022-10-05T19:05:00.000-04:00",
        "time": "7:05 PM",
        "daytime": false,
        "home": false,
        "vs": "Orioles"
      }
    ];

    /* 2022/bluejays-calendar/Post.svelte generated by Svelte v3.29.0 */
    const file$4 = "2022/bluejays-calendar/Post.svelte";

    function add_css$4() {
    	var style = element("style");
    	style.id = "svelte-1o2k1lr-style";
    	style.textContent = ".m3.svelte-1o2k1lr{margin:3rem}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBIZWFkIGZyb20gJy4uLy4uL2NvbXBvbmVudHMvSGVhZC5zdmVsdGUnXG4gIGltcG9ydCBGb290IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvRm9vdC5zdmVsdGUnXG4gIGltcG9ydCB7IFF1YXJ0ZXIgfSBmcm9tICcvVXNlcnMvc3BlbmNlci9tb3VudGFpbi9zb21laG93LWNhbGVuZGFyL3NyYy9pbmRleC5tanMnXG4gIGltcG9ydCBnYW1lcyBmcm9tICcuL2RhdGEvZ2FtZXMnXG5cbiAgZXhwb3J0IGxldCB0aXRsZSA9ICcyMDIyIEJsdWUgSmF5cyBTY2hlZHVsZSdcbiAgZXhwb3J0IGxldCBzdWIgPSAnJ1xuICBsZXQgdG9wcyA9IHt9XG4gIGxldCBib3R0b21zID0ge31cbiAgbGV0IGlzSG9tZSA9IHt9XG4gIGdhbWVzLmZvckVhY2goKGcpID0+IHtcbiAgICBpZiAoZy5ob21lKSB7XG4gICAgICBpc0hvbWVbZy5kYXRlXSA9IHRydWVcbiAgICB9XG4gICAgaWYgKGcuZGF5dGltZSkge1xuICAgICAgdG9wc1tnLmRhdGVdID0gZy5ob21lID8gJ3N0ZWVsYmx1ZScgOiAnbGlnaHRzdGVlbGJsdWUnXG4gICAgfSBlbHNlIHtcbiAgICAgIGJvdHRvbXNbZy5kYXRlXSA9IGcuaG9tZSA/ICdzdGVlbGJsdWUnIDogJ2xpZ2h0c3RlZWxibHVlJ1xuICAgIH1cbiAgfSlcbjwvc2NyaXB0PlxuXG48ZGl2PlxuICA8SGVhZCB7dGl0bGV9IG51bT1cIjAyXCIge3N1Yn0gLz5cbiAgPGRpdiBjbGFzcz1cIm0zXCIgc3R5bGU9XCJtYXgtd2lkdGg6MTIwMHB4O1wiPlxuICAgIDxRdWFydGVyIGRhdGU9eycyMDIyLTA0LTAxJ30ge3RvcHN9IHtib3R0b21zfSB7aXNIb21lfSBzaG93VG9kYXk9e2ZhbHNlfSAvPlxuICAgIDxRdWFydGVyIGRhdGU9eycyMDIyLTA3LTAxJ30ge3RvcHN9IHtib3R0b21zfSB7aXNIb21lfSBzaG93VG9kYXk9e2ZhbHNlfSAvPlxuICAgIDxRdWFydGVyIGRhdGU9eycyMDIyLTEwLTAxJ30ge3RvcHN9IHtib3R0b21zfSB7aXNIb21lfSBzaG93VG9kYXk9e2ZhbHNlfSAvPlxuICA8L2Rpdj5cblxuICA8Rm9vdCB7dGl0bGV9IC8+XG48L2Rpdj5cblxuPHN0eWxlPlxuICAubTMge1xuICAgIG1hcmdpbjogM3JlbTtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFtQ0UsR0FBRyxlQUFDLENBQUMsQUFDSCxNQUFNLENBQUUsSUFBSSxBQUNkLENBQUMifQ== */";
    	append_dev(document.head, style);
    }

    function create_fragment$4(ctx) {
    	let div1;
    	let head;
    	let t0;
    	let div0;
    	let quarter0;
    	let t1;
    	let quarter1;
    	let t2;
    	let quarter2;
    	let t3;
    	let foot;
    	let current;

    	head = new Head({
    			props: {
    				title: /*title*/ ctx[0],
    				num: "02",
    				sub: /*sub*/ ctx[1]
    			},
    			$$inline: true
    		});

    	quarter0 = new Quarter({
    			props: {
    				date: "2022-04-01",
    				tops: /*tops*/ ctx[2],
    				bottoms: /*bottoms*/ ctx[3],
    				isHome: /*isHome*/ ctx[4],
    				showToday: false
    			},
    			$$inline: true
    		});

    	quarter1 = new Quarter({
    			props: {
    				date: "2022-07-01",
    				tops: /*tops*/ ctx[2],
    				bottoms: /*bottoms*/ ctx[3],
    				isHome: /*isHome*/ ctx[4],
    				showToday: false
    			},
    			$$inline: true
    		});

    	quarter2 = new Quarter({
    			props: {
    				date: "2022-10-01",
    				tops: /*tops*/ ctx[2],
    				bottoms: /*bottoms*/ ctx[3],
    				isHome: /*isHome*/ ctx[4],
    				showToday: false
    			},
    			$$inline: true
    		});

    	foot = new Foot({
    			props: { title: /*title*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			create_component(head.$$.fragment);
    			t0 = space();
    			div0 = element("div");
    			create_component(quarter0.$$.fragment);
    			t1 = space();
    			create_component(quarter1.$$.fragment);
    			t2 = space();
    			create_component(quarter2.$$.fragment);
    			t3 = space();
    			create_component(foot.$$.fragment);
    			attr_dev(div0, "class", "m3 svelte-1o2k1lr");
    			set_style(div0, "max-width", "1200px");
    			add_location(div0, file$4, 25, 2, 650);
    			add_location(div1, file$4, 23, 0, 608);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			mount_component(head, div1, null);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			mount_component(quarter0, div0, null);
    			append_dev(div0, t1);
    			mount_component(quarter1, div0, null);
    			append_dev(div0, t2);
    			mount_component(quarter2, div0, null);
    			append_dev(div1, t3);
    			mount_component(foot, div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const head_changes = {};
    			if (dirty & /*title*/ 1) head_changes.title = /*title*/ ctx[0];
    			if (dirty & /*sub*/ 2) head_changes.sub = /*sub*/ ctx[1];
    			head.$set(head_changes);
    			const quarter0_changes = {};
    			if (dirty & /*tops*/ 4) quarter0_changes.tops = /*tops*/ ctx[2];
    			if (dirty & /*bottoms*/ 8) quarter0_changes.bottoms = /*bottoms*/ ctx[3];
    			if (dirty & /*isHome*/ 16) quarter0_changes.isHome = /*isHome*/ ctx[4];
    			quarter0.$set(quarter0_changes);
    			const quarter1_changes = {};
    			if (dirty & /*tops*/ 4) quarter1_changes.tops = /*tops*/ ctx[2];
    			if (dirty & /*bottoms*/ 8) quarter1_changes.bottoms = /*bottoms*/ ctx[3];
    			if (dirty & /*isHome*/ 16) quarter1_changes.isHome = /*isHome*/ ctx[4];
    			quarter1.$set(quarter1_changes);
    			const quarter2_changes = {};
    			if (dirty & /*tops*/ 4) quarter2_changes.tops = /*tops*/ ctx[2];
    			if (dirty & /*bottoms*/ 8) quarter2_changes.bottoms = /*bottoms*/ ctx[3];
    			if (dirty & /*isHome*/ 16) quarter2_changes.isHome = /*isHome*/ ctx[4];
    			quarter2.$set(quarter2_changes);
    			const foot_changes = {};
    			if (dirty & /*title*/ 1) foot_changes.title = /*title*/ ctx[0];
    			foot.$set(foot_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(head.$$.fragment, local);
    			transition_in(quarter0.$$.fragment, local);
    			transition_in(quarter1.$$.fragment, local);
    			transition_in(quarter2.$$.fragment, local);
    			transition_in(foot.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(head.$$.fragment, local);
    			transition_out(quarter0.$$.fragment, local);
    			transition_out(quarter1.$$.fragment, local);
    			transition_out(quarter2.$$.fragment, local);
    			transition_out(foot.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(head);
    			destroy_component(quarter0);
    			destroy_component(quarter1);
    			destroy_component(quarter2);
    			destroy_component(foot);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
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
    	validate_slots("Post", slots, []);
    	let { title = "2022 Blue Jays Schedule" } = $$props;
    	let { sub = "" } = $$props;
    	let tops = {};
    	let bottoms = {};
    	let isHome = {};

    	games.forEach(g => {
    		if (g.home) {
    			$$invalidate(4, isHome[g.date] = true, isHome);
    		}

    		if (g.daytime) {
    			$$invalidate(2, tops[g.date] = g.home ? "steelblue" : "lightsteelblue", tops);
    		} else {
    			$$invalidate(3, bottoms[g.date] = g.home ? "steelblue" : "lightsteelblue", bottoms);
    		}
    	});

    	const writable_props = ["title", "sub"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    	};

    	$$self.$capture_state = () => ({
    		Head,
    		Foot,
    		Quarter,
    		games,
    		title,
    		sub,
    		tops,
    		bottoms,
    		isHome
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    		if ("tops" in $$props) $$invalidate(2, tops = $$props.tops);
    		if ("bottoms" in $$props) $$invalidate(3, bottoms = $$props.bottoms);
    		if ("isHome" in $$props) $$invalidate(4, isHome = $$props.isHome);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, sub, tops, bottoms, isHome];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1o2k1lr-style")) add_css$4();
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { title: 0, sub: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$4.name
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

    let name$1 = '';
    // wire-in query params
    const URLSearchParams = window.URLSearchParams;
    if (typeof URLSearchParams !== undefined) {
      const urlParams = new URLSearchParams(window.location.search);
      const myParam = urlParams.get('name');
      if (myParam) {
        name$1 = myParam;
      }
    }

    const app = new Post({
      target: document.body,
      props: {
        name: name$1,
      },
    });

    return app;

}());
