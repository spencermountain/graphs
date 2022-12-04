var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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
    function empty() {
        return text('');
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

    /* components/Page.svelte generated by Svelte v3.29.0 */
    const file$2 = "components/Page.svelte";

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-juw3t5-style";
    	style.textContent = ".page.svelte-juw3t5{display:flex;flex-direction:column;justify-content:space-around;align-items:center;text-align:center}.grow.svelte-juw3t5{width:90%}.mid.svelte-juw3t5{margin:1rem;padding:1rem;margin-top:0rem;min-width:300px;flex-grow:1}.shadow.svelte-juw3t5{padding:2rem;min-height:300px;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2)}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGFnZS5zdmVsdGUiLCJzb3VyY2VzIjpbIlBhZ2Uuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBIZWFkIGZyb20gJy4vSGVhZC5zdmVsdGUnXG4gIGltcG9ydCBGb290IGZyb20gJy4vRm9vdC5zdmVsdGUnXG4gIGV4cG9ydCBsZXQgdGl0bGUgPSAnJ1xuICBleHBvcnQgbGV0IHN1YiA9ICcnXG4gIGV4cG9ydCBsZXQgZ3JvdyA9IGZhbHNlXG4gIGV4cG9ydCBsZXQgbWF4ID0gMTUwMFxuICBleHBvcnQgbGV0IG1pbiA9IDBcbiAgZXhwb3J0IGxldCBwYWRkaW5nID0gMTZcbiAgZXhwb3J0IGxldCB5ZWFyID0gU3RyaW5nKG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKSlcbjwvc2NyaXB0PlxuXG48ZGl2IGNsYXNzPVwicGFnZVwiPlxuICA8SGVhZCB7dGl0bGV9IHtzdWJ9IC8+XG4gIDxkaXYgY2xhc3M9XCJtaWRcIiBjbGFzczpncm93IHN0eWxlPVwibWF4LXdpZHRoOnttYXh9cHg7IG1pbi13aWR0aDp7bWlufXB4O1wiPlxuICAgIDxkaXYgY2xhc3M9XCJzaGFkb3dcIiBzdHlsZT1cInBhZGRpbmc6e3BhZGRpbmd9cHg7XCI+XG4gICAgICA8c2xvdCAvPlxuICAgIDwvZGl2PlxuICAgIDxGb290IHt0aXRsZX0ge3llYXJ9IC8+XG4gIDwvZGl2PlxuPC9kaXY+XG5cbjxzdHlsZT5cbiAgLyogZXZlcnl0aGluZyAqL1xuICAucGFnZSB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYXJvdW5kO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICB9XG4gIC5ncm93IHtcbiAgICB3aWR0aDogOTAlO1xuICB9XG5cbiAgLyogaW52aXNpYmxlLW1pZGRsZS1jb2x1bW4gKi9cbiAgLm1pZCB7XG4gICAgbWFyZ2luOiAxcmVtO1xuICAgIHBhZGRpbmc6IDFyZW07XG4gICAgbWFyZ2luLXRvcDogMHJlbTtcbiAgICBtaW4td2lkdGg6IDMwMHB4O1xuICAgIGZsZXgtZ3JvdzogMTtcbiAgfVxuXG4gIC8qIHZpc2libGUgbWlkZGxlLWNvbHVtbiAqL1xuICAuc2hhZG93IHtcbiAgICBwYWRkaW5nOiAycmVtO1xuICAgIG1pbi1oZWlnaHQ6IDMwMHB4O1xuICAgIGJveC1zaGFkb3c6IDJweCAycHggOHB4IDBweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBd0JFLEtBQUssY0FBQyxDQUFDLEFBQ0wsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxDQUN0QixlQUFlLENBQUUsWUFBWSxDQUM3QixXQUFXLENBQUUsTUFBTSxDQUNuQixVQUFVLENBQUUsTUFBTSxBQUNwQixDQUFDLEFBQ0QsS0FBSyxjQUFDLENBQUMsQUFDTCxLQUFLLENBQUUsR0FBRyxBQUNaLENBQUMsQUFHRCxJQUFJLGNBQUMsQ0FBQyxBQUNKLE1BQU0sQ0FBRSxJQUFJLENBQ1osT0FBTyxDQUFFLElBQUksQ0FDYixVQUFVLENBQUUsSUFBSSxDQUNoQixTQUFTLENBQUUsS0FBSyxDQUNoQixTQUFTLENBQUUsQ0FBQyxBQUNkLENBQUMsQUFHRCxPQUFPLGNBQUMsQ0FBQyxBQUNQLE9BQU8sQ0FBRSxJQUFJLENBQ2IsVUFBVSxDQUFFLEtBQUssQ0FDakIsVUFBVSxDQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxBQUNoRCxDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    function create_fragment$2(ctx) {
    	let div2;
    	let head;
    	let t0;
    	let div1;
    	let div0;
    	let t1;
    	let foot;
    	let current;

    	head = new Head({
    			props: {
    				title: /*title*/ ctx[0],
    				sub: /*sub*/ ctx[1]
    			},
    			$$inline: true
    		});

    	const default_slot_template = /*#slots*/ ctx[8].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[7], null);

    	foot = new Foot({
    			props: {
    				title: /*title*/ ctx[0],
    				year: /*year*/ ctx[6]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			create_component(head.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			div0 = element("div");
    			if (default_slot) default_slot.c();
    			t1 = space();
    			create_component(foot.$$.fragment);
    			attr_dev(div0, "class", "shadow svelte-juw3t5");
    			set_style(div0, "padding", /*padding*/ ctx[5] + "px");
    			add_location(div0, file$2, 15, 4, 411);
    			attr_dev(div1, "class", "mid svelte-juw3t5");
    			set_style(div1, "max-width", /*max*/ ctx[3] + "px");
    			set_style(div1, "min-width", /*min*/ ctx[4] + "px");
    			toggle_class(div1, "grow", /*grow*/ ctx[2]);
    			add_location(div1, file$2, 14, 2, 332);
    			attr_dev(div2, "class", "page svelte-juw3t5");
    			add_location(div2, file$2, 12, 0, 286);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			mount_component(head, div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, div0);

    			if (default_slot) {
    				default_slot.m(div0, null);
    			}

    			append_dev(div1, t1);
    			mount_component(foot, div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const head_changes = {};
    			if (dirty & /*title*/ 1) head_changes.title = /*title*/ ctx[0];
    			if (dirty & /*sub*/ 2) head_changes.sub = /*sub*/ ctx[1];
    			head.$set(head_changes);

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 128) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[7], dirty, null, null);
    				}
    			}

    			if (!current || dirty & /*padding*/ 32) {
    				set_style(div0, "padding", /*padding*/ ctx[5] + "px");
    			}

    			const foot_changes = {};
    			if (dirty & /*title*/ 1) foot_changes.title = /*title*/ ctx[0];
    			if (dirty & /*year*/ 64) foot_changes.year = /*year*/ ctx[6];
    			foot.$set(foot_changes);

    			if (!current || dirty & /*max*/ 8) {
    				set_style(div1, "max-width", /*max*/ ctx[3] + "px");
    			}

    			if (!current || dirty & /*min*/ 16) {
    				set_style(div1, "min-width", /*min*/ ctx[4] + "px");
    			}

    			if (dirty & /*grow*/ 4) {
    				toggle_class(div1, "grow", /*grow*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(head.$$.fragment, local);
    			transition_in(default_slot, local);
    			transition_in(foot.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(head.$$.fragment, local);
    			transition_out(default_slot, local);
    			transition_out(foot.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(head);
    			if (default_slot) default_slot.d(detaching);
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
    	validate_slots("Page", slots, ['default']);
    	let { title = "" } = $$props;
    	let { sub = "" } = $$props;
    	let { grow = false } = $$props;
    	let { max = 1500 } = $$props;
    	let { min = 0 } = $$props;
    	let { padding = 16 } = $$props;
    	let { year = String(new Date().getFullYear()) } = $$props;
    	const writable_props = ["title", "sub", "grow", "max", "min", "padding", "year"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Page> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    		if ("grow" in $$props) $$invalidate(2, grow = $$props.grow);
    		if ("max" in $$props) $$invalidate(3, max = $$props.max);
    		if ("min" in $$props) $$invalidate(4, min = $$props.min);
    		if ("padding" in $$props) $$invalidate(5, padding = $$props.padding);
    		if ("year" in $$props) $$invalidate(6, year = $$props.year);
    		if ("$$scope" in $$props) $$invalidate(7, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		Head,
    		Foot,
    		title,
    		sub,
    		grow,
    		max,
    		min,
    		padding,
    		year
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    		if ("grow" in $$props) $$invalidate(2, grow = $$props.grow);
    		if ("max" in $$props) $$invalidate(3, max = $$props.max);
    		if ("min" in $$props) $$invalidate(4, min = $$props.min);
    		if ("padding" in $$props) $$invalidate(5, padding = $$props.padding);
    		if ("year" in $$props) $$invalidate(6, year = $$props.year);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, sub, grow, max, min, padding, year, $$scope, slots];
    }

    class Page extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-juw3t5-style")) add_css$2();

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			title: 0,
    			sub: 1,
    			grow: 2,
    			max: 3,
    			min: 4,
    			padding: 5,
    			year: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Page",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get title() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get sub() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set sub(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get grow() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set grow(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get max() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set max(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get min() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set min(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get padding() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set padding(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get year() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set year(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var names = {
      blue: '#6699cc',
      green: '#6accb2',
      yellow: '#e1e6b3',
      red: '#cc7066',
      pink: '#F2C0BB', //'#e6b8b3',

      brown: '#705E5C',
      orange: '#cc8a66',
      purple: '#d8b3e6',
      navy: '#335799',
      olive: '#7f9c6c',

      fuscia: '#735873', //'#603960',
      beige: '#e6d7b3',
      slate: '#8C8C88',
      suede: '#9c896c',
      burnt: '#603a39',

      sea: '#50617A',
      sky: '#2D85A8',
      night: '#303b50',
      // dark: '#2C3133',
      rouge: '#914045',
      grey: '#838B91',

      mud: '#C4ABAB',
      royal: '#275291',
      cherry: '#cc6966',
      tulip: '#e6b3bc',
      rose: '#D68881',
      fire: '#AB5850',

      greyblue: '#72697D',
      greygreen: '#8BA3A2',
      greypurple: '#978BA3',
      burn: '#6D5685',

      slategrey: '#bfb0b3',
      light: '#a3a5a5',
      lighter: '#d7d5d2',
      fudge: '#4d4d4d',
      lightgrey: '#949a9e',

      white: '#fbfbfb',
      dimgrey: '#606c74',
      softblack: '#463D4F',
      dark: '#443d3d',
      black: '#333333',
    };

    var data = [
      {
        date: 'January 1, 1949',
        year: 1949,
        people: [
          { name: 'Hiram E. McCallum', num: 97715, percent: '80.43%' },
          { name: 'Ross Dowson', num: 23777, percent: '19.57%' }
        ],
        turnout: undefined,
      },
      {
        date: 'January 2, 1950',
        year: 1950,
        people: [
          { name: 'Hiram E. McCallum', num: 133320, percent: '79%' },
          { name: 'Charles Mahoney', num: 19658, percent: '11%' },
          { name: 'Ross Dowson', num: 15600, percent: '9%' }
        ],
        turnout: undefined
      },

      {
        date: 'December 4, 1950',
        year: 1950,
        people: [
          { name: 'Hiram E. McCallum', num: 86491, percent: '50.4%' },
          { name: 'Allan Lamport', num: 84987, percent: '49.5%' }
        ],
        turnout: undefined
      },

      {
        date: 'December 3, 1951',
        year: 1951,
        people: [
          { name: 'Allan Lamport', num: 72648, percent: '46%' },
          { name: 'Hiram E. McCallum', num: 59492, percent: '37%' },
          { name: 'Nathan Phillips', num: 24811, percent: '15%' }
        ],
        turnout: undefined
      },
      {
        date: 'December 1, 1952',
        year: 1952,
        people: [
          { name: 'Allan Lamport', num: 81448, percent: '66%' },
          { name: 'Nathan Phillips', num: 41923, percent: '33%' }
        ],
        turnout: undefined
      },
      {
        date: 'December 7, 1953',
        year: 1953,
        people: [
          { name: 'Allan Lamport', num: 55064, percent: '54%' },
          { name: 'Arthur J. Brown', num: 46080, percent: '45%' }
        ],
        turnout: undefined
      },
      {
        date: 'December 6, 1954',
        year: 1954,
        people: [
          { name: 'Nathan Phillips', num: 40683, percent: '34%' },
          { name: 'Leslie Saunders', num: 36756, percent: '30.8%' },
          { name: 'Arthur Brown', num: 36613, percent: '30.7%' }
        ],
        turnout: undefined
      },
      {
        date: 'December 5, 1955',
        year: 1955,
        people: [
          { name: 'Nathan Phillips', num: 70647, percent: '70%' },
          { name: 'Roy E. Belyea', num: 26717, percent: '26%' }
        ],
        turnout: undefined
      },
      {
        date: 'December 3, 1956',
        year: 1956,
        people: [
          { name: 'Nathan Phillips', num: 80352, percent: '89%' },
          { name: 'Ross Dowson', num: 9834, percent: '10%' }
        ],
        turnout: undefined
      },
      {
        date: 'December 1, 1958',
        year: 1958,
        people: [
          { name: 'Nathan Phillips', num: 53776, percent: '52%' },
          { name: 'Ford Brand', num: 30736, percent: '30%' },
          { name: 'Joseph Cornish', num: 17089, percent: '16%' }
        ],
        turnout: undefined
      },
      {
        date: 'December 5, 1960',
        year: 1960,
        people: [
          { name: 'Nathan Phillips', num: 81699, percent: '46%' },
          { name: 'Allan Lamport', num: 58254, percent: '33%' }
        ],
        turnout: undefined
      },
      {
        date: 'December 3, 1962',
        year: 1962,
        people: [
          { name: 'Donald Summerville', num: 117031, percent: '66%' },
          { name: 'Nathan Phillips', num: 51933, percent: '29%' }
        ],
        turnout: undefined
      },
      {
        date: 'December 7, 1964',
        year: 1964,
        people: [
          { name: 'Philip Givens', num: 62628, percent: '52%' },
          { name: 'Allan Lamport', num: 52143, percent: '43%' }
        ],
        turnout: undefined
      },
      {
        date: 'December 5, 1966',
        year: 1966,
        people: [
          { name: 'William Dennison', num: 59363, percent: '38%' },
          { name: 'Philip Givens', num: 54525, percent: '34%' }
        ],
        turnout: undefined
      },
      {
        date: 'December 1, 1969',
        year: 1969,
        people: [
          { name: 'William Dennison', num: 65988, percent: '43.1%' },
          { name: 'Margaret Campbell', num: 52742, percent: '34.5%' },
          { name: 'Stephen Clarkson', num: 31889, percent: '20.9%' }
        ],
        turnout: undefined
      },
      {
        date: 'December 4, 1972',
        year: 1972,
        people: [
          { name: 'David Crombie', num: 82754, percent: '43%' },
          { name: "Tony O'Donohue", num: 58362, percent: '30%' },
          { name: 'David Rotenberg', num: 35213, percent: '18%' }
        ],
        turnout: '40%'
      },
      {
        date: 'December 2, 1974',
        year: 1974,
        people: [
          { name: 'David Crombie', num: 100680, percent: '83%' },
          { name: 'Don Andrews', num: 5662, percent: '4%' }
        ],
        turnout: '27%'
      },
      {
        date: 'December 6, 1976',
        year: 1976,
        people: [
          { name: 'David Crombie', num: 112763, percent: '83%' },
          { name: 'Don Andrews', num: 7126, percent: '5.3%' }
        ],
        turnout: '30.5%'
      },
      {
        date: 'November 13, 1978',
        year: 1978,
        people: [
          { name: 'John Sewell', num: 71885, percent: '38%' },
          { name: "Tony O'Donohue", num: 62173, percent: '33%' },
          { name: 'David Smith', num: 45071, percent: '24%' }
        ],
        turnout: '46.4%'
      },
      {
        date: 'November 10, 1980',
        year: 1980,
        people: [
          { name: 'John Sewell', num: 86152, percent: '46.9%' },
          { name: 'Art Eggleton', num: 87919, percent: '47.8%' }
        ],
        turnout: '44.9%'
      },
      {
        date: 'November 8, 1982',
        year: 1982,
        people: [
          { name: 'Art Eggleton', num: 119387, percent: '74%' },
          { name: 'A. Hummer', num: 11721, percent: '7%' }
        ],
        turnout: '42%'
      },
      {
        date: 'November 12, 1985',
        year: 1985,
        people: [
          { name: 'Art Eggleton', num: 92994, percent: '58%' },
          { name: 'Anne Johnston', num: 59817, percent: '37%' }
        ],
        turnout: '36.6%'
      },
      {
        date: 'November 14, 1988',
        year: 1988,
        people: [
          { name: 'Art Eggleton', num: 91180, percent: '64%' },
          { name: 'Carolann Wright', num: 24479, percent: '17%' }
        ],
        turnout: '31%'
      },
      {
        date: 'November 12, 1991',
        year: 1991,
        people: [
          { name: 'June Rowlands', num: 113993, percent: '58.53' },
          { name: 'Jack Layton', num: 64044, percent: '32.88' }
        ],
        turnout: '42.9%'
      },
      {
        date: 'November 1994',
        year: 1994,
        people: [
          { name: 'Barbara Hall', num: 70248, percent: '43.05' },
          { name: 'June Rowlands', num: 58952, percent: '36.13' }
        ],
        turnout: '36.7%'
      },
      {
        date: 'November 10, 1997',
        year: 1997,
        people: [
          { name: 'Mel Lastman', num: 387848, percent: '51.92%' },
          { name: 'Barbara Hall', num: 346452, percent: '46.38%' }
        ],
        turnout: '45.6%'
      },
      {
        date: 'November 13, 2000',
        year: 2000,
        people: [
          { name: 'Mel Lastman', num: 483277, percent: '79.96%' },
          { name: 'Tooker Gomberg', num: 51111, percent: '8.46%' }
        ],
        turnout: '36.1%'
      },
      {
        date: 'November 10, 2003',
        year: 2003,
        people: [
          { name: 'David Miller', num: 299385, percent: '43.26%' },
          { name: 'John Tory', num: 263189, percent: '38.03%' }
        ],
        turnout: '38.33%'
      },
      {
        date: 'November 13, 2006',
        year: 2006,
        people: [
          { name: 'David Miller', num: 332969, percent: '56.97%' },
          { name: 'Jane Pitfield', num: 188932, percent: '32.32%' }
        ],
        turnout: '39.3%'
      },
      {
        date: 'October 25, 2010',
        year: 2010,
        people: [
          { name: 'Rob Ford', num: 383501, percent: '47.11%' },
          { name: 'George Smitherman', num: 289832, percent: '35.61%' },
          { name: 'Joe Pantalone', num: 95482, percent: '11.73%' }
        ],
        turnout: '50.55%'
      },
      {
        date: 'October 27, 2014',
        year: 2014,
        people: [
          { name: 'John Tory', num: 394775, percent: '40.28%' },
          { name: 'Doug Ford', num: 330610, percent: '33.73%' },
          { name: 'Olivia Chow', num: 226879, percent: '23.15%' }
        ],
        turnout: '54.67%'
      },
      {
        date: 'October 22, 2018',
        year: 2018,
        people: [
          { name: 'John Tory', num: 479659, percent: '63.49%' },
          { name: 'Jennifer Keesmaat', num: 178193, percent: '23.59%' }
        ],
        turnout: '40.9%'
      },
      {
        date: 'October 24, 2022',
        year: 2022,
        people: [
          { name: 'John Tory', num: 342158, percent: '62.00%' },
          { name: 'Gil Peñalosa', num: 98525, percent: '17.85%' },
          { name: 'Chloe-Marie Brown', num: 34821, percent: '6.31%' }
        ],
        turnout: '29.17%'
      },
    ];

    /* 2022/toronto-elections/Post.svelte generated by Svelte v3.29.0 */
    const file$3 = "2022/toronto-elections/Post.svelte";

    function add_css$3() {
    	var style = element("style");
    	style.id = "svelte-1a0t3m1-style";
    	style.textContent = ".shy.svelte-1a0t3m1{opacity:0.4}.year.svelte-1a0t3m1{min-height:90px}.digit.svelte-1a0t3m1{width:80px;display:flex;flex-direction:row;justify-content:center;align-items:center;margin-bottom:1rem;color:grey}.person.svelte-1a0t3m1{height:75px;width:500px;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2);margin-right:4px;border-radius:5px;transition:opacity 0.25s}.person.svelte-1a0t3m1:hover{box-shadow:4px 4px 8px 0px rgba(0, 0, 0, 0.4)}.other.svelte-1a0t3m1{background-color:lightgrey}.row.svelte-1a0t3m1{display:flex;flex-direction:row;justify-content:center;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch}.people.svelte-1a0t3m1{width:400px;display:flex;flex-direction:row;justify-content:stretch;align-items:flex-start;text-align:left;flex-wrap:nowrap;align-self:stretch}@media only screen and (max-width: 500px){.people.svelte-1a0t3m1{width:300px}.person.svelte-1a0t3m1{height:60px}}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCB7IFBhZ2UgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2luZGV4Lm1qcydcbiAgaW1wb3J0IG5hbWVzIGZyb20gJy4vY29sb3JzLmpzJ1xuICBsZXQgaG92ZXIgPSBudWxsXG4gIGxldCBjbGlja2VkID0gbnVsbFxuICBjb25zdCB0b2dnbGUgPSBmdW5jdGlvbiAoc3RyKSB7XG4gICAgaWYgKGNsaWNrZWQgPT09IHN0cikge1xuICAgICAgY2xpY2tlZCA9IG51bGxcbiAgICAgIGhvdmVyID0gbnVsbFxuICAgIH0gZWxzZSB7XG4gICAgICBjbGlja2VkID0gc3RyXG4gICAgfVxuICB9XG4gIGltcG9ydCBkYXRhIGZyb20gJy4vZGF0YS5qcydcbiAgbGV0IGNvbG9ycyA9IHtcbiAgICAnSmVubmlmZXIgS2Vlc21hYXQnOiBuYW1lc1sncGluayddLFxuICAgICdKYWNrIExheXRvbic6IG5hbWVzWyd5ZWxsb3cnXSxcbiAgICAnQmFyYmFyYSBIYWxsJzogbmFtZXNbJ211ZCddLFxuICAgICdBLiBIdW1tZXInOiBuYW1lc1sncGluayddLFxuICAgICdHZW9yZ2UgU21pdGhlcm1hbic6IG5hbWVzWydmdXNjaWEnXSxcbiAgICAnR2lsIFBlw7FhbG9zYSc6IG5hbWVzWydyb3lhbCddLFxuICAgICdKdW5lIFJvd2xhbmRzJzogbmFtZXNbJ3R1bGlwJ10sXG4gICAgJ0pvaG4gVG9yeSc6IG5hbWVzWydzZWEnXSxcbiAgICAnRG91ZyBGb3JkJzogbmFtZXNbJ3NreSddLFxuICAgICdPbGl2aWEgQ2hvdyc6IG5hbWVzWydvbGl2ZSddLFxuICAgICdBcnQgRWdnbGV0b24nOiBuYW1lc1snc3VlZGUnXSxcbiAgICAnTmF0aGFuIFBoaWxsaXBzJzogbmFtZXNbJ3NreSddLFxuICAgICdXaWxsaWFtIERlbm5pc29uJzogbmFtZXNbJ2dyZXlibHVlJ10sXG4gICAgJ1BoaWxpcCBHaXZlbnMnOiBuYW1lc1sndHVsaXAnXSxcbiAgICAnRGF2aWQgQ3JvbWJpZSc6IG5hbWVzWydvcmFuZ2UnXSxcbiAgICBcIlRvbnkgTydEb25vaHVlXCI6IG5hbWVzWydncmVlbiddLFxuICAgICdBbGxhbiBMYW1wb3J0JzogbmFtZXNbJ3JlZCddLFxuICAgICdTdGVwaGVuIENsYXJrc29udCc6IG5hbWVzWydmaXJlJ10sXG4gICAgJ01lbCBMYXN0bWFuJzogbmFtZXNbJ2NoZXJyeSddLFxuICAgICdUb29rZXIgR29tYmVyZyc6IG5hbWVzWydmaXJlJ10sXG4gICAgJ0RhdmlkIE1pbGxlcic6IG5hbWVzWydicm93biddLFxuICAgICdSb2IgRm9yZCc6IG5hbWVzWydmaXJlJ10sXG4gICAgJ0RvdWcgRm9yZCc6IG5hbWVzWydmaXJlJ10sXG4gICAgJ0NobG9lLU1hcmllIEJyb3duJzogbmFtZXNbJ3JlZCddLFxuICAgICdKb2UgUGFudGFsb25lJzogbmFtZXNbJ3NsYXRlJ10sXG4gICAgJ0Nhcm9sYW5uIFdyaWdodCc6IG5hbWVzWydncmVlbiddLFxuICAgICdBbm5lIEpvaG5zdG9uJzogbmFtZXNbJ29saXZlJ10sXG4gICAgJ0pvaG4gU2V3ZWxsJzogbmFtZXNbJ2JsdWUnXSxcbiAgICAnRG9uIEFuZHJld3MnOiBuYW1lc1sncmVkJ10sXG4gICAgJ01hcmdhcmV0IENhbXBiZWxsJzogbmFtZXNbJ3JvdWdlJ10sXG4gICAgJ1N0ZXBoZW4gQ2xhcmtzb24nOiBuYW1lc1snYmVpZ2UnXSxcbiAgICAnRG9uYWxkIFN1bW1lcnZpbGxlJzogbmFtZXNbJ2dyZXlncmVlbiddLFxuICAgICdBcnRodXIgSi4gQnJvd24nOiBuYW1lc1snc2xhdGUnXSxcbiAgICAnRm9yZCBCcmFuZCc6IG5hbWVzWydvbGl2ZSddLFxuICAgICdBcnRodXIgQnJvd24nOiBuYW1lc1snZ3JlZW4nXSxcbiAgICAnTGVzbGllIFNhdW5kZXJzJzogbmFtZXNbJ3B1cnBsZSddLFxuICAgICdSb3kgRS4gQmVseWVhJzogbmFtZXNbJ2dyZXlncmVlbiddLFxuICAgICdSb3NzIERvd3Nvbic6IG5hbWVzWydvcmFuZ2UnXSxcbiAgICAnSGlyYW0gRS4gTWNDYWxsdW0nOiBuYW1lc1sncGluayddLFxuICAgICdSb3NzIERvd3Nvbic6IG5hbWVzWydncmV5cHVycGxlJ10sXG4gICAgJ0NoYXJsZXMgTWFob25leSc6IG5hbWVzWydyb3NlJ10sXG4gIH1cbiAgZXhwb3J0IGxldCB0aXRsZSA9ICdFbGVjdGlvbnMgaW4gVG9yb250bydcbiAgZGF0YS5mb3JFYWNoKChvLCBpKSA9PiB7XG4gICAgbGV0IHN1bSA9IDBcbiAgICBvLnBlb3BsZS5mb3JFYWNoKChwKSA9PiB7XG4gICAgICBsZXQgbnVtID0gcGFyc2VJbnQocC5wZXJjZW50LnJlcGxhY2UoLyUvLCAnJykpXG4gICAgICBzdW0gKz0gbnVtXG4gICAgfSlcbiAgICBvLnllYXJzID0gNFxuICAgIGlmIChkYXRhW2kgKyAxXSkge1xuICAgICAgby55ZWFycyA9IGRhdGFbaSArIDFdLnllYXIgLSBvLnllYXJcbiAgICAgIGlmIChvLnllYXJzIDw9IDApIHtcbiAgICAgICAgby55ZWFycyA9IDFcbiAgICAgIH1cbiAgICB9XG4gICAgby5vdGhlciA9IDEwMCAtIHN1bVxuICB9KVxuPC9zY3JpcHQ+XG5cbjxQYWdlIHt0aXRsZX0+XG4gIHsjZWFjaCBkYXRhIGFzIG8sIGl9XG4gICAgPCEtLSA8ZGl2IGNsYXNzPVwicm93XCIgc3R5bGU9XCJoZWlnaHQ6e28ueWVhcnMgKiA0MH1weDtcIj4gLS0+XG4gICAgPGRpdiBjbGFzcz1cInJvdyB5ZWFyXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGlnaXRcIj57by55ZWFyfTwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cInBlb3BsZVwiPlxuICAgICAgICB7I2VhY2ggby5wZW9wbGUgYXMgcCwgaX1cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBjbGFzcz1cInBlcnNvblwiXG4gICAgICAgICAgICB0aXRsZT17cC5uYW1lfVxuICAgICAgICAgICAgY2xhc3M6c2h5PXsoaG92ZXIgJiYgaG92ZXIgIT09IHAubmFtZSkgfHwgKGNsaWNrZWQgJiYgY2xpY2tlZCAhPT0gcC5uYW1lKX1cbiAgICAgICAgICAgIHN0eWxlPVwid2lkdGg6e3AucGVyY2VudH07IGJhY2tncm91bmQtY29sb3I6e2NvbG9yc1twLm5hbWVdIHx8ICdzdGVlbGJsdWUnfTtcIlxuICAgICAgICAgICAgb246Y2xpY2s9eygpID0+IHRvZ2dsZShwLm5hbWUpfVxuICAgICAgICAgICAgb246bW91c2VlbnRlcj17KCkgPT4gKGhvdmVyID0gcC5uYW1lKX1cbiAgICAgICAgICAgIG9uOm1vdXNlbGVhdmU9eygpID0+IChob3ZlciA9IG51bGwpfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDwhLS0ge3AubmFtZX0gLS0+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIHsvZWFjaH1cbiAgICAgICAgPGRpdiBjbGFzcz1cInBlcnNvbiBvdGhlclwiIHN0eWxlPVwid2lkdGg6e28ub3RoZXJ9JTsgXCIgLz5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICB7L2VhY2h9XG48L1BhZ2U+XG5cbjxzdHlsZT5cbiAgLnNoeSB7XG4gICAgb3BhY2l0eTogMC40O1xuICB9XG4gIC55ZWFyIHtcbiAgICBtaW4taGVpZ2h0OiA5MHB4O1xuICB9XG4gIC5kaWdpdCB7XG4gICAgd2lkdGg6IDgwcHg7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgbWFyZ2luLWJvdHRvbTogMXJlbTtcbiAgICBjb2xvcjogZ3JleTtcbiAgfVxuICAucGVyc29uIHtcbiAgICBoZWlnaHQ6IDc1cHg7XG4gICAgd2lkdGg6IDUwMHB4O1xuICAgIGJveC1zaGFkb3c6IDJweCAycHggOHB4IDBweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gICAgbWFyZ2luLXJpZ2h0OiA0cHg7XG4gICAgYm9yZGVyLXJhZGl1czogNXB4O1xuICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4yNXM7XG4gIH1cbiAgLnBlcnNvbjpob3ZlciB7XG4gICAgYm94LXNoYWRvdzogNHB4IDRweCA4cHggMHB4IHJnYmEoMCwgMCwgMCwgMC40KTtcbiAgfVxuICAub3RoZXIge1xuICAgIGJhY2tncm91bmQtY29sb3I6IGxpZ2h0Z3JleTtcbiAgfVxuICAucm93IHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgZmxleC13cmFwOiB3cmFwO1xuICAgIGFsaWduLXNlbGY6IHN0cmV0Y2g7XG4gIH1cbiAgLnBlb3BsZSB7XG4gICAgd2lkdGg6IDQwMHB4O1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHN0cmV0Y2g7XG4gICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7XG4gICAgdGV4dC1hbGlnbjogbGVmdDtcbiAgICBmbGV4LXdyYXA6IG5vd3JhcDtcbiAgICBhbGlnbi1zZWxmOiBzdHJldGNoO1xuICB9XG4gIEBtZWRpYSBvbmx5IHNjcmVlbiBhbmQgKG1heC13aWR0aDogNTAwcHgpIHtcbiAgICAucGVvcGxlIHtcbiAgICAgIHdpZHRoOiAzMDBweDtcbiAgICB9XG4gICAgLnBlcnNvbiB7XG4gICAgICBoZWlnaHQ6IDYwcHg7XG4gICAgfVxuICB9XG48L3N0eWxlPlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXFHRSxJQUFJLGVBQUMsQ0FBQyxBQUNKLE9BQU8sQ0FBRSxHQUFHLEFBQ2QsQ0FBQyxBQUNELEtBQUssZUFBQyxDQUFDLEFBQ0wsVUFBVSxDQUFFLElBQUksQUFDbEIsQ0FBQyxBQUNELE1BQU0sZUFBQyxDQUFDLEFBQ04sS0FBSyxDQUFFLElBQUksQ0FDWCxPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxNQUFNLENBQ3ZCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLGFBQWEsQ0FBRSxJQUFJLENBQ25CLEtBQUssQ0FBRSxJQUFJLEFBQ2IsQ0FBQyxBQUNELE9BQU8sZUFBQyxDQUFDLEFBQ1AsTUFBTSxDQUFFLElBQUksQ0FDWixLQUFLLENBQUUsS0FBSyxDQUNaLFVBQVUsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FDOUMsWUFBWSxDQUFFLEdBQUcsQ0FDakIsYUFBYSxDQUFFLEdBQUcsQ0FDbEIsVUFBVSxDQUFFLE9BQU8sQ0FBQyxLQUFLLEFBQzNCLENBQUMsQUFDRCxzQkFBTyxNQUFNLEFBQUMsQ0FBQyxBQUNiLFVBQVUsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQUFDaEQsQ0FBQyxBQUNELE1BQU0sZUFBQyxDQUFDLEFBQ04sZ0JBQWdCLENBQUUsU0FBUyxBQUM3QixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxNQUFNLENBQ3ZCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLFNBQVMsQ0FBRSxJQUFJLENBQ2YsVUFBVSxDQUFFLE9BQU8sQUFDckIsQ0FBQyxBQUNELE9BQU8sZUFBQyxDQUFDLEFBQ1AsS0FBSyxDQUFFLEtBQUssQ0FDWixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxPQUFPLENBQ3hCLFdBQVcsQ0FBRSxVQUFVLENBQ3ZCLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLFNBQVMsQ0FBRSxNQUFNLENBQ2pCLFVBQVUsQ0FBRSxPQUFPLEFBQ3JCLENBQUMsQUFDRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFlBQVksS0FBSyxDQUFDLEFBQUMsQ0FBQyxBQUN6QyxPQUFPLGVBQUMsQ0FBQyxBQUNQLEtBQUssQ0FBRSxLQUFLLEFBQ2QsQ0FBQyxBQUNELE9BQU8sZUFBQyxDQUFDLEFBQ1AsTUFBTSxDQUFFLElBQUksQUFDZCxDQUFDLEFBQ0gsQ0FBQyJ9 */";
    	append_dev(document.head, style);
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	child_ctx[10] = i;
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	child_ctx[10] = i;
    	return child_ctx;
    }

    // (82:8) {#each o.people as p, i}
    function create_each_block_1(ctx) {
    	let div;
    	let div_title_value;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[5](/*p*/ ctx[11], ...args);
    	}

    	function mouseenter_handler(...args) {
    		return /*mouseenter_handler*/ ctx[6](/*p*/ ctx[11], ...args);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "person svelte-1a0t3m1");
    			attr_dev(div, "title", div_title_value = /*p*/ ctx[11].name);
    			set_style(div, "width", /*p*/ ctx[11].percent);
    			set_style(div, "background-color", /*colors*/ ctx[4][/*p*/ ctx[11].name] || "steelblue");
    			toggle_class(div, "shy", /*hover*/ ctx[1] && /*hover*/ ctx[1] !== /*p*/ ctx[11].name || /*clicked*/ ctx[2] && /*clicked*/ ctx[2] !== /*p*/ ctx[11].name);
    			add_location(div, file$3, 82, 10, 2465);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div, "click", click_handler, false, false, false),
    					listen_dev(div, "mouseenter", mouseenter_handler, false, false, false),
    					listen_dev(div, "mouseleave", /*mouseleave_handler*/ ctx[7], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*hover, data, clicked*/ 6) {
    				toggle_class(div, "shy", /*hover*/ ctx[1] && /*hover*/ ctx[1] !== /*p*/ ctx[11].name || /*clicked*/ ctx[2] && /*clicked*/ ctx[2] !== /*p*/ ctx[11].name);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(82:8) {#each o.people as p, i}",
    		ctx
    	});

    	return block;
    }

    // (77:2) {#each data as o, i}
    function create_each_block(ctx) {
    	let div3;
    	let div0;
    	let t0_value = /*o*/ ctx[8].year + "";
    	let t0;
    	let t1;
    	let div2;
    	let t2;
    	let div1;
    	let t3;
    	let each_value_1 = /*o*/ ctx[8].people;
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div2 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			div1 = element("div");
    			t3 = space();
    			attr_dev(div0, "class", "digit svelte-1a0t3m1");
    			add_location(div0, file$3, 79, 6, 2361);
    			attr_dev(div1, "class", "person other svelte-1a0t3m1");
    			set_style(div1, "width", /*o*/ ctx[8].other + "%");
    			add_location(div1, file$3, 94, 8, 2927);
    			attr_dev(div2, "class", "people svelte-1a0t3m1");
    			add_location(div2, file$3, 80, 6, 2401);
    			attr_dev(div3, "class", "row year svelte-1a0t3m1");
    			add_location(div3, file$3, 78, 4, 2332);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, t0);
    			append_dev(div3, t1);
    			append_dev(div3, div2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div3, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, colors, hover, clicked, toggle*/ 30) {
    				each_value_1 = /*o*/ ctx[8].people;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, t2);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(77:2) {#each data as o, i}",
    		ctx
    	});

    	return block;
    }

    // (76:0) <Page {title}>
    function create_default_slot(ctx) {
    	let each_1_anchor;
    	let each_value = data;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

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
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, colors, hover, clicked, toggle*/ 30) {
    				each_value = data;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
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
    		source: "(76:0) <Page {title}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let page;
    	let current;

    	page = new Page({
    			props: {
    				title: /*title*/ ctx[0],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(page.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(page, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const page_changes = {};
    			if (dirty & /*title*/ 1) page_changes.title = /*title*/ ctx[0];

    			if (dirty & /*$$scope, hover, clicked*/ 8198) {
    				page_changes.$$scope = { dirty, ctx };
    			}

    			page.$set(page_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(page.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(page.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(page, detaching);
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

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Post", slots, []);
    	let hover = null;
    	let clicked = null;

    	const toggle = function (str) {
    		if (clicked === str) {
    			$$invalidate(2, clicked = null);
    			$$invalidate(1, hover = null);
    		} else {
    			$$invalidate(2, clicked = str);
    		}
    	};

    	let colors = {
    		"Jennifer Keesmaat": names["pink"],
    		"Jack Layton": names["yellow"],
    		"Barbara Hall": names["mud"],
    		"A. Hummer": names["pink"],
    		"George Smitherman": names["fuscia"],
    		"Gil Peñalosa": names["royal"],
    		"June Rowlands": names["tulip"],
    		"John Tory": names["sea"],
    		"Doug Ford": names["sky"],
    		"Olivia Chow": names["olive"],
    		"Art Eggleton": names["suede"],
    		"Nathan Phillips": names["sky"],
    		"William Dennison": names["greyblue"],
    		"Philip Givens": names["tulip"],
    		"David Crombie": names["orange"],
    		"Tony O'Donohue": names["green"],
    		"Allan Lamport": names["red"],
    		"Stephen Clarksont": names["fire"],
    		"Mel Lastman": names["cherry"],
    		"Tooker Gomberg": names["fire"],
    		"David Miller": names["brown"],
    		"Rob Ford": names["fire"],
    		"Doug Ford": names["fire"],
    		"Chloe-Marie Brown": names["red"],
    		"Joe Pantalone": names["slate"],
    		"Carolann Wright": names["green"],
    		"Anne Johnston": names["olive"],
    		"John Sewell": names["blue"],
    		"Don Andrews": names["red"],
    		"Margaret Campbell": names["rouge"],
    		"Stephen Clarkson": names["beige"],
    		"Donald Summerville": names["greygreen"],
    		"Arthur J. Brown": names["slate"],
    		"Ford Brand": names["olive"],
    		"Arthur Brown": names["green"],
    		"Leslie Saunders": names["purple"],
    		"Roy E. Belyea": names["greygreen"],
    		"Ross Dowson": names["orange"],
    		"Hiram E. McCallum": names["pink"],
    		"Ross Dowson": names["greypurple"],
    		"Charles Mahoney": names["rose"]
    	};

    	let { title = "Elections in Toronto" } = $$props;

    	data.forEach((o, i) => {
    		let sum = 0;

    		o.people.forEach(p => {
    			let num = parseInt(p.percent.replace(/%/, ""));
    			sum += num;
    		});

    		o.years = 4;

    		if (data[i + 1]) {
    			o.years = data[i + 1].year - o.year;

    			if (o.years <= 0) {
    				o.years = 1;
    			}
    		}

    		o.other = 100 - sum;
    	});

    	const writable_props = ["title"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	const click_handler = p => toggle(p.name);
    	const mouseenter_handler = p => $$invalidate(1, hover = p.name);
    	const mouseleave_handler = () => $$invalidate(1, hover = null);

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    	};

    	$$self.$capture_state = () => ({
    		Page,
    		names,
    		hover,
    		clicked,
    		toggle,
    		data,
    		colors,
    		title
    	});

    	$$self.$inject_state = $$props => {
    		if ("hover" in $$props) $$invalidate(1, hover = $$props.hover);
    		if ("clicked" in $$props) $$invalidate(2, clicked = $$props.clicked);
    		if ("colors" in $$props) $$invalidate(4, colors = $$props.colors);
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		title,
    		hover,
    		clicked,
    		toggle,
    		colors,
    		click_handler,
    		mouseenter_handler,
    		mouseleave_handler
    	];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1a0t3m1-style")) add_css$3();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { title: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get title() {
    		throw new Error("<Post>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
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