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
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
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
    	style.id = "svelte-18y8cud-style";
    	style.textContent = ".goleft.svelte-18y8cud{align-self:flex-start;transition:margin-left 250ms;padding:2rem;padding-top:1rem;cursor:pointer}.goleft.svelte-18y8cud:hover{margin-left:0.8rem}.title.svelte-18y8cud{font-size:18px}.sub.svelte-18y8cud{margin-left:3rem;color:grey;text-align:right;margin-top:5px}.titlebox.svelte-18y8cud{width:400px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSGVhZC5zdmVsdGUiLCJzb3VyY2VzIjpbIkhlYWQuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGV4cG9ydCBsZXQgaHJlZiA9ICcjJ1xuICBleHBvcnQgbGV0IHRpdGxlID0gJydcbiAgZXhwb3J0IGxldCBzdWIgPSAnJ1xuICBleHBvcnQgbGV0IGNvbG9yID0gJyM3NjliYjUnXG48L3NjcmlwdD5cblxuPGRpdiB7aHJlZn0gY2xhc3M9XCJnb2xlZnRcIj5cbiAgPHN2ZyB3aWR0aD1cIjE1cHhcIiBoZWlnaHQ9XCIzMHB4XCIgdmlld0JveD1cIjAgMCA5MCAxNzBcIj5cbiAgICA8ZyBzdHJva2U9XCJub25lXCIgc3Ryb2tlLXdpZHRoPVwiMVwiIGZpbGw9XCJub25lXCIgZmlsbC1ydWxlPVwiZXZlbm9kZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+XG4gICAgICA8cGF0aFxuICAgICAgICBkPVwiTTgxLjUsNiBDNjkuODI0MDY2NiwyMy41MTM5MDAxIDQ1LjgyNDA2NjYsNDkuOTI3NzYzNSA5LjUsODUuMjQxNTkwMlxuICAgICAgICBDNDUuNzk4NDgxNCwxMjAuODA2ODYgNjkuNzk4NDgxNCwxNDcuMjI2MzMgODEuNSwxNjQuNVwiXG4gICAgICAgIHN0cm9rZT17Y29sb3J9XG4gICAgICAgIHN0cm9rZS13aWR0aD1cIjIwXCJcbiAgICAgICAgZmlsbC1ydWxlPVwibm9uemVyb1wiXG4gICAgICAvPlxuICAgIDwvZz5cbiAgPC9zdmc+XG48L2Rpdj5cbjxkaXYgY2xhc3M9XCJ0aXRsZWJveFwiPlxuICA8ZGl2IGNsYXNzPVwidGl0bGVcIj57QGh0bWwgdGl0bGV9PC9kaXY+XG4gIDxkaXYgY2xhc3M9XCJzdWJcIj57c3VifTwvZGl2PlxuPC9kaXY+XG5cbjxzdHlsZT5cbiAgLmdvbGVmdCB7XG4gICAgYWxpZ24tc2VsZjogZmxleC1zdGFydDtcbiAgICB0cmFuc2l0aW9uOiBtYXJnaW4tbGVmdCAyNTBtcztcbiAgICBwYWRkaW5nOiAycmVtO1xuICAgIHBhZGRpbmctdG9wOiAxcmVtO1xuICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgfVxuICAuZ29sZWZ0OmhvdmVyIHtcbiAgICBtYXJnaW4tbGVmdDogMC44cmVtO1xuICB9XG4gIC50aXRsZSB7XG4gICAgZm9udC1zaXplOiAxOHB4O1xuICB9XG4gIC5zdWIge1xuICAgIG1hcmdpbi1sZWZ0OiAzcmVtO1xuICAgIGNvbG9yOiBncmV5O1xuICAgIHRleHQtYWxpZ246IHJpZ2h0O1xuICAgIG1hcmdpbi10b3A6IDVweDtcbiAgfVxuICAudGl0bGVib3gge1xuICAgIHdpZHRoOiA0MDBweDtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUEwQkUsT0FBTyxlQUFDLENBQUMsQUFDUCxVQUFVLENBQUUsVUFBVSxDQUN0QixVQUFVLENBQUUsV0FBVyxDQUFDLEtBQUssQ0FDN0IsT0FBTyxDQUFFLElBQUksQ0FDYixXQUFXLENBQUUsSUFBSSxDQUNqQixNQUFNLENBQUUsT0FBTyxBQUNqQixDQUFDLEFBQ0Qsc0JBQU8sTUFBTSxBQUFDLENBQUMsQUFDYixXQUFXLENBQUUsTUFBTSxBQUNyQixDQUFDLEFBQ0QsTUFBTSxlQUFDLENBQUMsQUFDTixTQUFTLENBQUUsSUFBSSxBQUNqQixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixXQUFXLENBQUUsSUFBSSxDQUNqQixLQUFLLENBQUUsSUFBSSxDQUNYLFVBQVUsQ0FBRSxLQUFLLENBQ2pCLFVBQVUsQ0FBRSxHQUFHLEFBQ2pCLENBQUMsQUFDRCxTQUFTLGVBQUMsQ0FBQyxBQUNULEtBQUssQ0FBRSxLQUFLLEFBQ2QsQ0FBQyJ9 */";
    	append_dev(document.head, style);
    }

    function create_fragment(ctx) {
    	let div0;
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
    			add_location(path, file, 10, 6, 306);
    			attr_dev(g, "stroke", "none");
    			attr_dev(g, "stroke-width", "1");
    			attr_dev(g, "fill", "none");
    			attr_dev(g, "fill-rule", "evenodd");
    			attr_dev(g, "stroke-linejoin", "round");
    			add_location(g, file, 9, 4, 209);
    			attr_dev(svg, "width", "15px");
    			attr_dev(svg, "height", "30px");
    			attr_dev(svg, "viewBox", "0 0 90 170");
    			add_location(svg, file, 8, 2, 151);
    			attr_dev(div0, "href", /*href*/ ctx[0]);
    			attr_dev(div0, "class", "goleft svelte-18y8cud");
    			add_location(div0, file, 7, 0, 121);
    			attr_dev(div1, "class", "title svelte-18y8cud");
    			add_location(div1, file, 21, 2, 590);
    			attr_dev(div2, "class", "sub svelte-18y8cud");
    			add_location(div2, file, 22, 2, 631);
    			attr_dev(div3, "class", "titlebox svelte-18y8cud");
    			add_location(div3, file, 20, 0, 565);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, svg);
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
    				attr_dev(div0, "href", /*href*/ ctx[0]);
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
    	let { href = "#" } = $$props;
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
    		if (!document.getElementById("svelte-18y8cud-style")) add_css();
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
    	style.id = "svelte-1b15liy-style";
    	style.textContent = ".page.svelte-1b15liy{display:flex;flex-direction:column;justify-content:space-around;align-items:center;text-align:center}.mid.svelte-1b15liy{margin:1rem;padding:1rem;margin-top:0rem;min-width:300px;flex-grow:1}.shadow.svelte-1b15liy{padding:2rem;min-height:600px;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2)}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGFnZS5zdmVsdGUiLCJzb3VyY2VzIjpbIlBhZ2Uuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBIZWFkIGZyb20gJy4vSGVhZC5zdmVsdGUnXG4gIGltcG9ydCBGb290IGZyb20gJy4vRm9vdC5zdmVsdGUnXG4gIGV4cG9ydCBsZXQgdGl0bGUgPSAnJ1xuICBleHBvcnQgbGV0IHN1YiA9ICcnXG4gIGV4cG9ydCBsZXQgcGFkZGluZyA9IDE2XG4gIGV4cG9ydCBsZXQgeWVhciA9IFN0cmluZyhuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCkpXG48L3NjcmlwdD5cblxuPGRpdiBjbGFzcz1cInBhZ2VcIj5cbiAgPEhlYWQge3RpdGxlfSB7c3VifSAvPlxuICA8ZGl2IGNsYXNzPVwibWlkXCIgc3R5bGU9XCJcIj5cbiAgICA8ZGl2IGNsYXNzPVwic2hhZG93XCIgc3R5bGU9XCJwYWRkaW5nOntwYWRkaW5nfXB4O1wiPlxuICAgICAgPHNsb3QgLz5cbiAgICA8L2Rpdj5cbiAgICA8Rm9vdCB7dGl0bGV9IHt5ZWFyfSAvPlxuICA8L2Rpdj5cbjwvZGl2PlxuXG48c3R5bGU+XG4gIC8qIGV2ZXJ5dGhpbmcgKi9cbiAgLnBhZ2Uge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWFyb3VuZDtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgfVxuXG4gIC8qIGludmlzaWJsZS1taWRkbGUtY29sdW1uICovXG4gIC5taWQge1xuICAgIG1hcmdpbjogMXJlbTtcbiAgICBwYWRkaW5nOiAxcmVtO1xuICAgIG1hcmdpbi10b3A6IDByZW07XG4gICAgbWluLXdpZHRoOiAzMDBweDtcbiAgICBmbGV4LWdyb3c6IDE7XG4gIH1cblxuICAvKiB2aXNpYmxlIG1pZGRsZS1jb2x1bW4gKi9cbiAgLnNoYWRvdyB7XG4gICAgcGFkZGluZzogMnJlbTtcbiAgICBtaW4taGVpZ2h0OiA2MDBweDtcbiAgICBib3gtc2hhZG93OiAycHggMnB4IDhweCAwcHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICB9XG48L3N0eWxlPlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXFCRSxLQUFLLGVBQUMsQ0FBQyxBQUNMLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLE1BQU0sQ0FDdEIsZUFBZSxDQUFFLFlBQVksQ0FDN0IsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsVUFBVSxDQUFFLE1BQU0sQUFDcEIsQ0FBQyxBQUdELElBQUksZUFBQyxDQUFDLEFBQ0osTUFBTSxDQUFFLElBQUksQ0FDWixPQUFPLENBQUUsSUFBSSxDQUNiLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLFNBQVMsQ0FBRSxLQUFLLENBQ2hCLFNBQVMsQ0FBRSxDQUFDLEFBQ2QsQ0FBQyxBQUdELE9BQU8sZUFBQyxDQUFDLEFBQ1AsT0FBTyxDQUFFLElBQUksQ0FDYixVQUFVLENBQUUsS0FBSyxDQUNqQixVQUFVLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEFBQ2hELENBQUMifQ== */";
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

    	const default_slot_template = /*#slots*/ ctx[5].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

    	foot = new Foot({
    			props: {
    				title: /*title*/ ctx[0],
    				year: /*year*/ ctx[3]
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
    			attr_dev(div0, "class", "shadow svelte-1b15liy");
    			set_style(div0, "padding", /*padding*/ ctx[2] + "px");
    			add_location(div0, file$2, 12, 4, 292);
    			attr_dev(div1, "class", "mid svelte-1b15liy");
    			add_location(div1, file$2, 11, 2, 261);
    			attr_dev(div2, "class", "page svelte-1b15liy");
    			add_location(div2, file$2, 9, 0, 215);
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
    				if (default_slot.p && dirty & /*$$scope*/ 16) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[4], dirty, null, null);
    				}
    			}

    			if (!current || dirty & /*padding*/ 4) {
    				set_style(div0, "padding", /*padding*/ ctx[2] + "px");
    			}

    			const foot_changes = {};
    			if (dirty & /*title*/ 1) foot_changes.title = /*title*/ ctx[0];
    			if (dirty & /*year*/ 8) foot_changes.year = /*year*/ ctx[3];
    			foot.$set(foot_changes);
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
    	let { padding = 16 } = $$props;
    	let { year = String(new Date().getFullYear()) } = $$props;
    	const writable_props = ["title", "sub", "padding", "year"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Page> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    		if ("padding" in $$props) $$invalidate(2, padding = $$props.padding);
    		if ("year" in $$props) $$invalidate(3, year = $$props.year);
    		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ Head, Foot, title, sub, padding, year });

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    		if ("padding" in $$props) $$invalidate(2, padding = $$props.padding);
    		if ("year" in $$props) $$invalidate(3, year = $$props.year);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, sub, padding, year, $$scope, slots];
    }

    class Page extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1b15liy-style")) add_css$2();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { title: 0, sub: 1, padding: 2, year: 3 });

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

    /* 2022/one-of/Post.svelte generated by Svelte v3.29.0 */

    const { console: console_1, document: document_1 } = globals;
    const file$3 = "2022/one-of/Post.svelte";

    function add_css$3() {
    	var style = element("style");
    	style.id = "svelte-13dvqeh-style";
    	style.textContent = ".all.svelte-13dvqeh.svelte-13dvqeh{width:400px}.expand.svelte-13dvqeh.svelte-13dvqeh{width:800px}.row.svelte-13dvqeh.svelte-13dvqeh{display:flex;flex-direction:row;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch;flex-grow:1}.row.svelte-13dvqeh:last-child>.one.svelte-13dvqeh:first-child{border-top:1px solid #52d1dae6;border-right:1px solid #52d1dae6;background-color:#2cc4cee6;box-shadow:4px 4px 18px 2px rgba(0, 0, 0, 0.3);border-radius:5px}.light.svelte-13dvqeh.svelte-13dvqeh{background-color:#629edf !important}.one.svelte-13dvqeh.svelte-13dvqeh{flex-grow:1;height:100%}.square.svelte-13dvqeh.svelte-13dvqeh{border-radius:2px !important}.tiny.svelte-13dvqeh.svelte-13dvqeh{width:150px !important;height:150px !important;margin:5px !important;border-radius:2px !important}.tinier.svelte-13dvqeh.svelte-13dvqeh{width:70px !important;height:70px !important;margin:5px !important;border-radius:0px !important}.box.svelte-13dvqeh.svelte-13dvqeh{display:inline-block;width:300px;height:300px;background-color:#438ee1;margin:1rem;border-radius:15px}.col.svelte-13dvqeh.svelte-13dvqeh{display:flex;flex-direction:column;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCB7IFBhZ2UgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2luZGV4Lm1qcydcbiAgbGV0IHRpdGxlID0gYE9uZSBvdXQgb2YgPHNlbGVjdCBpZD1cInNlbGVjdFwiPlxuICAgIDxvcHRpb24gdmFsdWU9XCIxMDBcIiBkZWZhdWx0PjEwMDwvb3B0aW9uPlxuICAgIDxvcHRpb24gdmFsdWU9XCIxMDAwXCI+MSwwMDA8L29wdGlvbj5cbiAgICA8b3B0aW9uIHZhbHVlPVwiMTAwMDBcIj4xMCwwMDA8L29wdGlvbj5cbiAgICA8b3B0aW9uIHZhbHVlPVwiMTAwMDAwXCIgPjEwMCwwMDA8L29wdGlvbj5cbiAgICA8b3B0aW9uIHZhbHVlPVwiMTAwMDAwMFwiPjEsMDAwLDAwMDwvb3B0aW9uPlxuICAgIDwvc2VsZWN0PmBcbiAgbGV0IGJveGVzID0gNFxuICBsZXQgZ3JpZCA9IDVcbiAgbGV0IHRpbnkgPSBmYWxzZVxuICBsZXQgdGluaWVyID0gZmFsc2VcbiAgbGV0IGV4cGFuZCA9IGZhbHNlXG4gIGltcG9ydCB7IG9uTW91bnQgfSBmcm9tICdzdmVsdGUnXG5cbiAgb25Nb3VudCgoKSA9PiB7XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3NlbGVjdCcpLm9uY2hhbmdlID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIGxldCB2YWwgPSBOdW1iZXIoZS50YXJnZXQudmFsdWUpXG4gICAgICB0aW55ID0gZmFsc2VcbiAgICAgIGV4cGFuZCA9IGZhbHNlXG4gICAgICB0aW5pZXIgPSBmYWxzZVxuICAgICAgaWYgKHZhbCA9PT0gMTAwKSB7XG4gICAgICAgIGdyaWQgPSA1IC8vIDUqNT0yNVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZ3JpZCA9IDEwIC8vIDEwKjEwPTEwMFxuICAgICAgfVxuICAgICAgbGV0IHBlckJveCA9IGdyaWQgKiBncmlkXG4gICAgICBib3hlcyA9IHZhbCAvIHBlckJveFxuICAgICAgaWYgKGJveGVzID49IDEwKSB7XG4gICAgICAgIHRpbnkgPSB0cnVlXG4gICAgICB9XG4gICAgICBpZiAoYm94ZXMgPiAxMDApIHtcbiAgICAgICAgZXhwYW5kID0gdHJ1ZVxuICAgICAgfVxuICAgICAgaWYgKGJveGVzID49IDEwMCkge1xuICAgICAgICB0aW5pZXIgPSB0cnVlXG4gICAgICB9XG4gICAgICBjb25zb2xlLmxvZygnYm94ZXM6JywgYm94ZXMpXG4gICAgICBjb25zb2xlLmxvZygncGVyYm94OicsIHBlckJveClcbiAgICB9XG4gIH0pXG48L3NjcmlwdD5cblxuPFBhZ2Uge3RpdGxlfT5cbiAgPGRpdiBjbGFzcz1cImFsbCByb3dcIiBjbGFzczpleHBhbmQ+XG4gICAgeyNlYWNoIEFycmF5KGJveGVzIC0gMSkgYXMgXywgaX1cbiAgICAgIDxkaXYgY2xhc3M9XCJib3hcIiBjbGFzczp0aW55IGNsYXNzOnRpbmllciBjbGFzczpsaWdodD17Ym94ZXMgPj0gMTAwMCAmJiBNYXRoLnJhbmRvbSgpID4gMC44fSAvPlxuICAgIHsvZWFjaH1cbiAgICA8ZGl2IGNsYXNzPVwiYm94IGNvbFwiIGNsYXNzOnRpbnkgY2xhc3M6dGluaWVyPlxuICAgICAgeyNlYWNoIEFycmF5KGdyaWQpIGFzIF8sIGl9XG4gICAgICAgIDxkaXYgY2xhc3M9XCJyb3dcIj5cbiAgICAgICAgICB7I2VhY2ggQXJyYXkoZ3JpZCkgYXMgXywgaX1cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJvbmVcIiBjbGFzczpzcXVhcmU9e3Rpbnl9IC8+XG4gICAgICAgICAgey9lYWNofVxuICAgICAgICA8L2Rpdj5cbiAgICAgIHsvZWFjaH1cbiAgICA8L2Rpdj5cbiAgPC9kaXY+XG48L1BhZ2U+XG5cbjxzdHlsZT5cbiAgLmFsbCB7XG4gICAgLyogd2lkdGg6IDgwdnc7ICovXG4gICAgd2lkdGg6IDQwMHB4O1xuICB9XG4gIC5leHBhbmQge1xuICAgIHdpZHRoOiA4MDBweDtcbiAgfVxuICAucm93IHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1hcm91bmQ7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgZmxleC13cmFwOiB3cmFwO1xuICAgIGFsaWduLXNlbGY6IHN0cmV0Y2g7XG4gICAgZmxleC1ncm93OiAxO1xuICB9XG4gIC5yb3c6bGFzdC1jaGlsZCA+IC5vbmU6Zmlyc3QtY2hpbGQge1xuICAgIGJvcmRlci10b3A6IDFweCBzb2xpZCAjNTJkMWRhZTY7XG4gICAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgIzUyZDFkYWU2O1xuICAgIC8qIGJhY2tncm91bmQtY29sb3I6IHJnYmEoMjIwLCAyMjAsIDIyMCwgMC45KTsgKi9cbiAgICAvKiBiYWNrZ3JvdW5kLWNvbG9yOiAjZjBmMWYzOyAqL1xuICAgIGJhY2tncm91bmQtY29sb3I6ICMyY2M0Y2VlNjtcbiAgICBib3gtc2hhZG93OiA0cHggNHB4IDE4cHggMnB4IHJnYmEoMCwgMCwgMCwgMC4zKTtcbiAgICBib3JkZXItcmFkaXVzOiA1cHg7XG4gIH1cbiAgLmxpZ2h0IHtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjNjI5ZWRmICFpbXBvcnRhbnQ7XG4gIH1cbiAgLm9uZSB7XG4gICAgZmxleC1ncm93OiAxO1xuICAgIGhlaWdodDogMTAwJTtcbiAgfVxuICAuc3F1YXJlIHtcbiAgICBib3JkZXItcmFkaXVzOiAycHggIWltcG9ydGFudDtcbiAgfVxuICAudGlueSB7XG4gICAgd2lkdGg6IDE1MHB4ICFpbXBvcnRhbnQ7XG4gICAgaGVpZ2h0OiAxNTBweCAhaW1wb3J0YW50O1xuICAgIG1hcmdpbjogNXB4ICFpbXBvcnRhbnQ7XG4gICAgYm9yZGVyLXJhZGl1czogMnB4ICFpbXBvcnRhbnQ7XG4gIH1cbiAgLnRpbmllciB7XG4gICAgd2lkdGg6IDcwcHggIWltcG9ydGFudDtcbiAgICBoZWlnaHQ6IDcwcHggIWltcG9ydGFudDtcbiAgICBtYXJnaW46IDVweCAhaW1wb3J0YW50O1xuICAgIGJvcmRlci1yYWRpdXM6IDBweCAhaW1wb3J0YW50O1xuICB9XG4gIC5ib3gge1xuICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICB3aWR0aDogMzAwcHg7XG4gICAgaGVpZ2h0OiAzMDBweDtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjNDM4ZWUxO1xuICAgIG1hcmdpbjogMXJlbTtcbiAgICBib3JkZXItcmFkaXVzOiAxNXB4O1xuICAgIC8qIGJvcmRlci1yYWRpdXM6IDNweDsgKi9cbiAgICAvKiBib3gtc2hhZG93OiAycHggMnB4IDhweCAwcHggcmdiYSgwLCAwLCAwLCAwLjIpOyAqL1xuICB9XG4gIC5jb2wge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWFyb3VuZDtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgYWxpZ24tc2VsZjogc3RyZXRjaDtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUE4REUsSUFBSSw4QkFBQyxDQUFDLEFBRUosS0FBSyxDQUFFLEtBQUssQUFDZCxDQUFDLEFBQ0QsT0FBTyw4QkFBQyxDQUFDLEFBQ1AsS0FBSyxDQUFFLEtBQUssQUFDZCxDQUFDLEFBQ0QsSUFBSSw4QkFBQyxDQUFDLEFBQ0osT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsR0FBRyxDQUNuQixlQUFlLENBQUUsWUFBWSxDQUM3QixXQUFXLENBQUUsTUFBTSxDQUNuQixVQUFVLENBQUUsTUFBTSxDQUNsQixTQUFTLENBQUUsSUFBSSxDQUNmLFVBQVUsQ0FBRSxPQUFPLENBQ25CLFNBQVMsQ0FBRSxDQUFDLEFBQ2QsQ0FBQyxBQUNELG1CQUFJLFdBQVcsQ0FBRyxtQkFBSSxZQUFZLEFBQUMsQ0FBQyxBQUNsQyxVQUFVLENBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQy9CLFlBQVksQ0FBRSxHQUFHLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FHakMsZ0JBQWdCLENBQUUsU0FBUyxDQUMzQixVQUFVLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQy9DLGFBQWEsQ0FBRSxHQUFHLEFBQ3BCLENBQUMsQUFDRCxNQUFNLDhCQUFDLENBQUMsQUFDTixnQkFBZ0IsQ0FBRSxPQUFPLENBQUMsVUFBVSxBQUN0QyxDQUFDLEFBQ0QsSUFBSSw4QkFBQyxDQUFDLEFBQ0osU0FBUyxDQUFFLENBQUMsQ0FDWixNQUFNLENBQUUsSUFBSSxBQUNkLENBQUMsQUFDRCxPQUFPLDhCQUFDLENBQUMsQUFDUCxhQUFhLENBQUUsR0FBRyxDQUFDLFVBQVUsQUFDL0IsQ0FBQyxBQUNELEtBQUssOEJBQUMsQ0FBQyxBQUNMLEtBQUssQ0FBRSxLQUFLLENBQUMsVUFBVSxDQUN2QixNQUFNLENBQUUsS0FBSyxDQUFDLFVBQVUsQ0FDeEIsTUFBTSxDQUFFLEdBQUcsQ0FBQyxVQUFVLENBQ3RCLGFBQWEsQ0FBRSxHQUFHLENBQUMsVUFBVSxBQUMvQixDQUFDLEFBQ0QsT0FBTyw4QkFBQyxDQUFDLEFBQ1AsS0FBSyxDQUFFLElBQUksQ0FBQyxVQUFVLENBQ3RCLE1BQU0sQ0FBRSxJQUFJLENBQUMsVUFBVSxDQUN2QixNQUFNLENBQUUsR0FBRyxDQUFDLFVBQVUsQ0FDdEIsYUFBYSxDQUFFLEdBQUcsQ0FBQyxVQUFVLEFBQy9CLENBQUMsQUFDRCxJQUFJLDhCQUFDLENBQUMsQUFDSixPQUFPLENBQUUsWUFBWSxDQUNyQixLQUFLLENBQUUsS0FBSyxDQUNaLE1BQU0sQ0FBRSxLQUFLLENBQ2IsZ0JBQWdCLENBQUUsT0FBTyxDQUN6QixNQUFNLENBQUUsSUFBSSxDQUNaLGFBQWEsQ0FBRSxJQUFJLEFBR3JCLENBQUMsQUFDRCxJQUFJLDhCQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLGVBQWUsQ0FBRSxZQUFZLENBQzdCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLFNBQVMsQ0FBRSxJQUFJLENBQ2YsVUFBVSxDQUFFLE9BQU8sQUFDckIsQ0FBQyJ9 */";
    	append_dev(document_1.head, style);
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (47:4) {#each Array(boxes - 1) as _, i}
    function create_each_block_2(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "box svelte-13dvqeh");
    			toggle_class(div, "tiny", /*tiny*/ ctx[2]);
    			toggle_class(div, "tinier", /*tinier*/ ctx[3]);
    			toggle_class(div, "light", /*boxes*/ ctx[0] >= 1000 && Math.random() > 0.8);
    			add_location(div, file$3, 47, 6, 1169);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tiny*/ 4) {
    				toggle_class(div, "tiny", /*tiny*/ ctx[2]);
    			}

    			if (dirty & /*tinier*/ 8) {
    				toggle_class(div, "tinier", /*tinier*/ ctx[3]);
    			}

    			if (dirty & /*boxes, Math*/ 1) {
    				toggle_class(div, "light", /*boxes*/ ctx[0] >= 1000 && Math.random() > 0.8);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(47:4) {#each Array(boxes - 1) as _, i}",
    		ctx
    	});

    	return block;
    }

    // (53:10) {#each Array(grid) as _, i}
    function create_each_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "one svelte-13dvqeh");
    			toggle_class(div, "square", /*tiny*/ ctx[2]);
    			add_location(div, file$3, 53, 12, 1436);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tiny*/ 4) {
    				toggle_class(div, "square", /*tiny*/ ctx[2]);
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
    		source: "(53:10) {#each Array(grid) as _, i}",
    		ctx
    	});

    	return block;
    }

    // (51:6) {#each Array(grid) as _, i}
    function create_each_block(ctx) {
    	let div;
    	let t;
    	let each_value_1 = Array(/*grid*/ ctx[1]);
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			attr_dev(div, "class", "row svelte-13dvqeh");
    			add_location(div, file$3, 51, 8, 1368);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tiny, grid*/ 6) {
    				each_value_1 = Array(/*grid*/ ctx[1]);
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
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(51:6) {#each Array(grid) as _, i}",
    		ctx
    	});

    	return block;
    }

    // (45:0) <Page {title}>
    function create_default_slot(ctx) {
    	let div1;
    	let t;
    	let div0;
    	let each_value_2 = Array(/*boxes*/ ctx[0] - 1);
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value = Array(/*grid*/ ctx[1]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div0, "class", "box col svelte-13dvqeh");
    			toggle_class(div0, "tiny", /*tiny*/ ctx[2]);
    			toggle_class(div0, "tinier", /*tinier*/ ctx[3]);
    			add_location(div0, file$3, 49, 4, 1280);
    			attr_dev(div1, "class", "all row svelte-13dvqeh");
    			toggle_class(div1, "expand", /*expand*/ ctx[4]);
    			add_location(div1, file$3, 45, 2, 1091);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			append_dev(div1, t);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tiny, tinier, boxes, Math*/ 13) {
    				each_value_2 = Array(/*boxes*/ ctx[0] - 1);
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_2(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div1, t);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_2.length;
    			}

    			if (dirty & /*Array, grid, tiny*/ 6) {
    				each_value = Array(/*grid*/ ctx[1]);
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

    			if (dirty & /*tiny*/ 4) {
    				toggle_class(div0, "tiny", /*tiny*/ ctx[2]);
    			}

    			if (dirty & /*tinier*/ 8) {
    				toggle_class(div0, "tinier", /*tinier*/ ctx[3]);
    			}

    			if (dirty & /*expand*/ 16) {
    				toggle_class(div1, "expand", /*expand*/ ctx[4]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(45:0) <Page {title}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let page;
    	let current;

    	page = new Page({
    			props: {
    				title: /*title*/ ctx[5],
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

    			if (dirty & /*$$scope, expand, tiny, tinier, grid, boxes*/ 2079) {
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

    	let title = `One out of <select id="select">
    <option value="100" default>100</option>
    <option value="1000">1,000</option>
    <option value="10000">10,000</option>
    <option value="100000" >100,000</option>
    <option value="1000000">1,000,000</option>
    </select>`;

    	let boxes = 4;
    	let grid = 5;
    	let tiny = false;
    	let tinier = false;
    	let expand = false;

    	onMount(() => {
    		document.querySelector("#select").onchange = function (e) {
    			let val = Number(e.target.value);
    			$$invalidate(2, tiny = false);
    			$$invalidate(4, expand = false);
    			$$invalidate(3, tinier = false);

    			if (val === 100) {
    				$$invalidate(1, grid = 5); // 5*5=25
    			} else {
    				$$invalidate(1, grid = 10); // 10*10=100
    			}

    			let perBox = grid * grid;
    			$$invalidate(0, boxes = val / perBox);

    			if (boxes >= 10) {
    				$$invalidate(2, tiny = true);
    			}

    			if (boxes > 100) {
    				$$invalidate(4, expand = true);
    			}

    			if (boxes >= 100) {
    				$$invalidate(3, tinier = true);
    			}

    			console.log("boxes:", boxes);
    			console.log("perbox:", perBox);
    		};
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Page,
    		title,
    		boxes,
    		grid,
    		tiny,
    		tinier,
    		expand,
    		onMount
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(5, title = $$props.title);
    		if ("boxes" in $$props) $$invalidate(0, boxes = $$props.boxes);
    		if ("grid" in $$props) $$invalidate(1, grid = $$props.grid);
    		if ("tiny" in $$props) $$invalidate(2, tiny = $$props.tiny);
    		if ("tinier" in $$props) $$invalidate(3, tinier = $$props.tinier);
    		if ("expand" in $$props) $$invalidate(4, expand = $$props.expand);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [boxes, grid, tiny, tinier, expand, title];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document_1.getElementById("svelte-13dvqeh-style")) add_css$3();
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
