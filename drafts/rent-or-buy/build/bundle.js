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
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
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
    	style.id = "svelte-1rgea1p-style";
    	style.textContent = ".goleft.svelte-1rgea1p{align-self:flex-start;transition:margin-left 250ms;padding:2rem;padding-top:1rem;cursor:pointer}.title.svelte-1rgea1p{font-size:18px}.sub.svelte-1rgea1p{margin-left:3rem;color:grey;text-align:right;margin-top:5px}.titlebox.svelte-1rgea1p{width:400px;margin-left:1rem}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSGVhZC5zdmVsdGUiLCJzb3VyY2VzIjpbIkhlYWQuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGV4cG9ydCBsZXQgaHJlZiA9ICcuLi8uLi8nXG4gIGV4cG9ydCBsZXQgdGl0bGUgPSAnJ1xuICBleHBvcnQgbGV0IHN1YiA9ICcnXG4gIGV4cG9ydCBsZXQgY29sb3IgPSAnIzc2OWJiNSdcbjwvc2NyaXB0PlxuXG48ZGl2IGNsYXNzPVwiZ29sZWZ0XCI+XG4gIDxhIHtocmVmfT5cbiAgICA8c3ZnIHdpZHRoPVwiMTVweFwiIGhlaWdodD1cIjMwcHhcIiB2aWV3Qm94PVwiMCAwIDkwIDE3MFwiPlxuICAgICAgPGcgc3Ryb2tlPVwibm9uZVwiIHN0cm9rZS13aWR0aD1cIjFcIiBmaWxsPVwibm9uZVwiIGZpbGwtcnVsZT1cImV2ZW5vZGRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPlxuICAgICAgICA8cGF0aFxuICAgICAgICAgIGQ9XCJNODEuNSw2IEM2OS44MjQwNjY2LDIzLjUxMzkwMDEgNDUuODI0MDY2Niw0OS45Mjc3NjM1IDkuNSw4NS4yNDE1OTAyXG4gICAgICAgIEM0NS43OTg0ODE0LDEyMC44MDY4NiA2OS43OTg0ODE0LDE0Ny4yMjYzMyA4MS41LDE2NC41XCJcbiAgICAgICAgICBzdHJva2U9e2NvbG9yfVxuICAgICAgICAgIHN0cm9rZS13aWR0aD1cIjIwXCJcbiAgICAgICAgICBmaWxsLXJ1bGU9XCJub256ZXJvXCJcbiAgICAgICAgLz5cbiAgICAgIDwvZz5cbiAgICA8L3N2Zz5cbiAgPC9hPlxuPC9kaXY+XG48ZGl2IGNsYXNzPVwidGl0bGVib3hcIj5cbiAgPGRpdiBjbGFzcz1cInRpdGxlXCI+e0BodG1sIHRpdGxlfTwvZGl2PlxuICA8ZGl2IGNsYXNzPVwic3ViXCI+e3N1Yn08L2Rpdj5cbjwvZGl2PlxuXG48c3R5bGU+XG4gIC5nb2xlZnQge1xuICAgIGFsaWduLXNlbGY6IGZsZXgtc3RhcnQ7XG4gICAgdHJhbnNpdGlvbjogbWFyZ2luLWxlZnQgMjUwbXM7XG4gICAgcGFkZGluZzogMnJlbTtcbiAgICBwYWRkaW5nLXRvcDogMXJlbTtcbiAgICBjdXJzb3I6IHBvaW50ZXI7XG4gIH1cbiAgLyogLmdvbGVmdDpob3ZlciB7XG4gICAgbWFyZ2luLWxlZnQ6IDAuOHJlbTtcbiAgfSAqL1xuICAudGl0bGUge1xuICAgIGZvbnQtc2l6ZTogMThweDtcbiAgfVxuICAuc3ViIHtcbiAgICBtYXJnaW4tbGVmdDogM3JlbTtcbiAgICBjb2xvcjogZ3JleTtcbiAgICB0ZXh0LWFsaWduOiByaWdodDtcbiAgICBtYXJnaW4tdG9wOiA1cHg7XG4gIH1cbiAgLnRpdGxlYm94IHtcbiAgICB3aWR0aDogNDAwcHg7XG4gICAgbWFyZ2luLWxlZnQ6IDFyZW07XG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBNEJFLE9BQU8sZUFBQyxDQUFDLEFBQ1AsVUFBVSxDQUFFLFVBQVUsQ0FDdEIsVUFBVSxDQUFFLFdBQVcsQ0FBQyxLQUFLLENBQzdCLE9BQU8sQ0FBRSxJQUFJLENBQ2IsV0FBVyxDQUFFLElBQUksQ0FDakIsTUFBTSxDQUFFLE9BQU8sQUFDakIsQ0FBQyxBQUlELE1BQU0sZUFBQyxDQUFDLEFBQ04sU0FBUyxDQUFFLElBQUksQUFDakIsQ0FBQyxBQUNELElBQUksZUFBQyxDQUFDLEFBQ0osV0FBVyxDQUFFLElBQUksQ0FDakIsS0FBSyxDQUFFLElBQUksQ0FDWCxVQUFVLENBQUUsS0FBSyxDQUNqQixVQUFVLENBQUUsR0FBRyxBQUNqQixDQUFDLEFBQ0QsU0FBUyxlQUFDLENBQUMsQUFDVCxLQUFLLENBQUUsS0FBSyxDQUNaLFdBQVcsQ0FBRSxJQUFJLEFBQ25CLENBQUMifQ== */";
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
    			attr_dev(div0, "class", "goleft svelte-1rgea1p");
    			add_location(div0, file, 7, 0, 126);
    			attr_dev(div1, "class", "title svelte-1rgea1p");
    			add_location(div1, file, 23, 2, 628);
    			attr_dev(div2, "class", "sub svelte-1rgea1p");
    			add_location(div2, file, 24, 2, 669);
    			attr_dev(div3, "class", "titlebox svelte-1rgea1p");
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
    		if (!document.getElementById("svelte-1rgea1p-style")) add_css();
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

    /* components/Number.svelte generated by Svelte v3.29.0 */

    const file$2 = "components/Number.svelte";

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-1sy2c6q-style";
    	style.textContent = ".number.svelte-1sy2c6q{width:100px;border-radius:4px;padding-left:1rem;color:#525050;direction:ltr;line-height:2.6rem;font-size:2rem;padding-top:0.85rem;padding-bottom:0.75rem;font-family:'Merriweather', Georgia, 'Times New Roman', Times, serif;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2)}.col.svelte-1sy2c6q{display:flex;flex-direction:column;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTnVtYmVyLnN2ZWx0ZSIsInNvdXJjZXMiOlsiTnVtYmVyLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICBleHBvcnQgbGV0IHRleHQgPSAwXG4gIGV4cG9ydCBsZXQgbGFiZWwgPSAnJ1xuPC9zY3JpcHQ+XG5cbjxkaXYgY2xhc3M9XCJjb2xcIj5cbiAgPGRpdiBjbGFzcz1cImxhYmVsXCI+e2xhYmVsfTwvZGl2PlxuICA8aW5wdXQgdHlwZT1cInRleHRcIiBiaW5kOnZhbHVlPXt0ZXh0fSBjbGFzcz1cIm51bWJlclwiIC8+XG48L2Rpdj5cblxuPHN0eWxlPlxuICAubnVtYmVyIHtcbiAgICB3aWR0aDogMTAwcHg7XG5cbiAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgcGFkZGluZy1sZWZ0OiAxcmVtO1xuICAgIGNvbG9yOiAjNTI1MDUwO1xuICAgIGRpcmVjdGlvbjogbHRyO1xuICAgIGxpbmUtaGVpZ2h0OiAyLjZyZW07XG4gICAgZm9udC1zaXplOiAycmVtO1xuICAgIHBhZGRpbmctdG9wOiAwLjg1cmVtO1xuICAgIHBhZGRpbmctYm90dG9tOiAwLjc1cmVtO1xuICAgIGZvbnQtZmFtaWx5OiAnTWVycml3ZWF0aGVyJywgR2VvcmdpYSwgJ1RpbWVzIE5ldyBSb21hbicsIFRpbWVzLCBzZXJpZjtcbiAgICBib3gtc2hhZG93OiAycHggMnB4IDhweCAwcHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICB9XG4gIC5jb2wge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWFyb3VuZDtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgYWxpZ24tc2VsZjogc3RyZXRjaDtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFXRSxPQUFPLGVBQUMsQ0FBQyxBQUNQLEtBQUssQ0FBRSxLQUFLLENBRVosYUFBYSxDQUFFLEdBQUcsQ0FDbEIsWUFBWSxDQUFFLElBQUksQ0FDbEIsS0FBSyxDQUFFLE9BQU8sQ0FDZCxTQUFTLENBQUUsR0FBRyxDQUNkLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFNBQVMsQ0FBRSxJQUFJLENBQ2YsV0FBVyxDQUFFLE9BQU8sQ0FDcEIsY0FBYyxDQUFFLE9BQU8sQ0FDdkIsV0FBVyxDQUFFLGNBQWMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUNyRSxVQUFVLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEFBQ2hELENBQUMsQUFDRCxJQUFJLGVBQUMsQ0FBQyxBQUNKLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLE1BQU0sQ0FDdEIsZUFBZSxDQUFFLFlBQVksQ0FDN0IsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsVUFBVSxDQUFFLE1BQU0sQ0FDbEIsU0FBUyxDQUFFLElBQUksQ0FDZixVQUFVLENBQUUsT0FBTyxBQUNyQixDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    function create_fragment$2(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1;
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(/*label*/ ctx[1]);
    			t1 = space();
    			input = element("input");
    			attr_dev(div0, "class", "label");
    			add_location(div0, file$2, 6, 2, 86);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "number svelte-1sy2c6q");
    			add_location(input, file$2, 7, 2, 121);
    			attr_dev(div1, "class", "col svelte-1sy2c6q");
    			add_location(div1, file$2, 5, 0, 66);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div1, t1);
    			append_dev(div1, input);
    			set_input_value(input, /*text*/ ctx[0]);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", /*input_input_handler*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*label*/ 2) set_data_dev(t0, /*label*/ ctx[1]);

    			if (dirty & /*text*/ 1 && input.value !== /*text*/ ctx[0]) {
    				set_input_value(input, /*text*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			dispose();
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
    	validate_slots("Number", slots, []);
    	let { text = 0 } = $$props;
    	let { label = "" } = $$props;
    	const writable_props = ["text", "label"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Number> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		text = this.value;
    		$$invalidate(0, text);
    	}

    	$$self.$$set = $$props => {
    		if ("text" in $$props) $$invalidate(0, text = $$props.text);
    		if ("label" in $$props) $$invalidate(1, label = $$props.label);
    	};

    	$$self.$capture_state = () => ({ text, label });

    	$$self.$inject_state = $$props => {
    		if ("text" in $$props) $$invalidate(0, text = $$props.text);
    		if ("label" in $$props) $$invalidate(1, label = $$props.label);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [text, label, input_input_handler];
    }

    class Number$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1sy2c6q-style")) add_css$2();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { text: 0, label: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Number",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get text() {
    		throw new Error("<Number>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set text(value) {
    		throw new Error("<Number>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label() {
    		throw new Error("<Number>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<Number>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* drafts/rent-or-buy/Post.svelte generated by Svelte v3.29.0 */
    const file$3 = "drafts/rent-or-buy/Post.svelte";

    function add_css$3() {
    	var style = element("style");
    	style.id = "svelte-11nksa8-style";
    	style.textContent = ".row.svelte-11nksa8{display:flex;flex-direction:row;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch}.full.svelte-11nksa8{background-color:lightsteelblue}.col.svelte-11nksa8{display:flex;flex-direction:column;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch;width:100%}.age.svelte-11nksa8{color:lightgrey;font-size:0.6rem;width:40px}.grid.svelte-11nksa8{width:100%;display:flex;display:flex;flex-direction:column-reverse;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch;width:100%}.year.svelte-11nksa8{display:flex;flex-grow:1;flex-direction:row;justify-content:center;align-items:center;flex-wrap:nowrap;width:100%}.box.svelte-11nksa8{width:100%;flex:1;max-width:20px;max-height:20px;aspect-ratio:1 / 1;border:1px dotted lightgrey}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCB7IEhlYWQsIEZvb3QsIE51bSB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvaW5kZXgubWpzJ1xuICBsZXQgdGl0bGUgPSAnUmVudGluZyB2cyBidXlpbmcnXG4gIGxldCBhZ2UgPSAzN1xuICBsZXQgcmVudCA9IDI0MDBcbiAgbGV0IGhvdXNlID0gMTQwMFxuICBjb25zdCBkaWUgPSA4MVxuXG4gICQ6IHN0YXRlID0ge1xuICAgIGFnZTogTnVtYmVyKGFnZSksXG4gICAgcmVudDogTnVtYmVyKHJlbnQpLFxuICAgIGhvdXNlOiBOdW1iZXIoaG91c2UpLFxuICB9XG4gIGxldCB5ZWFyID0gWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwLCAxMSwgMTJdXG4gIGxldCBtb250aHMgPSAwXG4gICQ6IGdyaWQgPSAoKCkgPT4ge1xuICAgIG1vbnRocyA9IE1hdGguY2VpbCgoc3RhdGUuaG91c2UgKiAxMDAwKSAvIHN0YXRlLnJlbnQpXG4gICAgbGV0IHllYXJzID0gTWF0aC5jZWlsKG1vbnRocyAvIDEyKVxuICAgIGxldCBhcnIgPSBbXVxuICAgIGxldCBsZWZ0ID0gbW9udGhzXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB5ZWFyczsgaSArPSAxKSB7XG4gICAgICBsZWZ0IC09IDEyXG4gICAgICBpZiAobGVmdCA+IDApIHtcbiAgICAgICAgYXJyLnB1c2goeWVhci5zbGljZSgwLCBsZWZ0KSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYXJyXG4gIH0pKClcbjwvc2NyaXB0PlxuXG48ZGl2IGNsYXNzPVwicGFnZVwiPlxuICA8SGVhZCB7dGl0bGV9IHN1Yj1cIlwiIC8+XG4gIDxkaXYgY2xhc3M9XCJtaWQgY29sXCI+XG4gICAge21vbnRoc30gbW9udGhzICh7TWF0aC5mbG9vcihtb250aHMgLyAxMil9IHllYXJzKVxuICAgIDwhLS0gZ3JpZCAtLT5cbiAgICA8ZGl2IGNsYXNzPVwiZ3JpZFwiPlxuICAgICAgeyNlYWNoIGdyaWQgYXMgeWVhciwgaX1cbiAgICAgICAgeyNpZiBpICsgc3RhdGUuYWdlID09PSA4Mn1cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGllXCI+LS0tIGxpZmUgZXhwZWN0YW5jeSAtLS08L2Rpdj5cbiAgICAgICAgey9pZn1cbiAgICAgICAgPGRpdiBjbGFzcz1cInllYXJcIj5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImFnZVwiPntpICsgc3RhdGUuYWdlfTwvc3Bhbj5cbiAgICAgICAgICB7I2VhY2ggQXJyYXkoMTIpIGFzIF8sIGl9XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm94XCIgY2xhc3M6ZnVsbD17eWVhcltpXX0gLz5cbiAgICAgICAgICB7L2VhY2h9XG4gICAgICAgIDwvZGl2PlxuICAgICAgey9lYWNofVxuICAgIDwvZGl2PlxuICAgIDwhLS0gbnVtYmVycyAtLT5cbiAgICA8ZGl2IGNsYXNzPVwicm93XCI+XG4gICAgICA8TnVtIGJpbmQ6dGV4dD17YWdlfSBsYWJlbD1cImFnZTpcIiAvPlxuICAgICAgPE51bSBiaW5kOnRleHQ9e3JlbnR9IGxhYmVsPVwicmVudDpcIiAvPlxuICAgICAgPE51bSBiaW5kOnRleHQ9e2hvdXNlfSBsYWJlbD1cImJ1eSAodGhvdXNhbmQpOlwiIC8+XG4gICAgPC9kaXY+XG4gICAgPGRpdj57SlNPTi5zdHJpbmdpZnkoc3RhdGUpfTwvZGl2PlxuICAgIDxGb290IHt0aXRsZX0geWVhcj1cIjIwMjNcIiAvPlxuICA8L2Rpdj5cbjwvZGl2PlxuXG48c3R5bGU+XG4gIC5yb3cge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWFyb3VuZDtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgYWxpZ24tc2VsZjogc3RyZXRjaDtcbiAgfVxuICAuZnVsbCB7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogbGlnaHRzdGVlbGJsdWU7XG4gIH1cbiAgLmNvbCB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYXJvdW5kO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIGZsZXgtd3JhcDogd3JhcDtcbiAgICBhbGlnbi1zZWxmOiBzdHJldGNoO1xuICAgIHdpZHRoOiAxMDAlO1xuICB9XG4gIC5hZ2Uge1xuICAgIGNvbG9yOiBsaWdodGdyZXk7XG4gICAgZm9udC1zaXplOiAwLjZyZW07XG4gICAgd2lkdGg6IDQwcHg7XG4gIH1cbiAgLmdyaWQge1xuICAgIHdpZHRoOiAxMDAlO1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uLXJldmVyc2U7XG4gICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1hcm91bmQ7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgZmxleC13cmFwOiB3cmFwO1xuICAgIGFsaWduLXNlbGY6IHN0cmV0Y2g7XG4gICAgd2lkdGg6IDEwMCU7XG4gIH1cbiAgLnllYXIge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1ncm93OiAxO1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICBmbGV4LXdyYXA6IG5vd3JhcDtcbiAgICB3aWR0aDogMTAwJTtcbiAgfVxuICAuYm94IHtcbiAgICB3aWR0aDogMTAwJTtcbiAgICBmbGV4OiAxO1xuICAgIG1heC13aWR0aDogMjBweDtcbiAgICBtYXgtaGVpZ2h0OiAyMHB4O1xuICAgIGFzcGVjdC1yYXRpbzogMSAvIDE7XG4gICAgYm9yZGVyOiAxcHggZG90dGVkIGxpZ2h0Z3JleTtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUE2REUsSUFBSSxlQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxZQUFZLENBQzdCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLFNBQVMsQ0FBRSxJQUFJLENBQ2YsVUFBVSxDQUFFLE9BQU8sQUFDckIsQ0FBQyxBQUNELEtBQUssZUFBQyxDQUFDLEFBQ0wsZ0JBQWdCLENBQUUsY0FBYyxBQUNsQyxDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLGVBQWUsQ0FBRSxZQUFZLENBQzdCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLFNBQVMsQ0FBRSxJQUFJLENBQ2YsVUFBVSxDQUFFLE9BQU8sQ0FDbkIsS0FBSyxDQUFFLElBQUksQUFDYixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixLQUFLLENBQUUsU0FBUyxDQUNoQixTQUFTLENBQUUsTUFBTSxDQUNqQixLQUFLLENBQUUsSUFBSSxBQUNiLENBQUMsQUFDRCxLQUFLLGVBQUMsQ0FBQyxBQUNMLEtBQUssQ0FBRSxJQUFJLENBQ1gsT0FBTyxDQUFFLElBQUksQ0FDYixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxjQUFjLENBQzlCLGVBQWUsQ0FBRSxZQUFZLENBQzdCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLFNBQVMsQ0FBRSxJQUFJLENBQ2YsVUFBVSxDQUFFLE9BQU8sQ0FDbkIsS0FBSyxDQUFFLElBQUksQUFDYixDQUFDLEFBQ0QsS0FBSyxlQUFDLENBQUMsQUFDTCxPQUFPLENBQUUsSUFBSSxDQUNiLFNBQVMsQ0FBRSxDQUFDLENBQ1osY0FBYyxDQUFFLEdBQUcsQ0FDbkIsZUFBZSxDQUFFLE1BQU0sQ0FDdkIsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsU0FBUyxDQUFFLE1BQU0sQ0FDakIsS0FBSyxDQUFFLElBQUksQUFDYixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixLQUFLLENBQUUsSUFBSSxDQUNYLElBQUksQ0FBRSxDQUFDLENBQ1AsU0FBUyxDQUFFLElBQUksQ0FDZixVQUFVLENBQUUsSUFBSSxDQUNoQixZQUFZLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQ25CLE1BQU0sQ0FBRSxHQUFHLENBQUMsTUFBTSxDQUFDLFNBQVMsQUFDOUIsQ0FBQyJ9 */";
    	append_dev(document.head, style);
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	child_ctx[12] = i;
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	child_ctx[12] = i;
    	return child_ctx;
    }

    // (39:8) {#if i + state.age === 82}
    function create_if_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "--- life expectancy ---";
    			attr_dev(div, "class", "die");
    			add_location(div, file$3, 39, 10, 899);
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
    		id: create_if_block.name,
    		type: "if",
    		source: "(39:8) {#if i + state.age === 82}",
    		ctx
    	});

    	return block;
    }

    // (44:10) {#each Array(12) as _, i}
    function create_each_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "box svelte-11nksa8");
    			toggle_class(div, "full", /*year*/ ctx[7][/*i*/ ctx[12]]);
    			add_location(div, file$3, 44, 12, 1086);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*grid*/ 32) {
    				toggle_class(div, "full", /*year*/ ctx[7][/*i*/ ctx[12]]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(44:10) {#each Array(12) as _, i}",
    		ctx
    	});

    	return block;
    }

    // (38:6) {#each grid as year, i}
    function create_each_block(ctx) {
    	let t0;
    	let div;
    	let span;
    	let t1_value = /*i*/ ctx[12] + /*state*/ ctx[4].age + "";
    	let t1;
    	let t2;
    	let t3;
    	let if_block = /*i*/ ctx[12] + /*state*/ ctx[4].age === 82 && create_if_block(ctx);
    	let each_value_1 = Array(12);
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			t0 = space();
    			div = element("div");
    			span = element("span");
    			t1 = text(t1_value);
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			attr_dev(span, "class", "age svelte-11nksa8");
    			add_location(span, file$3, 42, 10, 997);
    			attr_dev(div, "class", "year svelte-11nksa8");
    			add_location(div, file$3, 41, 8, 968);
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, span);
    			append_dev(span, t1);
    			append_dev(div, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append_dev(div, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (/*i*/ ctx[12] + /*state*/ ctx[4].age === 82) {
    				if (if_block) ; else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(t0.parentNode, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*state*/ 16 && t1_value !== (t1_value = /*i*/ ctx[12] + /*state*/ ctx[4].age + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*grid*/ 32) {
    				each_value_1 = Array(12);
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t3);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(38:6) {#each grid as year, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div4;
    	let head;
    	let t0;
    	let div3;
    	let t1;
    	let t2;
    	let t3_value = Math.floor(/*months*/ ctx[3] / 12) + "";
    	let t3;
    	let t4;
    	let div0;
    	let t5;
    	let div1;
    	let num0;
    	let updating_text;
    	let t6;
    	let num1;
    	let updating_text_1;
    	let t7;
    	let num2;
    	let updating_text_2;
    	let t8;
    	let div2;
    	let t9_value = JSON.stringify(/*state*/ ctx[4]) + "";
    	let t9;
    	let t10;
    	let foot;
    	let current;

    	head = new Head({
    			props: { title: /*title*/ ctx[6], sub: "" },
    			$$inline: true
    		});

    	let each_value = /*grid*/ ctx[5];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	function num0_text_binding(value) {
    		/*num0_text_binding*/ ctx[8].call(null, value);
    	}

    	let num0_props = { label: "age:" };

    	if (/*age*/ ctx[0] !== void 0) {
    		num0_props.text = /*age*/ ctx[0];
    	}

    	num0 = new Number$1({ props: num0_props, $$inline: true });
    	binding_callbacks.push(() => bind(num0, "text", num0_text_binding));

    	function num1_text_binding(value) {
    		/*num1_text_binding*/ ctx[9].call(null, value);
    	}

    	let num1_props = { label: "rent:" };

    	if (/*rent*/ ctx[1] !== void 0) {
    		num1_props.text = /*rent*/ ctx[1];
    	}

    	num1 = new Number$1({ props: num1_props, $$inline: true });
    	binding_callbacks.push(() => bind(num1, "text", num1_text_binding));

    	function num2_text_binding(value) {
    		/*num2_text_binding*/ ctx[10].call(null, value);
    	}

    	let num2_props = { label: "buy (thousand):" };

    	if (/*house*/ ctx[2] !== void 0) {
    		num2_props.text = /*house*/ ctx[2];
    	}

    	num2 = new Number$1({ props: num2_props, $$inline: true });
    	binding_callbacks.push(() => bind(num2, "text", num2_text_binding));

    	foot = new Foot({
    			props: { title: /*title*/ ctx[6], year: "2023" },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			create_component(head.$$.fragment);
    			t0 = space();
    			div3 = element("div");
    			t1 = text(/*months*/ ctx[3]);
    			t2 = text(" months (");
    			t3 = text(t3_value);
    			t4 = text(" years)\n    \n    ");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t5 = space();
    			div1 = element("div");
    			create_component(num0.$$.fragment);
    			t6 = space();
    			create_component(num1.$$.fragment);
    			t7 = space();
    			create_component(num2.$$.fragment);
    			t8 = space();
    			div2 = element("div");
    			t9 = text(t9_value);
    			t10 = space();
    			create_component(foot.$$.fragment);
    			attr_dev(div0, "class", "grid svelte-11nksa8");
    			add_location(div0, file$3, 36, 4, 805);
    			attr_dev(div1, "class", "row svelte-11nksa8");
    			add_location(div1, file$3, 50, 4, 1210);
    			add_location(div2, file$3, 55, 4, 1387);
    			attr_dev(div3, "class", "mid col svelte-11nksa8");
    			add_location(div3, file$3, 33, 2, 707);
    			attr_dev(div4, "class", "page");
    			add_location(div4, file$3, 31, 0, 660);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			mount_component(head, div4, null);
    			append_dev(div4, t0);
    			append_dev(div4, div3);
    			append_dev(div3, t1);
    			append_dev(div3, t2);
    			append_dev(div3, t3);
    			append_dev(div3, t4);
    			append_dev(div3, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_dev(div3, t5);
    			append_dev(div3, div1);
    			mount_component(num0, div1, null);
    			append_dev(div1, t6);
    			mount_component(num1, div1, null);
    			append_dev(div1, t7);
    			mount_component(num2, div1, null);
    			append_dev(div3, t8);
    			append_dev(div3, div2);
    			append_dev(div2, t9);
    			append_dev(div3, t10);
    			mount_component(foot, div3, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*months*/ 8) set_data_dev(t1, /*months*/ ctx[3]);
    			if ((!current || dirty & /*months*/ 8) && t3_value !== (t3_value = Math.floor(/*months*/ ctx[3] / 12) + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*Array, grid, state*/ 48) {
    				each_value = /*grid*/ ctx[5];
    				validate_each_argument(each_value);
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

    			const num0_changes = {};

    			if (!updating_text && dirty & /*age*/ 1) {
    				updating_text = true;
    				num0_changes.text = /*age*/ ctx[0];
    				add_flush_callback(() => updating_text = false);
    			}

    			num0.$set(num0_changes);
    			const num1_changes = {};

    			if (!updating_text_1 && dirty & /*rent*/ 2) {
    				updating_text_1 = true;
    				num1_changes.text = /*rent*/ ctx[1];
    				add_flush_callback(() => updating_text_1 = false);
    			}

    			num1.$set(num1_changes);
    			const num2_changes = {};

    			if (!updating_text_2 && dirty & /*house*/ 4) {
    				updating_text_2 = true;
    				num2_changes.text = /*house*/ ctx[2];
    				add_flush_callback(() => updating_text_2 = false);
    			}

    			num2.$set(num2_changes);
    			if ((!current || dirty & /*state*/ 16) && t9_value !== (t9_value = JSON.stringify(/*state*/ ctx[4]) + "")) set_data_dev(t9, t9_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(head.$$.fragment, local);
    			transition_in(num0.$$.fragment, local);
    			transition_in(num1.$$.fragment, local);
    			transition_in(num2.$$.fragment, local);
    			transition_in(foot.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(head.$$.fragment, local);
    			transition_out(num0.$$.fragment, local);
    			transition_out(num1.$$.fragment, local);
    			transition_out(num2.$$.fragment, local);
    			transition_out(foot.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			destroy_component(head);
    			destroy_each(each_blocks, detaching);
    			destroy_component(num0);
    			destroy_component(num1);
    			destroy_component(num2);
    			destroy_component(foot);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const die = 81;

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Post", slots, []);
    	let title = "Renting vs buying";
    	let age = 37;
    	let rent = 2400;
    	let house = 1400;
    	let year = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    	let months = 0;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	function num0_text_binding(value) {
    		age = value;
    		$$invalidate(0, age);
    	}

    	function num1_text_binding(value) {
    		rent = value;
    		$$invalidate(1, rent);
    	}

    	function num2_text_binding(value) {
    		house = value;
    		$$invalidate(2, house);
    	}

    	$$self.$capture_state = () => ({
    		Head,
    		Foot,
    		Num: Number$1,
    		title,
    		age,
    		rent,
    		house,
    		die,
    		year,
    		months,
    		state,
    		grid
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(6, title = $$props.title);
    		if ("age" in $$props) $$invalidate(0, age = $$props.age);
    		if ("rent" in $$props) $$invalidate(1, rent = $$props.rent);
    		if ("house" in $$props) $$invalidate(2, house = $$props.house);
    		if ("year" in $$props) $$invalidate(7, year = $$props.year);
    		if ("months" in $$props) $$invalidate(3, months = $$props.months);
    		if ("state" in $$props) $$invalidate(4, state = $$props.state);
    		if ("grid" in $$props) $$invalidate(5, grid = $$props.grid);
    	};

    	let state;
    	let grid;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*age, rent, house*/ 7) {
    			 $$invalidate(4, state = {
    				age: Number(age),
    				rent: Number(rent),
    				house: Number(house)
    			});
    		}

    		if ($$self.$$.dirty & /*state, months*/ 24) {
    			 $$invalidate(5, grid = (() => {
    				$$invalidate(3, months = Math.ceil(state.house * 1000 / state.rent));
    				let years = Math.ceil(months / 12);
    				let arr = [];
    				let left = months;

    				for (let i = 0; i < years; i += 1) {
    					left -= 12;

    					if (left > 0) {
    						arr.push(year.slice(0, left));
    					}
    				}

    				return arr;
    			})());
    		}
    	};

    	return [
    		age,
    		rent,
    		house,
    		months,
    		state,
    		grid,
    		title,
    		year,
    		num0_text_binding,
    		num1_text_binding,
    		num2_text_binding
    	];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-11nksa8-style")) add_css$3();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    const app = new Post({
      target: document.body,
      props: {},
    });

    return app;

}());
