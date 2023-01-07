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
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
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
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
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
    	style.id = "svelte-2kl8gv-style";
    	style.textContent = ".goleft.svelte-2kl8gv{align-self:flex-start;transition:margin-left 250ms;padding:2rem;padding-top:1rem;cursor:pointer}.title.svelte-2kl8gv{font-size:18px}.sub.svelte-2kl8gv{margin-left:3rem;color:grey;text-align:right;margin-top:5px}.titlebox.svelte-2kl8gv{width:400px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSGVhZC5zdmVsdGUiLCJzb3VyY2VzIjpbIkhlYWQuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGV4cG9ydCBsZXQgaHJlZiA9ICcuLi8uLi8nXG4gIGV4cG9ydCBsZXQgdGl0bGUgPSAnJ1xuICBleHBvcnQgbGV0IHN1YiA9ICcnXG4gIGV4cG9ydCBsZXQgY29sb3IgPSAnIzc2OWJiNSdcbjwvc2NyaXB0PlxuXG48ZGl2IGNsYXNzPVwiZ29sZWZ0XCI+XG4gIDxhIHtocmVmfT5cbiAgICA8c3ZnIHdpZHRoPVwiMTVweFwiIGhlaWdodD1cIjMwcHhcIiB2aWV3Qm94PVwiMCAwIDkwIDE3MFwiPlxuICAgICAgPGcgc3Ryb2tlPVwibm9uZVwiIHN0cm9rZS13aWR0aD1cIjFcIiBmaWxsPVwibm9uZVwiIGZpbGwtcnVsZT1cImV2ZW5vZGRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPlxuICAgICAgICA8cGF0aFxuICAgICAgICAgIGQ9XCJNODEuNSw2IEM2OS44MjQwNjY2LDIzLjUxMzkwMDEgNDUuODI0MDY2Niw0OS45Mjc3NjM1IDkuNSw4NS4yNDE1OTAyXG4gICAgICAgIEM0NS43OTg0ODE0LDEyMC44MDY4NiA2OS43OTg0ODE0LDE0Ny4yMjYzMyA4MS41LDE2NC41XCJcbiAgICAgICAgICBzdHJva2U9e2NvbG9yfVxuICAgICAgICAgIHN0cm9rZS13aWR0aD1cIjIwXCJcbiAgICAgICAgICBmaWxsLXJ1bGU9XCJub256ZXJvXCJcbiAgICAgICAgLz5cbiAgICAgIDwvZz5cbiAgICA8L3N2Zz5cbiAgPC9hPlxuPC9kaXY+XG48ZGl2IGNsYXNzPVwidGl0bGVib3hcIj5cbiAgPGRpdiBjbGFzcz1cInRpdGxlXCI+e0BodG1sIHRpdGxlfTwvZGl2PlxuICA8ZGl2IGNsYXNzPVwic3ViXCI+e3N1Yn08L2Rpdj5cbjwvZGl2PlxuXG48c3R5bGU+XG4gIC5nb2xlZnQge1xuICAgIGFsaWduLXNlbGY6IGZsZXgtc3RhcnQ7XG4gICAgdHJhbnNpdGlvbjogbWFyZ2luLWxlZnQgMjUwbXM7XG4gICAgcGFkZGluZzogMnJlbTtcbiAgICBwYWRkaW5nLXRvcDogMXJlbTtcbiAgICBjdXJzb3I6IHBvaW50ZXI7XG4gIH1cbiAgLyogLmdvbGVmdDpob3ZlciB7XG4gICAgbWFyZ2luLWxlZnQ6IDAuOHJlbTtcbiAgfSAqL1xuICAudGl0bGUge1xuICAgIGZvbnQtc2l6ZTogMThweDtcbiAgfVxuICAuc3ViIHtcbiAgICBtYXJnaW4tbGVmdDogM3JlbTtcbiAgICBjb2xvcjogZ3JleTtcbiAgICB0ZXh0LWFsaWduOiByaWdodDtcbiAgICBtYXJnaW4tdG9wOiA1cHg7XG4gIH1cbiAgLnRpdGxlYm94IHtcbiAgICB3aWR0aDogNDAwcHg7XG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBNEJFLE9BQU8sY0FBQyxDQUFDLEFBQ1AsVUFBVSxDQUFFLFVBQVUsQ0FDdEIsVUFBVSxDQUFFLFdBQVcsQ0FBQyxLQUFLLENBQzdCLE9BQU8sQ0FBRSxJQUFJLENBQ2IsV0FBVyxDQUFFLElBQUksQ0FDakIsTUFBTSxDQUFFLE9BQU8sQUFDakIsQ0FBQyxBQUlELE1BQU0sY0FBQyxDQUFDLEFBQ04sU0FBUyxDQUFFLElBQUksQUFDakIsQ0FBQyxBQUNELElBQUksY0FBQyxDQUFDLEFBQ0osV0FBVyxDQUFFLElBQUksQ0FDakIsS0FBSyxDQUFFLElBQUksQ0FDWCxVQUFVLENBQUUsS0FBSyxDQUNqQixVQUFVLENBQUUsR0FBRyxBQUNqQixDQUFDLEFBQ0QsU0FBUyxjQUFDLENBQUMsQUFDVCxLQUFLLENBQUUsS0FBSyxBQUNkLENBQUMifQ== */";
    	append_dev(document.head, style);
    }

    function create_fragment(ctx) {
    	let div0;
    	let a;
    	let svg;
    	let g;
    	let path;
    	let t0;
    	let div3;
    	let div1;
    	let t1;
    	let div2;
    	let t2;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			a = element("a");
    			svg = svg_element("svg");
    			g = svg_element("g");
    			path = svg_element("path");
    			t0 = space();
    			div3 = element("div");
    			div1 = element("div");
    			t1 = space();
    			div2 = element("div");
    			t2 = text(/*sub*/ ctx[2]);
    			attr_dev(path, "d", "M81.5,6 C69.8240666,23.5139001 45.8240666,49.9277635 9.5,85.2415902\n        C45.7984814,120.80686 69.7984814,147.22633 81.5,164.5");
    			attr_dev(path, "stroke", /*color*/ ctx[3]);
    			attr_dev(path, "stroke-width", "20");
    			attr_dev(path, "fill-rule", "nonzero");
    			add_location(path, file, 11, 8, 323);
    			attr_dev(g, "stroke", "none");
    			attr_dev(g, "stroke-width", "1");
    			attr_dev(g, "fill", "none");
    			attr_dev(g, "fill-rule", "evenodd");
    			attr_dev(g, "stroke-linejoin", "round");
    			add_location(g, file, 10, 6, 224);
    			attr_dev(svg, "width", "15px");
    			attr_dev(svg, "height", "30px");
    			attr_dev(svg, "viewBox", "0 0 90 170");
    			add_location(svg, file, 9, 4, 164);
    			attr_dev(a, "href", /*href*/ ctx[0]);
    			add_location(a, file, 8, 2, 149);
    			attr_dev(div0, "class", "goleft svelte-2kl8gv");
    			add_location(div0, file, 7, 0, 126);
    			attr_dev(div1, "class", "title svelte-2kl8gv");
    			add_location(div1, file, 23, 2, 628);
    			attr_dev(div2, "class", "sub svelte-2kl8gv");
    			add_location(div2, file, 24, 2, 669);
    			attr_dev(div3, "class", "titlebox svelte-2kl8gv");
    			add_location(div3, file, 22, 0, 603);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, a);
    			append_dev(a, svg);
    			append_dev(svg, g);
    			append_dev(g, path);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div1);
    			div1.innerHTML = /*title*/ ctx[1];
    			append_dev(div3, t1);
    			append_dev(div3, div2);
    			append_dev(div2, t2);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*color*/ 8) {
    				attr_dev(path, "stroke", /*color*/ ctx[3]);
    			}

    			if (dirty & /*href*/ 1) {
    				attr_dev(a, "href", /*href*/ ctx[0]);
    			}

    			if (dirty & /*title*/ 2) div1.innerHTML = /*title*/ ctx[1];			if (dirty & /*sub*/ 4) set_data_dev(t2, /*sub*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div3);
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
    	let { href = "../../" } = $$props;
    	let { title = "" } = $$props;
    	let { sub = "" } = $$props;
    	let { color = "#769bb5" } = $$props;
    	const writable_props = ["href", "title", "sub", "color"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Head> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("href" in $$props) $$invalidate(0, href = $$props.href);
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(2, sub = $$props.sub);
    		if ("color" in $$props) $$invalidate(3, color = $$props.color);
    	};

    	$$self.$capture_state = () => ({ href, title, sub, color });

    	$$self.$inject_state = $$props => {
    		if ("href" in $$props) $$invalidate(0, href = $$props.href);
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(2, sub = $$props.sub);
    		if ("color" in $$props) $$invalidate(3, color = $$props.color);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [href, title, sub, color];
    }

    class Head extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-2kl8gv-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, { href: 0, title: 1, sub: 2, color: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Head",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get href() {
    		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set href(value) {
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

    	get color() {
    		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Head>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/Foot.svelte generated by Svelte v3.29.0 */

    const file$1 = "components/Foot.svelte";

    function add_css$1() {
    	var style = element("style");
    	style.id = "svelte-1a507ff-style";
    	style.textContent = ".footer.svelte-1a507ff{display:flex;margin:auto 1rem 1rem auto;padding:0.5rem;justify-content:flex-end;align-content:flex-end;align-items:center;padding-top:1rem;width:100%;font-size:0.8rem}.m2.svelte-1a507ff{margin:1.5rem}.link.svelte-1a507ff{color:#769bb5;cursor:pointer;text-decoration:none}a.svelte-1a507ff:hover{text-decoration-color:#cc7066}.name.svelte-1a507ff{margin-right:2rem}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRm9vdC5zdmVsdGUiLCJzb3VyY2VzIjpbIkZvb3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGV4cG9ydCBsZXQgdGl0bGUgPSAnJ1xuICBleHBvcnQgbGV0IHllYXIgPSAnJ1xuICBsZXQgdXJsID0gJ2h0dHBzOi8vZ2l0aHViLmNvbS9zcGVuY2VybW91bnRhaW4vdGhlbnNvbWUnXG4gIGlmICh0aXRsZSAmJiB5ZWFyKSB7XG4gICAgdXJsICs9IGAvdHJlZS9naC1wYWdlcy8ke3llYXJ9LyR7dGl0bGV9YFxuICB9XG48L3NjcmlwdD5cblxuPCEtLSBmb290ZXIgLS0+XG48ZGl2IGNsYXNzPVwiZm9vdGVyXCI+XG4gIDxhIGNsYXNzPVwibGluayBtMlwiIGhyZWY9e3VybH0+c291cmNlPC9hPlxuICA8YSBjbGFzcz1cImxpbmsgbmFtZVwiIGhyZWY9XCJodHRwOi8vdHdpdHRlci5jb20vc3BlbmNlcm1vdW50YWluL1wiPkBzcGVuY2VybW91bnRhaW48L2E+XG48L2Rpdj5cblxuPHN0eWxlPlxuICAuZm9vdGVyIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIG1hcmdpbjogYXV0byAxcmVtIDFyZW0gYXV0bztcbiAgICBwYWRkaW5nOiAwLjVyZW07XG4gICAganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcbiAgICBhbGlnbi1jb250ZW50OiBmbGV4LWVuZDtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIHBhZGRpbmctdG9wOiAxcmVtO1xuICAgIHdpZHRoOiAxMDAlO1xuICAgIGZvbnQtc2l6ZTogMC44cmVtO1xuICB9XG4gIC5tMiB7XG4gICAgbWFyZ2luOiAxLjVyZW07XG4gIH1cbiAgLmxpbmsge1xuICAgIGNvbG9yOiAjNzY5YmI1O1xuICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICB0ZXh0LWRlY29yYXRpb246IG5vbmU7XG4gIH1cbiAgYTpob3ZlciB7XG4gICAgdGV4dC1kZWNvcmF0aW9uLWNvbG9yOiAjY2M3MDY2O1xuICB9XG4gIC5uYW1lIHtcbiAgICBtYXJnaW4tcmlnaHQ6IDJyZW07XG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBZ0JFLE9BQU8sZUFBQyxDQUFDLEFBQ1AsT0FBTyxDQUFFLElBQUksQ0FDYixNQUFNLENBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUMzQixPQUFPLENBQUUsTUFBTSxDQUNmLGVBQWUsQ0FBRSxRQUFRLENBQ3pCLGFBQWEsQ0FBRSxRQUFRLENBQ3ZCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFdBQVcsQ0FBRSxJQUFJLENBQ2pCLEtBQUssQ0FBRSxJQUFJLENBQ1gsU0FBUyxDQUFFLE1BQU0sQUFDbkIsQ0FBQyxBQUNELEdBQUcsZUFBQyxDQUFDLEFBQ0gsTUFBTSxDQUFFLE1BQU0sQUFDaEIsQ0FBQyxBQUNELEtBQUssZUFBQyxDQUFDLEFBQ0wsS0FBSyxDQUFFLE9BQU8sQ0FDZCxNQUFNLENBQUUsT0FBTyxDQUNmLGVBQWUsQ0FBRSxJQUFJLEFBQ3ZCLENBQUMsQUFDRCxnQkFBQyxNQUFNLEFBQUMsQ0FBQyxBQUNQLHFCQUFxQixDQUFFLE9BQU8sQUFDaEMsQ0FBQyxBQUNELEtBQUssZUFBQyxDQUFDLEFBQ0wsWUFBWSxDQUFFLElBQUksQUFDcEIsQ0FBQyJ9 */";
    	append_dev(document.head, style);
    }

    function create_fragment$1(ctx) {
    	let div;
    	let a0;
    	let t0;
    	let t1;
    	let a1;

    	const block = {
    		c: function create() {
    			div = element("div");
    			a0 = element("a");
    			t0 = text("source");
    			t1 = space();
    			a1 = element("a");
    			a1.textContent = "@spencermountain";
    			attr_dev(a0, "class", "link m2 svelte-1a507ff");
    			attr_dev(a0, "href", /*url*/ ctx[0]);
    			add_location(a0, file$1, 11, 2, 236);
    			attr_dev(a1, "class", "link name svelte-1a507ff");
    			attr_dev(a1, "href", "http://twitter.com/spencermountain/");
    			add_location(a1, file$1, 12, 2, 279);
    			attr_dev(div, "class", "footer svelte-1a507ff");
    			add_location(div, file$1, 10, 0, 213);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, a0);
    			append_dev(a0, t0);
    			append_dev(div, t1);
    			append_dev(div, a1);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*url*/ 1) {
    				attr_dev(a0, "href", /*url*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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
    	let { title = "" } = $$props;
    	let { year = "" } = $$props;
    	let url = "https://github.com/spencermountain/thensome";

    	if (title && year) {
    		url += `/tree/gh-pages/${year}/${title}`;
    	}

    	const writable_props = ["title", "year"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Foot> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("year" in $$props) $$invalidate(2, year = $$props.year);
    	};

    	$$self.$capture_state = () => ({ title, year, url });

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("year" in $$props) $$invalidate(2, year = $$props.year);
    		if ("url" in $$props) $$invalidate(0, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [url, title, year];
    }

    class Foot extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1a507ff-style")) add_css$1();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { title: 1, year: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Foot",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get title() {
    		throw new Error("<Foot>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Foot>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get year() {
    		throw new Error("<Foot>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set year(value) {
    		throw new Error("<Foot>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    // these are the folk heuristics that timezones use to set their dst change dates
    // for example, the US changes:
    // the second Sunday of March -> first Sunday of November
    // http://www.webexhibits.org/daylightsaving/g.html
    let zones = {
      usa: '2nd-sun-mar-2h|1st-sun-nov-2h',// (From 1987 to 2006)
      // mexico
      mex: '1st-sun-apr-2h|last-sun-oct-2h',

      // European Union zone
      eu0: 'last-sun-mar-0h|last-sun-oct-1h',
      eu1: 'last-sun-mar-1h|last-sun-oct-2h',
      eu2: 'last-sun-mar-2h|last-sun-oct-3h',
      eu3: 'last-sun-mar-3h|last-sun-oct-4h',
      //greenland
      green: 'last-sat-mar-22h|last-sat-oct-23h',

      // australia
      aus: '1st-sun-apr-1h|1st-sun-oct-2h',
      //lord howe australia
      lhow: '1st-sun-apr-0.5h|1st-sun-oct-2h',
      // new zealand
      chat: '1st-sun-apr-2h|last-sun-sep-2h', //technically 3:45h -> 2:45h
      // new Zealand, antarctica 
      nz: '1st-sun-apr-1h|last-sun-sep-2h',
      // casey - antarctica
      ant: '2nd-sun-mar-0h|1st-sun-oct-0h',
      // troll - antarctica
      troll: 'last-sun-mar-2h|last-sun-oct-3h',

      //jordan
      jord: 'last-fri-feb-0h|last-fri-oct-1h',
      // lebanon
      leb: 'last-sun-mar-0h|last-sun-oct-0h',
      // syria
      syr: 'last-fri-mar-0h|last-fri-oct-0h',
      //israel
      // Start: Last Friday before April 2 -> The Sunday between Rosh Hashana and Yom Kippur
      isr: 'last-fri-mar-2h|last-sun-oct-2h',
      //palestine
      pal: 'last-sun-mar-0h|last-fri-oct-1h',

      // el aaiun
      //this one seems to be on arabic calendar?
      saha: 'last-sun-mar-3h|1st-sun-may-2h',

      // paraguay
      par: 'last-sat-mar-22h|1st-sun-oct-0h',
      //cuba
      cuba: '2nd-sun-mar-0h|1st-sun-nov-1h',
      //chile
      chile: '1st-sat-apr-22h|1st-sun-sep-0h',
      //easter island
      east: '1st-sat-apr-20h|1st-sat-sep-22h',
      //fiji
      fiji: '3rd-sun-jan-3h|2nd-sun-nov-2h',
      // iran
      iran: '4th-mon-march-0h|3rd-fri-sep-0h',//arabic calendar?

    };
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat',];

    const parse = function (str) {
      let [num, day, month, hour] = str.split(/-/g);
      hour = hour.replace(/h$/, '');
      hour = Number(hour);

      if (num !== 'last') {
        num = num.replace(/(st|nd|rd|th)$/, '');
        num = Number(num) || num;
      }
      //convert to numbers
      month = months.indexOf(month) + 1;
      day = days.indexOf(day);
      return {
        num, day, month, hour
      }
    };

    Object.keys(zones).forEach(k => {
      let str = zones[k];
      let [start, end] = str.split(/\|/);
      zones[k] = {
        start: parse(start),
        end: parse(end),
      };
    });
    // console.log(zones)

    var zoneFile = {
      "Africa/Abidjan": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Accra": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Addis_Ababa": {
        "offset": 3,
        "hem": "n"
      },
      "Africa/Algiers": {
        "offset": 1,
        "hem": "n"
      },
      "Africa/Asmara": {
        "offset": 3,
        "hem": "n"
      },
      "Africa/Bamako": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Bangui": {
        "offset": 1,
        "hem": "n"
      },
      "Africa/Banjul": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Bissau": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Blantyre": {
        "offset": 2,
        "hem": "n"
      },
      "Africa/Brazzaville": {
        "offset": 1,
        "hem": "s"
      },
      "Africa/Bujumbura": {
        "offset": 2,
        "hem": "n"
      },
      "Africa/Cairo": {
        "offset": 2,
        "hem": "n"
      },
      "Africa/Casablanca": {
        "offset": 1,
        "hem": "n",
        "pattern": "saha"
      },
      "Africa/Ceuta": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Africa/Conakry": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Dakar": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Dar_Es_Salaam": {
        "offset": 3,
        "hem": "n"
      },
      "Africa/Djibouti": {
        "offset": 3,
        "hem": "n"
      },
      "Africa/Douala": {
        "offset": 1,
        "hem": "n"
      },
      "Africa/El_Aaiun": {
        "offset": 1,
        "hem": "n",
        "pattern": "saha"
      },
      "Africa/Freetown": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Gaborone": {
        "offset": 2,
        "hem": "s"
      },
      "Africa/Harare": {
        "offset": 2,
        "hem": "s"
      },
      "Africa/Johannesburg": {
        "offset": 2,
        "hem": "s"
      },
      "Africa/Juba": {
        "offset": 3,
        "hem": "n"
      },
      "Africa/Kampala": {
        "offset": 3,
        "hem": "n"
      },
      "Africa/Khartoum": {
        "offset": 2,
        "hem": "n"
      },
      "Africa/Kigali": {
        "offset": 2,
        "hem": "n"
      },
      "Africa/Kinshasa": {
        "offset": 1,
        "hem": "s"
      },
      "Africa/Lagos": {
        "offset": 1,
        "hem": "n"
      },
      "Africa/Libreville": {
        "offset": 1,
        "hem": "n"
      },
      "Africa/Lome": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Luanda": {
        "offset": 1,
        "hem": "s"
      },
      "Africa/Lubumbashi": {
        "offset": 2,
        "hem": "s"
      },
      "Africa/Lusaka": {
        "offset": 2,
        "hem": "s"
      },
      "Africa/Malabo": {
        "offset": 1,
        "hem": "n"
      },
      "Africa/Maputo": {
        "offset": 2,
        "hem": "s"
      },
      "Africa/Maseru": {
        "offset": 2,
        "hem": "s"
      },
      "Africa/Mbabane": {
        "offset": 2,
        "hem": "s"
      },
      "Africa/Mogadishu": {
        "offset": 3,
        "hem": "n"
      },
      "Africa/Monrovia": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Nairobi": {
        "offset": 3,
        "hem": "n"
      },
      "Africa/Ndjamena": {
        "offset": 1,
        "hem": "n"
      },
      "Africa/Niamey": {
        "offset": 1,
        "hem": "n"
      },
      "Africa/Nouakchott": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Ouagadougou": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Porto-novo": {
        "offset": 1,
        "hem": "n"
      },
      "Africa/Sao_Tome": {
        "offset": 0,
        "hem": "n"
      },
      "Africa/Tripoli": {
        "offset": 2,
        "hem": "n"
      },
      "Africa/Tunis": {
        "offset": 1,
        "hem": "n"
      },
      "Africa/Windhoek": {
        "offset": 1,
        "hem": "s"
      },
      "America/Adak": {
        "offset": -9,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Anchorage": {
        "offset": -8,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Anguilla": {
        "offset": -4,
        "hem": "n"
      },
      "America/Antigua": {
        "offset": -4,
        "hem": "n"
      },
      "America/Araguaina": {
        "offset": -3,
        "hem": "n"
      },
      "America/Argentina": {
        "offset": -3,
        "hem": "s"
      },
      "America/Aruba": {
        "offset": -4,
        "hem": "n"
      },
      "America/Asuncion": {
        "offset": -4,
        "hem": "s",
        "pattern": "par"
      },
      "America/Bahia": {
        "offset": -3,
        "hem": "n"
      },
      "America/Bahia_Banderas": {
        "offset": -5,
        "hem": "n",
        "pattern": "mex"
      },
      "America/Barbados": {
        "offset": -4,
        "hem": "n"
      },
      "America/Belem": {
        "offset": -3,
        "hem": "n"
      },
      "America/Belize": {
        "offset": -6,
        "hem": "n"
      },
      "America/Blanc-sablon": {
        "offset": -4,
        "hem": "n"
      },
      "America/Boa_Vista": {
        "offset": -4,
        "hem": "n"
      },
      "America/Bogota": {
        "offset": -5,
        "hem": "n"
      },
      "America/Boise": {
        "offset": -6,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Buenos_Aires": {
        "offset": -3,
        "hem": "s"
      },
      "America/Cambridge_Bay": {
        "offset": -6,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Campo_Grande": {
        "offset": -4,
        "hem": "s"
      },
      "America/Cancun": {
        "offset": -5,
        "hem": "n"
      },
      "America/Caracas": {
        "offset": -4,
        "hem": "n"
      },
      "America/Catamarca": {
        "offset": -3,
        "hem": "s"
      },
      "America/Cayenne": {
        "offset": -3,
        "hem": "n"
      },
      "America/Cayman": {
        "offset": -5,
        "hem": "n"
      },
      "America/Chicago": {
        "offset": -5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Chihuahua": {
        "offset": -6,
        "hem": "n",
        "pattern": "mex"
      },
      "America/Atikokan": {
        "offset": -5,
        "hem": "n"
      },
      "America/Cordoba": {
        "offset": -3,
        "hem": "s"
      },
      "America/Costa_Rica": {
        "offset": -6,
        "hem": "n"
      },
      "America/Creston": {
        "offset": -7,
        "hem": "n"
      },
      "America/Cuiaba": {
        "offset": -4,
        "hem": "s"
      },
      "America/Curacao": {
        "offset": -4,
        "hem": "n"
      },
      "America/Danmarkshavn": {
        "offset": 0,
        "hem": "n"
      },
      "America/Dawson": {
        "offset": -7,
        "hem": "n"
      },
      "America/Dawson_Creek": {
        "offset": -7,
        "hem": "n"
      },
      "America/Denver": {
        "offset": -6,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Detroit": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Dominica": {
        "offset": -4,
        "hem": "n"
      },
      "America/Edmonton": {
        "offset": -6,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Eirunepe": {
        "offset": -5,
        "hem": "n"
      },
      "America/El_Salvador": {
        "offset": -6,
        "hem": "n"
      },
      "America/Fort_Nelson": {
        "offset": -7,
        "hem": "n"
      },
      "America/Fortaleza": {
        "offset": -3,
        "hem": "s"
      },
      "America/Glace_Bay": {
        "offset": -3,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Nuuk": {
        "offset": -2,
        "hem": "n",
        "pattern": "green"
      },
      "America/Goose_Bay": {
        "offset": -3,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Grand_Turk": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Grenada": {
        "offset": -4,
        "hem": "n"
      },
      "America/Guadeloupe": {
        "offset": -4,
        "hem": "n"
      },
      "America/Guatemala": {
        "offset": -6,
        "hem": "n"
      },
      "America/Guayaquil": {
        "offset": -5,
        "hem": "n"
      },
      "America/Guyana": {
        "offset": -4,
        "hem": "n"
      },
      "America/Halifax": {
        "offset": -3,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Havana": {
        "offset": -4,
        "hem": "n",
        "pattern": "cuba"
      },
      "America/Hermosillo": {
        "offset": -7,
        "hem": "n"
      },
      "America/Indianapolis": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Inuvik": {
        "offset": -6,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Iqaluit": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Jamaica": {
        "offset": -5,
        "hem": "n"
      },
      "America/Jujuy": {
        "offset": -3,
        "hem": "s"
      },
      "America/Juneau": {
        "offset": -8,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Kralendijk": {
        "offset": -4,
        "hem": "n"
      },
      "America/La_Paz": {
        "offset": -4,
        "hem": "s"
      },
      "America/Lima": {
        "offset": -5,
        "hem": "s"
      },
      "America/Los_Angeles": {
        "offset": -7,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Louisville": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Lower_Princes": {
        "offset": -4,
        "hem": "n"
      },
      "America/Maceio": {
        "offset": -3,
        "hem": "n"
      },
      "America/Managua": {
        "offset": -6,
        "hem": "n"
      },
      "America/Manaus": {
        "offset": -4,
        "hem": "s"
      },
      "America/Marigot": {
        "offset": -4,
        "hem": "n"
      },
      "America/Martinique": {
        "offset": -4,
        "hem": "n"
      },
      "America/Matamoros": {
        "offset": -5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Mazatlan": {
        "offset": -6,
        "hem": "n",
        "pattern": "mex"
      },
      "America/Mendoza": {
        "offset": -3,
        "hem": "s"
      },
      "America/Menominee": {
        "offset": -5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Merida": {
        "offset": -5,
        "hem": "n",
        "pattern": "mex"
      },
      "America/Metlakatla": {
        "offset": -8,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Mexico_City": {
        "offset": -5,
        "hem": "n",
        "pattern": "mex"
      },
      "America/Miquelon": {
        "offset": -2,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Moncton": {
        "offset": -3,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Monterrey": {
        "offset": -5,
        "hem": "n",
        "pattern": "mex"
      },
      "America/Montevideo": {
        "offset": -3,
        "hem": "s"
      },
      "America/Montserrat": {
        "offset": -4,
        "hem": "n"
      },
      "America/Nassau": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/New_York": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Nipigon": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Nome": {
        "offset": -8,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Noronha": {
        "offset": -2,
        "hem": "n"
      },
      "America/Ojinaga": {
        "offset": -6,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Panama": {
        "offset": -5,
        "hem": "n"
      },
      "America/Pangnirtung": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Paramaribo": {
        "offset": -3,
        "hem": "n"
      },
      "America/Phoenix": {
        "offset": -7,
        "hem": "n"
      },
      "America/Port-au-prince": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Port_Of_Spain": {
        "offset": -4,
        "hem": "n"
      },
      "America/Porto_Velho": {
        "offset": -4,
        "hem": "n"
      },
      "America/Puerto_Rico": {
        "offset": -4,
        "hem": "n"
      },
      "America/Punta_Arenas": {
        "offset": -3,
        "hem": "s"
      },
      "America/Rainy_River": {
        "offset": -5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Rankin_Inlet": {
        "offset": -5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Recife": {
        "offset": -3,
        "hem": "n"
      },
      "America/Regina": {
        "offset": -6,
        "hem": "n"
      },
      "America/Resolute": {
        "offset": -5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Rio_Branco": {
        "offset": -5,
        "hem": "s"
      },
      "America/Santarem": {
        "offset": -3,
        "hem": "n"
      },
      "America/Santiago": {
        "offset": -4,
        "hem": "s",
        "pattern": "chile"
      },
      "America/Santo_Domingo": {
        "offset": -4,
        "hem": "n"
      },
      "America/Sao_Paulo": {
        "offset": -3,
        "hem": "s"
      },
      "America/Scoresbysund": {
        "offset": 0,
        "hem": "n",
        "pattern": "eu0"
      },
      "America/Sitka": {
        "offset": -8,
        "hem": "n",
        "pattern": "usa"
      },
      "America/St_Barthelemy": {
        "offset": -4,
        "hem": "n"
      },
      "America/St_Johns": {
        "offset": -2.5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/St_Kitts": {
        "offset": -4,
        "hem": "n"
      },
      "America/St_Lucia": {
        "offset": -4,
        "hem": "n"
      },
      "America/St_Thomas": {
        "offset": -4,
        "hem": "n"
      },
      "America/St_Vincent": {
        "offset": -4,
        "hem": "n"
      },
      "America/Swift_Current": {
        "offset": -6,
        "hem": "n"
      },
      "America/Tegucigalpa": {
        "offset": -6,
        "hem": "n"
      },
      "America/Thule": {
        "offset": -3,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Thunder_Bay": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Tijuana": {
        "offset": -7,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Toronto": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Tortola": {
        "offset": -4,
        "hem": "n"
      },
      "America/Vancouver": {
        "offset": -7,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Whitehorse": {
        "offset": -7,
        "hem": "n"
      },
      "America/Winnipeg": {
        "offset": -5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Yakutat": {
        "offset": -8,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Yellowknife": {
        "offset": -6,
        "hem": "n",
        "pattern": "usa"
      },
      "Antarctica/Casey": {
        "offset": 8,
        "hours": 3,
        "hem": "s",
        "pattern": "ant"
      },
      "Antarctica/Davis": {
        "offset": 7,
        "hem": "s"
      },
      "Antarctica/Dumontdurville": {
        "offset": 10,
        "hem": "s"
      },
      "Antarctica/Macquarie": {
        "offset": 11,
        "hem": "s",
        "pattern": "aus"
      },
      "Antarctica/Mawson": {
        "offset": 5,
        "hem": "s"
      },
      "Antarctica/Mcmurdo": {
        "offset": 12,
        "hem": "s",
        "pattern": "nz"
      },
      "Antarctica/Palmer": {
        "offset": -3,
        "hem": "s"
      },
      "Antarctica/Rothera": {
        "offset": -3,
        "hem": "s"
      },
      "Antarctica/Syowa": {
        "offset": 3,
        "hem": "s"
      },
      "Antarctica/Troll": {
        "offset": 2,
        "hem": "s",
        "pattern": "troll"
      },
      "Antarctica/Vostok": {
        "offset": 6,
        "hem": "s"
      },
      "Arctic/Longyearbyen": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Asia/Aden": {
        "offset": 3,
        "hem": "n"
      },
      "Asia/Almaty": {
        "offset": 6,
        "hem": "n"
      },
      "Asia/Amman": {
        "offset": 3,
        "hem": "n",
        "pattern": "jord"
      },
      "Asia/Anadyr": {
        "offset": 12,
        "hem": "n"
      },
      "Asia/Aqtau": {
        "offset": 5,
        "hem": "n"
      },
      "Asia/Aqtobe": {
        "offset": 5,
        "hem": "n"
      },
      "Asia/Ashgabat": {
        "offset": 5,
        "hem": "n"
      },
      "Asia/Atyrau": {
        "offset": 5,
        "hem": "n"
      },
      "Asia/Baghdad": {
        "offset": 3,
        "hem": "n"
      },
      "Asia/Bahrain": {
        "offset": 3,
        "hem": "n"
      },
      "Asia/Baku": {
        "offset": 4,
        "hem": "n"
      },
      "Asia/Bangkok": {
        "offset": 7,
        "hem": "n"
      },
      "Asia/Barnaul": {
        "offset": 7,
        "hem": "n"
      },
      "Asia/Beirut": {
        "offset": 3,
        "hem": "n",
        "pattern": "leb"
      },
      "Asia/Bishkek": {
        "offset": 6,
        "hem": "n"
      },
      "Asia/Brunei": {
        "offset": 8,
        "hem": "n"
      },
      "Asia/Kolkata": {
        "offset": 5.5,
        "hem": "n"
      },
      "Asia/Chita": {
        "offset": 9,
        "hem": "n"
      },
      "Asia/Choibalsan": {
        "offset": 8,
        "hem": "n"
      },
      "Asia/Colombo": {
        "offset": 5.5,
        "hem": "n"
      },
      "Asia/Damascus": {
        "offset": 3,
        "hem": "n",
        "pattern": "syr"
      },
      "Asia/Dhaka": {
        "offset": 6,
        "hem": "n"
      },
      "Asia/Dili": {
        "offset": 9,
        "hem": "s"
      },
      "Asia/Dubai": {
        "offset": 4,
        "hem": "n"
      },
      "Asia/Dushanbe": {
        "offset": 5,
        "hem": "n"
      },
      "Asia/Famagusta": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Asia/Gaza": {
        "offset": 3,
        "hem": "n",
        "pattern": "pal"
      },
      "Asia/Hebron": {
        "offset": 3,
        "hem": "n",
        "pattern": "pal"
      },
      "Asia/Hong_Kong": {
        "offset": 8,
        "hem": "n"
      },
      "Asia/Hovd": {
        "offset": 7,
        "hem": "n"
      },
      "Asia/Irkutsk": {
        "offset": 8,
        "hem": "n"
      },
      "Asia/Jakarta": {
        "offset": 7,
        "hem": "s"
      },
      "Asia/Jayapura": {
        "offset": 9,
        "hem": "s"
      },
      "Asia/Jerusalem": {
        "offset": 3,
        "hem": "n",
        "pattern": "isr"
      },
      "Asia/Kabul": {
        "offset": 4.5,
        "hem": "n"
      },
      "Asia/Kamchatka": {
        "offset": 12,
        "hem": "n"
      },
      "Asia/Karachi": {
        "offset": 5,
        "hem": "n"
      },
      "Asia/Kathmandu": {
        "offset": 5.75,
        "hem": "n"
      },
      "Asia/Khandyga": {
        "offset": 9,
        "hem": "n"
      },
      "Asia/Krasnoyarsk": {
        "offset": 7,
        "hem": "n"
      },
      "Asia/Kuala_Lumpur": {
        "offset": 8,
        "hem": "s"
      },
      "Asia/Kuching": {
        "offset": 8,
        "hem": "n"
      },
      "Asia/Kuwait": {
        "offset": 3,
        "hem": "n"
      },
      "Asia/Macau": {
        "offset": 8,
        "hem": "n"
      },
      "Asia/Magadan": {
        "offset": 11,
        "hem": "n"
      },
      "Asia/Makassar": {
        "offset": 8,
        "hem": "s"
      },
      "Asia/Manila": {
        "offset": 8,
        "hem": "n"
      },
      "Asia/Muscat": {
        "offset": 4,
        "hem": "n"
      },
      "Asia/Nicosia": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Asia/Novokuznetsk": {
        "offset": 7,
        "hem": "n"
      },
      "Asia/Novosibirsk": {
        "offset": 7,
        "hem": "n"
      },
      "Asia/Omsk": {
        "offset": 6,
        "hem": "n"
      },
      "Asia/Oral": {
        "offset": 5,
        "hem": "n"
      },
      "Asia/Phnom_Penh": {
        "offset": 7,
        "hem": "n"
      },
      "Asia/Pontianak": {
        "offset": 7,
        "hem": "n"
      },
      "Asia/Pyongyang": {
        "offset": 9,
        "hem": "n"
      },
      "Asia/Qatar": {
        "offset": 3,
        "hem": "n"
      },
      "Asia/Qyzylorda": {
        "offset": 6,
        "hem": "n"
      },
      "Asia/Qostanay": {
        "offset": 6,
        "hem": "n"
      },
      "Asia/Yangon": {
        "offset": 6.5,
        "hem": "n"
      },
      "Asia/Riyadh": {
        "offset": 3,
        "hem": "n"
      },
      "Asia/Ho_Chi_Minh": {
        "offset": 7,
        "hem": "n"
      },
      "Asia/Sakhalin": {
        "offset": 11,
        "hem": "n"
      },
      "Asia/Samarkand": {
        "offset": 5,
        "hem": "n"
      },
      "Asia/Seoul": {
        "offset": 9,
        "hem": "n"
      },
      "Asia/Shanghai": {
        "offset": 8,
        "hem": "n"
      },
      "Asia/Singapore": {
        "offset": 8,
        "hem": "s"
      },
      "Asia/Srednekolymsk": {
        "offset": 12,
        "hem": "n"
      },
      "Asia/Taipei": {
        "offset": 8,
        "hem": "n"
      },
      "Asia/Tashkent": {
        "offset": 5,
        "hem": "n"
      },
      "Asia/Tbilisi": {
        "offset": 4,
        "hem": "n"
      },
      "Asia/Tehran": {
        "offset": 3.5,
        "hem": "n",
        "pattern": "iran"//ending in 2022
      },
      "Asia/Thimphu": {
        "offset": 6,
        "hem": "n"
      },
      "Asia/Tokyo": {
        "offset": 9,
        "hem": "n"
      },
      "Asia/Tomsk": {
        "offset": 7,
        "hem": "n"
      },
      "Asia/Ulaanbaatar": {
        "offset": 8,
        "hem": "n"
      },
      "Asia/Urumqi": {
        "offset": 6,
        "hem": "n"
      },
      "Asia/Ust-nera": {
        "offset": 10,
        "hem": "n"
      },
      "Asia/Vientiane": {
        "offset": 7,
        "hem": "n"
      },
      "Asia/Vladivostok": {
        "offset": 10,
        "hem": "n"
      },
      "Asia/Yakutsk": {
        "offset": 10,
        "hem": "n"
      },
      "Asia/Yekaterinburg": {
        "offset": 5,
        "hem": "n"
      },
      "Asia/Yerevan": {
        "offset": 4,
        "hem": "n"
      },
      "Atlantic/Azores": {
        "offset": 0,
        "hem": "n",
        "pattern": "eu0"
      },
      "Atlantic/Bermuda": {
        "offset": -3,
        "hem": "n",
        "pattern": "usa"
      },
      "Atlantic/Canary": {
        "offset": 1,
        "hem": "n",
        "pattern": "eu1"
      },
      "Atlantic/Cape_Verde": {
        "offset": -1,
        "hem": "n"
      },
      "Atlantic/Faroe": {
        "offset": 1,
        "hem": "n",
        "pattern": "eu1"
      },
      "Atlantic/Madeira": {
        "offset": 1,
        "hem": "n",
        "pattern": "eu1"
      },
      "Atlantic/Reykjavik": {
        "offset": 0,
        "hem": "n"
      },
      "Atlantic/South_Georgia": {
        "offset": -2,
        "hem": "n"
      },
      "Atlantic/St_Helena": {
        "offset": 0,
        "hem": "n"
      },
      "Atlantic/Stanley": {
        "offset": -3,
        "hem": "s"
      },
      "Australia/Adelaide": {
        "offset": 9.5,
        "hem": "s",
        "pattern": "aus"
      },
      "Australia/Brisbane": {
        "offset": 10,
        "hem": "s"
      },
      "Australia/Broken_Hill": {
        "offset": 9.5,
        "hem": "s",
        "pattern": "aus"
      },
      "Australia/Darwin": {
        "offset": 9.5,
        "hem": "s"
      },
      "Australia/Eucla": {
        "offset": 8.75,
        "hem": "s"
      },
      "Australia/Hobart": {
        "offset": 10,
        "hem": "s",
        "pattern": "aus"
      },
      "Australia/Lindeman": {
        "offset": 10,
        "hem": "s"
      },
      "Australia/Lord_Howe": {
        "offset": 10.5,
        "hem": "s",
        "pattern": "lhow"
      },
      "Australia/Melbourne": {
        "offset": 10,
        "hem": "s",
        "pattern": "aus"
      },
      "Australia/Perth": {
        "offset": 8,
        "hem": "s"
      },
      "Australia/Sydney": {
        "offset": 10,
        "hem": "s",
        "pattern": "aus"
      },
      "Europe/Amsterdam": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Andorra": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Astrakhan": {
        "offset": 4,
        "hem": "n"
      },
      "Europe/Athens": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Europe/Belgrade": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Berlin": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Bratislava": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Brussels": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Bucharest": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Europe/Budapest": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Busingen": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Chisinau": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Copenhagen": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Dublin": {
        "offset": 1,
        "hem": "n",
        "pattern": "eu1"
      },
      "Europe/Gibraltar": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Guernsey": {
        "offset": 1,
        "hem": "n",
        "pattern": "eu1"
      },
      "Europe/Helsinki": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Europe/Isle_Of_Man": {
        "offset": 1,
        "hem": "n",
        "pattern": "eu1"
      },
      "Europe/Istanbul": {
        "offset": 3,
        "hem": "n"
      },
      "Europe/Jersey": {
        "offset": 1,
        "hem": "n",
        "pattern": "eu1"
      },
      "Europe/Kaliningrad": {
        "offset": 2,
        "hem": "n"
      },
      "Europe/Kirov": {
        "offset": 3,
        "hem": "n"
      },
      "Europe/Kiev": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Europe/Lisbon": {
        "offset": 1,
        "hem": "n",
        "pattern": "eu1"
      },
      "Europe/Ljubljana": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/London": {
        "offset": 1,
        "hem": "n",
        "pattern": "eu1"
      },
      "Europe/Luxembourg": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Madrid": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Malta": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Mariehamn": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Europe/Minsk": {
        "offset": 3,
        "hem": "n"
      },
      "Europe/Monaco": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Moscow": {
        "offset": 3,
        "hem": "n"
      },
      "Europe/Oslo": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Paris": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Podgorica": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Prague": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Riga": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Europe/Rome": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Samara": {
        "offset": 4,
        "hem": "n"
      },
      "Europe/Saratov": {
        "offset": 4,
        "hem": "n"
      },
      "Europe/San_Marino": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Sarajevo": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Simferopol": {
        "offset": 3,
        "hem": "n"
      },
      "Europe/Skopje": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Sofia": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Europe/Stockholm": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Tallinn": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Europe/Tirane": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Ulyanovsk": {
        "offset": 4,
        "hem": "n"
      },
      "Europe/Uzhgorod": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Europe/Vaduz": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Vatican": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Vienna": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Vilnius": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Europe/Volgograd": {
        "offset": 4,
        "hem": "n"
      },
      "Europe/Warsaw": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Zagreb": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Europe/Zaporozhye": {
        "offset": 3,
        "hem": "n",
        "pattern": "eu3"
      },
      "Europe/Zurich": {
        "offset": 2,
        "hem": "n",
        "pattern": "eu2"
      },
      "Indian/Antananarivo": {
        "offset": 3,
        "hem": "s"
      },
      "Indian/Chagos": {
        "offset": 6,
        "hem": "n"
      },
      "Indian/Christmas": {
        "offset": 7,
        "hem": "s"
      },
      "Indian/Cocos": {
        "offset": 6.5,
        "hem": "n"
      },
      "Indian/Comoro": {
        "offset": 3,
        "hem": "n"
      },
      "Indian/Kerguelen": {
        "offset": 5,
        "hem": "s"
      },
      "Indian/Mahe": {
        "offset": 4,
        "hem": "n"
      },
      "Indian/Maldives": {
        "offset": 5,
        "hem": "n"
      },
      "Indian/Mauritius": {
        "offset": 4,
        "hem": "n"
      },
      "Indian/Mayotte": {
        "offset": 3,
        "hem": "n"
      },
      "Indian/Reunion": {
        "offset": 4,
        "hem": "s"
      },
      "Pacific/Apia": {
        "offset": 13,
        "hem": "s"
      },
      "Pacific/Auckland": {
        "offset": 12,
        "hem": "s",
        "pattern": "nz"
      },
      "Pacific/Bougainville": {
        "offset": 11,
        "hem": "s"
      },
      "Pacific/Chatham": {
        "offset": 12.75,
        "hem": "s",
        "pattern": "chat"
      },
      "Pacific/Easter": {
        "offset": -6,
        "hem": "s",
        "pattern": "east"
      },
      "Pacific/Efate": {
        "offset": 11,
        "hem": "n"
      },
      "Pacific/Kanton": {
        "offset": 13,
        "hem": "n"
      },
      "Pacific/Fakaofo": {
        "offset": 13,
        "hem": "n"
      },
      "Pacific/Fiji": {
        "offset": 12,
        "hem": "s",
        "pattern": "fiji"
      },
      "Pacific/Funafuti": {
        "offset": 12,
        "hem": "n"
      },
      "Pacific/Galapagos": {
        "offset": -6,
        "hem": "n"
      },
      "Pacific/Gambier": {
        "offset": -9,
        "hem": "n"
      },
      "Pacific/Guadalcanal": {
        "offset": 11,
        "hem": "n"
      },
      "Pacific/Guam": {
        "offset": 10,
        "hem": "n"
      },
      "Pacific/Honolulu": {
        "offset": -10,
        "hem": "n"
      },
      "Pacific/Kiritimati": {
        "offset": 14,
        "hem": "n"
      },
      "Pacific/Kosrae": {
        "offset": 11,
        "hem": "n"
      },
      "Pacific/Kwajalein": {
        "offset": 12,
        "hem": "n"
      },
      "Pacific/Majuro": {
        "offset": 12,
        "hem": "n"
      },
      "Pacific/Marquesas": {
        "offset": -9.5,
        "hem": "n"
      },
      "Pacific/Midway": {
        "offset": -11,
        "hem": "n"
      },
      "Pacific/Nauru": {
        "offset": 12,
        "hem": "n"
      },
      "Pacific/Niue": {
        "offset": -11,
        "hem": "n"
      },
      "Pacific/Norfolk": {
        "offset": 11.5,
        "hem": "n",
        "pattern": "aus"
      },
      "Pacific/Noumea": {
        "offset": 11,
        "hem": "n"
      },
      "Pacific/Pago_Pago": {
        "offset": -11,
        "hem": "n"
      },
      "Pacific/Palau": {
        "offset": 9,
        "hem": "n"
      },
      "Pacific/Pitcairn": {
        "offset": -8,
        "hem": "n"
      },
      "Pacific/Pohnpei": {
        "offset": 11,
        "hem": "n"
      },
      "Pacific/Port_Moresby": {
        "offset": 10,
        "hem": "s"
      },
      "Pacific/Rarotonga": {
        "offset": -10,
        "hem": "n"
      },
      "Pacific/Saipan": {
        "offset": 10,
        "hem": "n"
      },
      "Pacific/Tahiti": {
        "offset": -10,
        "hem": "n"
      },
      "Pacific/Tarawa": {
        "offset": 12,
        "hem": "n"
      },
      "Pacific/Tongatapu": {
        "offset": 13,
        "hem": "s"
      },
      "Pacific/Chuuk": {
        "offset": 10,
        "hem": "n"
      },
      "Pacific/Wake": {
        "offset": 12,
        "hem": "n"
      },
      "Pacific/Wallis": {
        "offset": 12,
        "hem": "n"
      },
      "Etc/GMT": {
        "offset": 0,
        "hem": "n"
      },
      "Etc/Utc": {
        "offset": 0,
        "hem": "n"
      },
      "America/Argentina/La_Rioja": {
        "offset": -3,
        "hem": "s"
      },
      "America/Argentina/Rio_Gallegos": {
        "offset": -3,
        "hem": "s"
      },
      "America/Argentina/Salta": {
        "offset": -3,
        "hem": "s"
      },
      "America/Argentina/San_Juan": {
        "offset": -3,
        "hem": "s"
      },
      "America/Argentina/San_Luis": {
        "offset": -3,
        "hem": "s"
      },
      "America/Argentina/Tucuman": {
        "offset": -3,
        "hem": "s"
      },
      "America/Argentina/Ushuaia": {
        "offset": -3,
        "hem": "s"
      },
      "America/Indiana/Knox": {
        "offset": -5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Indiana/Tell_City": {
        "offset": -5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/North_Dakota/Beulah": {
        "offset": -5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/North_Dakota/Center": {
        "offset": -5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/North_Dakota/New_Salem": {
        "offset": -5,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Indiana/Marengo": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Indiana/Petersburg": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Indiana/Vevay": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Indiana/Vincennes": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Indiana/Winamac": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      },
      "America/Kentucky/Monticello": {
        "offset": -4,
        "hem": "n",
        "pattern": "usa"
      }
    };

    var misc = {
      // this one may be on the muslim calendar?
      saha: {
        '2021': [1618106400000, 1621130400000],
        '2022': [1648346400000, 1651975200000],
        '2023': [1679191200000, 1682820000000],
      },
      iran: {
        '2021': [1616358600000, 1632252600000],
        '2022': [1647894600000, 1663788600000],
        '2023': [1679430600000, 1695324600000],
      },
      // The Sunday between Rosh Hashana and Yom Kippur
      isr: {
        '2023': [1679616000000, 1698534000000],
      },
      jord: {
        '2021': [1616709600000, 1635458400000],
      },
      pal: {
        '2021': [1616796000000, 1635458400000]
      }
    };

    //https://www.timeanddate.com/date/leapyear.html
    const isLeapYear = function (year) {
      return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
    };

    const SEC = 1000;
    const MIN = 60 * SEC;
    const HOUR = 60 * MIN;
    const DAY = 24 * HOUR;

    const YEAR = 365 * DAY;
    const LEAPYEAR = YEAR + DAY;

    let memo = {};

    // get UTC epoch for jan 1
    const getStart = function (year) {
      // only calculate this once
      if (memo.hasOwnProperty(year)) {
        return memo[year]
      }
      let n = 0;
      for (let y = 1970; y < year; y += 1) {
        if (isLeapYear(y)) {
          n += LEAPYEAR;
        } else {
          n += YEAR;
        }
        memo[year] = n;
      }
      return n
    };

    // determine current day (mon, tues)
    // using 'Key-Value Method' from - https://artofmemory.com/blog/how-to-calculate-the-day-of-the-week/

    // const DAYS = [
    //   'Sunday',
    //   'Monday',
    //   'Tuesday',
    //   'Wednesday',
    //   'Thursday',
    //   'Friday',
    //   'Saturday',
    // ];

    const month_code = function (n) {
      let month_codes = [
        null,
        0, //January
        3, //February
        3, //March
        6, //April
        1, //May
        4, //June
        6, //July
        2, //August
        5, //September
        0, //October
        3, //November
        5, //December
      ];
      return month_codes[n]
    };

    const year_code = function (year) {
      let yy = year % 100;
      return (yy + parseInt(yy / 4, 10)) % 7;
    };

    const century_code = function (year) {
      //julian
      if (year < 1752) {
        let c = parseInt(year / 100, 10);
        return 18 - c % 7;
      }
      //gregorian
      let c = parseInt(year / 100, 10);
      let codes = {
        '17': 4, // 1700s = 4
        '18': 2, // 1800s = 2
        '19': 0, // 1900s = 0
        '20': 6, // 2000s = 6
        '21': 4, // 2100s = 4
        '22': 2, // 2200s = 2
        '23': 0, // 2300s = 0
      };
      return codes[String(c)] || 0
    };

    // https://www.timeanddate.com/date/leapyear.html
    const leap_code = function (year) {
      let is_leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      if (is_leap === true) {
        return -1
      } else {
        return 0
      }
    };

    // which day of the week is it?
    const getDay = function (year, month, date) {
      let yc = year_code(year);
      let mc = month_code(month);
      let cc = century_code(year);
      let dc = date;
      let lc = leap_code(year);
      // (Year Code + Month Code + Century Code + Date Number - Leap Year Code) mod 7
      let day = (yc + mc + cc + dc + lc) % 7;
      return day
      // return DAYS[day]
    };


    // 1969-07-20 - sunday
    // 1897-03-14 - sunday
    //1066-10-14 -sat
    // let cal = { year: 2022, month: 10, date: 13 }
    // let cal = { year: 1066, month: 10, date: 14 }
    // let cal = { year: 1897, month: 3, date: 14 }
    // let cal = { year: 1969, month: 7, date: 20 }

    var MONTHS = [
      { long: 'January', short: 'Jan', len: 31 },
      { long: 'February', short: 'Feb', len: 28 }, // 29 in a leap year
      { long: 'March', short: 'Mar', len: 31 },
      { long: 'April', short: 'Apr', len: 30 },
      { long: 'May', short: 'May', len: 31 },
      { long: 'June', short: 'Jun', len: 30 },
      { long: 'July', short: 'Jul', len: 31 },
      { long: 'August', short: 'Aug', len: 31 },
      { long: 'September', short: 'Sep', len: 30 },
      { long: 'October', short: 'Oct', len: 31 },
      { long: 'November', short: 'Nov', len: 30 },
      { long: 'December', short: 'Dec', len: 31 },
    ];

    const monthLengths = MONTHS.map(o => o.len);

    const addMonths = function (months, year) {
      let ms = 0;
      for (let i = 0; i < months - 1; i += 1) {
        let days = monthLengths[i];
        if (i === 1 && isLeapYear(year)) {
          days = 29;
        }
        ms += days * DAY;
      }
      return ms
    };

    // click forward to the proper weekday
    const toWeekDay = function (obj, year) {
      let day = getDay(year, obj.month, 1);
      let want = obj.day;
      let diff = 0;
      for (let i = 0; i < 7; i += 1) {
        if (day === want) {
          return diff //* DAY
        }
        day += 1;
        day = day % 7;
        diff += 1;
      }
      return 0
    };


    const toRightWeek = function (num, day, month) {
      if (num === 'first' || num <= 1) {
        return 0
      }
      if (num === 'last') {
        let max = monthLengths[month + 1] || 31;
        let days = 0;
        for (let i = 0; i < 5; i += 1) {
          days += 7;
          if (days + day >= max) {
            return days - 7 //went too far
          }
        }
        console.log('fixme');
        return 3
      }
      let days = (num - 1) * 7;
      return days // * DAY
    };


    const calc = function (obj, year, offset) {
      let date = 1;
      let month = obj.month;
      let epoch = getStart(year);
      // go to the correct month
      epoch += addMonths(obj.month, year);
      // go to the correct day
      let days = toWeekDay(obj, year);
      date += days;
      epoch += days * DAY;
      // go to the correct week
      days = toRightWeek(obj.num, days, obj.month);
      epoch += days * DAY;
      date += days;
      // go to the correct hour
      epoch += (obj.hour || 0) * HOUR;
      // go to the correct offset
      epoch -= offset * 60 * 60 * 1000;
      // console.log(new Date(epoch))

      return { epoch, month, date }
    };

    const hour = 1000 * 60 * -60;

    // calculate DST times, for this timezone
    const getDst = function (tz, year) {
      let { pattern, offset } = zoneFile[tz] || {};
      // allow ad-hoc dst settings
      if (misc.hasOwnProperty(pattern) && misc[pattern][String(year)]) {
        let [start, end] = misc[pattern][String(year)];
        return { start, end }
      }

      let changes = [];

      let obj = zones[pattern];
      if (!obj) {
        return changes
      }
      // get epoch for spring dst change
      let res = calc(obj.start, year, offset);
      changes.push({
        epoch: res.epoch - hour,
        cal: {
          year,
          month: res.month,
          date: res.date,
          hour: obj.start.hour,
          minute: 0,
          offset: offset - 1,
          epoch: res.epoch - hour
        }
      });

      // get epoch for fall dst change
      res = calc(obj.end, year, offset);
      changes.push({
        epoch: res.epoch,
        cal: {
          year,
          month: res.month,
          date: res.date,
          hour: obj.end.hour,
          minute: 0,
          offset,
          epoch: res.epoch,
        }
      });
      return changes
    };

    // console.log(getDst('America/Toronto', 2023))

    const addYear = function (structure, tz, year) {

      let thisYear = getDst(tz, year);
      if (thisYear[0] && thisYear[1]) {

        structure[tz] = {
          start: thisYear[0].cal,
          end: thisYear[1].cal,
        };
      }

      return structure
    };

    const doYear = function (year) {
      let structure = {};
      Object.keys(zoneFile).forEach(k => {
        addYear(structure, k, year);
      });
      let out = Object.entries(structure).map(a => {
        let [tz, obj] = a;
        let arr = tz.split(/\//);
        let name = arr[arr.length - 1];
        return {
          tz,
          name,
          start: obj.start,
          end: obj.end
        }
      });
      return out
    };

    console.log(doYear(2023));

    /* 2023/dst-changes/Post.svelte generated by Svelte v3.29.0 */
    const file$2 = "2023/dst-changes/Post.svelte";

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-1soqnvw-style";
    	style.textContent = ".name.svelte-1soqnvw{width:150px}.container.svelte-1soqnvw{display:flex;flex-direction:column}.rightSide.svelte-1soqnvw{justify-content:flex-end;display:flex;margin-right:3rem;align-items:center}.year.svelte-1soqnvw{font-size:2.5rem;margin:1rem}input.svelte-1soqnvw{font-size:1.4rem;height:40px}.box.svelte-1soqnvw{margin:3rem;margin-top:1rem;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2);border-radius:5px;padding:3rem}.dot.svelte-1soqnvw{width:20px;height:20px;background-color:#4386cc;border-radius:50%;position:absolute;top:0px}.track.svelte-1soqnvw{height:3px;top:9px;border-radius:3px;box-shadow:1px 1px 8px 0px rgba(0, 0, 0, 0.1);position:absolute;background-color:lightgrey;width:100%}.end.svelte-1soqnvw{background-color:steelblue}.inside.svelte-1soqnvw{height:20px;position:absolute;margin-left:10px;top:0px;background-color:#d6e0ec}.line.svelte-1soqnvw{z-index:3;position:relative;flex-grow:1;margin-top:0.25rem;margin-bottom:0.25rem;height:20px}.col.svelte-1soqnvw{display:flex;flex-direction:column;justify-content:stretch;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch}.row.svelte-1soqnvw{display:flex;flex-direction:row;justify-content:space-around;align-items:center;text-align:center;flex-wrap:nowrap;align-self:stretch}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCB7IEhlYWQsIEZvb3QgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2luZGV4Lm1qcydcbiAgaW1wb3J0IGdldFllYXIgZnJvbSAnLi9saWIvYnVpbGQuanMnXG4gIGxldCB5ZWFyID0gMjAyM1xuICAkOiBkb3RzID0gZ2V0WWVhcih5ZWFyKVxuICAkOiB5ZWFyU3RhcnQgPSBuZXcgRGF0ZShgJHt5ZWFyfS0wMS0wMWApLmdldFRpbWUoKVxuICAkOiB5ZWFyRW5kID0gbmV3IERhdGUoYCR7eWVhcn0tMTItMzFUMTE6NTlgKS5nZXRUaW1lKClcblxuICAvL2EgdmVyeS10aW55IGxpbmVhciBzY2FsZVxuICBjb25zdCBzY2FsZUxpbmVhciA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICBsZXQgd29ybGQgPSBvYmoud29ybGQgfHwgW11cbiAgICBsZXQgbWlubWF4ID0gb2JqLm1pbm1heCB8fCBvYmoubWluTWF4IHx8IFtdXG4gICAgY29uc3QgY2FsYyA9IChudW0pID0+IHtcbiAgICAgIGxldCByYW5nZSA9IG1pbm1heFsxXSAtIG1pbm1heFswXVxuICAgICAgbGV0IHBlcmNlbnQgPSAobnVtIC0gbWlubWF4WzBdKSAvIHJhbmdlXG4gICAgICBsZXQgc2l6ZSA9IHdvcmxkWzFdIC0gd29ybGRbMF1cbiAgICAgIHJldHVybiBwYXJzZUludChzaXplICogcGVyY2VudCwgMTApXG4gICAgfVxuXG4gICAgcmV0dXJuIGNhbGNcbiAgfVxuXG4gICQ6IHNjYWxlID0gc2NhbGVMaW5lYXIoe1xuICAgIHdvcmxkOiBbMCwgMTAwXSxcbiAgICBtaW5NYXg6IFt5ZWFyU3RhcnQsIHllYXJFbmRdLFxuICB9KVxuICBsZXQgdGl0bGUgPSAnRFNUIGNoYW5nZXMgYnkgeWVhcidcbjwvc2NyaXB0PlxuXG48ZGl2IGNsYXNzPVwicGFnZVwiPlxuICA8SGVhZCB7dGl0bGV9IHN1Yj1cIlwiIC8+XG4gIDxkaXYgY2xhc3M9XCJtaWRcIj5cbiAgICA8ZGl2IGNsYXNzPVwic2hhZG93IGNvbnRhaW5lclwiPlxuICAgICAgPGRpdiBjbGFzcz1cInJpZ2h0U2lkZVwiPlxuICAgICAgICA8aW5wdXQgdHlwZT1cImJ1dHRvblwiIHZhbHVlPVwi4oaQXCIgb246Y2xpY2s9eygpID0+ICh5ZWFyIC09IDEpfSAvPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInllYXJcIj57eWVhcn08L3NwYW4+XG4gICAgICAgIDxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgdmFsdWU9XCLihpJcIiBvbjpjbGljaz17KCkgPT4gKHllYXIgKz0gMSl9IC8+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJjb2wgYm94XCI+XG4gICAgICAgIHsjZWFjaCBkb3RzIGFzIGRvdCwgaX1cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwicm93XCIgc3R5bGU9XCJ3aWR0aDoxMDAlO1wiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm5hbWVcIj57ZG90Lm5hbWV9PC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibGluZVwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidHJhY2tcIiAvPlxuICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgY2xhc3M9XCJpbnNpZGVcIlxuICAgICAgICAgICAgICAgIHRpdGxlPXtkb3QubmFtZX1cbiAgICAgICAgICAgICAgICBzdHlsZT1cImxlZnQ6e3NjYWxlKGRvdC5zdGFydC5lcG9jaCl9JTsgd2lkdGg6e3NjYWxlKGRvdC5lbmQuZXBvY2gpIC1cbiAgICAgICAgICAgICAgICAgIHNjYWxlKGRvdC5zdGFydC5lcG9jaCl9JVwiXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJkb3RcIiB0aXRsZT17ZG90Lm5hbWV9IHN0eWxlPVwibGVmdDp7c2NhbGUoZG90LnN0YXJ0LmVwb2NoKX0lO1wiIC8+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJkb3QgZW5kXCIgdGl0bGU9e2RvdC5uYW1lfSBzdHlsZT1cImxlZnQ6e3NjYWxlKGRvdC5lbmQuZXBvY2gpfSU7XCIgLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICB7L2VhY2h9XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICA8Rm9vdCB7dGl0bGV9IHllYXI9XCIyMDIzXCIgLz5cbiAgPC9kaXY+XG48L2Rpdj5cblxuPHN0eWxlPlxuICAubmFtZSB7XG4gICAgd2lkdGg6IDE1MHB4O1xuICB9XG4gIC5jb250YWluZXIge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgfVxuICAucmlnaHRTaWRlIHtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kO1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgbWFyZ2luLXJpZ2h0OiAzcmVtO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIH1cbiAgLnllYXIge1xuICAgIGZvbnQtc2l6ZTogMi41cmVtO1xuICAgIG1hcmdpbjogMXJlbTtcbiAgfVxuICBpbnB1dCB7XG4gICAgZm9udC1zaXplOiAxLjRyZW07XG4gICAgaGVpZ2h0OiA0MHB4O1xuICB9XG4gIC5ib3gge1xuICAgIG1hcmdpbjogM3JlbTtcbiAgICBtYXJnaW4tdG9wOiAxcmVtO1xuICAgIC8qIGJvcmRlcjogMXB4IHNvbGlkIGdyZXk7ICovXG4gICAgYm94LXNoYWRvdzogMnB4IDJweCA4cHggMHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcbiAgICBib3JkZXItcmFkaXVzOiA1cHg7XG4gICAgcGFkZGluZzogM3JlbTtcbiAgfVxuICAuZG90IHtcbiAgICB3aWR0aDogMjBweDtcbiAgICBoZWlnaHQ6IDIwcHg7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogIzQzODZjYztcbiAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIHRvcDogMHB4O1xuICB9XG4gIC50cmFjayB7XG4gICAgaGVpZ2h0OiAzcHg7XG4gICAgdG9wOiA5cHg7XG4gICAgYm9yZGVyLXJhZGl1czogM3B4O1xuICAgIGJveC1zaGFkb3c6IDFweCAxcHggOHB4IDBweCByZ2JhKDAsIDAsIDAsIDAuMSk7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIGJhY2tncm91bmQtY29sb3I6IGxpZ2h0Z3JleTtcbiAgICB3aWR0aDogMTAwJTtcbiAgfVxuICAuZW5kIHtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiBzdGVlbGJsdWU7XG4gIH1cbiAgLmluc2lkZSB7XG4gICAgaGVpZ2h0OiAyMHB4O1xuICAgIC8qIGJhY2tncm91bmQtY29sb3I6ICNmNmY0ZTk7ICovXG4gICAgLyogb3BhY2l0eTogMC41OyAqL1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBtYXJnaW4tbGVmdDogMTBweDtcbiAgICB0b3A6IDBweDtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjZDZlMGVjO1xuICB9XG4gIC5saW5lIHtcbiAgICAvKiBiYWNrZ3JvdW5kLWNvbG9yOiAjZDdkNWQyOyAqL1xuICAgIHotaW5kZXg6IDM7XG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgIC8qIHdpZHRoOiAxMDAlOyAqL1xuICAgIGZsZXgtZ3JvdzogMTtcbiAgICBtYXJnaW4tdG9wOiAwLjI1cmVtO1xuICAgIG1hcmdpbi1ib3R0b206IDAuMjVyZW07XG4gICAgaGVpZ2h0OiAyMHB4O1xuICB9XG4gIC5jb2wge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHN0cmV0Y2g7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgZmxleC13cmFwOiB3cmFwO1xuICAgIGFsaWduLXNlbGY6IHN0cmV0Y2g7XG4gIH1cbiAgLnJvdyB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYXJvdW5kO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIGZsZXgtd3JhcDogbm93cmFwO1xuICAgIGFsaWduLXNlbGY6IHN0cmV0Y2g7XG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBOERFLEtBQUssZUFBQyxDQUFDLEFBQ0wsS0FBSyxDQUFFLEtBQUssQUFDZCxDQUFDLEFBQ0QsVUFBVSxlQUFDLENBQUMsQUFDVixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLEFBQ3hCLENBQUMsQUFDRCxVQUFVLGVBQUMsQ0FBQyxBQUNWLGVBQWUsQ0FBRSxRQUFRLENBQ3pCLE9BQU8sQ0FBRSxJQUFJLENBQ2IsWUFBWSxDQUFFLElBQUksQ0FDbEIsV0FBVyxDQUFFLE1BQU0sQUFDckIsQ0FBQyxBQUNELEtBQUssZUFBQyxDQUFDLEFBQ0wsU0FBUyxDQUFFLE1BQU0sQ0FDakIsTUFBTSxDQUFFLElBQUksQUFDZCxDQUFDLEFBQ0QsS0FBSyxlQUFDLENBQUMsQUFDTCxTQUFTLENBQUUsTUFBTSxDQUNqQixNQUFNLENBQUUsSUFBSSxBQUNkLENBQUMsQUFDRCxJQUFJLGVBQUMsQ0FBQyxBQUNKLE1BQU0sQ0FBRSxJQUFJLENBQ1osVUFBVSxDQUFFLElBQUksQ0FFaEIsVUFBVSxDQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUM5QyxhQUFhLENBQUUsR0FBRyxDQUNsQixPQUFPLENBQUUsSUFBSSxBQUNmLENBQUMsQUFDRCxJQUFJLGVBQUMsQ0FBQyxBQUNKLEtBQUssQ0FBRSxJQUFJLENBQ1gsTUFBTSxDQUFFLElBQUksQ0FDWixnQkFBZ0IsQ0FBRSxPQUFPLENBQ3pCLGFBQWEsQ0FBRSxHQUFHLENBQ2xCLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLEdBQUcsQ0FBRSxHQUFHLEFBQ1YsQ0FBQyxBQUNELE1BQU0sZUFBQyxDQUFDLEFBQ04sTUFBTSxDQUFFLEdBQUcsQ0FDWCxHQUFHLENBQUUsR0FBRyxDQUNSLGFBQWEsQ0FBRSxHQUFHLENBQ2xCLFVBQVUsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FDOUMsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsZ0JBQWdCLENBQUUsU0FBUyxDQUMzQixLQUFLLENBQUUsSUFBSSxBQUNiLENBQUMsQUFDRCxJQUFJLGVBQUMsQ0FBQyxBQUNKLGdCQUFnQixDQUFFLFNBQVMsQUFDN0IsQ0FBQyxBQUNELE9BQU8sZUFBQyxDQUFDLEFBQ1AsTUFBTSxDQUFFLElBQUksQ0FHWixRQUFRLENBQUUsUUFBUSxDQUNsQixXQUFXLENBQUUsSUFBSSxDQUNqQixHQUFHLENBQUUsR0FBRyxDQUNSLGdCQUFnQixDQUFFLE9BQU8sQUFDM0IsQ0FBQyxBQUNELEtBQUssZUFBQyxDQUFDLEFBRUwsT0FBTyxDQUFFLENBQUMsQ0FDVixRQUFRLENBQUUsUUFBUSxDQUVsQixTQUFTLENBQUUsQ0FBQyxDQUNaLFVBQVUsQ0FBRSxPQUFPLENBQ25CLGFBQWEsQ0FBRSxPQUFPLENBQ3RCLE1BQU0sQ0FBRSxJQUFJLEFBQ2QsQ0FBQyxBQUNELElBQUksZUFBQyxDQUFDLEFBQ0osT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxDQUN0QixlQUFlLENBQUUsT0FBTyxDQUN4QixXQUFXLENBQUUsTUFBTSxDQUNuQixVQUFVLENBQUUsTUFBTSxDQUNsQixTQUFTLENBQUUsSUFBSSxDQUNmLFVBQVUsQ0FBRSxPQUFPLEFBQ3JCLENBQUMsQUFDRCxJQUFJLGVBQUMsQ0FBQyxBQUNKLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLEdBQUcsQ0FDbkIsZUFBZSxDQUFFLFlBQVksQ0FDN0IsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsVUFBVSxDQUFFLE1BQU0sQ0FDbEIsU0FBUyxDQUFFLE1BQU0sQ0FDakIsVUFBVSxDQUFFLE9BQU8sQUFDckIsQ0FBQyJ9 */";
    	append_dev(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[11] = i;
    	return child_ctx;
    }

    // (40:8) {#each dots as dot, i}
    function create_each_block(ctx) {
    	let div6;
    	let div0;
    	let t0_value = /*dot*/ ctx[9].name + "";
    	let t0;
    	let t1;
    	let div5;
    	let div1;
    	let t2;
    	let div2;
    	let div2_title_value;
    	let t3;
    	let div3;
    	let div3_title_value;
    	let t4;
    	let div4;
    	let div4_title_value;
    	let t5;

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div5 = element("div");
    			div1 = element("div");
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			div3 = element("div");
    			t4 = space();
    			div4 = element("div");
    			t5 = space();
    			attr_dev(div0, "class", "name svelte-1soqnvw");
    			add_location(div0, file$2, 41, 12, 1209);
    			attr_dev(div1, "class", "track svelte-1soqnvw");
    			add_location(div1, file$2, 43, 14, 1289);
    			attr_dev(div2, "class", "inside svelte-1soqnvw");
    			attr_dev(div2, "title", div2_title_value = /*dot*/ ctx[9].name);
    			set_style(div2, "left", /*scale*/ ctx[2](/*dot*/ ctx[9].start.epoch) + "%");
    			set_style(div2, "width", /*scale*/ ctx[2](/*dot*/ ctx[9].end.epoch) - /*scale*/ ctx[2](/*dot*/ ctx[9].start.epoch) + "%");
    			add_location(div2, file$2, 44, 14, 1325);
    			attr_dev(div3, "class", "dot svelte-1soqnvw");
    			attr_dev(div3, "title", div3_title_value = /*dot*/ ctx[9].name);
    			set_style(div3, "left", /*scale*/ ctx[2](/*dot*/ ctx[9].start.epoch) + "%");
    			add_location(div3, file$2, 50, 14, 1554);
    			attr_dev(div4, "class", "dot end svelte-1soqnvw");
    			attr_dev(div4, "title", div4_title_value = /*dot*/ ctx[9].name);
    			set_style(div4, "left", /*scale*/ ctx[2](/*dot*/ ctx[9].end.epoch) + "%");
    			add_location(div4, file$2, 51, 14, 1645);
    			attr_dev(div5, "class", "line svelte-1soqnvw");
    			add_location(div5, file$2, 42, 12, 1256);
    			attr_dev(div6, "class", "row svelte-1soqnvw");
    			set_style(div6, "width", "100%");
    			add_location(div6, file$2, 40, 10, 1159);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div0);
    			append_dev(div0, t0);
    			append_dev(div6, t1);
    			append_dev(div6, div5);
    			append_dev(div5, div1);
    			append_dev(div5, t2);
    			append_dev(div5, div2);
    			append_dev(div5, t3);
    			append_dev(div5, div3);
    			append_dev(div5, t4);
    			append_dev(div5, div4);
    			append_dev(div6, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*dots*/ 2 && t0_value !== (t0_value = /*dot*/ ctx[9].name + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*dots*/ 2 && div2_title_value !== (div2_title_value = /*dot*/ ctx[9].name)) {
    				attr_dev(div2, "title", div2_title_value);
    			}

    			if (dirty & /*scale, dots*/ 6) {
    				set_style(div2, "left", /*scale*/ ctx[2](/*dot*/ ctx[9].start.epoch) + "%");
    			}

    			if (dirty & /*scale, dots*/ 6) {
    				set_style(div2, "width", /*scale*/ ctx[2](/*dot*/ ctx[9].end.epoch) - /*scale*/ ctx[2](/*dot*/ ctx[9].start.epoch) + "%");
    			}

    			if (dirty & /*dots*/ 2 && div3_title_value !== (div3_title_value = /*dot*/ ctx[9].name)) {
    				attr_dev(div3, "title", div3_title_value);
    			}

    			if (dirty & /*scale, dots*/ 6) {
    				set_style(div3, "left", /*scale*/ ctx[2](/*dot*/ ctx[9].start.epoch) + "%");
    			}

    			if (dirty & /*dots*/ 2 && div4_title_value !== (div4_title_value = /*dot*/ ctx[9].name)) {
    				attr_dev(div4, "title", div4_title_value);
    			}

    			if (dirty & /*scale, dots*/ 6) {
    				set_style(div4, "left", /*scale*/ ctx[2](/*dot*/ ctx[9].end.epoch) + "%");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(40:8) {#each dots as dot, i}",
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
    	let input0;
    	let t1;
    	let span;
    	let t2;
    	let t3;
    	let input1;
    	let t4;
    	let div1;
    	let t5;
    	let foot;
    	let current;
    	let mounted;
    	let dispose;

    	head = new Head({
    			props: { title: /*title*/ ctx[3], sub: "" },
    			$$inline: true
    		});

    	let each_value = /*dots*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	foot = new Foot({
    			props: { title: /*title*/ ctx[3], year: "2023" },
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
    			input0 = element("input");
    			t1 = space();
    			span = element("span");
    			t2 = text(/*year*/ ctx[0]);
    			t3 = space();
    			input1 = element("input");
    			t4 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t5 = space();
    			create_component(foot.$$.fragment);
    			attr_dev(input0, "type", "button");
    			input0.value = "←";
    			attr_dev(input0, "class", "svelte-1soqnvw");
    			add_location(input0, file$2, 34, 8, 902);
    			attr_dev(span, "class", "year svelte-1soqnvw");
    			add_location(span, file$2, 35, 8, 973);
    			attr_dev(input1, "type", "button");
    			input1.value = "→";
    			attr_dev(input1, "class", "svelte-1soqnvw");
    			add_location(input1, file$2, 36, 8, 1014);
    			attr_dev(div0, "class", "rightSide svelte-1soqnvw");
    			add_location(div0, file$2, 33, 6, 870);
    			attr_dev(div1, "class", "col box svelte-1soqnvw");
    			add_location(div1, file$2, 38, 6, 1096);
    			attr_dev(div2, "class", "shadow container svelte-1soqnvw");
    			add_location(div2, file$2, 32, 4, 833);
    			attr_dev(div3, "class", "mid");
    			add_location(div3, file$2, 31, 2, 811);
    			attr_dev(div4, "class", "page");
    			add_location(div4, file$2, 29, 0, 764);
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
    			append_dev(div0, input0);
    			append_dev(div0, t1);
    			append_dev(div0, span);
    			append_dev(span, t2);
    			append_dev(div0, t3);
    			append_dev(div0, input1);
    			append_dev(div2, t4);
    			append_dev(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			append_dev(div3, t5);
    			mount_component(foot, div3, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "click", /*click_handler*/ ctx[4], false, false, false),
    					listen_dev(input1, "click", /*click_handler_1*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*year*/ 1) set_data_dev(t2, /*year*/ ctx[0]);

    			if (dirty & /*dots, scale*/ 6) {
    				each_value = /*dots*/ ctx[1];
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
    			mounted = false;
    			run_all(dispose);
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
    	let year = 2023;

    	//a very-tiny linear scale
    	const scaleLinear = function (obj) {
    		let world = obj.world || [];
    		let minmax = obj.minmax || obj.minMax || [];

    		const calc = num => {
    			let range = minmax[1] - minmax[0];
    			let percent = (num - minmax[0]) / range;
    			let size = world[1] - world[0];
    			return parseInt(size * percent, 10);
    		};

    		return calc;
    	};

    	let title = "DST changes by year";
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(0, year -= 1);
    	const click_handler_1 = () => $$invalidate(0, year += 1);

    	$$self.$capture_state = () => ({
    		Head,
    		Foot,
    		getYear: doYear,
    		year,
    		scaleLinear,
    		title,
    		dots,
    		yearStart,
    		yearEnd,
    		scale
    	});

    	$$self.$inject_state = $$props => {
    		if ("year" in $$props) $$invalidate(0, year = $$props.year);
    		if ("title" in $$props) $$invalidate(3, title = $$props.title);
    		if ("dots" in $$props) $$invalidate(1, dots = $$props.dots);
    		if ("yearStart" in $$props) $$invalidate(6, yearStart = $$props.yearStart);
    		if ("yearEnd" in $$props) $$invalidate(7, yearEnd = $$props.yearEnd);
    		if ("scale" in $$props) $$invalidate(2, scale = $$props.scale);
    	};

    	let dots;
    	let yearStart;
    	let yearEnd;
    	let scale;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*year*/ 1) {
    			 $$invalidate(1, dots = doYear(year));
    		}

    		if ($$self.$$.dirty & /*year*/ 1) {
    			 $$invalidate(6, yearStart = new Date(`${year}-01-01`).getTime());
    		}

    		if ($$self.$$.dirty & /*year*/ 1) {
    			 $$invalidate(7, yearEnd = new Date(`${year}-12-31T11:59`).getTime());
    		}

    		if ($$self.$$.dirty & /*yearStart, yearEnd*/ 192) {
    			 $$invalidate(2, scale = scaleLinear({
    				world: [0, 100],
    				minMax: [yearStart, yearEnd]
    			}));
    		}
    	};

    	return [year, dots, scale, title, click_handler, click_handler_1];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1soqnvw-style")) add_css$2();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    const app = new Post({
      target: document.body,
      props: {},
    });

    return app;

}());
