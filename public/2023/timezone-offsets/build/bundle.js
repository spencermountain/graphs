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

    const MSEC_IN_HOUR = 60 * 60 * 1000;

    //convert our local date syntax a javascript UTC date
    const toUtc = (dstChange, offset, year) => {
      const [month, rest] = dstChange.split('/');
      const [day, hour] = rest.split(':');
      return Date.UTC(year, month - 1, day, hour) - offset * MSEC_IN_HOUR
    };

    // compare epoch with dst change events (in utc)
    const inSummerTime = (epoch, start, end, summerOffset, winterOffset) => {
      const year = new Date(epoch).getUTCFullYear();
      const startUtc = toUtc(start, winterOffset, year);
      const endUtc = toUtc(end, summerOffset, year);
      // simple number comparison now
      return epoch >= startUtc && epoch < endUtc
    };

    // this method avoids having to do a full dst-calculation on every operation
    // it reproduces some things in ./index.js, but speeds up spacetime considerably
    const quickOffset = s => {
      let zones = s.timezones;
      let obj = zones[s.tz];
      if (obj === undefined) {
        console.warn("Warning: couldn't find timezone " + s.tz);
        return 0
      }
      if (obj.dst === undefined) {
        return obj.offset
      }

      //get our two possible offsets
      let jul = obj.offset;
      let dec = obj.offset + 1; // assume it's the same for now
      if (obj.hem === 'n') {
        dec = jul - 1;
      }
      let split = obj.dst.split('->');
      let inSummer = inSummerTime(s.epoch, split[0], split[1], jul, dec);
      if (inSummer === true) {
        return jul
      }
      return dec
    };

    var data = {
      "9|s": "2/dili,2/jayapura",
      "9|n": "2/chita,2/khandyga,2/pyongyang,2/seoul,2/tokyo,11/palau,japan,rok",
      "9.5|s|04/03:03->10/02:02": "4/adelaide,4/broken_hill,4/south,4/yancowinna",
      "9.5|s": "4/darwin,4/north",
      "8|s|03/08:01->10/04:00": "12/casey",
      "8|s": "2/kuala_lumpur,2/makassar,2/singapore,4/perth,2/ujung_pandang,4/west,singapore",
      "8|n": "2/brunei,2/choibalsan,2/hong_kong,2/irkutsk,2/kuching,2/macau,2/manila,2/shanghai,2/taipei,2/ulaanbaatar,2/chongqing,2/chungking,2/harbin,2/macao,2/ulan_bator,hongkong,prc,roc",
      "8.75|s": "4/eucla",
      "7|s": "12/davis,2/jakarta,9/christmas",
      "7|n": "2/bangkok,2/barnaul,2/hovd,2/krasnoyarsk,2/novokuznetsk,2/novosibirsk,2/phnom_penh,2/pontianak,2/ho_chi_minh,2/tomsk,2/vientiane,2/saigon",
      "6|s": "12/vostok",
      "6|n": "2/almaty,2/bishkek,2/dhaka,2/omsk,2/qyzylorda,2/qostanay,2/thimphu,2/urumqi,9/chagos,2/dacca,2/kashgar,2/thimbu",
      "6.5|n": "2/yangon,9/cocos,2/rangoon",
      "5|s": "12/mawson,9/kerguelen",
      "5|n": "2/aqtau,2/aqtobe,2/ashgabat,2/atyrau,2/dushanbe,2/karachi,2/oral,2/samarkand,2/tashkent,2/yekaterinburg,9/maldives,2/ashkhabad",
      "5.75|n": "2/katmandu,2/kathmandu",
      "5.5|n": "2/kolkata,2/colombo,2/calcutta",
      "4|s": "9/reunion",
      "4|n": "2/baku,2/dubai,2/muscat,2/tbilisi,2/yerevan,8/astrakhan,8/samara,8/saratov,8/ulyanovsk,8/volgograd,2/volgograd,9/mahe,9/mauritius",
      "4.5|n|03/22:00->09/21:24": "2/tehran,iran",
      "4.5|n": "2/kabul",
      "3|s": "12/syowa,9/antananarivo",
      "3|n|03/27:03->10/30:04": "2/famagusta,2/nicosia,8/athens,8/bucharest,8/helsinki,8/kiev,8/mariehamn,8/riga,8/sofia,8/tallinn,8/uzhgorod,8/vilnius,8/zaporozhye,8/nicosia",
      "3|n|03/27:02->10/30:03": "8/chisinau,8/tiraspol",
      "3|n|03/27:00->10/29:24": "2/beirut",
      "3|n|03/26:00->10/28:01": "2/gaza,2/hebron",
      "3|n|03/25:02->10/30:02": "2/jerusalem,2/tel_aviv,israel",
      "3|n|03/25:00->10/27:24": "2/damascus",
      "3|n|02/25:00->10/28:01": "2/amman",
      "3|n": "0/addis_ababa,0/asmara,0/asmera,0/dar_es_salaam,0/djibouti,0/juba,0/kampala,0/mogadishu,0/nairobi,2/aden,2/baghdad,2/bahrain,2/kuwait,2/qatar,2/riyadh,8/istanbul,8/kirov,8/minsk,8/moscow,8/simferopol,9/comoro,9/mayotte,2/istanbul,turkey,w-su",
      "2|s|03/27:02->10/30:02": "12/troll",
      "2|s": "0/gaborone,0/harare,0/johannesburg,0/lubumbashi,0/lusaka,0/maputo,0/maseru,0/mbabane",
      "2|n|03/27:02->10/30:03": "0/ceuta,arctic/longyearbyen,8/amsterdam,8/andorra,8/belgrade,8/berlin,8/bratislava,8/brussels,8/budapest,8/busingen,8/copenhagen,8/gibraltar,8/ljubljana,8/luxembourg,8/madrid,8/malta,8/monaco,8/oslo,8/paris,8/podgorica,8/prague,8/rome,8/san_marino,8/sarajevo,8/skopje,8/stockholm,8/tirane,8/vaduz,8/vatican,8/vienna,8/warsaw,8/zagreb,8/zurich,3/jan_mayen,poland",
      "2|n": "0/blantyre,0/bujumbura,0/cairo,0/khartoum,0/kigali,0/tripoli,8/kaliningrad,egypt,libya",
      "1|s": "0/brazzaville,0/kinshasa,0/luanda,0/windhoek",
      "1|n|03/27:03->05/08:02": "0/casablanca,0/el_aaiun",
      "1|n|03/27:01->10/30:02": "3/canary,3/faroe,3/madeira,8/dublin,8/guernsey,8/isle_of_man,8/jersey,8/lisbon,8/london,3/faeroe,eire,8/belfast,gb-eire,gb,portugal",
      "1|n": "0/algiers,0/bangui,0/douala,0/lagos,0/libreville,0/malabo,0/ndjamena,0/niamey,0/porto-novo,0/tunis",
      "14|n": "11/kiritimati",
      "13|s|04/04:04->09/26:03": "11/apia",
      "13|s|01/15:02->11/05:03": "11/tongatapu",
      "13|n": "11/enderbury,11/fakaofo",
      "12|s|04/03:03->09/25:02": "12/mcmurdo,11/auckland,12/south_pole,nz",
      "12|s|01/17:03->11/14:02": "11/fiji",
      "12|n": "2/anadyr,2/kamchatka,2/srednekolymsk,11/funafuti,11/kwajalein,11/majuro,11/nauru,11/tarawa,11/wake,11/wallis,kwajalein",
      "12.75|s|04/03:03->04/03:02": "11/chatham,nz-chat",
      "11|s|04/03:03->10/02:02": "12/macquarie",
      "11|s": "11/bougainville",
      "11|n": "2/magadan,2/sakhalin,11/efate,11/guadalcanal,11/kosrae,11/noumea,11/pohnpei,11/ponape",
      "11.5|n|04/03:03->10/02:02": "11/norfolk",
      "10|s|04/03:03->10/02:02": "4/currie,4/hobart,4/melbourne,4/sydney,4/act,4/canberra,4/nsw,4/tasmania,4/victoria",
      "10|s": "12/dumontdurville,4/brisbane,4/lindeman,11/port_moresby,4/queensland",
      "10|n": "2/ust-nera,2/vladivostok,2/yakutsk,11/guam,11/saipan,11/chuuk,11/truk,11/yap",
      "10.5|s|04/03:01->10/02:02": "4/lord_howe,4/lhi",
      "0|n|03/27:00->10/30:01": "1/scoresbysund,3/azores",
      "0|n": "0/abidjan,0/accra,0/bamako,0/banjul,0/bissau,0/conakry,0/dakar,0/freetown,0/lome,0/monrovia,0/nouakchott,0/ouagadougou,0/sao_tome,1/danmarkshavn,3/reykjavik,3/st_helena,13/gmt,13/utc,0/timbuktu,13/greenwich,13/uct,13/universal,13/zulu,gmt-0,gmt+0,gmt0,greenwich,iceland,uct,universal,utc,zulu",
      "-9|n|03/13:02->11/06:02": "1/adak,1/atka,us/aleutian",
      "-9|n": "11/gambier",
      "-9.5|n": "11/marquesas",
      "-8|n|03/13:02->11/06:02": "1/anchorage,1/juneau,1/metlakatla,1/nome,1/sitka,1/yakutat,us/alaska",
      "-8|n": "11/pitcairn",
      "-7|n|03/13:02->11/06:02": "1/los_angeles,1/santa_isabel,1/tijuana,1/vancouver,1/ensenada,6/pacific,10/bajanorte,us/pacific-new,us/pacific",
      "-7|n|03/08:02->11/01:01": "1/dawson,1/whitehorse,6/yukon",
      "-7|n": "1/creston,1/dawson_creek,1/fort_nelson,1/hermosillo,1/phoenix,us/arizona",
      "-6|s|04/02:22->09/03:22": "11/easter,7/easterisland",
      "-6|n|04/03:02->10/30:02": "1/chihuahua,1/mazatlan,10/bajasur",
      "-6|n|03/13:02->11/06:02": "1/boise,1/cambridge_bay,1/denver,1/edmonton,1/inuvik,1/ojinaga,1/yellowknife,1/shiprock,6/mountain,navajo,us/mountain",
      "-6|n": "1/belize,1/costa_rica,1/el_salvador,1/guatemala,1/managua,1/regina,1/swift_current,1/tegucigalpa,11/galapagos,6/east-saskatchewan,6/saskatchewan",
      "-5|s": "1/lima,1/rio_branco,1/porto_acre,5/acre",
      "-5|n|04/03:02->10/30:02": "1/bahia_banderas,1/merida,1/mexico_city,1/monterrey,10/general",
      "-5|n|03/13:02->11/06:02": "1/chicago,1/matamoros,1/menominee,1/rainy_river,1/rankin_inlet,1/resolute,1/winnipeg,1/indiana/knox,1/indiana/tell_city,1/north_dakota/beulah,1/north_dakota/center,1/north_dakota/new_salem,1/knox_in,6/central,us/central,us/indiana-starke",
      "-5|n|03/12:03->11/05:01": "1/north_dakota",
      "-5|n": "1/bogota,1/cancun,1/cayman,1/coral_harbour,1/eirunepe,1/guayaquil,1/jamaica,1/panama,1/atikokan,jamaica",
      "-4|s|05/13:23->08/13:01": "12/palmer",
      "-4|s|04/02:24->09/04:00": "1/santiago,7/continental",
      "-4|s|03/26:24->10/02:00": "1/asuncion",
      "-4|s|02/16:24->11/03:00": "1/campo_grande,1/cuiaba",
      "-4|s": "1/la_paz,1/manaus,5/west",
      "-4|n|03/13:02->11/06:02": "1/detroit,1/grand_turk,1/indianapolis,1/iqaluit,1/louisville,1/montreal,1/nassau,1/new_york,1/nipigon,1/pangnirtung,1/port-au-prince,1/thunder_bay,1/toronto,1/indiana/marengo,1/indiana/petersburg,1/indiana/vevay,1/indiana/vincennes,1/indiana/winamac,1/kentucky/monticello,1/fort_wayne,1/indiana/indianapolis,1/kentucky/louisville,6/eastern,us/east-indiana,us/eastern,us/michigan",
      "-4|n|03/13:00->11/06:01": "1/havana,cuba",
      "-4|n|03/12:03->11/05:01": "1/indiana,1/kentucky",
      "-4|n": "1/anguilla,1/antigua,1/aruba,1/barbados,1/blanc-sablon,1/boa_vista,1/caracas,1/curacao,1/dominica,1/grenada,1/guadeloupe,1/guyana,1/kralendijk,1/lower_princes,1/marigot,1/martinique,1/montserrat,1/port_of_spain,1/porto_velho,1/puerto_rico,1/santo_domingo,1/st_barthelemy,1/st_kitts,1/st_lucia,1/st_thomas,1/st_vincent,1/tortola,1/virgin",
      "-3|s": "1/argentina,1/buenos_aires,1/catamarca,1/cordoba,1/fortaleza,1/jujuy,1/mendoza,1/montevideo,1/punta_arenas,1/sao_paulo,12/rothera,3/stanley,1/argentina/la_rioja,1/argentina/rio_gallegos,1/argentina/salta,1/argentina/san_juan,1/argentina/san_luis,1/argentina/tucuman,1/argentina/ushuaia,1/argentina/comodrivadavia,1/argentina/buenos_aires,1/argentina/catamarca,1/argentina/cordoba,1/argentina/jujuy,1/argentina/mendoza,1/argentina/rosario,1/rosario,5/east",
      "-3|n|03/13:02->11/06:02": "1/glace_bay,1/goose_bay,1/halifax,1/moncton,1/thule,3/bermuda,6/atlantic",
      "-3|n": "1/araguaina,1/bahia,1/belem,1/cayenne,1/maceio,1/paramaribo,1/recife,1/santarem",
      "-2|n|03/26:22->10/29:23": "1/nuuk,1/godthab",
      "-2|n|03/13:02->11/06:02": "1/miquelon",
      "-2|n": "1/noronha,3/south_georgia,5/denoronha",
      "-2.5|n|03/13:02->11/06:02": "1/st_johns,6/newfoundland",
      "-1|n": "3/cape_verde",
      "-11|n": "11/midway,11/niue,11/pago_pago,11/samoa,us/samoa",
      "-10|n": "11/honolulu,11/johnston,11/rarotonga,11/tahiti,us/hawaii"
    };

    //prefixes for iana names..
    var prefixes = [
      'africa',
      'america',
      'asia',
      'atlantic',
      'australia',
      'brazil',
      'canada',
      'chile',
      'europe',
      'indian',
      'mexico',
      'pacific',
      'antarctica',
      'etc'
    ];

    let all = {};
    Object.keys(data).forEach((k) => {
      let split = k.split('|');
      let obj = {
        offset: Number(split[0]),
        hem: split[1]
      };
      if (split[2]) {
        obj.dst = split[2];
      }
      let names = data[k].split(',');
      names.forEach((str) => {
        str = str.replace(/(^[0-9]+)\//, (before, num) => {
          num = Number(num);
          return prefixes[num] + '/'
        });
        all[str] = obj;
      });
    });

    all.utc = {
      offset: 0,
      hem: 'n' //default to northern hemisphere - (sorry!)
    };

    //add etc/gmt+n
    for (let i = -14; i <= 14; i += 0.5) {
      let num = i;
      if (num > 0) {
        num = '+' + num;
      }
      let name = 'etc/gmt' + num;
      all[name] = {
        offset: i * -1, //they're negative!
        hem: 'n' //(sorry)
      };
      name = 'utc/gmt' + num; //this one too, why not.
      all[name] = {
        offset: i * -1,
        hem: 'n'
      };
    }

    //find the implicit iana code for this machine.
    //safely query the Intl object
    //based on - https://bitbucket.org/pellepim/jstimezonedetect/src
    const fallbackTZ = 'utc'; //

    //this Intl object is not supported often, yet
    const safeIntl = () => {
      if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat === 'undefined') {
        return null
      }
      let format = Intl.DateTimeFormat();
      if (typeof format === 'undefined' || typeof format.resolvedOptions === 'undefined') {
        return null
      }
      let timezone = format.resolvedOptions().timeZone;
      if (!timezone) {
        return null
      }
      return timezone.toLowerCase()
    };

    const guessTz = () => {
      let timezone = safeIntl();
      if (timezone === null) {
        return fallbackTZ
      }
      return timezone
    };

    const isOffset = /(\-?[0-9]+)h(rs)?/i;
    const isNumber = /(\-?[0-9]+)/;
    const utcOffset = /utc([\-+]?[0-9]+)/i;
    const gmtOffset = /gmt([\-+]?[0-9]+)/i;

    const toIana = function (num) {
      num = Number(num);
      if (num >= -13 && num <= 13) {
        num = num * -1; //it's opposite!
        num = (num > 0 ? '+' : '') + num; //add plus sign
        return 'etc/gmt' + num
      }
      return null
    };

    const parseOffset = function (tz) {
      // '+5hrs'
      let m = tz.match(isOffset);
      if (m !== null) {
        return toIana(m[1])
      }
      // 'utc+5'
      m = tz.match(utcOffset);
      if (m !== null) {
        return toIana(m[1])
      }
      // 'GMT-5' (not opposite)
      m = tz.match(gmtOffset);
      if (m !== null) {
        let num = Number(m[1]) * -1;
        return toIana(num)
      }
      // '+5'
      m = tz.match(isNumber);
      if (m !== null) {
        return toIana(m[1])
      }
      return null
    };

    const local = guessTz();

    //add all the city names by themselves
    const cities = Object.keys(all).reduce((h, k) => {
      let city = k.split('/')[1] || '';
      city = city.replace(/_/g, ' ');
      h[city] = k;
      return h
    }, {});

    //try to match these against iana form
    const normalize = (tz) => {
      tz = tz.replace(/ time/g, '');
      tz = tz.replace(/ (standard|daylight|summer)/g, '');
      tz = tz.replace(/\b(east|west|north|south)ern/g, '$1');
      tz = tz.replace(/\b(africa|america|australia)n/g, '$1');
      tz = tz.replace(/\beuropean/g, 'europe');
      tz = tz.replace(/\islands/g, 'island');
      return tz
    };

    // try our best to reconcile the timzone to this given string
    const lookupTz = (str, zones) => {
      if (!str) {
        return local
      }
      if (typeof str !== 'string') {
        console.error("Timezone must be a string - recieved: '", str, "'\n");
      }
      let tz = str.trim();
      // let split = str.split('/')
      //support long timezones like 'America/Argentina/Rio_Gallegos'
      // if (split.length > 2 && zones.hasOwnProperty(tz) === false) {
      //   tz = split[0] + '/' + split[1]
      // }
      tz = tz.toLowerCase();
      if (zones.hasOwnProperty(tz) === true) {
        return tz
      }
      //lookup more loosely..
      tz = normalize(tz);
      if (zones.hasOwnProperty(tz) === true) {
        return tz
      }
      //try city-names
      if (cities.hasOwnProperty(tz) === true) {
        return cities[tz]
      }
      // //try to parse '-5h'
      if (/[0-9]/.test(tz) === true) {
        let id = parseOffset(tz);
        if (id) {
          return id
        }
      }

      throw new Error(
        "Spacetime: Cannot find timezone named: '" + str + "'. Please enter an IANA timezone id."
      )
    };

    //git:blame @JuliasCaesar https://www.timeanddate.com/date/leapyear.html
    function isLeapYear$1(year) { return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 }
    // unsurprisingly-nasty `typeof date` call
    function isDate(d) { return Object.prototype.toString.call(d) === '[object Date]' && !isNaN(d.valueOf()) }
    function isArray(input) { return Object.prototype.toString.call(input) === '[object Array]' }
    function isObject(input) { return Object.prototype.toString.call(input) === '[object Object]' }
    function isBoolean(input) { return Object.prototype.toString.call(input) === '[object Boolean]' }

    function zeroPad(str, len = 2) {
      let pad = '0';
      str = str + '';
      return str.length >= len ? str : new Array(len - str.length + 1).join(pad) + str
    }

    function titleCase(str) {
      if (!str) {
        return ''
      }
      return str[0].toUpperCase() + str.substr(1)
    }

    function ordinal(i) {
      let j = i % 10;
      let k = i % 100;
      if (j === 1 && k !== 11) {
        return i + 'st'
      }
      if (j === 2 && k !== 12) {
        return i + 'nd'
      }
      if (j === 3 && k !== 13) {
        return i + 'rd'
      }
      return i + 'th'
    }

    //strip 'st' off '1st'..
    function toCardinal(str) {
      str = String(str);
      str = str.replace(/([0-9])(st|nd|rd|th)$/i, '$1');
      return parseInt(str, 10)
    }

    //used mostly for cleanup of unit names, like 'months'
    function normalize$1(str = '') {
      str = str.toLowerCase().trim();
      str = str.replace(/ies$/, 'y'); //'centuries'
      str = str.replace(/s$/, '');
      str = str.replace(/-/g, '');
      if (str === 'day' || str === 'days') {
        return 'date'
      }
      if (str === 'min' || str === 'mins') {
        return 'minute'
      }
      return str
    }

    function getEpoch(tmp) {
      //support epoch
      if (typeof tmp === 'number') {
        return tmp
      }
      //suport date objects
      if (isDate(tmp)) {
        return tmp.getTime()
      }
      if (tmp.epoch) {
        return tmp.epoch
      }
      return null
    }

    //make sure this input is a spacetime obj
    function beADate(d, s) {
      if (isObject(d) === false) {
        return s.clone().set(d)
      }
      return d
    }

    function formatTimezone(offset, delimiter = '') {
      const sign = offset > 0 ? '+' : '-';
      const absOffset = Math.abs(offset);
      const hours = zeroPad(parseInt('' + absOffset, 10));
      const minutes = zeroPad((absOffset % 1) * 60);
      return `${sign}${hours}${delimiter}${minutes}`
    }

    const defaults = {
      year: new Date().getFullYear(),
      month: 0,
      date: 1
    };

    //support [2016, 03, 01] format
    const parseArray = (s, arr, today) => {
      if (arr.length === 0) {
        return s
      }
      let order = ['year', 'month', 'date', 'hour', 'minute', 'second', 'millisecond'];
      for (let i = 0; i < order.length; i++) {
        let num = arr[i] || today[order[i]] || defaults[order[i]] || 0;
        s = s[order[i]](num);
      }
      return s
    };

    //support {year:2016, month:3} format
    const parseObject = (s, obj, today) => {
      // if obj is empty, do nothing
      if (Object.keys(obj).length === 0) {
        return s
      }
      obj = Object.assign({}, defaults, today, obj);
      let keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        let unit = keys[i];
        //make sure we have this method
        if (s[unit] === undefined || typeof s[unit] !== 'function') {
          continue
        }
        //make sure the value is a number
        if (obj[unit] === null || obj[unit] === undefined || obj[unit] === '') {
          continue
        }
        let num = obj[unit] || today[unit] || defaults[unit] || 0;
        s = s[unit](num);
      }
      return s
    };

    // this may seem like an arbitrary number, but it's 'within jan 1970'
    // this is only really ambiguous until 2054 or so
    const parseNumber = function (s, input) {
      const minimumEpoch = 2500000000;
      // if the given epoch is really small, they've probably given seconds and not milliseconds
      // anything below this number is likely (but not necessarily) a mistaken input.
      if (input > 0 && input < minimumEpoch && s.silent === false) {
        console.warn('  - Warning: You are setting the date to January 1970.');
        console.warn('       -   did input seconds instead of milliseconds?');
      }
      s.epoch = input;
      return s
    };

    var fns = {
      parseArray,
      parseObject,
      parseNumber
    };

    // pull in 'today' data for the baseline moment
    const getNow = function (s) {
      s.epoch = Date.now();
      Object.keys(s._today || {}).forEach((k) => {
        if (typeof s[k] === 'function') {
          s = s[k](s._today[k]);
        }
      });
      return s
    };

    const dates = {
      now: (s) => {
        return getNow(s)
      },
      today: (s) => {
        return getNow(s)
      },
      tonight: (s) => {
        s = getNow(s);
        s = s.hour(18); //6pm
        return s
      },
      tomorrow: (s) => {
        s = getNow(s);
        s = s.add(1, 'day');
        s = s.startOf('day');
        return s
      },
      yesterday: (s) => {
        s = getNow(s);
        s = s.subtract(1, 'day');
        s = s.startOf('day');
        return s
      },
      christmas: (s) => {
        let year = getNow(s).year();
        s = s.set([year, 11, 25, 18, 0, 0]); // Dec 25
        return s
      },
      'new years': (s) => {
        let year = getNow(s).year();
        s = s.set([year, 11, 31, 18, 0, 0]); // Dec 31
        return s
      }
    };
    dates['new years eve'] = dates['new years'];

    //little cleanup..
    const normalize$2 = function (str) {
      // remove all day-names
      str = str.replace(/\b(mon|tues?|wed|wednes|thur?s?|fri|sat|satur|sun)(day)?\b/i, '');
      //remove ordinal ending
      str = str.replace(/([0-9])(th|rd|st|nd)/, '$1');
      str = str.replace(/,/g, '');
      str = str.replace(/ +/g, ' ').trim();
      return str
    };

    let o = {
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
    Object.keys(o).forEach(k => {
      o[k + 's'] = o[k];
    });

    //basically, step-forward/backward until js Date object says we're there.
    const walk = (s, n, fn, unit, previous) => {
      let current = s.d[fn]();
      if (current === n) {
        return //already there
      }
      let startUnit = previous === null ? null : s.d[previous]();
      let original = s.epoch;
      //try to get it as close as we can
      let diff = n - current;
      s.epoch += o[unit] * diff;
      //DST edge-case: if we are going many days, be a little conservative
      // console.log(unit, diff)
      if (unit === 'day') {
        // s.epoch -= ms.minute
        //but don't push it over a month
        if (Math.abs(diff) > 28 && n < 28) {
          s.epoch += o.hour;
        }
      }
      // 1st time: oops, did we change previous unit? revert it.
      if (previous !== null && startUnit !== s.d[previous]()) {
        // console.warn('spacetime warning: missed setting ' + unit)
        s.epoch = original;
        // s.epoch += ms[unit] * diff * 0.89 // maybe try and make it close...?
      }
      //repair it if we've gone too far or something
      //(go by half-steps, just in case)
      const halfStep = o[unit] / 2;
      while (s.d[fn]() < n) {
        s.epoch += halfStep;
      }

      while (s.d[fn]() > n) {
        s.epoch -= halfStep;
      }
      // 2nd time: did we change previous unit? revert it.
      if (previous !== null && startUnit !== s.d[previous]()) {
        // console.warn('spacetime warning: missed setting ' + unit)
        s.epoch = original;
      }
    };
    //find the desired date by a increment/check while loop
    const units = {
      year: {
        valid: (n) => n > -4000 && n < 4000,
        walkTo: (s, n) => walk(s, n, 'getFullYear', 'year', null)
      },
      month: {
        valid: (n) => n >= 0 && n <= 11,
        walkTo: (s, n) => {
          let d = s.d;
          let current = d.getMonth();
          let original = s.epoch;
          let startUnit = d.getFullYear();
          if (current === n) {
            return
          }
          //try to get it as close as we can..
          let diff = n - current;
          s.epoch += o.day * (diff * 28); //special case
          //oops, did we change the year? revert it.
          if (startUnit !== s.d.getFullYear()) {
            s.epoch = original;
          }
          //increment by day
          while (s.d.getMonth() < n) {
            s.epoch += o.day;
          }
          while (s.d.getMonth() > n) {
            s.epoch -= o.day;
          }
        }
      },
      date: {
        valid: (n) => n > 0 && n <= 31,
        walkTo: (s, n) => walk(s, n, 'getDate', 'day', 'getMonth')
      },
      hour: {
        valid: (n) => n >= 0 && n < 24,
        walkTo: (s, n) => walk(s, n, 'getHours', 'hour', 'getDate')
      },
      minute: {
        valid: (n) => n >= 0 && n < 60,
        walkTo: (s, n) => walk(s, n, 'getMinutes', 'minute', 'getHours')
      },
      second: {
        valid: (n) => n >= 0 && n < 60,
        walkTo: (s, n) => {
          //do this one directly
          s.epoch = s.seconds(n).epoch;
        }
      },
      millisecond: {
        valid: (n) => n >= 0 && n < 1000,
        walkTo: (s, n) => {
          //do this one directly
          s.epoch = s.milliseconds(n).epoch;
        }
      }
    };

    const walkTo = (s, wants) => {
      let keys = Object.keys(units);
      let old = s.clone();
      for (let i = 0; i < keys.length; i++) {
        let k = keys[i];
        let n = wants[k];
        if (n === undefined) {
          n = old[k]();
        }
        if (typeof n === 'string') {
          n = parseInt(n, 10);
        }
        //make-sure it's valid
        if (!units[k].valid(n)) {
          s.epoch = null;
          if (s.silent === false) {
            console.warn('invalid ' + k + ': ' + n);
          }
          return
        }
        units[k].walkTo(s, n);
      }
      return
    };

    const monthLengths$1 = [
      31, // January - 31 days
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

    // 28 - feb
    // 30 - april, june, sept, nov
    // 31 - jan, march, may, july, aug, oct, dec

    let shortMonths = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec'
    ];
    let longMonths = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december'
    ];

    function buildMapping() {
      const obj = {
        sep: 8 //support this format
      };
      for (let i = 0; i < shortMonths.length; i++) {
        obj[shortMonths[i]] = i;
      }
      for (let i = 0; i < longMonths.length; i++) {
        obj[longMonths[i]] = i;
      }
      return obj
    }

    function short() { return shortMonths }
    function long() { return longMonths }
    function mapping() { return buildMapping() }
    function set(i18n) {
      shortMonths = i18n.short || shortMonths;
      longMonths = i18n.long || longMonths;
    }

    //pull-apart ISO offsets, like "+0100"
    const parseOffset$1 = (s, offset) => {
      if (!offset) {
        return s
      }

      // according to ISO8601, tz could be hh:mm, hhmm or hh
      // so need few more steps before the calculation.
      let num = 0;

      // for (+-)hh:mm
      if (/^[\+-]?[0-9]{2}:[0-9]{2}$/.test(offset)) {
        //support "+01:00"
        if (/:00/.test(offset) === true) {
          offset = offset.replace(/:00/, '');
        }
        //support "+01:30"
        if (/:30/.test(offset) === true) {
          offset = offset.replace(/:30/, '.5');
        }
      }

      // for (+-)hhmm
      if (/^[\+-]?[0-9]{4}$/.test(offset)) {
        offset = offset.replace(/30$/, '.5');
      }
      num = parseFloat(offset);

      //divide by 100 or 10 - , "+0100", "+01"
      if (Math.abs(num) > 100) {
        num = num / 100;
      }
      //this is a fancy-move
      if (num === 0 || offset === 'Z' || offset === 'z') {
        s.tz = 'etc/gmt';
        return s
      }
      //okay, try to match it to a utc timezone
      //remember - this is opposite! a -5 offset maps to Etc/GMT+5  ¯\_(:/)_/¯
      //https://askubuntu.com/questions/519550/why-is-the-8-timezone-called-gmt-8-in-the-filesystem
      num *= -1;

      if (num >= 0) {
        num = '+' + num;
      }
      let tz = 'etc/gmt' + num;
      let zones = s.timezones;

      if (zones[tz]) {
        // log a warning if we're over-writing a given timezone?
        // console.log('changing timezone to: ' + tz)
        s.tz = tz;
      }
      return s
    };

    // truncate any sub-millisecond values
    const parseMs = function (str = '') {
      str = String(str);
      //js does not support sub-millisecond values 
      // so truncate these - 2021-11-02T19:55:30.087772
      if (str.length > 3) {
        str = str.substr(0, 3);
      } else if (str.length === 1) {
        // assume ms are zero-padded on the left
        // but maybe not on the right.
        // turn '.10' into '.100'
        str = str + '00';
      } else if (str.length === 2) {
        str = str + '0';
      }
      return Number(str) || 0
    };

    const parseTime = (s, str = '') => {
      // remove all whitespace
      str = str.replace(/^\s+/, '').toLowerCase();
      //formal time format - 04:30.23
      let arr = str.match(/([0-9]{1,2}):([0-9]{1,2}):?([0-9]{1,2})?[:\.]?([0-9]{1,4})?/);
      if (arr !== null) {
        //validate it a little
        let h = Number(arr[1]);
        if (h < 0 || h > 24) {
          return s.startOf('day')
        }
        let m = Number(arr[2]); //don't accept '5:3pm'
        if (arr[2].length < 2 || m < 0 || m > 59) {
          return s.startOf('day')
        }
        s = s.hour(h);
        s = s.minute(m);
        s = s.seconds(arr[3] || 0);
        s = s.millisecond(parseMs(arr[4]));
        //parse-out am/pm
        let ampm = str.match(/[\b0-9] ?(am|pm)\b/);
        if (ampm !== null && ampm[1]) {
          s = s.ampm(ampm[1]);
        }
        return s
      }

      //try an informal form - 5pm (no minutes)
      arr = str.match(/([0-9]+) ?(am|pm)/);
      if (arr !== null && arr[1]) {
        let h = Number(arr[1]);
        //validate it a little..
        if (h > 12 || h < 1) {
          return s.startOf('day')
        }
        s = s.hour(arr[1] || 0);
        s = s.ampm(arr[2]);
        s = s.startOf('hour');
        return s
      }

      //no time info found, use start-of-day
      s = s.startOf('day');
      return s
    };

    let months$1 = mapping();

    //given a month, return whether day number exists in it
    const validate = (obj) => {
      //invalid values
      if (monthLengths$1.hasOwnProperty(obj.month) !== true) {
        return false
      }
      //support leap-year in february
      if (obj.month === 1) {
        if (isLeapYear$1(obj.year) && obj.date <= 29) {
          return true
        } else {
          return obj.date <= 28
        }
      }
      //is this date too-big for this month?
      let max = monthLengths$1[obj.month] || 0;
      if (obj.date <= max) {
        return true
      }
      return false
    };

    const parseYear = (str = '', today) => {
      str = str.trim();
      // parse '86 shorthand
      if (/^'[0-9][0-9]$/.test(str) === true) {
        let num = Number(str.replace(/'/, ''));
        if (num > 50) {
          return 1900 + num
        }
        return 2000 + num
      }
      let year = parseInt(str, 10);
      // use a given year from options.today
      if (!year && today) {
        year = today.year;
      }
      // fallback to this year
      year = year || new Date().getFullYear();
      return year
    };

    const parseMonth = function (str) {
      str = str.toLowerCase().trim();
      if (str === 'sept') {
        return months$1.sep
      }
      return months$1[str]
    };

    var ymd = [
      // =====
      //  y-m-d
      // =====
      //iso-this 1998-05-30T22:00:00:000Z, iso-that 2017-04-03T08:00:00-0700
      {
        reg: /^(\-?0?0?[0-9]{3,4})-([0-9]{1,2})-([0-9]{1,2})[T| ]([0-9.:]+)(Z|[0-9\-\+:]+)?$/i,
        parse: (s, m) => {
          let obj = {
            year: m[1],
            month: parseInt(m[2], 10) - 1,
            date: m[3]
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          parseOffset$1(s, m[5]);
          walkTo(s, obj);
          s = parseTime(s, m[4]);
          return s
        }
      },
      //short-iso "2015-03-25" or "2015/03/25" or "2015/03/25 12:26:14 PM"
      {
        reg: /^([0-9]{4})[\-\/\. ]([0-9]{1,2})[\-\/\. ]([0-9]{1,2})( [0-9]{1,2}(:[0-9]{0,2})?(:[0-9]{0,3})? ?(am|pm)?)?$/i,
        parse: (s, m) => {
          let obj = {
            year: m[1],
            month: parseInt(m[2], 10) - 1,
            date: parseInt(m[3], 10)
          };
          if (obj.month >= 12) {
            //support yyyy/dd/mm (weird, but ok)
            obj.date = parseInt(m[2], 10);
            obj.month = parseInt(m[3], 10) - 1;
          }
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, m[4]);
          return s
        }
      },

      //text-month "2015-feb-25"
      {
        reg: /^([0-9]{4})[\-\/\. ]([a-z]+)[\-\/\. ]([0-9]{1,2})( [0-9]{1,2}(:[0-9]{0,2})?(:[0-9]{0,3})? ?(am|pm)?)?$/i,
        parse: (s, m) => {
          let obj = {
            year: parseYear(m[1], s._today),
            month: parseMonth(m[2]),
            date: toCardinal(m[3] || '')
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, m[4]);
          return s
        }
      }
    ];

    var mdy = [
      // =====
      //  m-d-y
      // =====
      //mm/dd/yyyy - uk/canada "6/28/2019, 12:26:14 PM"
      {
        reg: /^([0-9]{1,2})[\-\/.]([0-9]{1,2})[\-\/.]?([0-9]{4})?( [0-9]{1,2}:[0-9]{2}:?[0-9]{0,2}? ?(am|pm|gmt))?$/i,
        parse: (s, arr) => {
          let month = parseInt(arr[1], 10) - 1;
          let date = parseInt(arr[2], 10);
          //support dd/mm/yyy
          if (s.british || month >= 12) {
            date = parseInt(arr[1], 10);
            month = parseInt(arr[2], 10) - 1;
          }
          let obj = {
            date,
            month,
            year: parseYear(arr[3], s._today) || new Date().getFullYear()
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, arr[4]);
          return s
        }
      },
      //alt short format - "feb-25-2015"
      {
        reg: /^([a-z]+)[\-\/\. ]([0-9]{1,2})[\-\/\. ]?([0-9]{4}|'[0-9]{2})?( [0-9]{1,2}(:[0-9]{0,2})?(:[0-9]{0,3})? ?(am|pm)?)?$/i,
        parse: (s, arr) => {
          let obj = {
            year: parseYear(arr[3], s._today),
            month: parseMonth(arr[1]),
            date: toCardinal(arr[2] || '')
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, arr[4]);
          return s
        }
      },

      //Long "Mar 25 2015"
      //February 22, 2017 15:30:00
      {
        reg: /^([a-z]+) ([0-9]{1,2})( [0-9]{4})?( ([0-9:]+( ?am| ?pm| ?gmt)?))?$/i,
        parse: (s, arr) => {
          let obj = {
            year: parseYear(arr[3], s._today),
            month: parseMonth(arr[1]),
            date: toCardinal(arr[2] || '')
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, arr[4]);
          return s
        }
      },
      // 'Sun Mar 14 15:09:48 +0000 2021'
      {
        reg: /^([a-z]+) ([0-9]{1,2})( [0-9:]+)?( \+[0-9]{4})?( [0-9]{4})?$/i,
        parse: (s, arr) => {
          let obj = {
            year: parseYear(arr[5], s._today),
            month: parseMonth(arr[1]),
            date: toCardinal(arr[2] || '')
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, arr[3]);
          return s
        }
      }
    ];

    var dmy = [
      // =====
      //  d-m-y
      // =====
      //common british format - "25-feb-2015"
      {
        reg: /^([0-9]{1,2})[\-\/]([a-z]+)[\-\/]?([0-9]{4})?$/i,
        parse: (s, m) => {
          let obj = {
            year: parseYear(m[3], s._today),
            month: parseMonth(m[2]),
            date: toCardinal(m[1] || '')
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, m[4]);
          return s
        }
      },
      // "25 Mar 2015"
      {
        reg: /^([0-9]{1,2})( [a-z]+)( [0-9]{4}| '[0-9]{2})? ?([0-9]{1,2}:[0-9]{2}:?[0-9]{0,2}? ?(am|pm|gmt))?$/i,
        parse: (s, m) => {
          let obj = {
            year: parseYear(m[3], s._today),
            month: parseMonth(m[2]),
            date: toCardinal(m[1])
          };
          if (!obj.month || validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, m[4]);
          return s
        }
      },
      // 01-jan-2020
      {
        reg: /^([0-9]{1,2})[\. -/]([a-z]+)[\. -/]([0-9]{4})?( [0-9]{1,2}(:[0-9]{0,2})?(:[0-9]{0,3})? ?(am|pm)?)?$/i,
        parse: (s, m) => {
          let obj = {
            date: Number(m[1]),
            month: parseMonth(m[2]),
            year: Number(m[3])
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = s.startOf('day');
          s = parseTime(s, m[4]);
          return s
        }
      }
    ];

    var misc$1 = [
      // =====
      // no dates
      // =====

      // '2012-06' month-only
      {
        reg: /^([0-9]{4})[\-\/]([0-9]{2})$/i,
        parse: (s, m) => {
          let obj = {
            year: m[1],
            month: parseInt(m[2], 10) - 1,
            date: 1
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, m[4]);
          return s
        }
      },

      //February 2017 (implied date)
      {
        reg: /^([a-z]+) ([0-9]{4})$/i,
        parse: (s, arr) => {
          let obj = {
            year: parseYear(arr[2], s._today),
            month: parseMonth(arr[1]),
            date: s._today.date || 1
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, arr[4]);
          return s
        }
      },

      {
        // 'q2 2002'
        reg: /^(q[0-9])( of)?( [0-9]{4})?/i,
        parse: (s, arr) => {
          let quarter = arr[1] || '';
          s = s.quarter(quarter);
          let year = arr[3] || '';
          if (year) {
            year = year.trim();
            s = s.year(year);
          }
          return s
        }
      },
      {
        // 'summer 2002'
        reg: /^(spring|summer|winter|fall|autumn)( of)?( [0-9]{4})?/i,
        parse: (s, arr) => {
          let season = arr[1] || '';
          s = s.season(season);
          let year = arr[3] || '';
          if (year) {
            year = year.trim();
            s = s.year(year);
          }
          return s
        }
      },
      {
        // '200bc'
        reg: /^[0-9,]+ ?b\.?c\.?$/i,
        parse: (s, arr) => {
          let str = arr[0] || '';
          //make year-negative
          str = str.replace(/^([0-9,]+) ?b\.?c\.?$/i, '-$1');
          let d = new Date();
          let obj = {
            year: parseInt(str.trim(), 10),
            month: d.getMonth(),
            date: d.getDate()
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s);
          return s
        }
      },
      {
        // '200ad'
        reg: /^[0-9,]+ ?(a\.?d\.?|c\.?e\.?)$/i,
        parse: (s, arr) => {
          let str = arr[0] || '';
          //remove commas
          str = str.replace(/,/g, '');
          let d = new Date();
          let obj = {
            year: parseInt(str.trim(), 10),
            month: d.getMonth(),
            date: d.getDate()
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s);
          return s
        }
      },
      {
        // '1992'
        reg: /^[0-9]{4}( ?a\.?d\.?)?$/i,
        parse: (s, arr) => {
          let today = s._today;
          // using today's date, but a new month is awkward.
          if (today.month && !today.date) {
            today.date = 1;
          }
          let d = new Date();
          let obj = {
            year: parseYear(arr[0], today),
            month: today.month || d.getMonth(),
            date: today.date || d.getDate()
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s);
          return s
        }
      }
    ];

    var parsers = [].concat(ymd, mdy, dmy, misc$1);

    const parseString = function (s, input, givenTz) {
      // let parsers = s.parsers || []
      //try each text-parse template, use the first good result
      for (let i = 0; i < parsers.length; i++) {
        let m = input.match(parsers[i].reg);
        if (m) {
          // console.log(parsers[i].reg)
          let res = parsers[i].parse(s, m, givenTz);
          if (res !== null && res.isValid()) {
            return res
          }
        }
      }
      if (s.silent === false) {
        console.warn("Warning: couldn't parse date-string: '" + input + "'");
      }
      s.epoch = null;
      return s
    };

    const { parseArray: parseArray$1, parseObject: parseObject$1, parseNumber: parseNumber$1 } = fns;
    //we have to actually parse these inputs ourselves
    //  -  can't use built-in js parser ;(
    //=========================================
    // ISO Date	  "2015-03-25"
    // Short Date	"03/25/2015" or "2015/03/25"
    // Long Date	"Mar 25 2015" or "25 Mar 2015"
    // Full Date	"Wednesday March 25 2015"
    //=========================================

    const defaults$1 = {
      year: new Date().getFullYear(),
      month: 0,
      date: 1
    };

    //find the epoch from different input styles
    const parseInput = (s, input) => {
      let today = s._today || defaults$1;
      //if we've been given a epoch number, it's easy
      if (typeof input === 'number') {
        return parseNumber$1(s, input)
      }
      //set tmp time
      s.epoch = Date.now();
      // overwrite tmp time with 'today' value, if exists
      if (s._today && isObject(s._today) && Object.keys(s._today).length > 0) {
        let res = parseObject$1(s, today, defaults$1);
        if (res.isValid()) {
          s.epoch = res.epoch;
        }
      }
      // null input means 'now'
      if (input === null || input === undefined || input === '') {
        return s //k, we're good.
      }
      //support input of Date() object
      if (isDate(input) === true) {
        s.epoch = input.getTime();
        return s
      }
      //support [2016, 03, 01] format
      if (isArray(input) === true) {
        s = parseArray$1(s, input, today);
        return s
      }
      //support {year:2016, month:3} format
      if (isObject(input) === true) {
        //support spacetime object as input
        if (input.epoch) {
          s.epoch = input.epoch;
          s.tz = input.tz;
          return s
        }
        s = parseObject$1(s, input, today);
        return s
      }
      //input as a string..
      if (typeof input !== 'string') {
        return s
      }
      //little cleanup..
      input = normalize$2(input);
      //try some known-words, like 'now'
      if (dates.hasOwnProperty(input) === true) {
        s = dates[input](s);
        return s
      }
      //try each text-parse template, use the first good result
      return parseString(s, input)
    };

    let shortDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let longDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    function short$1() { return shortDays }
    function long$1() { return longDays }
    function set$1(i18n) {
      shortDays = i18n.short || shortDays;
      longDays = i18n.long || longDays;
    }
    const aliases = {
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
    };

    let titleCaseEnabled = true;

    function useTitleCase() {
      return titleCaseEnabled
    }

    function set$2(val) {
      titleCaseEnabled = val;
    }

    // create the timezone offset part of an iso timestamp
    // it's kind of nuts how involved this is
    // "+01:00", "+0100", or simply "+01"
    const isoOffset = s => {
      let offset = s.timezone().current.offset;
      return !offset ? 'Z' : formatTimezone(offset, ':')
    };

    const applyCaseFormat = (str) => {
      if (useTitleCase()) {
        return titleCase(str)
      }
      return str
    };

    // iso-year padding
    const padYear = (num) => {
      if (num >= 0) {
        return zeroPad(num, 4)
      } else {
        num = Math.abs(num);
        return '-' + zeroPad(num, 4)
      }
    };

    const format = {
      day: (s) => applyCaseFormat(s.dayName()),
      'day-short': (s) => applyCaseFormat(short$1()[s.day()]),
      'day-number': (s) => s.day(),
      'day-ordinal': (s) => ordinal(s.day()),
      'day-pad': (s) => zeroPad(s.day()),

      date: (s) => s.date(),
      'date-ordinal': (s) => ordinal(s.date()),
      'date-pad': (s) => zeroPad(s.date()),

      month: (s) => applyCaseFormat(s.monthName()),
      'month-short': (s) => applyCaseFormat(short()[s.month()]),
      'month-number': (s) => s.month(),
      'month-ordinal': (s) => ordinal(s.month()),
      'month-pad': (s) => zeroPad(s.month()),
      'iso-month': (s) => zeroPad(s.month() + 1), //1-based months

      year: (s) => {
        let year = s.year();
        if (year > 0) {
          return year
        }
        year = Math.abs(year);
        return year + ' BC'
      },
      'year-short': (s) => {
        let year = s.year();
        if (year > 0) {
          return `'${String(s.year()).substr(2, 4)}`
        }
        year = Math.abs(year);
        return year + ' BC'
      },
      'iso-year': (s) => {
        let year = s.year();
        let isNegative = year < 0;
        let str = zeroPad(Math.abs(year), 4); //0-padded
        if (isNegative) {
          //negative years are for some reason 6-digits ('-00008')
          str = zeroPad(str, 6);
          str = '-' + str;
        }
        return str
      },

      time: (s) => s.time(),
      'time-24': (s) => `${s.hour24()}:${zeroPad(s.minute())}`,

      hour: (s) => s.hour12(),
      'hour-pad': (s) => zeroPad(s.hour12()),
      'hour-24': (s) => s.hour24(),
      'hour-24-pad': (s) => zeroPad(s.hour24()),

      minute: (s) => s.minute(),
      'minute-pad': (s) => zeroPad(s.minute()),
      second: (s) => s.second(),
      'second-pad': (s) => zeroPad(s.second()),
      millisecond: (s) => s.millisecond(),
      'millisecond-pad': (s) => zeroPad(s.millisecond(), 3),

      ampm: (s) => s.ampm(),
      quarter: (s) => 'Q' + s.quarter(),
      season: (s) => s.season(),
      era: (s) => s.era(),
      json: (s) => s.json(),
      timezone: (s) => s.timezone().name,
      offset: (s) => isoOffset(s),

      numeric: (s) => `${s.year()}/${zeroPad(s.month() + 1)}/${zeroPad(s.date())}`, // yyyy/mm/dd
      'numeric-us': (s) => `${zeroPad(s.month() + 1)}/${zeroPad(s.date())}/${s.year()}`, // mm/dd/yyyy
      'numeric-uk': (s) => `${zeroPad(s.date())}/${zeroPad(s.month() + 1)}/${s.year()}`, //dd/mm/yyyy
      'mm/dd': (s) => `${zeroPad(s.month() + 1)}/${zeroPad(s.date())}`, //mm/dd

      // ... https://en.wikipedia.org/wiki/ISO_8601 ;(((
      iso: (s) => {
        let year = s.format('iso-year');
        let month = zeroPad(s.month() + 1); //1-based months
        let date = zeroPad(s.date());
        let hour = zeroPad(s.h24());
        let minute = zeroPad(s.minute());
        let second = zeroPad(s.second());
        let ms = zeroPad(s.millisecond(), 3);
        let offset = isoOffset(s);
        return `${year}-${month}-${date}T${hour}:${minute}:${second}.${ms}${offset}` //2018-03-09T08:50:00.000-05:00
      },
      'iso-short': (s) => {
        let month = zeroPad(s.month() + 1); //1-based months
        let date = zeroPad(s.date());
        let year = padYear(s.year());
        return `${year}-${month}-${date}` //2017-02-15
      },
      'iso-utc': (s) => {
        return new Date(s.epoch).toISOString() //2017-03-08T19:45:28.367Z
      },

      //i made these up
      nice: (s) => `${short()[s.month()]} ${ordinal(s.date())}, ${s.time()}`,
      'nice-24': (s) =>
        `${short()[s.month()]} ${ordinal(s.date())}, ${s.hour24()}:${zeroPad(
      s.minute()
    )}`,
      'nice-year': (s) => `${short()[s.month()]} ${ordinal(s.date())}, ${s.year()}`,
      'nice-day': (s) =>
        `${short$1()[s.day()]} ${applyCaseFormat(short()[s.month()])} ${ordinal(
      s.date()
    )}`,
      'nice-full': (s) =>
        `${s.dayName()} ${applyCaseFormat(s.monthName())} ${ordinal(s.date())}, ${s.time()}`,
      'nice-full-24': (s) =>
        `${s.dayName()} ${applyCaseFormat(s.monthName())} ${ordinal(
      s.date()
    )}, ${s.hour24()}:${zeroPad(s.minute())}`
    };
    //aliases
    const aliases$1 = {
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
    Object.keys(aliases$1).forEach((k) => (format[k] = format[aliases$1[k]]));

    const printFormat = (s, str = '') => {
      //don't print anything if it's an invalid date
      if (s.isValid() !== true) {
        return ''
      }
      //support .format('month')
      if (format.hasOwnProperty(str)) {
        let out = format[str](s) || '';
        if (str !== 'json') {
          out = String(out);
          if (str !== 'ampm') {
            out = applyCaseFormat(out);
          }
        }
        return out
      }
      //support '{hour}:{minute}' notation
      if (str.indexOf('{') !== -1) {
        let sections = /\{(.+?)\}/g;
        str = str.replace(sections, (_, fmt) => {
          fmt = fmt.toLowerCase().trim();
          if (format.hasOwnProperty(fmt)) {
            let out = String(format[fmt](s));
            if (fmt !== 'ampm') {
              return applyCaseFormat(out)
            }
            return out
          }
          return ''
        });
        return str
      }

      return s.format('iso-short')
    };

    //parse this insane unix-time-templating thing, from the 19th century
    //http://unicode.org/reports/tr35/tr35-25.html#Date_Format_Patterns

    //time-symbols we support
    const mapping$1 = {
      G: (s) => s.era(),
      GG: (s) => s.era(),
      GGG: (s) => s.era(),
      GGGG: (s) => (s.era() === 'AD' ? 'Anno Domini' : 'Before Christ'),
      //year
      y: (s) => s.year(),
      yy: (s) => {
        //last two chars
        return zeroPad(Number(String(s.year()).substr(2, 4)))
      },
      yyy: (s) => s.year(),
      yyyy: (s) => s.year(),
      yyyyy: (s) => '0' + s.year(),
      // u: (s) => {},//extended non-gregorian years

      //quarter
      Q: (s) => s.quarter(),
      QQ: (s) => s.quarter(),
      QQQ: (s) => s.quarter(),
      QQQQ: (s) => s.quarter(),

      //month
      M: (s) => s.month() + 1,
      MM: (s) => zeroPad(s.month() + 1),
      MMM: (s) => s.format('month-short'),
      MMMM: (s) => s.format('month'),

      //week
      w: (s) => s.week(),
      ww: (s) => zeroPad(s.week()),
      //week of month
      // W: (s) => s.week(),

      //date of month
      d: (s) => s.date(),
      dd: (s) => zeroPad(s.date()),
      //date of year
      D: (s) => s.dayOfYear(),
      DD: (s) => zeroPad(s.dayOfYear()),
      DDD: (s) => zeroPad(s.dayOfYear(), 3),

      // F: (s) => {},//date of week in month
      // g: (s) => {},//modified julian day

      //day
      E: (s) => s.format('day-short'),
      EE: (s) => s.format('day-short'),
      EEE: (s) => s.format('day-short'),
      EEEE: (s) => s.format('day'),
      EEEEE: (s) => s.format('day')[0],
      e: (s) => s.day(),
      ee: (s) => s.day(),
      eee: (s) => s.format('day-short'),
      eeee: (s) => s.format('day'),
      eeeee: (s) => s.format('day')[0],

      //am/pm
      a: (s) => s.ampm().toUpperCase(),
      aa: (s) => s.ampm().toUpperCase(),
      aaa: (s) => s.ampm().toUpperCase(),
      aaaa: (s) => s.ampm().toUpperCase(),

      //hour
      h: (s) => s.h12(),
      hh: (s) => zeroPad(s.h12()),
      H: (s) => s.hour(),
      HH: (s) => zeroPad(s.hour()),
      // j: (s) => {},//weird hour format

      m: (s) => s.minute(),
      mm: (s) => zeroPad(s.minute()),
      s: (s) => s.second(),
      ss: (s) => zeroPad(s.second()),

      //milliseconds
      SSS: (s) => zeroPad(s.millisecond(), 3),
      //milliseconds in the day
      A: (s) => s.epoch - s.startOf('day').epoch,
      //timezone
      z: (s) => s.timezone().name,
      zz: (s) => s.timezone().name,
      zzz: (s) => s.timezone().name,
      zzzz: (s) => s.timezone().name,
      Z: (s) => formatTimezone(s.timezone().current.offset),
      ZZ: (s) => formatTimezone(s.timezone().current.offset),
      ZZZ: (s) => formatTimezone(s.timezone().current.offset),
      ZZZZ: (s) => formatTimezone(s.timezone().current.offset, ':')
    };

    const addAlias = (char, to, n) => {
      let name = char;
      let toName = to;
      for (let i = 0; i < n; i += 1) {
        mapping$1[name] = mapping$1[toName];
        name += char;
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
    addAlias('V', 'Z', 4);

    // support unix-style escaping with ' character
    const escapeChars = function (arr) {
      for (let i = 0; i < arr.length; i += 1) {
        if (arr[i] === `'`) {
          // greedy-search for next apostrophe
          for (let o = i + 1; o < arr.length; o += 1) {
            if (arr[o]) {
              arr[i] += arr[o];
            }
            if (arr[o] === `'`) {
              arr[o] = null;
              break
            }
            arr[o] = null;
          }
        }
      }
      return arr.filter((ch) => ch)
    };

    //combine consecutive chars, like 'yyyy' as one.
    const combineRepeated = function (arr) {
      for (let i = 0; i < arr.length; i += 1) {
        let c = arr[i];
        // greedy-forward
        for (let o = i + 1; o < arr.length; o += 1) {
          if (arr[o] === c) {
            arr[i] += arr[o];
            arr[o] = null;
          } else {
            break
          }
        }
      }
      // '' means one apostrophe
      arr = arr.filter((ch) => ch);
      arr = arr.map((str) => {
        if (str === `''`) {
          str = `'`;
        }
        return str
      });
      return arr
    };

    const unixFmt = (s, str) => {
      let arr = str.split('');
      // support character escaping
      arr = escapeChars(arr);
      //combine 'yyyy' as string.
      arr = combineRepeated(arr);
      return arr.reduce((txt, c) => {
        if (mapping$1[c] !== undefined) {
          txt += mapping$1[c](s) || '';
        } else {
          // 'unescape'
          if (/^'.{1,}'$/.test(c)) {
            c = c.replace(/'/g, '');
          }
          txt += c;
        }
        return txt
      }, '')
    };

    const units$1 = ['year', 'season', 'quarter', 'month', 'week', 'day', 'quarterHour', 'hour', 'minute'];

    const doUnit = function (s, k) {
      let start = s.clone().startOf(k);
      let end = s.clone().endOf(k);
      let duration = end.epoch - start.epoch;
      let percent = (s.epoch - start.epoch) / duration;
      return parseFloat(percent.toFixed(2))
    };

    //how far it is along, from 0-1
    const progress = (s, unit) => {
      if (unit) {
        unit = normalize$1(unit);
        return doUnit(s, unit)
      }
      let obj = {};
      units$1.forEach(k => {
        obj[k] = doUnit(s, k);
      });
      return obj
    };

    //round to either current, or +1 of this unit
    const nearest = (s, unit) => {
      //how far have we gone?
      let prog = s.progress();
      unit = normalize$1(unit);
      //fix camel-case for this one
      if (unit === 'quarterhour') {
        unit = 'quarterHour';
      }
      if (prog[unit] !== undefined) {
        // go forward one?
        if (prog[unit] > 0.5) {
          s = s.add(1, unit);
        }
        // go to start
        s = s.startOf(unit);
      } else if (s.silent === false) {
        console.warn("no known unit '" + unit + "'");
      }
      return s
    };

    //increment until dates are the same
    const climb = (a, b, unit) => {
      let i = 0;
      a = a.clone();
      while (a.isBefore(b)) {
        //do proper, expensive increment to catch all-the-tricks
        a = a.add(1, unit);
        i += 1;
      }
      //oops, we went too-far..
      if (a.isAfter(b, unit)) {
        i -= 1;
      }
      return i
    };

    // do a thurough +=1 on the unit, until they match
    // for speed-reasons, only used on day, month, week.
    const diffOne = (a, b, unit) => {
      if (a.isBefore(b)) {
        return climb(a, b, unit)
      } else {
        return climb(b, a, unit) * -1 //reverse it
      }
    };

    // don't do anything too fancy here.
    // 2020 - 2019 may be 1 year, or 0 years
    // - '1 year difference' means 366 days during a leap year
    const fastYear = (a, b) => {
      let years = b.year() - a.year();
      // should we decrement it by 1?
      a = a.year(b.year());
      if (a.isAfter(b)) {
        years -= 1;
      }
      return years
    };

    // use a waterfall-method for computing a diff of any 'pre-knowable' units
    // compute years, then compute months, etc..
    // ... then ms-math for any very-small units
    const diff = function (a, b) {
      // an hour is always the same # of milliseconds
      // so these units can be 'pre-calculated'
      let msDiff = b.epoch - a.epoch;
      let obj = {
        milliseconds: msDiff,
        seconds: parseInt(msDiff / 1000, 10)
      };
      obj.minutes = parseInt(obj.seconds / 60, 10);
      obj.hours = parseInt(obj.minutes / 60, 10);

      //do the year
      let tmp = a.clone();
      obj.years = fastYear(tmp, b);
      tmp = a.add(obj.years, 'year');

      //there's always 12 months in a year...
      obj.months = obj.years * 12;
      tmp = a.add(obj.months, 'month');
      obj.months += diffOne(tmp, b, 'month');

      // there's always atleast 52 weeks in a year..
      // (month * 4) isn't as close
      obj.weeks = obj.years * 52;
      tmp = a.add(obj.weeks, 'week');
      obj.weeks += diffOne(tmp, b, 'week');

      // there's always atleast 7 days in a week
      obj.days = obj.weeks * 7;
      tmp = a.add(obj.days, 'day');
      obj.days += diffOne(tmp, b, 'day');

      return obj
    };

    const reverseDiff = function (obj) {
      Object.keys(obj).forEach((k) => {
        obj[k] *= -1;
      });
      return obj
    };

    // this method counts a total # of each unit, between a, b.
    // '1 month' means 28 days in february
    // '1 year' means 366 days in a leap year
    const main = function (a, b, unit) {
      b = beADate(b, a);
      //reverse values, if necessary
      let reversed = false;
      if (a.isAfter(b)) {
        let tmp = a;
        a = b;
        b = tmp;
        reversed = true;
      }
      //compute them all (i know!)
      let obj = diff(a, b);
      if (reversed) {
        obj = reverseDiff(obj);
      }
      //return just the requested unit
      if (unit) {
        //make sure it's plural-form
        unit = normalize$1(unit);
        if (/s$/.test(unit) !== true) {
          unit += 's';
        }
        if (unit === 'dates') {
          unit = 'days';
        }
        return obj[unit]
      }
      return obj
    };

    /*
    ISO 8601 duration format
    // https://en.wikipedia.org/wiki/ISO_8601#Durations
    "P3Y6M4DT12H30M5S"
    P the start of the duration representation.
    Y the number of years.
    M the number of months.
    W the number of weeks.
    D the number of days.
    T of the representation.
    H the number of hours.
    M the number of minutes.
    S the number of seconds.
    */

    const fmt = (n) => Math.abs(n) || 0;

    const toISO = function (diff) {
      let iso = 'P';
      iso += fmt(diff.years) + 'Y';
      iso += fmt(diff.months) + 'M';
      iso += fmt(diff.days) + 'DT';
      iso += fmt(diff.hours) + 'H';
      iso += fmt(diff.minutes) + 'M';
      iso += fmt(diff.seconds) + 'S';
      return iso
    };

    //get number of hours/minutes... between the two dates
    function getDiff(a, b) {
      const isBefore = a.isBefore(b);
      const later = isBefore ? b : a;
      let earlier = isBefore ? a : b;
      earlier = earlier.clone();
      const diff = {
        years: 0,
        months: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
      };
      Object.keys(diff).forEach((unit) => {
        if (earlier.isSame(later, unit)) {
          return
        }
        let max = earlier.diff(later, unit);
        earlier = earlier.add(max, unit);
        diff[unit] = max;
      });
      //reverse it, if necessary
      if (isBefore) {
        Object.keys(diff).forEach((u) => {
          if (diff[u] !== 0) {
            diff[u] *= -1;
          }
        });
      }
      return diff
    }

    //our conceptual 'break-points' for each unit
    const qualifiers = {
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
    };

    // Expects a plural unit arg
    function pluralize(value, unit) {
      if (value === 1) {
        unit = unit.slice(0, -1);
      }
      return value + ' ' + unit
    }

    const toSoft = function (diff) {
      let rounded = null;
      let qualified = null;
      let abbreviated = [];
      let englishValues = [];
      //go through each value and create its text-representation
      Object.keys(diff).forEach((unit, i, units) => {
        const value = Math.abs(diff[unit]);
        if (value === 0) {
          return
        }
        abbreviated.push(value + unit[0]);
        const englishValue = pluralize(value, unit);
        englishValues.push(englishValue);
        if (!rounded) {
          rounded = qualified = englishValue;
          if (i > 4) {
            return
          }
          //is it a 'almost' something, etc?
          const nextUnit = units[i + 1];
          const nextValue = Math.abs(diff[nextUnit]);
          if (nextValue > qualifiers[nextUnit].almost) {
            rounded = pluralize(value + 1, unit);
            qualified = 'almost ' + rounded;
          } else if (nextValue > qualifiers[nextUnit].over) {
            qualified = 'over ' + englishValue;
          }
        }
      });
      return { qualified, rounded, abbreviated, englishValues }
    };

    //by spencermountain + Shaun Grady

    //create the human-readable diff between the two dates
    const since = (start, end) => {
      end = beADate(end, start);
      const diff = getDiff(start, end);
      const isNow = Object.keys(diff).every((u) => !diff[u]);
      if (isNow === true) {
        return {
          diff,
          rounded: 'now',
          qualified: 'now',
          precise: 'now',
          abbreviated: [],
          iso: 'P0Y0M0DT0H0M0S',
          direction: 'present',
        }
      }
      let precise;
      let direction = 'future';

      let { rounded, qualified, englishValues, abbreviated } = toSoft(diff);

      //make them into a string
      precise = englishValues.splice(0, 2).join(', ');
      //handle before/after logic
      if (start.isAfter(end) === true) {
        rounded += ' ago';
        qualified += ' ago';
        precise += ' ago';
        direction = 'past';
      } else {
        rounded = 'in ' + rounded;
        qualified = 'in ' + qualified;
        precise = 'in ' + precise;
      }
      // https://en.wikipedia.org/wiki/ISO_8601#Durations
      // P[n]Y[n]M[n]DT[n]H[n]M[n]S 
      let iso = toISO(diff);
      return {
        diff,
        rounded,
        qualified,
        precise,
        abbreviated,
        iso,
        direction,
      }
    };

    //https://www.timeanddate.com/calendar/aboutseasons.html
    // Spring - from March 1 to May 31;
    // Summer - from June 1 to August 31;
    // Fall (autumn) - from September 1 to November 30; and,
    // Winter - from December 1 to February 28 (February 29 in a leap year).
    const north = [
      ['spring', 2, 1],
      ['summer', 5, 1],
      ['fall', 8, 1],
      ['autumn', 8, 1],
      ['winter', 11, 1] //dec 1
    ];
    const south = [
      ['fall', 2, 1],
      ['autumn', 2, 1],
      ['winter', 5, 1],
      ['spring', 8, 1],
      ['summer', 11, 1] //dec 1
    ];

    var seasons = { north, south };

    var quarters = [
      null,
      [0, 1], //jan 1
      [3, 1], //apr 1
      [6, 1], //july 1
      [9, 1] //oct 1
    ];

    const units$2 = {
      minute: (s) => {
        walkTo(s, {
          second: 0,
          millisecond: 0
        });
        return s
      },
      quarterhour: (s) => {
        let minute = s.minutes();
        if (minute >= 45) {
          s = s.minutes(45);
        } else if (minute >= 30) {
          s = s.minutes(30);
        } else if (minute >= 15) {
          s = s.minutes(15);
        } else {
          s = s.minutes(0);
        }
        walkTo(s, {
          second: 0,
          millisecond: 0
        });
        return s
      },
      hour: (s) => {
        walkTo(s, {
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s
      },
      day: (s) => {
        walkTo(s, {
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s
      },
      week: (s) => {
        let original = s.clone();
        s = s.day(s._weekStart); //monday
        if (s.isAfter(original)) {
          s = s.subtract(1, 'week');
        }
        walkTo(s, {
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s
      },
      month: (s) => {
        walkTo(s, {
          date: 1,
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s
      },
      quarter: (s) => {
        let q = s.quarter();
        if (quarters[q]) {
          walkTo(s, {
            month: quarters[q][0],
            date: quarters[q][1],
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0
          });
        }
        return s
      },
      season: (s) => {
        let current = s.season();
        let hem = 'north';
        if (s.hemisphere() === 'South') {
          hem = 'south';
        }
        for (let i = 0; i < seasons[hem].length; i++) {
          if (seasons[hem][i][0] === current) {
            //winter goes between years
            let year = s.year();
            if (current === 'winter' && s.month() < 3) {
              year -= 1;
            }
            walkTo(s, {
              year,
              month: seasons[hem][i][1],
              date: seasons[hem][i][2],
              hour: 0,
              minute: 0,
              second: 0,
              millisecond: 0
            });
            return s
          }
        }
        return s
      },
      year: (s) => {
        walkTo(s, {
          month: 0,
          date: 1,
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s
      },
      decade: (s) => {
        s = s.startOf('year');
        let year = s.year();
        let decade = parseInt(year / 10, 10) * 10;
        s = s.year(decade);
        return s
      },
      century: (s) => {
        s = s.startOf('year');
        let year = s.year();
        // near 0AD goes '-1 | +1'
        let decade = parseInt(year / 100, 10) * 100;
        s = s.year(decade);
        return s
      }
    };
    units$2.date = units$2.day;

    const startOf = (a, unit) => {
      let s = a.clone();
      unit = normalize$1(unit);
      if (units$2[unit]) {
        return units$2[unit](s)
      }
      if (unit === 'summer' || unit === 'winter') {
        s = s.season(unit);
        return units$2.season(s)
      }
      return s
    };

    //piggy-backs off startOf
    const endOf = (a, unit) => {
      let s = a.clone();
      unit = normalize$1(unit);
      if (units$2[unit]) {
        // go to beginning, go to next one, step back 1ms
        s = units$2[unit](s); // startof
        s = s.add(1, unit);
        s = s.subtract(1, 'millisecond');
        return s
      }
      return s
    };

    //is it 'wednesday'?
    const isDay = function (unit) {
      if (short$1().find((s) => s === unit)) {
        return true
      }
      if (long$1().find((s) => s === unit)) {
        return true
      }
      return false
    };

    // return a list of the weeks/months/days between a -> b
    // returns spacetime objects in the timezone of the input
    const every = function (start, unit, end) {
      if (!unit || !end) {
        return []
      }
      //cleanup unit param
      unit = normalize$1(unit);
      //cleanup to param
      end = start.clone().set(end);
      //swap them, if they're backwards
      if (start.isAfter(end)) {
        let tmp = start;
        start = end;
        end = tmp;
      }

      //support 'every wednesday'
      let d = start.clone();
      if (isDay(unit)) {
        d = d.next(unit);
        unit = 'week';
      } else {
        let first = d.startOf(unit);
        if (first.isBefore(start)) {
          d = d.next(unit);
        }
      }
      //okay, actually start doing it
      let result = [];
      while (d.isBefore(end)) {
        result.push(d);
        d = d.add(1, unit);
      }
      return result
    };

    const parseDst = dst => {
      if (!dst) {
        return []
      }
      return dst.split('->')
    };

    const titleCase$1 = str => {
      str = str[0].toUpperCase() + str.substr(1);
      str = str.replace(/\/gmt/, '/GMT');
      str = str.replace(/[\/_]([a-z])/gi, s => {
        return s.toUpperCase()
      });
      return str
    };

    //get metadata about this timezone
    const timezone = s => {
      let zones = s.timezones;
      let tz = s.tz;
      if (zones.hasOwnProperty(tz) === false) {
        tz = lookupTz(s.tz, zones);
      }
      if (tz === null) {
        if (s.silent === false) {
          console.warn("Warn: could not find given or local timezone - '" + s.tz + "'");
        }
        return {
          current: {
            epochShift: 0
          }
        }
      }
      let found = zones[tz];
      let result = {
        name: titleCase$1(tz),
        hasDst: Boolean(found.dst),
        default_offset: found.offset,
        //do north-hemisphere version as default (sorry!)
        hemisphere: found.hem === 's' ? 'South' : 'North',
        current: {}
      };

      if (result.hasDst) {
        let arr = parseDst(found.dst);
        result.change = {
          start: arr[0],
          back: arr[1]
        };
      }
      //find the offsets for summer/winter times
      //(these variable names are north-centric)
      let summer = found.offset; // (july)
      let winter = summer; // (january) assume it's the same for now
      if (result.hasDst === true) {
        if (result.hemisphere === 'North') {
          winter = summer - 1;
        } else {
          //southern hemisphere
          winter = found.offset + 1;
        }
      }

      //find out which offset to use right now
      //use 'summer' time july-time
      if (result.hasDst === false) {
        result.current.offset = summer;
        result.current.isDST = false;
      } else if (inSummerTime(s.epoch, result.change.start, result.change.back, summer, winter) === true) {
        result.current.offset = summer;
        result.current.isDST = result.hemisphere === 'North'; //dst 'on' in winter in north
      } else {
        //use 'winter' january-time
        result.current.offset = winter;
        result.current.isDST = result.hemisphere === 'South'; //dst 'on' in summer in south
      }
      return result
    };

    const units$3 = [
      'century',
      'decade',
      'year',
      'month',
      'date',
      'day',
      'hour',
      'minute',
      'second',
      'millisecond'
    ];

    //the spacetime instance methods (also, the API)
    const methods = {
      set: function (input, tz) {
        let s = this.clone();
        s = parseInput(s, input);
        if (tz) {
          this.tz = lookupTz(tz);
        }
        return s
      },
      timezone: function () {
        return timezone(this)
      },
      isDST: function () {
        return timezone(this).current.isDST
      },
      hasDST: function () {
        return timezone(this).hasDst
      },
      offset: function () {
        return timezone(this).current.offset * 60
      },
      hemisphere: function () {
        return timezone(this).hemisphere
      },
      format: function (fmt) {
        return printFormat(this, fmt)
      },
      unixFmt: function (fmt) {
        return unixFmt(this, fmt)
      },
      startOf: function (unit) {
        return startOf(this, unit)
      },
      endOf: function (unit) {
        return endOf(this, unit)
      },
      leapYear: function () {
        let year = this.year();
        return isLeapYear$1(year)
      },
      progress: function (unit) {
        return progress(this, unit)
      },
      nearest: function (unit) {
        return nearest(this, unit)
      },
      diff: function (d, unit) {
        return main(this, d, unit)
      },
      since: function (d) {
        if (!d) {
          d = this.clone().set();
        }
        return since(this, d)
      },
      next: function (unit) {
        let s = this.add(1, unit);
        return s.startOf(unit)
      },
      //the start of the previous year/week/century
      last: function (unit) {
        let s = this.subtract(1, unit);
        return s.startOf(unit)
      },
      isValid: function () {
        //null/undefined epochs
        if (!this.epoch && this.epoch !== 0) {
          return false
        }
        return !isNaN(this.d.getTime())
      },
      //travel to this timezone
      goto: function (tz) {
        let s = this.clone();
        s.tz = lookupTz(tz, s.timezones); //science!
        return s
      },
      //get each week/month/day between a -> b
      every: function (unit, to) {
        // allow swapping these params:
        if (typeof unit === 'object' && typeof to === 'string') {
          let tmp = to;
          to = unit;
          unit = tmp;
        }
        return every(this, unit, to)
      },
      isAwake: function () {
        let hour = this.hour();
        //10pm -> 8am
        if (hour < 8 || hour > 22) {
          return false
        }
        return true
      },
      isAsleep: function () {
        return !this.isAwake()
      },
      daysInMonth: function () {
        switch (this.month()) {
          case 0:
            return 31
          case 1:
            return this.leapYear() ? 29 : 28
          case 2:
            return 31
          case 3:
            return 30
          case 4:
            return 31
          case 5:
            return 30
          case 6:
            return 31
          case 7:
            return 31
          case 8:
            return 30
          case 9:
            return 31
          case 10:
            return 30
          case 11:
            return 31
          default:
            throw new Error('Invalid Month state.')
        }
      },
      //pretty-printing
      log: function () {
        console.log('');
        console.log(printFormat(this, 'nice-short'));
        return this
      },
      logYear: function () {
        console.log('');
        console.log(printFormat(this, 'full-short'));
        return this
      },
      json: function () {
        return units$3.reduce((h, unit) => {
          h[unit] = this[unit]();
          return h
        }, {})
      },
      debug: function () {
        let tz = this.timezone();
        let date = this.format('MM') + ' ' + this.format('date-ordinal') + ' ' + this.year();
        date += '\n     - ' + this.format('time');
        console.log('\n\n', date + '\n     - ' + tz.name + ' (' + tz.current.offset + ')');
        return this
      },
      //alias of 'since' but opposite - like moment.js
      from: function (d) {
        d = this.clone().set(d);
        return d.since(this)
      },
      fromNow: function () {
        let d = this.clone().set(Date.now());
        return d.since(this)
      },
      weekStart: function (input) {
        //accept a number directly
        if (typeof input === 'number') {
          this._weekStart = input;
          return this
        }
        if (typeof input === 'string') {
          // accept 'wednesday'
          input = input.toLowerCase().trim();
          let num = short$1().indexOf(input);
          if (num === -1) {
            num = long$1().indexOf(input);
          }
          if (num === -1) {
            num = 1; //go back to default
          }
          this._weekStart = num;
        } else {
          console.warn('Spacetime Error: Cannot understand .weekStart() input:', input);
        }
        return this
      }
    };
    // aliases
    methods.inDST = methods.isDST;
    methods.round = methods.nearest;
    methods.each = methods.every;

    // javascript setX methods like setDate() can't be used because of the local bias

    const validate$1 = (n) => {
      //handle number as a string
      if (typeof n === 'string') {
        n = parseInt(n, 10);
      }
      return n
    };

    const order = ['year', 'month', 'date', 'hour', 'minute', 'second', 'millisecond'];

    //reduce hostile micro-changes when moving dates by millisecond
    const confirm = (s, tmp, unit) => {
      let n = order.indexOf(unit);
      let arr = order.slice(n, order.length);
      for (let i = 0; i < arr.length; i++) {
        let want = tmp[arr[i]]();
        s[arr[i]](want);
      }
      return s
    };

    // allow specifying setter direction
    const fwdBkwd = function (s, old, goFwd, unit) {
      if (goFwd === true && s.isBefore(old)) {
        s = s.add(1, unit);
      } else if (goFwd === false && s.isAfter(old)) {
        s = s.minus(1, unit);
      }
      return s
    };

    const milliseconds = function (s, n) {
      n = validate$1(n);
      let current = s.millisecond();
      let diff = current - n; //milliseconds to shift by
      return s.epoch - diff
    };

    const seconds = function (s, n, goFwd) {
      n = validate$1(n);
      let old = s.clone();
      let diff = s.second() - n;
      let shift = diff * o.second;
      s.epoch = s.epoch - shift;
      s = fwdBkwd(s, old, goFwd, 'minute'); // specify direction
      return s.epoch
    };

    const minutes = function (s, n, goFwd) {
      n = validate$1(n);
      let old = s.clone();
      let diff = s.minute() - n;
      let shift = diff * o.minute;
      s.epoch -= shift;
      confirm(s, old, 'second');
      s = fwdBkwd(s, old, goFwd, 'hour'); // specify direction
      return s.epoch
    };

    const hours = function (s, n, goFwd) {
      n = validate$1(n);
      if (n >= 24) {
        n = 24;
      } else if (n < 0) {
        n = 0;
      }
      let old = s.clone();
      let diff = s.hour() - n;
      let shift = diff * o.hour;
      s.epoch -= shift;
      // oops, did we change the day?
      if (s.date() !== old.date()) {
        s = old.clone();
        if (diff > 1) {
          diff -= 1;
        }
        if (diff < 1) {
          diff += 1;
        }
        shift = diff * o.hour;
        s.epoch -= shift;
      }
      walkTo(s, {
        hour: n
      });
      confirm(s, old, 'minute');
      s = fwdBkwd(s, old, goFwd, 'day'); // specify direction
      return s.epoch
    };

    const time = function (s, str, goFwd) {
      let m = str.match(/([0-9]{1,2})[:h]([0-9]{1,2})(:[0-9]{1,2})? ?(am|pm)?/);
      if (!m) {
        //fallback to support just '2am'
        m = str.match(/([0-9]{1,2}) ?(am|pm)/);
        if (!m) {
          return s.epoch
        }
        m.splice(2, 0, '0'); //add implicit 0 minutes
        m.splice(3, 0, ''); //add implicit seconds
      }
      let h24 = false;
      let hour = parseInt(m[1], 10);
      let minute = parseInt(m[2], 10);
      if (minute >= 60) {
        minute = 59;
      }
      if (hour > 12) {
        h24 = true;
      }
      //make the hour into proper 24h time
      if (h24 === false) {
        if (m[4] === 'am' && hour === 12) {
          //12am is midnight
          hour = 0;
        }
        if (m[4] === 'pm' && hour < 12) {
          //12pm is noon
          hour += 12;
        }
      }
      // handle seconds
      m[3] = m[3] || '';
      m[3] = m[3].replace(/:/, '');
      let sec = parseInt(m[3], 10) || 0;
      let old = s.clone();
      s = s.hour(hour);
      s = s.minute(minute);
      s = s.second(sec);
      s = s.millisecond(0);
      s = fwdBkwd(s, old, goFwd, 'day'); // specify direction
      return s.epoch
    };

    const date = function (s, n, goFwd) {
      n = validate$1(n);
      //avoid setting february 31st
      if (n > 28) {
        let month = s.month();
        let max = monthLengths$1[month];
        // support leap day in february
        if (month === 1 && n === 29 && isLeapYear$1(s.year())) {
          max = 29;
        }
        if (n > max) {
          n = max;
        }
      }
      //avoid setting < 0
      if (n <= 0) {
        n = 1;
      }
      let old = s.clone();
      walkTo(s, {
        date: n
      });
      s = fwdBkwd(s, old, goFwd, 'month'); // specify direction
      return s.epoch
    };

    const month = function (s, n, goFwd) {
      if (typeof n === 'string') {
        n = mapping()[n.toLowerCase()];
      }
      n = validate$1(n);
      //don't go past december
      if (n >= 12) {
        n = 11;
      }
      if (n <= 0) {
        n = 0;
      }

      let d = s.date();
      //there's no 30th of february, etc.
      if (d > monthLengths$1[n]) {
        //make it as close as we can..
        d = monthLengths$1[n];
      }
      let old = s.clone();
      walkTo(s, {
        month: n,
        d
      });
      s = fwdBkwd(s, old, goFwd, 'year'); // specify direction
      return s.epoch
    };

    const year = function (s, n) {
      // support '97
      if (typeof n === 'string' && /^'[0-9]{2}$/.test(n)) {
        n = n.replace(/'/, '').trim();
        n = Number(n);
        // '89 is 1989
        if (n > 30) {
          //change this in 10y
          n = 1900 + n;
        } else {
          // '12 is 2012
          n = 2000 + n;
        }
      }
      n = validate$1(n);
      walkTo(s, {
        year: n
      });
      return s.epoch
    };

    const week = function (s, n, goFwd) {
      let old = s.clone();
      n = validate$1(n);
      s = s.month(0);
      s = s.date(1);
      s = s.day('monday');
      //first week starts first Thurs in Jan
      // so mon dec 28th is 1st week
      // so mon dec 29th is not the week
      if (s.monthName() === 'december' && s.date() >= 28) {
        s = s.add(1, 'week');
      }
      n -= 1; //1-based
      s = s.add(n, 'weeks');
      s = fwdBkwd(s, old, goFwd, 'year'); // specify direction
      return s.epoch
    };

    const dayOfYear = function (s, n, goFwd) {
      n = validate$1(n);
      let old = s.clone();
      n -= 1; //days are 1-based
      if (n <= 0) {
        n = 0;
      } else if (n >= 365) {
        n = 364;
      }
      s = s.startOf('year');
      s = s.add(n, 'day');
      confirm(s, old, 'hour');
      s = fwdBkwd(s, old, goFwd, 'year'); // specify direction
      return s.epoch
    };

    let morning = 'am';
    let evening = 'pm';

    function am() { return morning }
    function pm() { return evening }
    function set$3(i18n) {
        morning = i18n.am || morning;
        evening = i18n.pm || evening;
    }

    const methods$1 = {
      millisecond: function (num) {
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = milliseconds(s, num);
          return s
        }
        return this.d.getMilliseconds()
      },
      second: function (num, goFwd) {
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = seconds(s, num, goFwd);
          return s
        }
        return this.d.getSeconds()
      },
      minute: function (num, goFwd) {
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = minutes(s, num, goFwd);
          return s
        }
        return this.d.getMinutes()
      },
      hour: function (num, goFwd) {
        let d = this.d;
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = hours(s, num, goFwd);
          return s
        }
        return d.getHours()
      },

      //'3:30' is 3.5
      hourFloat: function (num, goFwd) {
        if (num !== undefined) {
          let s = this.clone();
          let minute = num % 1;
          minute = minute * 60;
          let hour = parseInt(num, 10);
          s.epoch = hours(s, hour, goFwd);
          s.epoch = minutes(s, minute, goFwd);
          return s
        }
        let d = this.d;
        let hour = d.getHours();
        let minute = d.getMinutes();
        minute = minute / 60;
        return hour + minute
      },

      // hour in 12h format
      hour12: function (str, goFwd) {
        let d = this.d;
        if (str !== undefined) {
          let s = this.clone();
          str = '' + str;
          let m = str.match(/^([0-9]+)(am|pm)$/);
          if (m) {
            let hour = parseInt(m[1], 10);
            if (m[2] === 'pm') {
              hour += 12;
            }
            s.epoch = hours(s, hour, goFwd);
          }
          return s
        }
        //get the hour
        let hour12 = d.getHours();
        if (hour12 > 12) {
          hour12 = hour12 - 12;
        }
        if (hour12 === 0) {
          hour12 = 12;
        }
        return hour12
      },

      //some ambiguity here with 12/24h
      time: function (str, goFwd) {
        if (str !== undefined) {
          let s = this.clone();
          str = str.toLowerCase().trim();
          s.epoch = time(s, str, goFwd);
          return s
        }
        return `${this.h12()}:${zeroPad(this.minute())}${this.ampm()}`
      },

      // either 'am' or 'pm'
      ampm: function (input, goFwd) {
        // let which = 'am'
        let which = am();
        let hour = this.hour();
        if (hour >= 12) {
          // which = 'pm'
          which = pm();
        }
        if (typeof input !== 'string') {
          return which
        }
        //okay, we're doing a setter
        let s = this.clone();
        input = input.toLowerCase().trim();
        //ampm should never change the day
        // - so use `.hour(n)` instead of `.minus(12,'hour')`
        if (hour >= 12 && input === 'am') {
          //noon is 12pm
          hour -= 12;
          return s.hour(hour, goFwd)
        }
        if (hour < 12 && input === 'pm') {
          hour += 12;
          return s.hour(hour, goFwd)
        }
        return s
      },

      //some hard-coded times of day, like 'noon'
      dayTime: function (str, goFwd) {
        if (str !== undefined) {
          const times = {
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
          let s = this.clone();
          str = str || '';
          str = str.toLowerCase();
          if (times.hasOwnProperty(str) === true) {
            s = s.time(times[str], goFwd);
          }
          return s
        }
        let h = this.hour();
        if (h < 6) {
          return 'night'
        }
        if (h < 12) {
          //until noon
          return 'morning'
        }
        if (h < 17) {
          //until 5pm
          return 'afternoon'
        }
        if (h < 22) {
          //until 10pm
          return 'evening'
        }
        return 'night'
      },

      //parse a proper iso string
      iso: function (num) {
        if (num !== undefined) {
          return this.set(num)
        }
        return this.format('iso')
      }
    };

    const methods$2 = {
      // # day in the month
      date: function (num, goFwd) {
        if (num !== undefined) {
          let s = this.clone();
          num = parseInt(num, 10);
          if (num) {
            s.epoch = date(s, num, goFwd);
          }
          return s
        }
        return this.d.getDate()
      },

      //like 'wednesday' (hard!)
      day: function (input, goFwd) {
        if (input === undefined) {
          return this.d.getDay()
        }
        let original = this.clone();
        let want = input;
        // accept 'wednesday'
        if (typeof input === 'string') {
          input = input.toLowerCase();
          if (aliases.hasOwnProperty(input)) {
            want = aliases[input];
          } else {
            want = short$1().indexOf(input);
            if (want === -1) {
              want = long$1().indexOf(input);
            }
          }
        }
        //move approx
        let day = this.d.getDay();
        let diff = day - want;
        if (goFwd === true && diff > 0) {
          diff = diff - 7;
        }
        if (goFwd === false && diff < 0) {
          diff = diff + 7;
        }
        let s = this.subtract(diff, 'days');
        //tighten it back up
        walkTo(s, {
          hour: original.hour(),
          minute: original.minute(),
          second: original.second()
        });
        return s
      },

      //these are helpful name-wrappers
      dayName: function (input, goFwd) {
        if (input === undefined) {
          return long$1()[this.day()]
        }
        let s = this.clone();
        s = s.day(input, goFwd);
        return s
      }
    };

    const clearMinutes = (s) => {
      s = s.minute(0);
      s = s.second(0);
      s = s.millisecond(1);
      return s
    };

    const methods$3 = {
      // day 0-366
      dayOfYear: function (num, goFwd) {
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = dayOfYear(s, num, goFwd);
          return s
        }
        //days since newyears - jan 1st is 1, jan 2nd is 2...
        let sum = 0;
        let month = this.d.getMonth();
        let tmp;
        //count the num days in each month
        for (let i = 1; i <= month; i++) {
          tmp = new Date();
          tmp.setDate(1);
          tmp.setFullYear(this.d.getFullYear()); //the year matters, because leap-years
          tmp.setHours(1);
          tmp.setMinutes(1);
          tmp.setMonth(i);
          tmp.setHours(-2); //the last day of the month
          sum += tmp.getDate();
        }
        return sum + this.d.getDate()
      },

      //since the start of the year
      week: function (num, goFwd) {
        // week-setter
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = week(this, num, goFwd);
          s = clearMinutes(s);
          return s
        }
        //find-out which week it is
        let tmp = this.clone();
        tmp = tmp.month(0);
        tmp = tmp.date(1);
        tmp = clearMinutes(tmp);
        tmp = tmp.day('monday');
        //don't go into last-year
        if (tmp.monthName() === 'december' && tmp.date() >= 28) {
          tmp = tmp.add(1, 'week');
        }
        // is first monday the 1st?
        let toAdd = 1;
        if (tmp.date() === 1) {
          toAdd = 0;
        }
        tmp = tmp.minus(1, 'second');
        const thisOne = this.epoch;
        //if the week technically hasn't started yet
        if (tmp.epoch > thisOne) {
          return 1
        }
        //speed it up, if we can
        let i = 0;
        let skipWeeks = this.month() * 4;
        tmp.epoch += o.week * skipWeeks;
        i += skipWeeks;
        for (; i <= 52; i++) {
          if (tmp.epoch > thisOne) {
            return i + toAdd
          }
          tmp = tmp.add(1, 'week');
        }
        return 52
      },
      //either name or number
      month: function (input, goFwd) {
        if (input !== undefined) {
          let s = this.clone();
          s.epoch = month(s, input, goFwd);
          return s
        }
        return this.d.getMonth()
      },
      //'january'
      monthName: function (input, goFwd) {
        if (input !== undefined) {
          let s = this.clone();
          s = s.month(input, goFwd);
          return s
        }
        return long()[this.month()]
      },

      //q1, q2, q3, q4
      quarter: function (num, goFwd) {
        if (num !== undefined) {
          if (typeof num === 'string') {
            num = num.replace(/^q/i, '');
            num = parseInt(num, 10);
          }
          if (quarters[num]) {
            let s = this.clone();
            let month = quarters[num][0];
            s = s.month(month, goFwd);
            s = s.date(1, goFwd);
            s = s.startOf('day');
            return s
          }
        }
        let month = this.d.getMonth();
        for (let i = 1; i < quarters.length; i++) {
          if (month < quarters[i][0]) {
            return i - 1
          }
        }
        return 4
      },

      //spring, summer, winter, fall
      season: function (input, goFwd) {
        let hem = 'north';
        if (this.hemisphere() === 'South') {
          hem = 'south';
        }
        if (input !== undefined) {
          let s = this.clone();
          for (let i = 0; i < seasons[hem].length; i++) {
            if (input === seasons[hem][i][0]) {
              s = s.month(seasons[hem][i][1], goFwd);
              s = s.date(1);
              s = s.startOf('day');
            }
          }
          return s
        }
        let month = this.d.getMonth();
        for (let i = 0; i < seasons[hem].length - 1; i++) {
          if (month >= seasons[hem][i][1] && month < seasons[hem][i + 1][1]) {
            return seasons[hem][i][0]
          }
        }
        return 'winter'
      },

      //the year number
      year: function (num) {
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = year(s, num);
          return s
        }
        return this.d.getFullYear()
      },

      //bc/ad years
      era: function (str) {
        if (str !== undefined) {
          let s = this.clone();
          str = str.toLowerCase();
          //TODO: there is no year-0AD i think. may have off-by-1 error here
          let year$1 = s.d.getFullYear();
          //make '1992' into 1992bc..
          if (str === 'bc' && year$1 > 0) {
            s.epoch = year(s, year$1 * -1);
          }
          //make '1992bc' into '1992'
          if (str === 'ad' && year$1 < 0) {
            s.epoch = year(s, year$1 * -1);
          }
          return s
        }
        if (this.d.getFullYear() < 0) {
          return 'BC'
        }
        return 'AD'
      },

      // 2019 -> 2010
      decade: function (input) {
        if (input !== undefined) {
          input = String(input);
          input = input.replace(/([0-9])'?s$/, '$1'); //1950's
          input = input.replace(/([0-9])(th|rd|st|nd)/, '$1'); //fix ordinals
          if (!input) {
            console.warn('Spacetime: Invalid decade input');
            return this
          }
          // assume 20th century?? for '70s'.
          if (input.length === 2 && /[0-9][0-9]/.test(input)) {
            input = '19' + input;
          }
          let year = Number(input);
          if (isNaN(year)) {
            return this
          }
          // round it down to the decade
          year = Math.floor(year / 10) * 10;
          return this.year(year) //.startOf('decade')
        }
        return this.startOf('decade').year()
      },
      // 1950 -> 19+1
      century: function (input) {
        if (input !== undefined) {
          if (typeof input === 'string') {
            input = input.replace(/([0-9])(th|rd|st|nd)/, '$1'); //fix ordinals
            input = input.replace(/([0-9]+) ?(b\.?c\.?|a\.?d\.?)/i, (a, b, c) => {
              if (c.match(/b\.?c\.?/i)) {
                b = '-' + b;
              }
              return b
            });
            input = input.replace(/c$/, ''); //20thC
          }
          let year = Number(input);
          if (isNaN(input)) {
            console.warn('Spacetime: Invalid century input');
            return this
          }
          // there is no century 0
          if (year === 0) {
            year = 1;
          }
          if (year >= 0) {
            year = (year - 1) * 100;
          } else {
            year = (year + 1) * 100;
          }
          return this.year(year)
        }
        // century getter
        let num = this.startOf('century').year();
        num = Math.floor(num / 100);
        if (num < 0) {
          return num - 1
        }
        return num + 1
      },
      // 2019 -> 2+1
      millenium: function (input) {
        if (input !== undefined) {
          if (typeof input === 'string') {
            input = input.replace(/([0-9])(th|rd|st|nd)/, '$1'); //fix ordinals
            input = Number(input);
            if (isNaN(input)) {
              console.warn('Spacetime: Invalid millenium input');
              return this
            }
          }
          if (input > 0) {
            input -= 1;
          }
          let year = input * 1000;
          // there is no year 0
          if (year === 0) {
            year = 1;
          }
          return this.year(year)
        }
        // get the current millenium
        let num = Math.floor(this.year() / 1000);
        if (num >= 0) {
          num += 1;
        }
        return num
      }
    };

    const methods$4 = Object.assign({}, methods$1, methods$2, methods$3);

    //aliases
    methods$4.milliseconds = methods$4.millisecond;
    methods$4.seconds = methods$4.second;
    methods$4.minutes = methods$4.minute;
    methods$4.hours = methods$4.hour;
    methods$4.hour24 = methods$4.hour;
    methods$4.h12 = methods$4.hour12;
    methods$4.h24 = methods$4.hour24;
    methods$4.days = methods$4.day;

    const addMethods = Space => {
      //hook the methods into prototype
      Object.keys(methods$4).forEach(k => {
        Space.prototype[k] = methods$4[k];
      });
    };

    const getMonthLength = function (month, year) {
      if (month === 1 && isLeapYear$1(year)) {
        return 29
      }
      return monthLengths$1[month]
    };

    //month is the one thing we 'model/compute'
    //- because ms-shifting can be off by enough
    const rollMonth = (want, old) => {
      //increment year
      if (want.month > 0) {
        let years = parseInt(want.month / 12, 10);
        want.year = old.year() + years;
        want.month = want.month % 12;
      } else if (want.month < 0) {
        let m = Math.abs(want.month);
        let years = parseInt(m / 12, 10);
        if (m % 12 !== 0) {
          years += 1;
        }
        want.year = old.year() - years;
        //ignore extras
        want.month = want.month % 12;
        want.month = want.month + 12;
        if (want.month === 12) {
          want.month = 0;
        }
      }
      return want
    };

    // briefly support day=-2 (this does not need to be perfect.)
    const rollDaysDown = (want, old, sum) => {
      want.year = old.year();
      want.month = old.month();
      let date = old.date();
      want.date = date - Math.abs(sum);
      while (want.date < 1) {
        want.month -= 1;
        if (want.month < 0) {
          want.month = 11;
          want.year -= 1;
        }
        let max = getMonthLength(want.month, want.year);
        want.date += max;
      }
      return want
    };

    // briefly support day=33 (this does not need to be perfect.)
    const rollDaysUp = (want, old, sum) => {
      let year = old.year();
      let month = old.month();
      let max = getMonthLength(month, year);
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
      return want
    };

    const months$2 = rollMonth;
    const days$1 = rollDaysUp;
    const daysBack = rollDaysDown;

    // this logic is a bit of a mess,
    // but briefly:
    // millisecond-math, and some post-processing covers most-things
    // we 'model' the calendar here only a little bit
    // and that usually works-out...

    const order$1 = ['millisecond', 'second', 'minute', 'hour', 'date', 'month'];
    let keep = {
      second: order$1.slice(0, 1),
      minute: order$1.slice(0, 2),
      quarterhour: order$1.slice(0, 2),
      hour: order$1.slice(0, 3),
      date: order$1.slice(0, 4),
      month: order$1.slice(0, 4),
      quarter: order$1.slice(0, 4),
      season: order$1.slice(0, 4),
      year: order$1,
      decade: order$1,
      century: order$1
    };
    keep.week = keep.hour;
    keep.season = keep.date;
    keep.quarter = keep.date;

    // Units need to be dst adjuested
    const dstAwareUnits = {
      year: true,
      quarter: true,
      season: true,
      month: true,
      week: true,
      date: true
    };

    const keepDate = {
      month: true,
      quarter: true,
      season: true,
      year: true
    };

    const addMethods$1 = (SpaceTime) => {
      SpaceTime.prototype.add = function (num, unit) {
        let s = this.clone();

        if (!unit || num === 0) {
          return s //don't bother
        }
        let old = this.clone();
        unit = normalize$1(unit);
        if (unit === 'millisecond') {
          s.epoch += num;
          return s
        }
        // support 'fortnight' alias
        if (unit === 'fortnight') {
          num *= 2;
          unit = 'week';
        }
        //move forward by the estimated milliseconds (rough)
        if (o[unit]) {
          s.epoch += o[unit] * num;
        } else if (unit === 'week' || unit === 'weekend') {
          s.epoch += o.day * (num * 7);
        } else if (unit === 'quarter' || unit === 'season') {
          s.epoch += o.month * (num * 3);
        } else if (unit === 'quarterhour') {
          s.epoch += o.minute * 15 * num;
        }
        //now ensure our milliseconds/etc are in-line
        let want = {};
        if (keep[unit]) {
          keep[unit].forEach((u) => {
            want[u] = old[u]();
          });
        }

        if (dstAwareUnits[unit]) {
          const diff = old.timezone().current.offset - s.timezone().current.offset;
          s.epoch += diff * 3600 * 1000;
        }

        //ensure month/year has ticked-over
        if (unit === 'month') {
          want.month = old.month() + num;
          //month is the one unit we 'model' directly
          want = months$2(want, old);
        }
        //support coercing a week, too
        if (unit === 'week') {
          let sum = old.date() + num * 7;
          if (sum <= 28 && sum > 1) {
            want.date = sum;
          }
        }
        if (unit === 'weekend' && s.dayName() !== 'saturday') {
          s = s.day('saturday', true); //ensure it's saturday
        }
        //support 25-hour day-changes on dst-changes
        else if (unit === 'date') {
          if (num < 0) {
            want = daysBack(want, old, num);
          } else {
            //specify a naive date number, if it's easy to do...
            let sum = old.date() + num;
            // ok, model this one too
            want = days$1(want, old, sum);
          }
          //manually punt it if we haven't moved at all..
          if (num !== 0 && old.isSame(s, 'day')) {
            want.date = old.date() + num;
          }
        }
        // ensure a quarter is 3 months over
        else if (unit === 'quarter') {
          want.month = old.month() + num * 3;
          want.year = old.year();
          // handle rollover
          if (want.month < 0) {
            let years = Math.floor(want.month / 12);
            let remainder = want.month + Math.abs(years) * 12;
            want.month = remainder;
            want.year += years;
          } else if (want.month >= 12) {
            let years = Math.floor(want.month / 12);
            want.month = want.month % 12;
            want.year += years;
          }
          want.date = old.date();
        }
        //ensure year has changed (leap-years)
        else if (unit === 'year') {
          let wantYear = old.year() + num;
          let haveYear = s.year();
          if (haveYear < wantYear) {
            let toAdd = Math.floor(num / 4) || 1; //approx num of leap-days
            s.epoch += Math.abs(o.day * toAdd);
          } else if (haveYear > wantYear) {
            let toAdd = Math.floor(num / 4) || 1; //approx num of leap-days
            s.epoch += o.day * toAdd;
          }
        }
        //these are easier
        else if (unit === 'decade') {
          want.year = s.year() + 10;
        } else if (unit === 'century') {
          want.year = s.year() + 100;
        }
        //keep current date, unless the month doesn't have it.
        if (keepDate[unit]) {
          let max = monthLengths$1[want.month];
          want.date = old.date();
          if (want.date > max) {
            want.date = max;
          }
        }
        if (Object.keys(want).length > 1) {
          walkTo(s, want);
        }
        return s
      };

      //subtract is only add *-1
      SpaceTime.prototype.subtract = function (num, unit) {
        let s = this.clone();
        return s.add(num * -1, unit)
      };
      //add aliases
      SpaceTime.prototype.minus = SpaceTime.prototype.subtract;
      SpaceTime.prototype.plus = SpaceTime.prototype.add;
    };

    //make a string, for easy comparison between dates
    const print = {
      millisecond: (s) => {
        return s.epoch
      },
      second: (s) => {
        return [s.year(), s.month(), s.date(), s.hour(), s.minute(), s.second()].join('-')
      },
      minute: (s) => {
        return [s.year(), s.month(), s.date(), s.hour(), s.minute()].join('-')
      },
      hour: (s) => {
        return [s.year(), s.month(), s.date(), s.hour()].join('-')
      },
      day: (s) => {
        return [s.year(), s.month(), s.date()].join('-')
      },
      week: (s) => {
        return [s.year(), s.week()].join('-')
      },
      month: (s) => {
        return [s.year(), s.month()].join('-')
      },
      quarter: (s) => {
        return [s.year(), s.quarter()].join('-')
      },
      year: (s) => {
        return s.year()
      }
    };
    print.date = print.day;

    const addMethods$2 = (SpaceTime) => {
      SpaceTime.prototype.isSame = function (b, unit, tzAware = true) {
        let a = this;
        if (!unit) {
          return null
        }
        // support swapped params
        if (typeof b === 'string' && typeof unit === 'object') {
          let tmp = b;
          b = unit;
          unit = tmp;
        }
        if (typeof b === 'string' || typeof b === 'number') {
          b = new SpaceTime(b, this.timezone.name);
        }
        //support 'seconds' aswell as 'second'
        unit = unit.replace(/s$/, '');

        // make them the same timezone for proper comparison
        if (tzAware === true && a.tz !== b.tz) {
          b = b.clone();
          b.tz = a.tz;
        }
        if (print[unit]) {
          return print[unit](a) === print[unit](b)
        }
        return null
      };
    };

    const addMethods$3 = SpaceTime => {
      const methods = {
        isAfter: function (d) {
          d = beADate(d, this);
          let epoch = getEpoch(d);
          if (epoch === null) {
            return null
          }
          return this.epoch > epoch
        },
        isBefore: function (d) {
          d = beADate(d, this);
          let epoch = getEpoch(d);
          if (epoch === null) {
            return null
          }
          return this.epoch < epoch
        },
        isEqual: function (d) {
          d = beADate(d, this);
          let epoch = getEpoch(d);
          if (epoch === null) {
            return null
          }
          return this.epoch === epoch
        },
        isBetween: function (start, end, isInclusive = false) {
          start = beADate(start, this);
          end = beADate(end, this);
          let startEpoch = getEpoch(start);
          if (startEpoch === null) {
            return null
          }
          let endEpoch = getEpoch(end);
          if (endEpoch === null) {
            return null
          }
          if (isInclusive) {
            return this.isBetween(start, end) || this.isEqual(start) || this.isEqual(end);
          }
          return startEpoch < this.epoch && this.epoch < endEpoch
        }
      };

      //hook them into proto
      Object.keys(methods).forEach(k => {
        SpaceTime.prototype[k] = methods[k];
      });
    };

    const addMethods$4 = SpaceTime => {
      const methods = {
        i18n: data => {
          //change the day names
          if (isObject(data.days)) {
            set$1(data.days);
          }
          //change the month names
          if (isObject(data.months)) {
            set(data.months);
          }

          // change the the display style of the month / day names
          if (isBoolean(data.useTitleCase)) {
            set$2(data.useTitleCase);
          }

          //change am and pm strings
          if (isObject(data.ampm)) {
            set$3(data.ampm);
          }
        }
      };

      //hook them into proto
      Object.keys(methods).forEach(k => {
        SpaceTime.prototype[k] = methods[k];
      });
    };

    let timezones = all;
    //fake timezone-support, for fakers (es5 class)
    const SpaceTime = function (input, tz, options = {}) {
      //the holy moment
      this.epoch = null;
      //the shift for the given timezone
      this.tz = lookupTz(tz, timezones);
      //whether to output warnings to console
      this.silent = typeof options.silent !== 'undefined' ? options.silent : true;
      // favour british interpretation of 02/02/2018, etc
      this.british = options.dmy || options.british;

      //does the week start on sunday, or monday:
      this._weekStart = 1; //default to monday
      if (options.weekStart !== undefined) {
        this._weekStart = options.weekStart;
      }
      // the reference today date object, (for testing)
      this._today = {};
      if (options.today !== undefined) {
        this._today = options.today;
      }
      // dunno if this is a good idea, or not
      // Object.defineProperty(this, 'parsers', {
      //   enumerable: false,
      //   writable: true,
      //   value: parsers
      // })
      //add getter/setters
      Object.defineProperty(this, 'd', {
        //return a js date object
        get: function () {
          let offset = quickOffset(this);
          //every computer is somewhere- get this computer's built-in offset
          let bias = new Date(this.epoch).getTimezoneOffset() || 0;
          //movement
          let shift = bias + offset * 60; //in minutes
          shift = shift * 60 * 1000; //in ms
          //remove this computer's offset
          let epoch = this.epoch + shift;
          let d = new Date(epoch);
          return d
        }
      });
      //add this data on the object, to allow adding new timezones
      Object.defineProperty(this, 'timezones', {
        get: () => timezones,
        set: (obj) => {
          timezones = obj;
          return obj
        }
      });
      //parse the various formats
      let tmp = parseInput(this, input);
      this.epoch = tmp.epoch;
    };

    //(add instance methods to prototype)
    Object.keys(methods).forEach((k) => {
      SpaceTime.prototype[k] = methods[k];
    });

    // ¯\_(ツ)_/¯
    SpaceTime.prototype.clone = function () {
      return new SpaceTime(this.epoch, this.tz, {
        silent: this.silent,
        weekStart: this._weekStart,
        today: this._today,
        parsers: this.parsers
      })
    };

    /**
     * @deprecated use toNativeDate()
     * @returns native date object at the same epoch
     */
    SpaceTime.prototype.toLocalDate = function () {
      return this.toNativeDate()
    };

    /**
     * @returns native date object at the same epoch
     */
    SpaceTime.prototype.toNativeDate = function () {
      return new Date(this.epoch)
    };

    //append more methods
    addMethods(SpaceTime);
    addMethods$1(SpaceTime);
    addMethods$2(SpaceTime);
    addMethods$3(SpaceTime);
    addMethods$4(SpaceTime);

    // const timezones = require('../data');

    const whereIts = (a, b) => {
      let start = new SpaceTime(null);
      let end = new SpaceTime(null);
      start = start.time(a);
      //if b is undefined, use as 'within one hour'
      if (b) {
        end = end.time(b);
      } else {
        end = start.add(59, 'minutes');
      }

      let startHour = start.hour();
      let endHour = end.hour();
      let tzs = Object.keys(start.timezones).filter((tz) => {
        if (tz.indexOf('/') === -1) {
          return false
        }
        let m = new SpaceTime(null, tz);
        let hour = m.hour();
        //do 'calendar-compare' not real-time-compare
        if (hour >= startHour && hour <= endHour) {
          //test minutes too, if applicable
          if (hour === startHour && m.minute() < start.minute()) {
            return false
          }
          if (hour === endHour && m.minute() > end.minute()) {
            return false
          }
          return true
        }
        return false
      });
      return tzs
    };

    var version = '7.1.2';

    const main$1 = (input, tz, options) => new SpaceTime(input, tz, options);

    // set all properties of a given 'today' object
    const setToday = function (s) {
      let today = s._today || {};
      Object.keys(today).forEach((k) => {
        s = s[k](today[k]);
      });
      return s
    };

    //some helper functions on the main method
    main$1.now = (tz, options) => {
      let s = new SpaceTime(new Date().getTime(), tz, options);
      s = setToday(s);
      return s
    };
    main$1.today = (tz, options) => {
      let s = new SpaceTime(new Date().getTime(), tz, options);
      s = setToday(s);
      return s.startOf('day')
    };
    main$1.tomorrow = (tz, options) => {
      let s = new SpaceTime(new Date().getTime(), tz, options);
      s = setToday(s);
      return s.add(1, 'day').startOf('day')
    };
    main$1.yesterday = (tz, options) => {
      let s = new SpaceTime(new Date().getTime(), tz, options);
      s = setToday(s);
      return s.subtract(1, 'day').startOf('day')
    };
    main$1.extend = function (obj = {}) {
      Object.keys(obj).forEach((k) => {
        SpaceTime.prototype[k] = obj[k];
      });
      return this
    };
    main$1.timezones = function () {
      let s = new SpaceTime();
      return s.timezones
    };
    main$1.max = function (tz, options) {
      let s = new SpaceTime(null, tz, options);
      s.epoch = 8640000000000000;
      return s
    };
    main$1.min = function (tz, options) {
      let s = new SpaceTime(null, tz, options);
      s.epoch = -8640000000000000;
      return s
    };

    //find tz by time
    main$1.whereIts = whereIts;
    main$1.version = version;

    //aliases:
    main$1.plugin = main$1.extend;

    /* 2023/timezone-offsets/Post.svelte generated by Svelte v3.29.0 */
    const file$2 = "2023/timezone-offsets/Post.svelte";

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-1d8yzxj-style";
    	style.textContent = ".name.svelte-1d8yzxj{width:150px}.container.svelte-1d8yzxj{display:flex;flex-direction:column}.rightSide.svelte-1d8yzxj{justify-content:flex-end;display:flex;margin-right:3rem;align-items:center}.hr.svelte-1d8yzxj{font-size:1.5rem}.year.svelte-1d8yzxj{font-size:1.5rem;margin:1rem;width:180px}input.svelte-1d8yzxj{font-size:1.4rem;height:40px;margin:0.5rem}.box.svelte-1d8yzxj{margin:3rem;margin-top:1rem;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2);border-radius:5px;padding:3rem}.dot.svelte-1d8yzxj{width:20px;height:20px;background-color:steelblue;border-radius:50%;position:absolute;top:0px}.track.svelte-1d8yzxj{height:3px;top:9px;border-radius:3px;box-shadow:1px 1px 8px 0px rgba(0, 0, 0, 0.1);position:absolute;background-color:lightgrey;width:100%}.end.svelte-1d8yzxj{background-color:#d6e0ec}.inside.svelte-1d8yzxj{height:20px;position:absolute;margin-left:10px;top:0px;background-color:#d6e0ec}.line.svelte-1d8yzxj{z-index:3;position:relative;flex-grow:1;margin-top:0.25rem;margin-bottom:0.25rem;height:20px}.col.svelte-1d8yzxj{display:flex;flex-direction:column;justify-content:stretch;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch}.row.svelte-1d8yzxj{display:flex;flex-direction:row;justify-content:space-around;align-items:center;text-align:center;flex-wrap:nowrap;align-self:stretch}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCB7IEhlYWQsIEZvb3QgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2luZGV4Lm1qcydcbiAgaW1wb3J0IGdldFllYXIgZnJvbSAnLi9saWIvYnVpbGQuanMnXG4gIGltcG9ydCBzcGFjZXRpbWUgZnJvbSAnc3BhY2V0aW1lJ1xuXG4gIGxldCBzID0gc3BhY2V0aW1lLm5vdygpLnN0YXJ0T2YoJ3llYXInKVxuXG4gICQ6IGRvdHMgPSBnZXRZZWFyKHMueWVhcigpKVxuXG4gIC8vYSB2ZXJ5LXRpbnkgbGluZWFyIHNjYWxlXG4gIGNvbnN0IHNjYWxlTGluZWFyID0gZnVuY3Rpb24gKG9iaikge1xuICAgIGxldCB3b3JsZCA9IG9iai53b3JsZCB8fCBbXVxuICAgIGxldCBtaW5tYXggPSBvYmoubWlubWF4IHx8IG9iai5taW5NYXggfHwgW11cbiAgICBjb25zdCBjYWxjID0gKG51bSkgPT4ge1xuICAgICAgbGV0IHJhbmdlID0gbWlubWF4WzFdIC0gbWlubWF4WzBdXG4gICAgICBsZXQgcGVyY2VudCA9IChudW0gLSBtaW5tYXhbMF0pIC8gcmFuZ2VcbiAgICAgIGxldCBzaXplID0gd29ybGRbMV0gLSB3b3JsZFswXVxuICAgICAgcmV0dXJuIHBhcnNlSW50KHNpemUgKiBwZXJjZW50LCAxMClcbiAgICB9XG5cbiAgICByZXR1cm4gY2FsY1xuICB9XG5cbiAgJDogc2NhbGUgPSBzY2FsZUxpbmVhcih7XG4gICAgd29ybGQ6IFswLCAxMDBdLFxuICAgIG1pbk1heDogWy0xNCwgMTRdLFxuICB9KVxuICBsZXQgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgcyA9IHMuYWRkKDEwLCAnZGF5cycpXG4gIH0sIDUwMClcbiAgY29uc3QgcGF1c2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKGludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKGludGVydmFsKVxuICAgICAgaW50ZXJ2YWwgPSBudWxsXG4gICAgfSBlbHNlIHtcbiAgICAgIGludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBzID0gcy5hZGQoMTAsICdkYXlzJylcbiAgICAgIH0sIDIwMClcbiAgICB9XG4gIH1cbiAgY29uc3QgcmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcyA9IHNwYWNldGltZS5ub3coKS5zdGFydE9mKCd5ZWFyJylcbiAgfVxuICBsZXQgdGl0bGUgPSAnVGltZXpvbmUgb2Zmc2V0cyBieSBkYXRlJ1xuPC9zY3JpcHQ+XG5cbjxkaXYgY2xhc3M9XCJwYWdlXCI+XG4gIDxIZWFkIHt0aXRsZX0gc3ViPVwiXCIgLz5cbiAgPGRpdiBjbGFzcz1cIm1pZFwiPlxuICAgIDxkaXYgY2xhc3M9XCJzaGFkb3cgY29udGFpbmVyXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwicmlnaHRTaWRlXCI+XG4gICAgICAgIDxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgdmFsdWU9XCLwn5SZXCIgb246Y2xpY2s9e3Jlc2V0fSAvPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInllYXJcIj57cy5mb3JtYXQoJ3ttb250aC1zaG9ydH0ge2RhdGUtb3JkaW5hbH0ge3llYXJ9Jyl9PC9zcGFuPlxuICAgICAgICA8aW5wdXQgdHlwZT1cImJ1dHRvblwiIHZhbHVlPVwi4o+477iPXCIgb246Y2xpY2s9e3BhdXNlfSAvPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiY29sIGJveFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwicm93XCIgc3R5bGU9XCJ3aWR0aDoxMDAlOyBtYXJnaW4tYm90dG9tOjNyZW07XCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm5hbWVcIiAvPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJsaW5lXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaHJcIiBzdHlsZT1cInBvc2l0aW9uOmFic29sdXRlOyBsZWZ0Oi01JVwiPi0xNGg8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoclwiIHN0eWxlPVwicG9zaXRpb246YWJzb2x1dGU7IGxlZnQ6OTUlXCI+KzE0aDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgeyNlYWNoIGRvdHMgYXMgZG90LCBpfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJyb3dcIiBzdHlsZT1cIndpZHRoOjEwMCU7XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibmFtZVwiPntkb3QubmFtZX08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJsaW5lXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0cmFja1wiIC8+XG4gICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICBjbGFzcz1cImluc2lkZVwiXG4gICAgICAgICAgICAgICAgdGl0bGU9e2RvdC5uYW1lfVxuICAgICAgICAgICAgICAgIHN0eWxlPVwibGVmdDp7c2NhbGUoZG90LnN0YXJ0Lm9mZnNldCl9JTsgd2lkdGg6e3NjYWxlKGRvdC5lbmQub2Zmc2V0KSAtXG4gICAgICAgICAgICAgICAgICBzY2FsZShkb3Quc3RhcnQub2Zmc2V0KX0lXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImRvdCBlbmRcIiB0aXRsZT17ZG90Lm5hbWV9IHN0eWxlPVwibGVmdDp7c2NhbGUoZG90LnN0YXJ0Lm9mZnNldCl9JTtcIiAvPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZG90IGVuZFwiIHRpdGxlPXtkb3QubmFtZX0gc3R5bGU9XCJsZWZ0OntzY2FsZShkb3QuZW5kLm9mZnNldCl9JTtcIiAvPlxuICAgICAgICAgICAgICB7I2lmIHMuZXBvY2ggPD0gZG90LnN0YXJ0LmVwb2NofVxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJkb3RcIiB0aXRsZT17ZG90Lm5hbWV9IHN0eWxlPVwibGVmdDp7c2NhbGUoZG90LnN0YXJ0Lm9mZnNldCl9JTtcIiAvPlxuICAgICAgICAgICAgICB7OmVsc2V9XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImRvdFwiIHRpdGxlPXtkb3QubmFtZX0gc3R5bGU9XCJsZWZ0OntzY2FsZShkb3QuZW5kLm9mZnNldCl9JTtcIiAvPlxuICAgICAgICAgICAgICB7L2lmfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIHsvZWFjaH1cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxGb290IHt0aXRsZX0geWVhcj1cIjIwMjNcIiAvPlxuICA8L2Rpdj5cbjwvZGl2PlxuXG48c3R5bGU+XG4gIC5uYW1lIHtcbiAgICB3aWR0aDogMTUwcHg7XG4gIH1cbiAgLmNvbnRhaW5lciB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICB9XG4gIC5yaWdodFNpZGUge1xuICAgIGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBtYXJnaW4tcmlnaHQ6IDNyZW07XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgfVxuICAuaHIge1xuICAgIGZvbnQtc2l6ZTogMS41cmVtO1xuICB9XG4gIC55ZWFyIHtcbiAgICBmb250LXNpemU6IDEuNXJlbTtcbiAgICBtYXJnaW46IDFyZW07XG4gICAgd2lkdGg6IDE4MHB4O1xuICB9XG4gIGlucHV0IHtcbiAgICBmb250LXNpemU6IDEuNHJlbTtcbiAgICBoZWlnaHQ6IDQwcHg7XG4gICAgbWFyZ2luOiAwLjVyZW07XG4gIH1cbiAgLmJveCB7XG4gICAgbWFyZ2luOiAzcmVtO1xuICAgIG1hcmdpbi10b3A6IDFyZW07XG4gICAgLyogYm9yZGVyOiAxcHggc29saWQgZ3JleTsgKi9cbiAgICBib3gtc2hhZG93OiAycHggMnB4IDhweCAwcHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIGJvcmRlci1yYWRpdXM6IDVweDtcbiAgICBwYWRkaW5nOiAzcmVtO1xuICB9XG4gIC5kb3Qge1xuICAgIHdpZHRoOiAyMHB4O1xuICAgIGhlaWdodDogMjBweDtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiBzdGVlbGJsdWU7XG4gICAgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICB0b3A6IDBweDtcbiAgfVxuICAudHJhY2sge1xuICAgIGhlaWdodDogM3B4O1xuICAgIHRvcDogOXB4O1xuICAgIGJvcmRlci1yYWRpdXM6IDNweDtcbiAgICBib3gtc2hhZG93OiAxcHggMXB4IDhweCAwcHggcmdiYSgwLCAwLCAwLCAwLjEpO1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiBsaWdodGdyZXk7XG4gICAgd2lkdGg6IDEwMCU7XG4gIH1cbiAgLmVuZCB7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogI2Q2ZTBlYztcbiAgfVxuICAuaW5zaWRlIHtcbiAgICBoZWlnaHQ6IDIwcHg7XG4gICAgLyogYmFja2dyb3VuZC1jb2xvcjogI2Y2ZjRlOTsgKi9cbiAgICAvKiBvcGFjaXR5OiAwLjU7ICovXG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIG1hcmdpbi1sZWZ0OiAxMHB4O1xuICAgIHRvcDogMHB4O1xuICAgIGJhY2tncm91bmQtY29sb3I6ICNkNmUwZWM7XG4gIH1cbiAgLmxpbmUge1xuICAgIC8qIGJhY2tncm91bmQtY29sb3I6ICNkN2Q1ZDI7ICovXG4gICAgei1pbmRleDogMztcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgLyogd2lkdGg6IDEwMCU7ICovXG4gICAgZmxleC1ncm93OiAxO1xuICAgIG1hcmdpbi10b3A6IDAuMjVyZW07XG4gICAgbWFyZ2luLWJvdHRvbTogMC4yNXJlbTtcbiAgICBoZWlnaHQ6IDIwcHg7XG4gIH1cbiAgLmNvbCB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgIGp1c3RpZnktY29udGVudDogc3RyZXRjaDtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgYWxpZ24tc2VsZjogc3RyZXRjaDtcbiAgfVxuICAucm93IHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1hcm91bmQ7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgZmxleC13cmFwOiBub3dyYXA7XG4gICAgYWxpZ24tc2VsZjogc3RyZXRjaDtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUEyRkUsS0FBSyxlQUFDLENBQUMsQUFDTCxLQUFLLENBQUUsS0FBSyxBQUNkLENBQUMsQUFDRCxVQUFVLGVBQUMsQ0FBQyxBQUNWLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLE1BQU0sQUFDeEIsQ0FBQyxBQUNELFVBQVUsZUFBQyxDQUFDLEFBQ1YsZUFBZSxDQUFFLFFBQVEsQ0FDekIsT0FBTyxDQUFFLElBQUksQ0FDYixZQUFZLENBQUUsSUFBSSxDQUNsQixXQUFXLENBQUUsTUFBTSxBQUNyQixDQUFDLEFBQ0QsR0FBRyxlQUFDLENBQUMsQUFDSCxTQUFTLENBQUUsTUFBTSxBQUNuQixDQUFDLEFBQ0QsS0FBSyxlQUFDLENBQUMsQUFDTCxTQUFTLENBQUUsTUFBTSxDQUNqQixNQUFNLENBQUUsSUFBSSxDQUNaLEtBQUssQ0FBRSxLQUFLLEFBQ2QsQ0FBQyxBQUNELEtBQUssZUFBQyxDQUFDLEFBQ0wsU0FBUyxDQUFFLE1BQU0sQ0FDakIsTUFBTSxDQUFFLElBQUksQ0FDWixNQUFNLENBQUUsTUFBTSxBQUNoQixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixNQUFNLENBQUUsSUFBSSxDQUNaLFVBQVUsQ0FBRSxJQUFJLENBRWhCLFVBQVUsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FDOUMsYUFBYSxDQUFFLEdBQUcsQ0FDbEIsT0FBTyxDQUFFLElBQUksQUFDZixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixLQUFLLENBQUUsSUFBSSxDQUNYLE1BQU0sQ0FBRSxJQUFJLENBQ1osZ0JBQWdCLENBQUUsU0FBUyxDQUMzQixhQUFhLENBQUUsR0FBRyxDQUNsQixRQUFRLENBQUUsUUFBUSxDQUNsQixHQUFHLENBQUUsR0FBRyxBQUNWLENBQUMsQUFDRCxNQUFNLGVBQUMsQ0FBQyxBQUNOLE1BQU0sQ0FBRSxHQUFHLENBQ1gsR0FBRyxDQUFFLEdBQUcsQ0FDUixhQUFhLENBQUUsR0FBRyxDQUNsQixVQUFVLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQzlDLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLGdCQUFnQixDQUFFLFNBQVMsQ0FDM0IsS0FBSyxDQUFFLElBQUksQUFDYixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixnQkFBZ0IsQ0FBRSxPQUFPLEFBQzNCLENBQUMsQUFDRCxPQUFPLGVBQUMsQ0FBQyxBQUNQLE1BQU0sQ0FBRSxJQUFJLENBR1osUUFBUSxDQUFFLFFBQVEsQ0FDbEIsV0FBVyxDQUFFLElBQUksQ0FDakIsR0FBRyxDQUFFLEdBQUcsQ0FDUixnQkFBZ0IsQ0FBRSxPQUFPLEFBQzNCLENBQUMsQUFDRCxLQUFLLGVBQUMsQ0FBQyxBQUVMLE9BQU8sQ0FBRSxDQUFDLENBQ1YsUUFBUSxDQUFFLFFBQVEsQ0FFbEIsU0FBUyxDQUFFLENBQUMsQ0FDWixVQUFVLENBQUUsT0FBTyxDQUNuQixhQUFhLENBQUUsT0FBTyxDQUN0QixNQUFNLENBQUUsSUFBSSxBQUNkLENBQUMsQUFDRCxJQUFJLGVBQUMsQ0FBQyxBQUNKLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLE1BQU0sQ0FDdEIsZUFBZSxDQUFFLE9BQU8sQ0FDeEIsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsVUFBVSxDQUFFLE1BQU0sQ0FDbEIsU0FBUyxDQUFFLElBQUksQ0FDZixVQUFVLENBQUUsT0FBTyxBQUNyQixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxZQUFZLENBQzdCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLFNBQVMsQ0FBRSxNQUFNLENBQ2pCLFVBQVUsQ0FBRSxPQUFPLEFBQ3JCLENBQUMifQ== */";
    	append_dev(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	child_ctx[10] = i;
    	return child_ctx;
    }

    // (79:14) {:else}
    function create_else_block(ctx) {
    	let div;
    	let div_title_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "dot svelte-1d8yzxj");
    			attr_dev(div, "title", div_title_value = /*dot*/ ctx[8].name);
    			set_style(div, "left", /*scale*/ ctx[2](/*dot*/ ctx[8].end.offset) + "%");
    			add_location(div, file$2, 79, 16, 2544);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*dots*/ 2 && div_title_value !== (div_title_value = /*dot*/ ctx[8].name)) {
    				attr_dev(div, "title", div_title_value);
    			}

    			if (dirty & /*scale, dots*/ 6) {
    				set_style(div, "left", /*scale*/ ctx[2](/*dot*/ ctx[8].end.offset) + "%");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(79:14) {:else}",
    		ctx
    	});

    	return block;
    }

    // (77:14) {#if s.epoch <= dot.start.epoch}
    function create_if_block(ctx) {
    	let div;
    	let div_title_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "dot svelte-1d8yzxj");
    			attr_dev(div, "title", div_title_value = /*dot*/ ctx[8].name);
    			set_style(div, "left", /*scale*/ ctx[2](/*dot*/ ctx[8].start.offset) + "%");
    			add_location(div, file$2, 77, 16, 2428);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*dots*/ 2 && div_title_value !== (div_title_value = /*dot*/ ctx[8].name)) {
    				attr_dev(div, "title", div_title_value);
    			}

    			if (dirty & /*scale, dots*/ 6) {
    				set_style(div, "left", /*scale*/ ctx[2](/*dot*/ ctx[8].start.offset) + "%");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(77:14) {#if s.epoch <= dot.start.epoch}",
    		ctx
    	});

    	return block;
    }

    // (64:8) {#each dots as dot, i}
    function create_each_block(ctx) {
    	let div6;
    	let div0;
    	let t0_value = /*dot*/ ctx[8].name + "";
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
    	let t6;

    	function select_block_type(ctx, dirty) {
    		if (/*s*/ ctx[0].epoch <= /*dot*/ ctx[8].start.epoch) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

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
    			if_block.c();
    			t6 = space();
    			attr_dev(div0, "class", "name svelte-1d8yzxj");
    			add_location(div0, file$2, 65, 12, 1841);
    			attr_dev(div1, "class", "track svelte-1d8yzxj");
    			add_location(div1, file$2, 67, 14, 1921);
    			attr_dev(div2, "class", "inside svelte-1d8yzxj");
    			attr_dev(div2, "title", div2_title_value = /*dot*/ ctx[8].name);
    			set_style(div2, "left", /*scale*/ ctx[2](/*dot*/ ctx[8].start.offset) + "%");
    			set_style(div2, "width", /*scale*/ ctx[2](/*dot*/ ctx[8].end.offset) - /*scale*/ ctx[2](/*dot*/ ctx[8].start.offset) + "%");
    			add_location(div2, file$2, 68, 14, 1957);
    			attr_dev(div3, "class", "dot end svelte-1d8yzxj");
    			attr_dev(div3, "title", div3_title_value = /*dot*/ ctx[8].name);
    			set_style(div3, "left", /*scale*/ ctx[2](/*dot*/ ctx[8].start.offset) + "%");
    			add_location(div3, file$2, 74, 14, 2189);
    			attr_dev(div4, "class", "dot end svelte-1d8yzxj");
    			attr_dev(div4, "title", div4_title_value = /*dot*/ ctx[8].name);
    			set_style(div4, "left", /*scale*/ ctx[2](/*dot*/ ctx[8].end.offset) + "%");
    			add_location(div4, file$2, 75, 14, 2285);
    			attr_dev(div5, "class", "line svelte-1d8yzxj");
    			add_location(div5, file$2, 66, 12, 1888);
    			attr_dev(div6, "class", "row svelte-1d8yzxj");
    			set_style(div6, "width", "100%");
    			add_location(div6, file$2, 64, 10, 1791);
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
    			append_dev(div5, t5);
    			if_block.m(div5, null);
    			append_dev(div6, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*dots*/ 2 && t0_value !== (t0_value = /*dot*/ ctx[8].name + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*dots*/ 2 && div2_title_value !== (div2_title_value = /*dot*/ ctx[8].name)) {
    				attr_dev(div2, "title", div2_title_value);
    			}

    			if (dirty & /*scale, dots*/ 6) {
    				set_style(div2, "left", /*scale*/ ctx[2](/*dot*/ ctx[8].start.offset) + "%");
    			}

    			if (dirty & /*scale, dots*/ 6) {
    				set_style(div2, "width", /*scale*/ ctx[2](/*dot*/ ctx[8].end.offset) - /*scale*/ ctx[2](/*dot*/ ctx[8].start.offset) + "%");
    			}

    			if (dirty & /*dots*/ 2 && div3_title_value !== (div3_title_value = /*dot*/ ctx[8].name)) {
    				attr_dev(div3, "title", div3_title_value);
    			}

    			if (dirty & /*scale, dots*/ 6) {
    				set_style(div3, "left", /*scale*/ ctx[2](/*dot*/ ctx[8].start.offset) + "%");
    			}

    			if (dirty & /*dots*/ 2 && div4_title_value !== (div4_title_value = /*dot*/ ctx[8].name)) {
    				attr_dev(div4, "title", div4_title_value);
    			}

    			if (dirty & /*scale, dots*/ 6) {
    				set_style(div4, "left", /*scale*/ ctx[2](/*dot*/ ctx[8].end.offset) + "%");
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div5, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(64:8) {#each dots as dot, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div9;
    	let head;
    	let t0;
    	let div8;
    	let div7;
    	let div0;
    	let input0;
    	let t1;
    	let span;
    	let t2_value = /*s*/ ctx[0].format("{month-short} {date-ordinal} {year}") + "";
    	let t2;
    	let t3;
    	let input1;
    	let t4;
    	let div6;
    	let div5;
    	let div1;
    	let t5;
    	let div4;
    	let div2;
    	let t7;
    	let div3;
    	let t9;
    	let t10;
    	let foot;
    	let current;
    	let mounted;
    	let dispose;

    	head = new Head({
    			props: { title: /*title*/ ctx[5], sub: "" },
    			$$inline: true
    		});

    	let each_value = /*dots*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	foot = new Foot({
    			props: { title: /*title*/ ctx[5], year: "2023" },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div9 = element("div");
    			create_component(head.$$.fragment);
    			t0 = space();
    			div8 = element("div");
    			div7 = element("div");
    			div0 = element("div");
    			input0 = element("input");
    			t1 = space();
    			span = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			input1 = element("input");
    			t4 = space();
    			div6 = element("div");
    			div5 = element("div");
    			div1 = element("div");
    			t5 = space();
    			div4 = element("div");
    			div2 = element("div");
    			div2.textContent = "-14h";
    			t7 = space();
    			div3 = element("div");
    			div3.textContent = "+14h";
    			t9 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t10 = space();
    			create_component(foot.$$.fragment);
    			attr_dev(input0, "type", "button");
    			input0.value = "🔙";
    			attr_dev(input0, "class", "svelte-1d8yzxj");
    			add_location(input0, file$2, 51, 8, 1205);
    			attr_dev(span, "class", "year svelte-1d8yzxj");
    			add_location(span, file$2, 52, 8, 1265);
    			attr_dev(input1, "type", "button");
    			input1.value = "⏸️";
    			attr_dev(input1, "class", "svelte-1d8yzxj");
    			add_location(input1, file$2, 53, 8, 1349);
    			attr_dev(div0, "class", "rightSide svelte-1d8yzxj");
    			add_location(div0, file$2, 50, 6, 1173);
    			attr_dev(div1, "class", "name svelte-1d8yzxj");
    			add_location(div1, file$2, 57, 10, 1518);
    			attr_dev(div2, "class", "hr svelte-1d8yzxj");
    			set_style(div2, "position", "absolute");
    			set_style(div2, "left", "-5%");
    			add_location(div2, file$2, 59, 12, 1580);
    			attr_dev(div3, "class", "hr svelte-1d8yzxj");
    			set_style(div3, "position", "absolute");
    			set_style(div3, "left", "95%");
    			add_location(div3, file$2, 60, 12, 1655);
    			attr_dev(div4, "class", "line svelte-1d8yzxj");
    			add_location(div4, file$2, 58, 10, 1549);
    			attr_dev(div5, "class", "row svelte-1d8yzxj");
    			set_style(div5, "width", "100%");
    			set_style(div5, "margin-bottom", "3rem");
    			add_location(div5, file$2, 56, 8, 1450);
    			attr_dev(div6, "class", "col box svelte-1d8yzxj");
    			add_location(div6, file$2, 55, 6, 1420);
    			attr_dev(div7, "class", "shadow container svelte-1d8yzxj");
    			add_location(div7, file$2, 49, 4, 1136);
    			attr_dev(div8, "class", "mid");
    			add_location(div8, file$2, 48, 2, 1114);
    			attr_dev(div9, "class", "page");
    			add_location(div9, file$2, 46, 0, 1067);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div9, anchor);
    			mount_component(head, div9, null);
    			append_dev(div9, t0);
    			append_dev(div9, div8);
    			append_dev(div8, div7);
    			append_dev(div7, div0);
    			append_dev(div0, input0);
    			append_dev(div0, t1);
    			append_dev(div0, span);
    			append_dev(span, t2);
    			append_dev(div0, t3);
    			append_dev(div0, input1);
    			append_dev(div7, t4);
    			append_dev(div7, div6);
    			append_dev(div6, div5);
    			append_dev(div5, div1);
    			append_dev(div5, t5);
    			append_dev(div5, div4);
    			append_dev(div4, div2);
    			append_dev(div4, t7);
    			append_dev(div4, div3);
    			append_dev(div6, t9);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div6, null);
    			}

    			append_dev(div8, t10);
    			mount_component(foot, div8, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "click", /*reset*/ ctx[4], false, false, false),
    					listen_dev(input1, "click", /*pause*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*s*/ 1) && t2_value !== (t2_value = /*s*/ ctx[0].format("{month-short} {date-ordinal} {year}") + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*dots, scale, s*/ 7) {
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
    						each_blocks[i].m(div6, null);
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
    			if (detaching) detach_dev(div9);
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
    	let s = main$1.now().startOf("year");

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

    	let interval = setInterval(
    		() => {
    			$$invalidate(0, s = s.add(10, "days"));
    		},
    		500
    	);

    	const pause = function () {
    		if (interval) {
    			clearInterval(interval);
    			interval = null;
    		} else {
    			interval = setInterval(
    				() => {
    					$$invalidate(0, s = s.add(10, "days"));
    				},
    				200
    			);
    		}
    	};

    	const reset = function () {
    		$$invalidate(0, s = main$1.now().startOf("year"));
    	};

    	let title = "Timezone offsets by date";
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Head,
    		Foot,
    		getYear: doYear,
    		spacetime: main$1,
    		s,
    		scaleLinear,
    		interval,
    		pause,
    		reset,
    		title,
    		dots,
    		scale
    	});

    	$$self.$inject_state = $$props => {
    		if ("s" in $$props) $$invalidate(0, s = $$props.s);
    		if ("interval" in $$props) interval = $$props.interval;
    		if ("title" in $$props) $$invalidate(5, title = $$props.title);
    		if ("dots" in $$props) $$invalidate(1, dots = $$props.dots);
    		if ("scale" in $$props) $$invalidate(2, scale = $$props.scale);
    	};

    	let dots;
    	let scale;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*s*/ 1) {
    			 $$invalidate(1, dots = doYear(s.year()));
    		}
    	};

    	 $$invalidate(2, scale = scaleLinear({ world: [0, 100], minMax: [-14, 14] }));
    	return [s, dots, scale, pause, reset, title];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1d8yzxj-style")) add_css$2();
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
