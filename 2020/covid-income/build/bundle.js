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

    function noop$1() { }
    function assign$1(tar, src) {
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
    function create_slot$1(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context$1(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context$1(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign$1($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes$1(definition, $$scope, dirty, fn) {
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
    function update_slot$1(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes$1(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context$1(slot_definition, ctx, $$scope, get_slot_context_fn);
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
    function svg_element$1(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text$1(data) {
        return document.createTextNode(data);
    }
    function space$1() {
        return text$1(' ');
    }
    function empty() {
        return text$1('');
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

    const globals = (typeof window !== 'undefined'
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

    //a very-tiny version of d3-scale's scaleLinear
    const scaleLinear = function (obj) {
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

    // let scale = scaleLinear({
    //   world: [0, 300],
    //   minmax: [0, 100]
    // })
    // console.log(scale(50))

    const pi = Math.PI,
        tau = 2 * pi,
        epsilon = 1e-6,
        tauEpsilon = tau - epsilon;

    function Path() {
      this._x0 = this._y0 = // start of current subpath
      this._x1 = this._y1 = null; // end of current subpath
      this._ = "";
    }

    function path() {
      return new Path;
    }

    Path.prototype = path.prototype = {
      constructor: Path,
      moveTo: function(x, y) {
        this._ += "M" + (this._x0 = this._x1 = +x) + "," + (this._y0 = this._y1 = +y);
      },
      closePath: function() {
        if (this._x1 !== null) {
          this._x1 = this._x0, this._y1 = this._y0;
          this._ += "Z";
        }
      },
      lineTo: function(x, y) {
        this._ += "L" + (this._x1 = +x) + "," + (this._y1 = +y);
      },
      quadraticCurveTo: function(x1, y1, x, y) {
        this._ += "Q" + (+x1) + "," + (+y1) + "," + (this._x1 = +x) + "," + (this._y1 = +y);
      },
      bezierCurveTo: function(x1, y1, x2, y2, x, y) {
        this._ += "C" + (+x1) + "," + (+y1) + "," + (+x2) + "," + (+y2) + "," + (this._x1 = +x) + "," + (this._y1 = +y);
      },
      arcTo: function(x1, y1, x2, y2, r) {
        x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;
        var x0 = this._x1,
            y0 = this._y1,
            x21 = x2 - x1,
            y21 = y2 - y1,
            x01 = x0 - x1,
            y01 = y0 - y1,
            l01_2 = x01 * x01 + y01 * y01;

        // Is the radius negative? Error.
        if (r < 0) throw new Error("negative radius: " + r);

        // Is this path empty? Move to (x1,y1).
        if (this._x1 === null) {
          this._ += "M" + (this._x1 = x1) + "," + (this._y1 = y1);
        }

        // Or, is (x1,y1) coincident with (x0,y0)? Do nothing.
        else if (!(l01_2 > epsilon));

        // Or, are (x0,y0), (x1,y1) and (x2,y2) collinear?
        // Equivalently, is (x1,y1) coincident with (x2,y2)?
        // Or, is the radius zero? Line to (x1,y1).
        else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon) || !r) {
          this._ += "L" + (this._x1 = x1) + "," + (this._y1 = y1);
        }

        // Otherwise, draw an arc!
        else {
          var x20 = x2 - x0,
              y20 = y2 - y0,
              l21_2 = x21 * x21 + y21 * y21,
              l20_2 = x20 * x20 + y20 * y20,
              l21 = Math.sqrt(l21_2),
              l01 = Math.sqrt(l01_2),
              l = r * Math.tan((pi - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2),
              t01 = l / l01,
              t21 = l / l21;

          // If the start tangent is not coincident with (x0,y0), line to.
          if (Math.abs(t01 - 1) > epsilon) {
            this._ += "L" + (x1 + t01 * x01) + "," + (y1 + t01 * y01);
          }

          this._ += "A" + r + "," + r + ",0,0," + (+(y01 * x20 > x01 * y20)) + "," + (this._x1 = x1 + t21 * x21) + "," + (this._y1 = y1 + t21 * y21);
        }
      },
      arc: function(x, y, r, a0, a1, ccw) {
        x = +x, y = +y, r = +r, ccw = !!ccw;
        var dx = r * Math.cos(a0),
            dy = r * Math.sin(a0),
            x0 = x + dx,
            y0 = y + dy,
            cw = 1 ^ ccw,
            da = ccw ? a0 - a1 : a1 - a0;

        // Is the radius negative? Error.
        if (r < 0) throw new Error("negative radius: " + r);

        // Is this path empty? Move to (x0,y0).
        if (this._x1 === null) {
          this._ += "M" + x0 + "," + y0;
        }

        // Or, is (x0,y0) not coincident with the previous point? Line to (x0,y0).
        else if (Math.abs(this._x1 - x0) > epsilon || Math.abs(this._y1 - y0) > epsilon) {
          this._ += "L" + x0 + "," + y0;
        }

        // Is this arc empty? We’re done.
        if (!r) return;

        // Does the angle go the wrong way? Flip the direction.
        if (da < 0) da = da % tau + tau;

        // Is this a complete circle? Draw two arcs to complete the circle.
        if (da > tauEpsilon) {
          this._ += "A" + r + "," + r + ",0,1," + cw + "," + (x - dx) + "," + (y - dy) + "A" + r + "," + r + ",0,1," + cw + "," + (this._x1 = x0) + "," + (this._y1 = y0);
        }

        // Is this arc non-empty? Draw an arc!
        else if (da > epsilon) {
          this._ += "A" + r + "," + r + ",0," + (+(da >= pi)) + "," + cw + "," + (this._x1 = x + r * Math.cos(a1)) + "," + (this._y1 = y + r * Math.sin(a1));
        }
      },
      rect: function(x, y, w, h) {
        this._ += "M" + (this._x0 = this._x1 = +x) + "," + (this._y0 = this._y1 = +y) + "h" + (+w) + "v" + (+h) + "h" + (-w) + "Z";
      },
      toString: function() {
        return this._;
      }
    };

    function constant(x) {
      return function constant() {
        return x;
      };
    }

    var abs = Math.abs;
    var atan2 = Math.atan2;
    var cos = Math.cos;
    var max = Math.max;
    var min = Math.min;
    var sin = Math.sin;
    var sqrt = Math.sqrt;

    var epsilon$1 = 1e-12;
    var pi$1 = Math.PI;
    var halfPi = pi$1 / 2;
    var tau$1 = 2 * pi$1;

    function acos(x) {
      return x > 1 ? 0 : x < -1 ? pi$1 : Math.acos(x);
    }

    function asin(x) {
      return x >= 1 ? halfPi : x <= -1 ? -halfPi : Math.asin(x);
    }

    function arcInnerRadius(d) {
      return d.innerRadius;
    }

    function arcOuterRadius(d) {
      return d.outerRadius;
    }

    function arcStartAngle(d) {
      return d.startAngle;
    }

    function arcEndAngle(d) {
      return d.endAngle;
    }

    function arcPadAngle(d) {
      return d && d.padAngle; // Note: optional!
    }

    function intersect(x0, y0, x1, y1, x2, y2, x3, y3) {
      var x10 = x1 - x0, y10 = y1 - y0,
          x32 = x3 - x2, y32 = y3 - y2,
          t = y32 * x10 - x32 * y10;
      if (t * t < epsilon$1) return;
      t = (x32 * (y0 - y2) - y32 * (x0 - x2)) / t;
      return [x0 + t * x10, y0 + t * y10];
    }

    // Compute perpendicular offset line of length rc.
    // http://mathworld.wolfram.com/Circle-LineIntersection.html
    function cornerTangents(x0, y0, x1, y1, r1, rc, cw) {
      var x01 = x0 - x1,
          y01 = y0 - y1,
          lo = (cw ? rc : -rc) / sqrt(x01 * x01 + y01 * y01),
          ox = lo * y01,
          oy = -lo * x01,
          x11 = x0 + ox,
          y11 = y0 + oy,
          x10 = x1 + ox,
          y10 = y1 + oy,
          x00 = (x11 + x10) / 2,
          y00 = (y11 + y10) / 2,
          dx = x10 - x11,
          dy = y10 - y11,
          d2 = dx * dx + dy * dy,
          r = r1 - rc,
          D = x11 * y10 - x10 * y11,
          d = (dy < 0 ? -1 : 1) * sqrt(max(0, r * r * d2 - D * D)),
          cx0 = (D * dy - dx * d) / d2,
          cy0 = (-D * dx - dy * d) / d2,
          cx1 = (D * dy + dx * d) / d2,
          cy1 = (-D * dx + dy * d) / d2,
          dx0 = cx0 - x00,
          dy0 = cy0 - y00,
          dx1 = cx1 - x00,
          dy1 = cy1 - y00;

      // Pick the closer of the two intersection points.
      // TODO Is there a faster way to determine which intersection to use?
      if (dx0 * dx0 + dy0 * dy0 > dx1 * dx1 + dy1 * dy1) cx0 = cx1, cy0 = cy1;

      return {
        cx: cx0,
        cy: cy0,
        x01: -ox,
        y01: -oy,
        x11: cx0 * (r1 / r - 1),
        y11: cy0 * (r1 / r - 1)
      };
    }

    function arc() {
      var innerRadius = arcInnerRadius,
          outerRadius = arcOuterRadius,
          cornerRadius = constant(0),
          padRadius = null,
          startAngle = arcStartAngle,
          endAngle = arcEndAngle,
          padAngle = arcPadAngle,
          context = null;

      function arc() {
        var buffer,
            r,
            r0 = +innerRadius.apply(this, arguments),
            r1 = +outerRadius.apply(this, arguments),
            a0 = startAngle.apply(this, arguments) - halfPi,
            a1 = endAngle.apply(this, arguments) - halfPi,
            da = abs(a1 - a0),
            cw = a1 > a0;

        if (!context) context = buffer = path();

        // Ensure that the outer radius is always larger than the inner radius.
        if (r1 < r0) r = r1, r1 = r0, r0 = r;

        // Is it a point?
        if (!(r1 > epsilon$1)) context.moveTo(0, 0);

        // Or is it a circle or annulus?
        else if (da > tau$1 - epsilon$1) {
          context.moveTo(r1 * cos(a0), r1 * sin(a0));
          context.arc(0, 0, r1, a0, a1, !cw);
          if (r0 > epsilon$1) {
            context.moveTo(r0 * cos(a1), r0 * sin(a1));
            context.arc(0, 0, r0, a1, a0, cw);
          }
        }

        // Or is it a circular or annular sector?
        else {
          var a01 = a0,
              a11 = a1,
              a00 = a0,
              a10 = a1,
              da0 = da,
              da1 = da,
              ap = padAngle.apply(this, arguments) / 2,
              rp = (ap > epsilon$1) && (padRadius ? +padRadius.apply(this, arguments) : sqrt(r0 * r0 + r1 * r1)),
              rc = min(abs(r1 - r0) / 2, +cornerRadius.apply(this, arguments)),
              rc0 = rc,
              rc1 = rc,
              t0,
              t1;

          // Apply padding? Note that since r1 ≥ r0, da1 ≥ da0.
          if (rp > epsilon$1) {
            var p0 = asin(rp / r0 * sin(ap)),
                p1 = asin(rp / r1 * sin(ap));
            if ((da0 -= p0 * 2) > epsilon$1) p0 *= (cw ? 1 : -1), a00 += p0, a10 -= p0;
            else da0 = 0, a00 = a10 = (a0 + a1) / 2;
            if ((da1 -= p1 * 2) > epsilon$1) p1 *= (cw ? 1 : -1), a01 += p1, a11 -= p1;
            else da1 = 0, a01 = a11 = (a0 + a1) / 2;
          }

          var x01 = r1 * cos(a01),
              y01 = r1 * sin(a01),
              x10 = r0 * cos(a10),
              y10 = r0 * sin(a10);

          // Apply rounded corners?
          if (rc > epsilon$1) {
            var x11 = r1 * cos(a11),
                y11 = r1 * sin(a11),
                x00 = r0 * cos(a00),
                y00 = r0 * sin(a00),
                oc;

            // Restrict the corner radius according to the sector angle.
            if (da < pi$1 && (oc = intersect(x01, y01, x00, y00, x11, y11, x10, y10))) {
              var ax = x01 - oc[0],
                  ay = y01 - oc[1],
                  bx = x11 - oc[0],
                  by = y11 - oc[1],
                  kc = 1 / sin(acos((ax * bx + ay * by) / (sqrt(ax * ax + ay * ay) * sqrt(bx * bx + by * by))) / 2),
                  lc = sqrt(oc[0] * oc[0] + oc[1] * oc[1]);
              rc0 = min(rc, (r0 - lc) / (kc - 1));
              rc1 = min(rc, (r1 - lc) / (kc + 1));
            }
          }

          // Is the sector collapsed to a line?
          if (!(da1 > epsilon$1)) context.moveTo(x01, y01);

          // Does the sector’s outer ring have rounded corners?
          else if (rc1 > epsilon$1) {
            t0 = cornerTangents(x00, y00, x01, y01, r1, rc1, cw);
            t1 = cornerTangents(x11, y11, x10, y10, r1, rc1, cw);

            context.moveTo(t0.cx + t0.x01, t0.cy + t0.y01);

            // Have the corners merged?
            if (rc1 < rc) context.arc(t0.cx, t0.cy, rc1, atan2(t0.y01, t0.x01), atan2(t1.y01, t1.x01), !cw);

            // Otherwise, draw the two corners and the ring.
            else {
              context.arc(t0.cx, t0.cy, rc1, atan2(t0.y01, t0.x01), atan2(t0.y11, t0.x11), !cw);
              context.arc(0, 0, r1, atan2(t0.cy + t0.y11, t0.cx + t0.x11), atan2(t1.cy + t1.y11, t1.cx + t1.x11), !cw);
              context.arc(t1.cx, t1.cy, rc1, atan2(t1.y11, t1.x11), atan2(t1.y01, t1.x01), !cw);
            }
          }

          // Or is the outer ring just a circular arc?
          else context.moveTo(x01, y01), context.arc(0, 0, r1, a01, a11, !cw);

          // Is there no inner ring, and it’s a circular sector?
          // Or perhaps it’s an annular sector collapsed due to padding?
          if (!(r0 > epsilon$1) || !(da0 > epsilon$1)) context.lineTo(x10, y10);

          // Does the sector’s inner ring (or point) have rounded corners?
          else if (rc0 > epsilon$1) {
            t0 = cornerTangents(x10, y10, x11, y11, r0, -rc0, cw);
            t1 = cornerTangents(x01, y01, x00, y00, r0, -rc0, cw);

            context.lineTo(t0.cx + t0.x01, t0.cy + t0.y01);

            // Have the corners merged?
            if (rc0 < rc) context.arc(t0.cx, t0.cy, rc0, atan2(t0.y01, t0.x01), atan2(t1.y01, t1.x01), !cw);

            // Otherwise, draw the two corners and the ring.
            else {
              context.arc(t0.cx, t0.cy, rc0, atan2(t0.y01, t0.x01), atan2(t0.y11, t0.x11), !cw);
              context.arc(0, 0, r0, atan2(t0.cy + t0.y11, t0.cx + t0.x11), atan2(t1.cy + t1.y11, t1.cx + t1.x11), cw);
              context.arc(t1.cx, t1.cy, rc0, atan2(t1.y11, t1.x11), atan2(t1.y01, t1.x01), !cw);
            }
          }

          // Or is the inner ring just a circular arc?
          else context.arc(0, 0, r0, a10, a00, cw);
        }

        context.closePath();

        if (buffer) return context = null, buffer + "" || null;
      }

      arc.centroid = function() {
        var r = (+innerRadius.apply(this, arguments) + +outerRadius.apply(this, arguments)) / 2,
            a = (+startAngle.apply(this, arguments) + +endAngle.apply(this, arguments)) / 2 - pi$1 / 2;
        return [cos(a) * r, sin(a) * r];
      };

      arc.innerRadius = function(_) {
        return arguments.length ? (innerRadius = typeof _ === "function" ? _ : constant(+_), arc) : innerRadius;
      };

      arc.outerRadius = function(_) {
        return arguments.length ? (outerRadius = typeof _ === "function" ? _ : constant(+_), arc) : outerRadius;
      };

      arc.cornerRadius = function(_) {
        return arguments.length ? (cornerRadius = typeof _ === "function" ? _ : constant(+_), arc) : cornerRadius;
      };

      arc.padRadius = function(_) {
        return arguments.length ? (padRadius = _ == null ? null : typeof _ === "function" ? _ : constant(+_), arc) : padRadius;
      };

      arc.startAngle = function(_) {
        return arguments.length ? (startAngle = typeof _ === "function" ? _ : constant(+_), arc) : startAngle;
      };

      arc.endAngle = function(_) {
        return arguments.length ? (endAngle = typeof _ === "function" ? _ : constant(+_), arc) : endAngle;
      };

      arc.padAngle = function(_) {
        return arguments.length ? (padAngle = typeof _ === "function" ? _ : constant(+_), arc) : padAngle;
      };

      arc.context = function(_) {
        return arguments.length ? ((context = _ == null ? null : _), arc) : context;
      };

      return arc;
    }

    function array(x) {
      return typeof x === "object" && "length" in x
        ? x // Array, TypedArray, NodeList, array-like
        : Array.from(x); // Map, Set, iterable, string, or anything else
    }

    function Linear(context) {
      this._context = context;
    }

    Linear.prototype = {
      areaStart: function() {
        this._line = 0;
      },
      areaEnd: function() {
        this._line = NaN;
      },
      lineStart: function() {
        this._point = 0;
      },
      lineEnd: function() {
        if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
        this._line = 1 - this._line;
      },
      point: function(x, y) {
        x = +x, y = +y;
        switch (this._point) {
          case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
          case 1: this._point = 2; // proceed
          default: this._context.lineTo(x, y); break;
        }
      }
    };

    function curveLinear(context) {
      return new Linear(context);
    }

    function x(p) {
      return p[0];
    }

    function y(p) {
      return p[1];
    }

    function line(x$1, y$1) {
      var defined = constant(true),
          context = null,
          curve = curveLinear,
          output = null;

      x$1 = typeof x$1 === "function" ? x$1 : (x$1 === undefined) ? x : constant(x$1);
      y$1 = typeof y$1 === "function" ? y$1 : (y$1 === undefined) ? y : constant(y$1);

      function line(data) {
        var i,
            n = (data = array(data)).length,
            d,
            defined0 = false,
            buffer;

        if (context == null) output = curve(buffer = path());

        for (i = 0; i <= n; ++i) {
          if (!(i < n && defined(d = data[i], i, data)) === defined0) {
            if (defined0 = !defined0) output.lineStart();
            else output.lineEnd();
          }
          if (defined0) output.point(+x$1(d, i, data), +y$1(d, i, data));
        }

        if (buffer) return output = null, buffer + "" || null;
      }

      line.x = function(_) {
        return arguments.length ? (x$1 = typeof _ === "function" ? _ : constant(+_), line) : x$1;
      };

      line.y = function(_) {
        return arguments.length ? (y$1 = typeof _ === "function" ? _ : constant(+_), line) : y$1;
      };

      line.defined = function(_) {
        return arguments.length ? (defined = typeof _ === "function" ? _ : constant(!!_), line) : defined;
      };

      line.curve = function(_) {
        return arguments.length ? (curve = _, context != null && (output = curve(context)), line) : curve;
      };

      line.context = function(_) {
        return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), line) : context;
      };

      return line;
    }

    var curveRadialLinear = curveRadial(curveLinear);

    function Radial(curve) {
      this._curve = curve;
    }

    Radial.prototype = {
      areaStart: function() {
        this._curve.areaStart();
      },
      areaEnd: function() {
        this._curve.areaEnd();
      },
      lineStart: function() {
        this._curve.lineStart();
      },
      lineEnd: function() {
        this._curve.lineEnd();
      },
      point: function(a, r) {
        this._curve.point(r * Math.sin(a), r * -Math.cos(a));
      }
    };

    function curveRadial(curve) {

      function radial(context) {
        return new Radial(curve(context));
      }

      radial._curve = curve;

      return radial;
    }

    function lineRadial(l) {
      var c = l.curve;

      l.angle = l.x, delete l.x;
      l.radius = l.y, delete l.y;

      l.curve = function(_) {
        return arguments.length ? c(curveRadial(_)) : c()._curve;
      };

      return l;
    }

    function lineRadial$1() {
      return lineRadial(line().curve(curveRadialLinear));
    }

    const drawArcs = function (arcs, xScale, rScale, q, rotate) {
      return arcs.map((obj) => {
        let r = rScale(obj.radius);
        let attrs = {
          startAngle: xScale(obj.to) - q + rotate,
          endAngle: xScale(obj.from) - q + rotate,
          innerRadius: r,
          outerRadius: r + rScale(obj.width)
        };
        let path = arc()(attrs);
        return {
          type: 'arc',
          path: path,
          color: obj.color
        }
      })
    };

    const drawArcs$1 = function (arcs, xScale, rScale, q, rotate) {
      return arcs.map((obj) => {
        let r = rScale(obj.radius);
        let attrs = {
          startAngle: xScale(obj.to) - q + rotate,
          endAngle: xScale(obj.from) - q + rotate,
          innerRadius: r,
          outerRadius: r + rScale(obj.width)
        };
        let path = arc()(attrs);
        let clockwise = attrs.endAngle < attrs.startAngle;
        let arrow = {};
        return {
          type: 'arrow',
          clockwise: clockwise,
          path: path,
          color: obj.color,
          arrow: arrow
        }
      })
    };

    const drawLines = function (lines, xScale, rScale, q, rotate) {
      // draw lines
      return lines.map((obj) => {
        let data = [
          { angle: obj.angle, radius: obj.radius },
          { angle: obj.angle, radius: obj.length + obj.radius }
        ];
        let path = lineRadial$1()
          .angle((d) => xScale(d.angle) - q + rotate)
          .radius((d) => rScale(d.radius));
        return {
          type: 'line',
          path: path(data),
          color: obj.color,
          width: obj.width
        }
      })
    };

    const findPoint = function (angle, r) {
      return {
        x: r * Math.sin(angle),
        y: -r * Math.cos(angle)
      }
    };

    const drawLabels = function (labels, xScale, rScale, q, rotate) {
      return labels.map((obj) => {
        let point = findPoint(xScale(obj.angle) - q + rotate, rScale(obj.radius));
        let angle = obj.angle;
        // don't go upside-down
        if (angle > 90) {
          angle -= 180;
          obj.align = obj.align === 'left' ? 'right' : 'left';
        } else if (angle < -90) {
          angle += 180;
          obj.align = obj.align === 'left' ? 'right' : 'left';
        }
        // console.log(obj.rotate)
        if (angle > 0) {
          angle -= obj.rotate;
        } else {
          angle += obj.rotate;
        }
        return {
          type: 'label',
          x: point.x,
          y: point.y,
          angle: angle,
          align: obj.align === 'left' ? 'start' : 'end',
          size: obj.size,
          text: obj.text,
          color: obj.color
        }
      })
    };

    const findPoint$1 = function (angle, r) {
      return {
        x: r * Math.sin(angle),
        y: -r * Math.cos(angle)
      }
    };

    const drawLabels$1 = function (labels, xScale, rScale, q, rotate) {
      return labels.map((obj) => {
        let point = findPoint$1(xScale(obj.angle) - q + rotate, rScale(obj.radius));
        let angle = obj.angle;
        // don't go upside-down
        if (angle > 90) {
          angle -= 180;
          obj.align = obj.align === 'left' ? 'right' : 'left';
        } else if (angle < -90) {
          angle += 180;
          obj.align = obj.align === 'left' ? 'right' : 'left';
        }
        // console.log(obj.rotate)
        if (angle > 0) {
          angle -= obj.rotate;
        } else {
          angle += obj.rotate;
        }
        return {
          type: 'tick',
          x: point.x,
          y: point.y,
          angle: angle,
          align: obj.align === 'left' ? 'start' : 'end',
          size: obj.size,
          text: obj.text,
          color: obj.color
        }
      })
    };

    //export let name = ''

    let q = Math.PI / 2;
    const trig = [-Math.PI, Math.PI];

    function toRadian(deg) {
      var pi = Math.PI;
      return deg * (pi / 180)
    }

    const maxRadius = function (shapes) {
      let max = 0;
      shapes.forEach((o) => {
        let r = o.radius + o.width;
        if (r > max) {
          max = r;
        }
      });
      return max
    };

    const layout = function (arcs, lines, labels, ticks, arrows, world) {
      let xScale = scaleLinear({ minmax: [world.from, world.to], world: trig });
      let rotate = toRadian(world.rotate);
      // console.log(world.rotate)

      let arr = arcs.concat(lines, labels, arrows);
      let maxR = maxRadius(arr);
      maxR = maxR + world.margin;
      let rScale = scaleLinear({ minmax: [0, maxR], world: [0, 50] });

      // draw arcs
      let shapes = drawArcs(arcs, xScale, rScale, q, rotate);
      // draw lines
      shapes = shapes.concat(drawLines(lines, xScale, rScale, q, rotate));
      // draw kabeks
      shapes = shapes.concat(drawLabels(labels, xScale, rScale, q, rotate));
      // draw ticks
      shapes = shapes.concat(drawLabels$1(ticks, xScale, rScale, q, rotate));
      // draw arrows
      shapes = shapes.concat(drawArcs$1(arrows, xScale, rScale, q, rotate));
      return shapes
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

    const arcs = writable([]);
    const lines = writable([]);
    const labels = writable([]);
    const ticks = writable([]);
    const arrows = writable([]);
    //
    // export const _rotate = 0

    /* Users/spencer/mountain/somehow-circle/src/Round.svelte generated by Svelte v3.29.0 */

    const { console: console_1 } = globals;
    const file$3 = "Users/spencer/mountain/somehow-circle/src/Round.svelte";

    function add_css$3() {
    	var style = element$1("style");
    	style.id = "svelte-1lnhtnf-style";
    	style.textContent = "path.svelte-1lnhtnf{pointer-events:all}path.svelte-1lnhtnf:hover{filter:drop-shadow(0px 1px 1px steelblue)}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUm91bmQuc3ZlbHRlIiwic291cmNlcyI6WyJSb3VuZC5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbiAgaW1wb3J0IHsgb25Nb3VudCB9IGZyb20gJ3N2ZWx0ZSdcbiAgaW1wb3J0IGxheW91dCBmcm9tICcuL2xheW91dCdcbiAgaW1wb3J0IHsgYXJjcywgbGluZXMsIGxhYmVscywgdGlja3MsIGFycm93cyB9IGZyb20gJy4vc3RvcmVzLmpzJ1xuXG4gIGV4cG9ydCBsZXQgcmFkaXVzID0gNTAwXG4gIGV4cG9ydCBsZXQgcm90YXRlID0gMFxuICBleHBvcnQgbGV0IGZyb20gPSAwXG4gIGV4cG9ydCBsZXQgdG8gPSAzNjBcbiAgZXhwb3J0IGxldCBtYXJnaW4gPSAwXG4gIHJhZGl1cyA9IE51bWJlcihyYWRpdXMpXG5cbiAgbGV0IHdvcmxkID0ge1xuICAgIHJhZGl1czogcmFkaXVzLFxuICAgIHJvdGF0ZTogTnVtYmVyKHJvdGF0ZSksXG4gICAgZnJvbTogTnVtYmVyKGZyb20pLFxuICAgIHRvOiBOdW1iZXIodG8pLFxuICAgIG1hcmdpbjogTnVtYmVyKG1hcmdpbilcbiAgfVxuICBsZXQgc2hhcGVzID0gW11cbiAgb25Nb3VudCgoKSA9PiB7XG4gICAgc2hhcGVzID0gbGF5b3V0KCRhcmNzLCAkbGluZXMsICRsYWJlbHMsICR0aWNrcywgJGFycm93cywgd29ybGQpXG4gICAgY29uc29sZS5sb2coc2hhcGVzKVxuICB9KVxuPC9zY3JpcHQ+XG5cbjxzdHlsZT5cbiAgcGF0aCB7XG4gICAgcG9pbnRlci1ldmVudHM6IGFsbDtcbiAgfVxuICBwYXRoOmhvdmVyIHtcbiAgICBmaWx0ZXI6IGRyb3Atc2hhZG93KDBweCAxcHggMXB4IHN0ZWVsYmx1ZSk7XG4gIH1cbjwvc3R5bGU+XG5cbjxkaXYgY2xhc3M9XCJjb250YWluZXJcIj5cbiAgPHN2ZyB2aWV3Qm94PVwiLTUwLC01MCwxMDAsMTAwXCIgc2hhcGUtcmVuZGVyaW5nPVwiZ2VvbWV0cmljUHJlY2lzaW9uXCIgd2lkdGg9XCIxMDAlXCIgaGVpZ2h0PVwiMTAwJVwiPlxuXG4gICAgPCEtLSBhcnJvdy1oZWFkIC0tPlxuICAgIDxkZWZzPlxuICAgICAgPG1hcmtlclxuICAgICAgICBpZD1cInRyaWFuZ2xlXCJcbiAgICAgICAgdmlld0JveD1cIjAgMCAxMCAxMFwiXG4gICAgICAgIHJlZlg9XCI0XCJcbiAgICAgICAgcmVmWT1cIjZcIlxuICAgICAgICBtYXJrZXJVbml0cz1cInN0cm9rZVdpZHRoXCJcbiAgICAgICAgbWFya2VyV2lkdGg9XCI5XCJcbiAgICAgICAgbWFya2VySGVpZ2h0PVwiOVwiXG4gICAgICAgIG9yaWVudD1cImF1dG9cIj5cbiAgICAgICAgPHBhdGggZD1cIk0gMCAwIEwgMTAgNCBMIDAgMTAgelwiIGZpbGw9XCIjRDY4ODgxXCIgdHJhbnNmb3JtPVwicm90YXRlKDIzKVwiIC8+XG4gICAgICA8L21hcmtlcj5cbiAgICA8L2RlZnM+XG5cbiAgICB7I2VhY2ggc2hhcGVzIGFzIG99XG4gICAgICB7I2lmIG8udHlwZSA9PT0gJ2FyYyd9XG4gICAgICAgIDxwYXRoIGNsYXNzPVwibGlua1wiIGQ9e28ucGF0aH0gc3Ryb2tlPVwibm9uZVwiIGZpbGw9e28uY29sb3J9IHN0eWxlPVwiXCIgc3Ryb2tlLXdpZHRoPXsxfSAvPlxuICAgICAgey9pZn1cbiAgICAgIHsjaWYgby50eXBlID09PSAnbGluZSd9XG4gICAgICAgIDxwYXRoXG4gICAgICAgICAgY2xhc3M9XCJsaW5rXCJcbiAgICAgICAgICBkPXtvLnBhdGh9XG4gICAgICAgICAgc3Ryb2tlPXtvLmNvbG9yfVxuICAgICAgICAgIGZpbGw9e28uY29sb3J9XG4gICAgICAgICAgc3R5bGU9XCJcIlxuICAgICAgICAgIHN0cm9rZS13aWR0aD17by53aWR0aH0gLz5cbiAgICAgIHsvaWZ9XG4gICAgICB7I2lmIG8udHlwZSA9PT0gJ2xhYmVsJ31cbiAgICAgICAgPHRleHRcbiAgICAgICAgICB4PXtvLnh9XG4gICAgICAgICAgeT17by55fVxuICAgICAgICAgIHRyYW5zZm9ybT1cInJvdGF0ZSh7by5hbmdsZX0se28ueH0se28ueX0pXCJcbiAgICAgICAgICBmb250LXNpemU9e28uc2l6ZX1cbiAgICAgICAgICB0ZXh0LWFuY2hvcj17by5hbGlnbn1cbiAgICAgICAgICBmaWxsPXtvLmNvbG9yfT5cbiAgICAgICAgICB7QGh0bWwgby50ZXh0fVxuICAgICAgICA8L3RleHQ+XG4gICAgICB7L2lmfVxuICAgICAgeyNpZiBvLnR5cGUgPT09ICd0aWNrJ31cbiAgICAgICAgPHRleHRcbiAgICAgICAgICB4PXtvLnh9XG4gICAgICAgICAgeT17by55fVxuICAgICAgICAgIHRyYW5zZm9ybT1cInJvdGF0ZSh7by5hbmdsZX0se28ueH0se28ueX0pXCJcbiAgICAgICAgICBmb250LXNpemU9e28uc2l6ZX1cbiAgICAgICAgICB0ZXh0LWFuY2hvcj17by5hbGlnbn1cbiAgICAgICAgICBmaWxsPXtvLmNvbG9yfT5cbiAgICAgICAgICB7QGh0bWwgby50ZXh0fVxuICAgICAgICA8L3RleHQ+XG4gICAgICB7L2lmfVxuICAgICAgeyNpZiBvLnR5cGUgPT09ICdhcnJvdyd9XG4gICAgICAgIDxwYXRoXG4gICAgICAgICAgY2xhc3M9XCJsaW5rXCJcbiAgICAgICAgICBkPXtvLnBhdGh9XG4gICAgICAgICAgc3Ryb2tlPVwibm9uZVwiXG4gICAgICAgICAgZmlsbD17by5jb2xvcn1cbiAgICAgICAgICBzdHlsZT1cIlwiXG4gICAgICAgICAgc3Ryb2tlLXdpZHRoPXsxfVxuICAgICAgICAgIG1hcmtlci1lbmQ9XCJ1cmwoI3RyaWFuZ2xlKVwiIC8+XG4gICAgICB7L2lmfVxuICAgIHsvZWFjaH1cbiAgPC9zdmc+XG5cbjwvZGl2PlxuPHNsb3QgLz5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUEyQkUsSUFBSSxlQUFDLENBQUMsQUFDSixjQUFjLENBQUUsR0FBRyxBQUNyQixDQUFDLEFBQ0QsbUJBQUksTUFBTSxBQUFDLENBQUMsQUFDVixNQUFNLENBQUUsWUFBWSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQUFDNUMsQ0FBQyJ9 */";
    	append_dev$1(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    // (55:6) {#if o.type === 'arc'}
    function create_if_block_4(ctx) {
    	let path;
    	let path_d_value;
    	let path_fill_value;
    	let path_stroke_width_value;

    	const block = {
    		c: function create() {
    			path = svg_element$1("path");
    			attr_dev$1(path, "class", "link svelte-1lnhtnf");
    			attr_dev$1(path, "d", path_d_value = /*o*/ ctx[14].path);
    			attr_dev$1(path, "stroke", "none");
    			attr_dev$1(path, "fill", path_fill_value = /*o*/ ctx[14].color);
    			attr_dev$1(path, "stroke-width", path_stroke_width_value = 1);
    			add_location$1(path, file$3, 55, 8, 1228);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, path, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*shapes*/ 1 && path_d_value !== (path_d_value = /*o*/ ctx[14].path)) {
    				attr_dev$1(path, "d", path_d_value);
    			}

    			if (dirty & /*shapes*/ 1 && path_fill_value !== (path_fill_value = /*o*/ ctx[14].color)) {
    				attr_dev$1(path, "fill", path_fill_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(path);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(55:6) {#if o.type === 'arc'}",
    		ctx
    	});

    	return block;
    }

    // (58:6) {#if o.type === 'line'}
    function create_if_block_3(ctx) {
    	let path;
    	let path_d_value;
    	let path_stroke_value;
    	let path_fill_value;
    	let path_stroke_width_value;

    	const block = {
    		c: function create() {
    			path = svg_element$1("path");
    			attr_dev$1(path, "class", "link svelte-1lnhtnf");
    			attr_dev$1(path, "d", path_d_value = /*o*/ ctx[14].path);
    			attr_dev$1(path, "stroke", path_stroke_value = /*o*/ ctx[14].color);
    			attr_dev$1(path, "fill", path_fill_value = /*o*/ ctx[14].color);
    			attr_dev$1(path, "stroke-width", path_stroke_width_value = /*o*/ ctx[14].width);
    			add_location$1(path, file$3, 58, 8, 1366);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, path, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*shapes*/ 1 && path_d_value !== (path_d_value = /*o*/ ctx[14].path)) {
    				attr_dev$1(path, "d", path_d_value);
    			}

    			if (dirty & /*shapes*/ 1 && path_stroke_value !== (path_stroke_value = /*o*/ ctx[14].color)) {
    				attr_dev$1(path, "stroke", path_stroke_value);
    			}

    			if (dirty & /*shapes*/ 1 && path_fill_value !== (path_fill_value = /*o*/ ctx[14].color)) {
    				attr_dev$1(path, "fill", path_fill_value);
    			}

    			if (dirty & /*shapes*/ 1 && path_stroke_width_value !== (path_stroke_width_value = /*o*/ ctx[14].width)) {
    				attr_dev$1(path, "stroke-width", path_stroke_width_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(path);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(58:6) {#if o.type === 'line'}",
    		ctx
    	});

    	return block;
    }

    // (67:6) {#if o.type === 'label'}
    function create_if_block_2(ctx) {
    	let text_1;
    	let raw_value = /*o*/ ctx[14].text + "";
    	let text_1_x_value;
    	let text_1_y_value;
    	let text_1_transform_value;
    	let text_1_font_size_value;
    	let text_1_text_anchor_value;
    	let text_1_fill_value;

    	const block = {
    		c: function create() {
    			text_1 = svg_element$1("text");
    			attr_dev$1(text_1, "x", text_1_x_value = /*o*/ ctx[14].x);
    			attr_dev$1(text_1, "y", text_1_y_value = /*o*/ ctx[14].y);
    			attr_dev$1(text_1, "transform", text_1_transform_value = "rotate(" + /*o*/ ctx[14].angle + "," + /*o*/ ctx[14].x + "," + /*o*/ ctx[14].y + ")");
    			attr_dev$1(text_1, "font-size", text_1_font_size_value = /*o*/ ctx[14].size);
    			attr_dev$1(text_1, "text-anchor", text_1_text_anchor_value = /*o*/ ctx[14].align);
    			attr_dev$1(text_1, "fill", text_1_fill_value = /*o*/ ctx[14].color);
    			add_location$1(text_1, file$3, 67, 8, 1574);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, text_1, anchor);
    			text_1.innerHTML = raw_value;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*shapes*/ 1 && raw_value !== (raw_value = /*o*/ ctx[14].text + "")) text_1.innerHTML = raw_value;
    			if (dirty & /*shapes*/ 1 && text_1_x_value !== (text_1_x_value = /*o*/ ctx[14].x)) {
    				attr_dev$1(text_1, "x", text_1_x_value);
    			}

    			if (dirty & /*shapes*/ 1 && text_1_y_value !== (text_1_y_value = /*o*/ ctx[14].y)) {
    				attr_dev$1(text_1, "y", text_1_y_value);
    			}

    			if (dirty & /*shapes*/ 1 && text_1_transform_value !== (text_1_transform_value = "rotate(" + /*o*/ ctx[14].angle + "," + /*o*/ ctx[14].x + "," + /*o*/ ctx[14].y + ")")) {
    				attr_dev$1(text_1, "transform", text_1_transform_value);
    			}

    			if (dirty & /*shapes*/ 1 && text_1_font_size_value !== (text_1_font_size_value = /*o*/ ctx[14].size)) {
    				attr_dev$1(text_1, "font-size", text_1_font_size_value);
    			}

    			if (dirty & /*shapes*/ 1 && text_1_text_anchor_value !== (text_1_text_anchor_value = /*o*/ ctx[14].align)) {
    				attr_dev$1(text_1, "text-anchor", text_1_text_anchor_value);
    			}

    			if (dirty & /*shapes*/ 1 && text_1_fill_value !== (text_1_fill_value = /*o*/ ctx[14].color)) {
    				attr_dev$1(text_1, "fill", text_1_fill_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(text_1);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(67:6) {#if o.type === 'label'}",
    		ctx
    	});

    	return block;
    }

    // (78:6) {#if o.type === 'tick'}
    function create_if_block_1(ctx) {
    	let text_1;
    	let raw_value = /*o*/ ctx[14].text + "";
    	let text_1_x_value;
    	let text_1_y_value;
    	let text_1_transform_value;
    	let text_1_font_size_value;
    	let text_1_text_anchor_value;
    	let text_1_fill_value;

    	const block = {
    		c: function create() {
    			text_1 = svg_element$1("text");
    			attr_dev$1(text_1, "x", text_1_x_value = /*o*/ ctx[14].x);
    			attr_dev$1(text_1, "y", text_1_y_value = /*o*/ ctx[14].y);
    			attr_dev$1(text_1, "transform", text_1_transform_value = "rotate(" + /*o*/ ctx[14].angle + "," + /*o*/ ctx[14].x + "," + /*o*/ ctx[14].y + ")");
    			attr_dev$1(text_1, "font-size", text_1_font_size_value = /*o*/ ctx[14].size);
    			attr_dev$1(text_1, "text-anchor", text_1_text_anchor_value = /*o*/ ctx[14].align);
    			attr_dev$1(text_1, "fill", text_1_fill_value = /*o*/ ctx[14].color);
    			add_location$1(text_1, file$3, 78, 8, 1846);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, text_1, anchor);
    			text_1.innerHTML = raw_value;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*shapes*/ 1 && raw_value !== (raw_value = /*o*/ ctx[14].text + "")) text_1.innerHTML = raw_value;
    			if (dirty & /*shapes*/ 1 && text_1_x_value !== (text_1_x_value = /*o*/ ctx[14].x)) {
    				attr_dev$1(text_1, "x", text_1_x_value);
    			}

    			if (dirty & /*shapes*/ 1 && text_1_y_value !== (text_1_y_value = /*o*/ ctx[14].y)) {
    				attr_dev$1(text_1, "y", text_1_y_value);
    			}

    			if (dirty & /*shapes*/ 1 && text_1_transform_value !== (text_1_transform_value = "rotate(" + /*o*/ ctx[14].angle + "," + /*o*/ ctx[14].x + "," + /*o*/ ctx[14].y + ")")) {
    				attr_dev$1(text_1, "transform", text_1_transform_value);
    			}

    			if (dirty & /*shapes*/ 1 && text_1_font_size_value !== (text_1_font_size_value = /*o*/ ctx[14].size)) {
    				attr_dev$1(text_1, "font-size", text_1_font_size_value);
    			}

    			if (dirty & /*shapes*/ 1 && text_1_text_anchor_value !== (text_1_text_anchor_value = /*o*/ ctx[14].align)) {
    				attr_dev$1(text_1, "text-anchor", text_1_text_anchor_value);
    			}

    			if (dirty & /*shapes*/ 1 && text_1_fill_value !== (text_1_fill_value = /*o*/ ctx[14].color)) {
    				attr_dev$1(text_1, "fill", text_1_fill_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(text_1);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(78:6) {#if o.type === 'tick'}",
    		ctx
    	});

    	return block;
    }

    // (89:6) {#if o.type === 'arrow'}
    function create_if_block(ctx) {
    	let path;
    	let path_d_value;
    	let path_fill_value;
    	let path_stroke_width_value;

    	const block = {
    		c: function create() {
    			path = svg_element$1("path");
    			attr_dev$1(path, "class", "link svelte-1lnhtnf");
    			attr_dev$1(path, "d", path_d_value = /*o*/ ctx[14].path);
    			attr_dev$1(path, "stroke", "none");
    			attr_dev$1(path, "fill", path_fill_value = /*o*/ ctx[14].color);
    			attr_dev$1(path, "stroke-width", path_stroke_width_value = 1);
    			attr_dev$1(path, "marker-end", "url(#triangle)");
    			add_location$1(path, file$3, 89, 8, 2119);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, path, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*shapes*/ 1 && path_d_value !== (path_d_value = /*o*/ ctx[14].path)) {
    				attr_dev$1(path, "d", path_d_value);
    			}

    			if (dirty & /*shapes*/ 1 && path_fill_value !== (path_fill_value = /*o*/ ctx[14].color)) {
    				attr_dev$1(path, "fill", path_fill_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(path);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(89:6) {#if o.type === 'arrow'}",
    		ctx
    	});

    	return block;
    }

    // (54:4) {#each shapes as o}
    function create_each_block(ctx) {
    	let if_block0_anchor;
    	let if_block1_anchor;
    	let if_block2_anchor;
    	let if_block3_anchor;
    	let if_block4_anchor;
    	let if_block0 = /*o*/ ctx[14].type === "arc" && create_if_block_4(ctx);
    	let if_block1 = /*o*/ ctx[14].type === "line" && create_if_block_3(ctx);
    	let if_block2 = /*o*/ ctx[14].type === "label" && create_if_block_2(ctx);
    	let if_block3 = /*o*/ ctx[14].type === "tick" && create_if_block_1(ctx);
    	let if_block4 = /*o*/ ctx[14].type === "arrow" && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			if_block0_anchor = empty();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			if (if_block2) if_block2.c();
    			if_block2_anchor = empty();
    			if (if_block3) if_block3.c();
    			if_block3_anchor = empty();
    			if (if_block4) if_block4.c();
    			if_block4_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev$1(target, if_block0_anchor, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev$1(target, if_block1_anchor, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev$1(target, if_block2_anchor, anchor);
    			if (if_block3) if_block3.m(target, anchor);
    			insert_dev$1(target, if_block3_anchor, anchor);
    			if (if_block4) if_block4.m(target, anchor);
    			insert_dev$1(target, if_block4_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*o*/ ctx[14].type === "arc") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(if_block0_anchor.parentNode, if_block0_anchor);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*o*/ ctx[14].type === "line") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*o*/ ctx[14].type === "label") {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_2(ctx);
    					if_block2.c();
    					if_block2.m(if_block2_anchor.parentNode, if_block2_anchor);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*o*/ ctx[14].type === "tick") {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_1(ctx);
    					if_block3.c();
    					if_block3.m(if_block3_anchor.parentNode, if_block3_anchor);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*o*/ ctx[14].type === "arrow") {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);
    				} else {
    					if_block4 = create_if_block(ctx);
    					if_block4.c();
    					if_block4.m(if_block4_anchor.parentNode, if_block4_anchor);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev$1(if_block0_anchor);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev$1(if_block1_anchor);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev$1(if_block2_anchor);
    			if (if_block3) if_block3.d(detaching);
    			if (detaching) detach_dev$1(if_block3_anchor);
    			if (if_block4) if_block4.d(detaching);
    			if (detaching) detach_dev$1(if_block4_anchor);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(54:4) {#each shapes as o}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div;
    	let svg;
    	let defs;
    	let marker;
    	let path;
    	let t;
    	let current;
    	let each_value = /*shapes*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const default_slot_template = /*#slots*/ ctx[7].default;
    	const default_slot = create_slot$1(default_slot_template, ctx, /*$$scope*/ ctx[6], null);

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			svg = svg_element$1("svg");
    			defs = svg_element$1("defs");
    			marker = svg_element$1("marker");
    			path = svg_element$1("path");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space$1();
    			if (default_slot) default_slot.c();
    			attr_dev$1(path, "d", "M 0 0 L 10 4 L 0 10 z");
    			attr_dev$1(path, "fill", "#D68881");
    			attr_dev$1(path, "transform", "rotate(23)");
    			attr_dev$1(path, "class", "svelte-1lnhtnf");
    			add_location$1(path, file$3, 49, 8, 1065);
    			attr_dev$1(marker, "id", "triangle");
    			attr_dev$1(marker, "viewBox", "0 0 10 10");
    			attr_dev$1(marker, "refX", "4");
    			attr_dev$1(marker, "refY", "6");
    			attr_dev$1(marker, "markerUnits", "strokeWidth");
    			attr_dev$1(marker, "markerWidth", "9");
    			attr_dev$1(marker, "markerHeight", "9");
    			attr_dev$1(marker, "orient", "auto");
    			add_location$1(marker, file$3, 40, 6, 859);
    			add_location$1(defs, file$3, 39, 4, 846);
    			attr_dev$1(svg, "viewBox", "-50,-50,100,100");
    			attr_dev$1(svg, "shape-rendering", "geometricPrecision");
    			attr_dev$1(svg, "width", "100%");
    			attr_dev$1(svg, "height", "100%");
    			add_location$1(svg, file$3, 36, 2, 721);
    			attr_dev$1(div, "class", "container");
    			add_location$1(div, file$3, 35, 0, 695);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);
    			append_dev$1(div, svg);
    			append_dev$1(svg, defs);
    			append_dev$1(defs, marker);
    			append_dev$1(marker, path);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(svg, null);
    			}

    			insert_dev$1(target, t, anchor);

    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*shapes*/ 1) {
    				each_value = /*shapes*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(svg, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 64) {
    					update_slot$1(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[6], dirty, null, null);
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
    			if (detaching) detach_dev$1(div);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev$1(t);
    			if (default_slot) default_slot.d(detaching);
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
    	let $arcs;
    	let $lines;
    	let $labels;
    	let $ticks;
    	let $arrows;
    	validate_store(arcs, "arcs");
    	component_subscribe($$self, arcs, $$value => $$invalidate(8, $arcs = $$value));
    	validate_store(lines, "lines");
    	component_subscribe($$self, lines, $$value => $$invalidate(9, $lines = $$value));
    	validate_store(labels, "labels");
    	component_subscribe($$self, labels, $$value => $$invalidate(10, $labels = $$value));
    	validate_store(ticks, "ticks");
    	component_subscribe($$self, ticks, $$value => $$invalidate(11, $ticks = $$value));
    	validate_store(arrows, "arrows");
    	component_subscribe($$self, arrows, $$value => $$invalidate(12, $arrows = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots$1("Round", slots, ['default']);
    	let { radius = 500 } = $$props;
    	let { rotate = 0 } = $$props;
    	let { from = 0 } = $$props;
    	let { to = 360 } = $$props;
    	let { margin = 0 } = $$props;
    	radius = Number(radius);

    	let world = {
    		radius,
    		rotate: Number(rotate),
    		from: Number(from),
    		to: Number(to),
    		margin: Number(margin)
    	};

    	let shapes = [];

    	onMount(() => {
    		$$invalidate(0, shapes = layout($arcs, $lines, $labels, $ticks, $arrows, world));
    		console.log(shapes);
    	});

    	const writable_props = ["radius", "rotate", "from", "to", "margin"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Round> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("radius" in $$props) $$invalidate(1, radius = $$props.radius);
    		if ("rotate" in $$props) $$invalidate(2, rotate = $$props.rotate);
    		if ("from" in $$props) $$invalidate(3, from = $$props.from);
    		if ("to" in $$props) $$invalidate(4, to = $$props.to);
    		if ("margin" in $$props) $$invalidate(5, margin = $$props.margin);
    		if ("$$scope" in $$props) $$invalidate(6, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		layout,
    		arcs,
    		lines,
    		labels,
    		ticks,
    		arrows,
    		radius,
    		rotate,
    		from,
    		to,
    		margin,
    		world,
    		shapes,
    		$arcs,
    		$lines,
    		$labels,
    		$ticks,
    		$arrows
    	});

    	$$self.$inject_state = $$props => {
    		if ("radius" in $$props) $$invalidate(1, radius = $$props.radius);
    		if ("rotate" in $$props) $$invalidate(2, rotate = $$props.rotate);
    		if ("from" in $$props) $$invalidate(3, from = $$props.from);
    		if ("to" in $$props) $$invalidate(4, to = $$props.to);
    		if ("margin" in $$props) $$invalidate(5, margin = $$props.margin);
    		if ("world" in $$props) world = $$props.world;
    		if ("shapes" in $$props) $$invalidate(0, shapes = $$props.shapes);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [shapes, radius, rotate, from, to, margin, $$scope, slots];
    }

    class Round extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1lnhtnf-style")) add_css$3();

    		init$1(this, options, instance$3, create_fragment$3, safe_not_equal$1, {
    			radius: 1,
    			rotate: 2,
    			from: 3,
    			to: 4,
    			margin: 5
    		});

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Round",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get radius() {
    		throw new Error("<Round>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set radius(value) {
    		throw new Error("<Round>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rotate() {
    		throw new Error("<Round>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rotate(value) {
    		throw new Error("<Round>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get from() {
    		throw new Error("<Round>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set from(value) {
    		throw new Error("<Round>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get to() {
    		throw new Error("<Round>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set to(value) {
    		throw new Error("<Round>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get margin() {
    		throw new Error("<Round>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set margin(value) {
    		throw new Error("<Round>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var colors = {
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

    /* Users/spencer/mountain/somehow-circle/src/Arc.svelte generated by Svelte v3.29.0 */
    const file$4 = "Users/spencer/mountain/somehow-circle/src/Arc.svelte";

    function create_fragment$4(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			add_location$1(div, file$4, 28, 0, 534);
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
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots$1("Arc", slots, []);
    	let { to = 90 } = $$props;
    	let { from = 0 } = $$props;
    	let { radius = 80 } = $$props;
    	let { width = 20 } = $$props;
    	to = Number(to);
    	from = Number(from);
    	radius = Number(radius);
    	width = Number(width);
    	let { color = "blue" } = $$props;
    	color = colors[color] || color;

    	arcs.update(arr => {
    		arr.push({ color, to, from, radius, width });
    		return arr;
    	});

    	const writable_props = ["to", "from", "radius", "width", "color"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Arc> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("to" in $$props) $$invalidate(0, to = $$props.to);
    		if ("from" in $$props) $$invalidate(1, from = $$props.from);
    		if ("radius" in $$props) $$invalidate(2, radius = $$props.radius);
    		if ("width" in $$props) $$invalidate(3, width = $$props.width);
    		if ("color" in $$props) $$invalidate(4, color = $$props.color);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		arcs,
    		colors,
    		to,
    		from,
    		radius,
    		width,
    		color
    	});

    	$$self.$inject_state = $$props => {
    		if ("to" in $$props) $$invalidate(0, to = $$props.to);
    		if ("from" in $$props) $$invalidate(1, from = $$props.from);
    		if ("radius" in $$props) $$invalidate(2, radius = $$props.radius);
    		if ("width" in $$props) $$invalidate(3, width = $$props.width);
    		if ("color" in $$props) $$invalidate(4, color = $$props.color);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [to, from, radius, width, color];
    }

    class Arc extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$4, create_fragment$4, safe_not_equal$1, {
    			to: 0,
    			from: 1,
    			radius: 2,
    			width: 3,
    			color: 4
    		});

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Arc",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get to() {
    		throw new Error("<Arc>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set to(value) {
    		throw new Error("<Arc>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get from() {
    		throw new Error("<Arc>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set from(value) {
    		throw new Error("<Arc>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get radius() {
    		throw new Error("<Arc>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set radius(value) {
    		throw new Error("<Arc>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get width() {
    		throw new Error("<Arc>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Arc>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Arc>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Arc>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Users/spencer/mountain/somehow-circle/src/Circle.svelte generated by Svelte v3.29.0 */
    const file$5 = "Users/spencer/mountain/somehow-circle/src/Circle.svelte";

    function create_fragment$5(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			add_location$1(div, file$5, 28, 0, 534);
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
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots$1("Circle", slots, []);
    	let { to = 0 } = $$props;
    	let { from = 360 } = $$props;
    	let { radius = 80 } = $$props;
    	let { width = 1 } = $$props;
    	to = Number(to);
    	from = Number(from);
    	radius = Number(radius);
    	width = Number(width);
    	let { color = "blue" } = $$props;
    	color = colors[color] || color;

    	arcs.update(arr => {
    		arr.push({ color, to, from, radius, width });
    		return arr;
    	});

    	const writable_props = ["to", "from", "radius", "width", "color"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Circle> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("to" in $$props) $$invalidate(0, to = $$props.to);
    		if ("from" in $$props) $$invalidate(1, from = $$props.from);
    		if ("radius" in $$props) $$invalidate(2, radius = $$props.radius);
    		if ("width" in $$props) $$invalidate(3, width = $$props.width);
    		if ("color" in $$props) $$invalidate(4, color = $$props.color);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		arcs,
    		colors,
    		to,
    		from,
    		radius,
    		width,
    		color
    	});

    	$$self.$inject_state = $$props => {
    		if ("to" in $$props) $$invalidate(0, to = $$props.to);
    		if ("from" in $$props) $$invalidate(1, from = $$props.from);
    		if ("radius" in $$props) $$invalidate(2, radius = $$props.radius);
    		if ("width" in $$props) $$invalidate(3, width = $$props.width);
    		if ("color" in $$props) $$invalidate(4, color = $$props.color);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [to, from, radius, width, color];
    }

    class Circle extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$5, create_fragment$5, safe_not_equal$1, {
    			to: 0,
    			from: 1,
    			radius: 2,
    			width: 3,
    			color: 4
    		});

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Circle",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get to() {
    		throw new Error("<Circle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set to(value) {
    		throw new Error("<Circle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get from() {
    		throw new Error("<Circle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set from(value) {
    		throw new Error("<Circle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get radius() {
    		throw new Error("<Circle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set radius(value) {
    		throw new Error("<Circle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get width() {
    		throw new Error("<Circle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Circle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Circle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Circle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Users/spencer/mountain/somehow-circle/src/Label.svelte generated by Svelte v3.29.0 */
    const file$6 = "Users/spencer/mountain/somehow-circle/src/Label.svelte";

    function create_fragment$6(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			add_location$1(div, file$6, 29, 0, 584);
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
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots$1("Label", slots, []);
    	let { angle = 0 } = $$props;
    	let { at = 0 } = $$props;
    	angle = angle || at;
    	let { radius = 0 } = $$props;
    	let { rotate = 0 } = $$props;
    	let { size = 1.5 } = $$props;
    	let { align = "left" } = $$props;
    	let { text = "" } = $$props;
    	let { color = "grey" } = $$props;
    	color = colors[color] || color;

    	labels.update(arr => {
    		arr.push({
    			text,
    			color,
    			align,
    			angle: Number(angle),
    			radius: Number(radius),
    			size: Number(size),
    			rotate: Number(rotate)
    		});

    		return arr;
    	});

    	const writable_props = ["angle", "at", "radius", "rotate", "size", "align", "text", "color"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Label> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("angle" in $$props) $$invalidate(0, angle = $$props.angle);
    		if ("at" in $$props) $$invalidate(2, at = $$props.at);
    		if ("radius" in $$props) $$invalidate(3, radius = $$props.radius);
    		if ("rotate" in $$props) $$invalidate(4, rotate = $$props.rotate);
    		if ("size" in $$props) $$invalidate(5, size = $$props.size);
    		if ("align" in $$props) $$invalidate(6, align = $$props.align);
    		if ("text" in $$props) $$invalidate(7, text = $$props.text);
    		if ("color" in $$props) $$invalidate(1, color = $$props.color);
    	};

    	$$self.$capture_state = () => ({
    		labels,
    		colors,
    		angle,
    		at,
    		radius,
    		rotate,
    		size,
    		align,
    		text,
    		color
    	});

    	$$self.$inject_state = $$props => {
    		if ("angle" in $$props) $$invalidate(0, angle = $$props.angle);
    		if ("at" in $$props) $$invalidate(2, at = $$props.at);
    		if ("radius" in $$props) $$invalidate(3, radius = $$props.radius);
    		if ("rotate" in $$props) $$invalidate(4, rotate = $$props.rotate);
    		if ("size" in $$props) $$invalidate(5, size = $$props.size);
    		if ("align" in $$props) $$invalidate(6, align = $$props.align);
    		if ("text" in $$props) $$invalidate(7, text = $$props.text);
    		if ("color" in $$props) $$invalidate(1, color = $$props.color);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [angle, color, at, radius, rotate, size, align, text];
    }

    class Label extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$6, create_fragment$6, safe_not_equal$1, {
    			angle: 0,
    			at: 2,
    			radius: 3,
    			rotate: 4,
    			size: 5,
    			align: 6,
    			text: 7,
    			color: 1
    		});

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Label",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get angle() {
    		throw new Error("<Label>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set angle(value) {
    		throw new Error("<Label>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get at() {
    		throw new Error("<Label>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set at(value) {
    		throw new Error("<Label>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get radius() {
    		throw new Error("<Label>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set radius(value) {
    		throw new Error("<Label>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rotate() {
    		throw new Error("<Label>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rotate(value) {
    		throw new Error("<Label>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Label>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Label>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get align() {
    		throw new Error("<Label>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set align(value) {
    		throw new Error("<Label>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get text() {
    		throw new Error("<Label>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set text(value) {
    		throw new Error("<Label>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Label>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Label>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* 2020/covid-income/Post.svelte generated by Svelte v3.29.0 */

    // (8:2) <Round rotate="0" margin="10">
    function create_default_slot_1(ctx) {
    	let arc0;
    	let t0;
    	let label0;
    	let t1;
    	let arc1;
    	let t2;
    	let label1;
    	let t3;
    	let arc2;
    	let t4;
    	let label2;
    	let t5;
    	let label3;
    	let t6;
    	let label4;
    	let t7;
    	let arc3;
    	let t8;
    	let circle0;
    	let t9;
    	let label5;
    	let t10;
    	let label6;
    	let t11;
    	let label7;
    	let t12;
    	let circle1;
    	let t13;
    	let circle2;
    	let t14;
    	let circle3;
    	let t15;
    	let circle4;
    	let t16;
    	let label8;
    	let t17;
    	let circle5;
    	let t18;
    	let label9;
    	let t19;
    	let circle6;
    	let t20;
    	let label10;
    	let t21;
    	let circle7;
    	let t22;
    	let label11;
    	let t23;
    	let circle8;
    	let t24;
    	let label12;
    	let t25;
    	let arc4;
    	let t26;
    	let arc5;
    	let t27;
    	let arc6;
    	let t28;
    	let arc7;
    	let t29;
    	let arc8;
    	let t30;
    	let arc9;
    	let t31;
    	let arc10;
    	let t32;
    	let arc11;
    	let t33;
    	let arc12;
    	let t34;
    	let arc13;
    	let current;

    	arc0 = new Arc({
    			props: {
    				from: 90,
    				to: 181,
    				color: "blue",
    				width: "8",
    				radius: "5",
    				opacity: "0.6"
    			},
    			$$inline: true
    		});

    	label0 = new Label({
    			props: {
    				text: "Child Benefit",
    				radius: "14",
    				align: "middle",
    				at: "150",
    				color: "blue",
    				size: "1.5"
    			},
    			$$inline: true
    		});

    	arc1 = new Arc({
    			props: {
    				from: 181,
    				to: 270,
    				color: "red",
    				width: "18",
    				label: "CERB",
    				radius: "5"
    			},
    			$$inline: true
    		});

    	label1 = new Label({
    			props: {
    				text: "CERB",
    				radius: "28",
    				align: "middle",
    				at: "220",
    				color: "red",
    				size: "2.5"
    			},
    			$$inline: true
    		});

    	arc2 = new Arc({
    			props: {
    				from: 18,
    				to: 90,
    				color: "purple",
    				width: "23",
    				radius: "2"
    			},
    			$$inline: true
    		});

    	label2 = new Label({
    			props: {
    				text: "CPP/",
    				radius: "36",
    				align: "left",
    				at: "50",
    				color: "purple",
    				size: "2"
    			},
    			$$inline: true
    		});

    	label3 = new Label({
    			props: {
    				text: "OAS",
    				radius: "36",
    				align: "left",
    				at: "42.5",
    				color: "purple",
    				size: "2"
    			},
    			$$inline: true
    		});

    	label4 = new Label({
    			props: {
    				text: "poverty line",
    				radius: "22",
    				align: "right",
    				at: "5",
    				color: "green"
    			},
    			$$inline: true
    		});

    	arc3 = new Arc({
    			props: {
    				from: "180",
    				to: "450",
    				radius: "20",
    				color: "green",
    				fill: "green",
    				width: "0.5"
    			},
    			$$inline: true
    		});

    	circle0 = new Circle({
    			props: {
    				radius: "50",
    				color: "pink",
    				width: "0.2"
    			},
    			$$inline: true
    		});

    	label5 = new Label({
    			props: {
    				text: "mean",
    				radius: "51.5",
    				align: "right",
    				at: "142",
    				color: "pink"
    			},
    			$$inline: true
    		});

    	label6 = new Label({
    			props: {
    				text: "salary",
    				radius: "51.5",
    				align: "right",
    				at: "145",
    				color: "pink"
    			},
    			$$inline: true
    		});

    	label7 = new Label({
    			props: {
    				text: "50k",
    				radius: "51.5",
    				align: "right",
    				at: "148",
    				size: "1.6",
    				color: "pink"
    			},
    			$$inline: true
    		});

    	circle1 = new Circle({
    			props: {
    				radius: "0",
    				color: "lighter",
    				width: "0.1",
    				dotted: true
    			},
    			$$inline: true
    		});

    	circle2 = new Circle({
    			props: {
    				radius: "10",
    				color: "lighter",
    				width: "0.1",
    				dotted: true
    			},
    			$$inline: true
    		});

    	circle3 = new Circle({
    			props: {
    				radius: "20",
    				color: "lighter",
    				width: "0.1",
    				dotted: true
    			},
    			$$inline: true
    		});

    	circle4 = new Circle({
    			props: {
    				radius: "30",
    				color: "lighter",
    				width: "0.1",
    				dotted: true
    			},
    			$$inline: true
    		});

    	label8 = new Label({
    			props: {
    				text: "30k",
    				radius: "35.5",
    				at: "135",
    				color: "lighter"
    			},
    			$$inline: true
    		});

    	circle5 = new Circle({
    			props: {
    				radius: "40",
    				color: "lighter",
    				width: "0.1",
    				dotted: true
    			},
    			$$inline: true
    		});

    	label9 = new Label({
    			props: {
    				text: "40k",
    				radius: "45.5",
    				at: "135",
    				color: "lighter"
    			},
    			$$inline: true
    		});

    	circle6 = new Circle({
    			props: {
    				radius: "60",
    				color: "lighter",
    				width: "0.1",
    				dotted: true
    			},
    			$$inline: true
    		});

    	label10 = new Label({
    			props: {
    				text: "60k",
    				radius: "65.5",
    				at: "135",
    				color: "lighter"
    			},
    			$$inline: true
    		});

    	circle7 = new Circle({
    			props: {
    				radius: "70",
    				color: "lighter",
    				width: "0.1",
    				dotted: true
    			},
    			$$inline: true
    		});

    	label11 = new Label({
    			props: {
    				text: "70k",
    				radius: "75.5",
    				at: "135",
    				color: "lighter"
    			},
    			$$inline: true
    		});

    	circle8 = new Circle({
    			props: {
    				radius: "80",
    				color: "lighter",
    				width: "0.1",
    				dotted: true
    			},
    			$$inline: true
    		});

    	label12 = new Label({
    			props: {
    				text: "80k",
    				radius: "85.5",
    				at: "135",
    				color: "lighter"
    			},
    			$$inline: true
    		});

    	arc4 = new Arc({
    			props: {
    				from: 270,
    				to: 280,
    				color: "sky",
    				width: "1",
    				radius: "20",
    				opacity: "0.6"
    			},
    			$$inline: true
    		});

    	arc5 = new Arc({
    			props: {
    				from: 280,
    				to: 290,
    				color: "sky",
    				width: "1",
    				radius: "30",
    				opacity: "0.6"
    			},
    			$$inline: true
    		});

    	arc6 = new Arc({
    			props: {
    				from: 290,
    				to: 300,
    				color: "sky",
    				width: "1",
    				radius: "40",
    				opacity: "0.6"
    			},
    			$$inline: true
    		});

    	arc7 = new Arc({
    			props: {
    				from: 300,
    				to: 310,
    				color: "sky",
    				width: "1",
    				radius: "50",
    				opacity: "0.6"
    			},
    			$$inline: true
    		});

    	arc8 = new Arc({
    			props: {
    				from: 310,
    				to: 320,
    				color: "sky",
    				width: "1",
    				radius: "50",
    				opacity: "0.6"
    			},
    			$$inline: true
    		});

    	arc9 = new Arc({
    			props: {
    				from: 320,
    				to: 330,
    				color: "sky",
    				width: "1",
    				radius: "50",
    				opacity: "0.6"
    			},
    			$$inline: true
    		});

    	arc10 = new Arc({
    			props: {
    				from: 330,
    				to: 340,
    				color: "sky",
    				width: "1",
    				radius: "50",
    				opacity: "0.6"
    			},
    			$$inline: true
    		});

    	arc11 = new Arc({
    			props: {
    				from: 340,
    				to: 350,
    				color: "sky",
    				width: "1",
    				radius: "60",
    				opacity: "0.6"
    			},
    			$$inline: true
    		});

    	arc12 = new Arc({
    			props: {
    				from: 350,
    				to: 360,
    				color: "sky",
    				width: "1",
    				radius: "70",
    				opacity: "0.6"
    			},
    			$$inline: true
    		});

    	arc13 = new Arc({
    			props: {
    				from: 360,
    				to: 370,
    				color: "sky",
    				width: "1",
    				radius: "80",
    				opacity: "0.6"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(arc0.$$.fragment);
    			t0 = space();
    			create_component(label0.$$.fragment);
    			t1 = space();
    			create_component(arc1.$$.fragment);
    			t2 = space();
    			create_component(label1.$$.fragment);
    			t3 = space();
    			create_component(arc2.$$.fragment);
    			t4 = space();
    			create_component(label2.$$.fragment);
    			t5 = space();
    			create_component(label3.$$.fragment);
    			t6 = space();
    			create_component(label4.$$.fragment);
    			t7 = space();
    			create_component(arc3.$$.fragment);
    			t8 = space();
    			create_component(circle0.$$.fragment);
    			t9 = space();
    			create_component(label5.$$.fragment);
    			t10 = space();
    			create_component(label6.$$.fragment);
    			t11 = space();
    			create_component(label7.$$.fragment);
    			t12 = space();
    			create_component(circle1.$$.fragment);
    			t13 = space();
    			create_component(circle2.$$.fragment);
    			t14 = space();
    			create_component(circle3.$$.fragment);
    			t15 = space();
    			create_component(circle4.$$.fragment);
    			t16 = space();
    			create_component(label8.$$.fragment);
    			t17 = space();
    			create_component(circle5.$$.fragment);
    			t18 = space();
    			create_component(label9.$$.fragment);
    			t19 = space();
    			create_component(circle6.$$.fragment);
    			t20 = space();
    			create_component(label10.$$.fragment);
    			t21 = space();
    			create_component(circle7.$$.fragment);
    			t22 = space();
    			create_component(label11.$$.fragment);
    			t23 = space();
    			create_component(circle8.$$.fragment);
    			t24 = space();
    			create_component(label12.$$.fragment);
    			t25 = space();
    			create_component(arc4.$$.fragment);
    			t26 = space();
    			create_component(arc5.$$.fragment);
    			t27 = space();
    			create_component(arc6.$$.fragment);
    			t28 = space();
    			create_component(arc7.$$.fragment);
    			t29 = space();
    			create_component(arc8.$$.fragment);
    			t30 = space();
    			create_component(arc9.$$.fragment);
    			t31 = space();
    			create_component(arc10.$$.fragment);
    			t32 = space();
    			create_component(arc11.$$.fragment);
    			t33 = space();
    			create_component(arc12.$$.fragment);
    			t34 = space();
    			create_component(arc13.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(arc0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(label0, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(arc1, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(label1, target, anchor);
    			insert_dev(target, t3, anchor);
    			mount_component(arc2, target, anchor);
    			insert_dev(target, t4, anchor);
    			mount_component(label2, target, anchor);
    			insert_dev(target, t5, anchor);
    			mount_component(label3, target, anchor);
    			insert_dev(target, t6, anchor);
    			mount_component(label4, target, anchor);
    			insert_dev(target, t7, anchor);
    			mount_component(arc3, target, anchor);
    			insert_dev(target, t8, anchor);
    			mount_component(circle0, target, anchor);
    			insert_dev(target, t9, anchor);
    			mount_component(label5, target, anchor);
    			insert_dev(target, t10, anchor);
    			mount_component(label6, target, anchor);
    			insert_dev(target, t11, anchor);
    			mount_component(label7, target, anchor);
    			insert_dev(target, t12, anchor);
    			mount_component(circle1, target, anchor);
    			insert_dev(target, t13, anchor);
    			mount_component(circle2, target, anchor);
    			insert_dev(target, t14, anchor);
    			mount_component(circle3, target, anchor);
    			insert_dev(target, t15, anchor);
    			mount_component(circle4, target, anchor);
    			insert_dev(target, t16, anchor);
    			mount_component(label8, target, anchor);
    			insert_dev(target, t17, anchor);
    			mount_component(circle5, target, anchor);
    			insert_dev(target, t18, anchor);
    			mount_component(label9, target, anchor);
    			insert_dev(target, t19, anchor);
    			mount_component(circle6, target, anchor);
    			insert_dev(target, t20, anchor);
    			mount_component(label10, target, anchor);
    			insert_dev(target, t21, anchor);
    			mount_component(circle7, target, anchor);
    			insert_dev(target, t22, anchor);
    			mount_component(label11, target, anchor);
    			insert_dev(target, t23, anchor);
    			mount_component(circle8, target, anchor);
    			insert_dev(target, t24, anchor);
    			mount_component(label12, target, anchor);
    			insert_dev(target, t25, anchor);
    			mount_component(arc4, target, anchor);
    			insert_dev(target, t26, anchor);
    			mount_component(arc5, target, anchor);
    			insert_dev(target, t27, anchor);
    			mount_component(arc6, target, anchor);
    			insert_dev(target, t28, anchor);
    			mount_component(arc7, target, anchor);
    			insert_dev(target, t29, anchor);
    			mount_component(arc8, target, anchor);
    			insert_dev(target, t30, anchor);
    			mount_component(arc9, target, anchor);
    			insert_dev(target, t31, anchor);
    			mount_component(arc10, target, anchor);
    			insert_dev(target, t32, anchor);
    			mount_component(arc11, target, anchor);
    			insert_dev(target, t33, anchor);
    			mount_component(arc12, target, anchor);
    			insert_dev(target, t34, anchor);
    			mount_component(arc13, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(arc0.$$.fragment, local);
    			transition_in(label0.$$.fragment, local);
    			transition_in(arc1.$$.fragment, local);
    			transition_in(label1.$$.fragment, local);
    			transition_in(arc2.$$.fragment, local);
    			transition_in(label2.$$.fragment, local);
    			transition_in(label3.$$.fragment, local);
    			transition_in(label4.$$.fragment, local);
    			transition_in(arc3.$$.fragment, local);
    			transition_in(circle0.$$.fragment, local);
    			transition_in(label5.$$.fragment, local);
    			transition_in(label6.$$.fragment, local);
    			transition_in(label7.$$.fragment, local);
    			transition_in(circle1.$$.fragment, local);
    			transition_in(circle2.$$.fragment, local);
    			transition_in(circle3.$$.fragment, local);
    			transition_in(circle4.$$.fragment, local);
    			transition_in(label8.$$.fragment, local);
    			transition_in(circle5.$$.fragment, local);
    			transition_in(label9.$$.fragment, local);
    			transition_in(circle6.$$.fragment, local);
    			transition_in(label10.$$.fragment, local);
    			transition_in(circle7.$$.fragment, local);
    			transition_in(label11.$$.fragment, local);
    			transition_in(circle8.$$.fragment, local);
    			transition_in(label12.$$.fragment, local);
    			transition_in(arc4.$$.fragment, local);
    			transition_in(arc5.$$.fragment, local);
    			transition_in(arc6.$$.fragment, local);
    			transition_in(arc7.$$.fragment, local);
    			transition_in(arc8.$$.fragment, local);
    			transition_in(arc9.$$.fragment, local);
    			transition_in(arc10.$$.fragment, local);
    			transition_in(arc11.$$.fragment, local);
    			transition_in(arc12.$$.fragment, local);
    			transition_in(arc13.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(arc0.$$.fragment, local);
    			transition_out(label0.$$.fragment, local);
    			transition_out(arc1.$$.fragment, local);
    			transition_out(label1.$$.fragment, local);
    			transition_out(arc2.$$.fragment, local);
    			transition_out(label2.$$.fragment, local);
    			transition_out(label3.$$.fragment, local);
    			transition_out(label4.$$.fragment, local);
    			transition_out(arc3.$$.fragment, local);
    			transition_out(circle0.$$.fragment, local);
    			transition_out(label5.$$.fragment, local);
    			transition_out(label6.$$.fragment, local);
    			transition_out(label7.$$.fragment, local);
    			transition_out(circle1.$$.fragment, local);
    			transition_out(circle2.$$.fragment, local);
    			transition_out(circle3.$$.fragment, local);
    			transition_out(circle4.$$.fragment, local);
    			transition_out(label8.$$.fragment, local);
    			transition_out(circle5.$$.fragment, local);
    			transition_out(label9.$$.fragment, local);
    			transition_out(circle6.$$.fragment, local);
    			transition_out(label10.$$.fragment, local);
    			transition_out(circle7.$$.fragment, local);
    			transition_out(label11.$$.fragment, local);
    			transition_out(circle8.$$.fragment, local);
    			transition_out(label12.$$.fragment, local);
    			transition_out(arc4.$$.fragment, local);
    			transition_out(arc5.$$.fragment, local);
    			transition_out(arc6.$$.fragment, local);
    			transition_out(arc7.$$.fragment, local);
    			transition_out(arc8.$$.fragment, local);
    			transition_out(arc9.$$.fragment, local);
    			transition_out(arc10.$$.fragment, local);
    			transition_out(arc11.$$.fragment, local);
    			transition_out(arc12.$$.fragment, local);
    			transition_out(arc13.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(arc0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(label0, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(arc1, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(label1, detaching);
    			if (detaching) detach_dev(t3);
    			destroy_component(arc2, detaching);
    			if (detaching) detach_dev(t4);
    			destroy_component(label2, detaching);
    			if (detaching) detach_dev(t5);
    			destroy_component(label3, detaching);
    			if (detaching) detach_dev(t6);
    			destroy_component(label4, detaching);
    			if (detaching) detach_dev(t7);
    			destroy_component(arc3, detaching);
    			if (detaching) detach_dev(t8);
    			destroy_component(circle0, detaching);
    			if (detaching) detach_dev(t9);
    			destroy_component(label5, detaching);
    			if (detaching) detach_dev(t10);
    			destroy_component(label6, detaching);
    			if (detaching) detach_dev(t11);
    			destroy_component(label7, detaching);
    			if (detaching) detach_dev(t12);
    			destroy_component(circle1, detaching);
    			if (detaching) detach_dev(t13);
    			destroy_component(circle2, detaching);
    			if (detaching) detach_dev(t14);
    			destroy_component(circle3, detaching);
    			if (detaching) detach_dev(t15);
    			destroy_component(circle4, detaching);
    			if (detaching) detach_dev(t16);
    			destroy_component(label8, detaching);
    			if (detaching) detach_dev(t17);
    			destroy_component(circle5, detaching);
    			if (detaching) detach_dev(t18);
    			destroy_component(label9, detaching);
    			if (detaching) detach_dev(t19);
    			destroy_component(circle6, detaching);
    			if (detaching) detach_dev(t20);
    			destroy_component(label10, detaching);
    			if (detaching) detach_dev(t21);
    			destroy_component(circle7, detaching);
    			if (detaching) detach_dev(t22);
    			destroy_component(label11, detaching);
    			if (detaching) detach_dev(t23);
    			destroy_component(circle8, detaching);
    			if (detaching) detach_dev(t24);
    			destroy_component(label12, detaching);
    			if (detaching) detach_dev(t25);
    			destroy_component(arc4, detaching);
    			if (detaching) detach_dev(t26);
    			destroy_component(arc5, detaching);
    			if (detaching) detach_dev(t27);
    			destroy_component(arc6, detaching);
    			if (detaching) detach_dev(t28);
    			destroy_component(arc7, detaching);
    			if (detaching) detach_dev(t29);
    			destroy_component(arc8, detaching);
    			if (detaching) detach_dev(t30);
    			destroy_component(arc9, detaching);
    			if (detaching) detach_dev(t31);
    			destroy_component(arc10, detaching);
    			if (detaching) detach_dev(t32);
    			destroy_component(arc11, detaching);
    			if (detaching) detach_dev(t33);
    			destroy_component(arc12, detaching);
    			if (detaching) detach_dev(t34);
    			destroy_component(arc13, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(8:2) <Round rotate=\\\"0\\\" margin=\\\"10\\\">",
    		ctx
    	});

    	return block;
    }

    // (7:0) <Page {title} grow={true}>
    function create_default_slot(ctx) {
    	let round;
    	let current;

    	round = new Round({
    			props: {
    				rotate: "0",
    				margin: "10",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(round.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(round, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const round_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				round_changes.$$scope = { dirty, ctx };
    			}

    			round.$set(round_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(round.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(round.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(round, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(7:0) <Page {title} grow={true}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let page;
    	let current;

    	page = new Page({
    			props: {
    				title: /*title*/ ctx[0],
    				grow: true,
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

    			if (dirty & /*$$scope*/ 2) {
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
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Post", slots, []);
    	let title = `Income by demographic in Canada, during Covid-19`;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Page, Round, Arc, Label, Circle, title });

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$7.name
    		});
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
