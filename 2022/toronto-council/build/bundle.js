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
    	style.id = "svelte-18y8cud-style";
    	style.textContent = ".goleft.svelte-18y8cud{align-self:flex-start;transition:margin-left 250ms;padding:2rem;padding-top:1rem;cursor:pointer}.goleft.svelte-18y8cud:hover{margin-left:0.8rem}.title.svelte-18y8cud{font-size:18px}.sub.svelte-18y8cud{margin-left:3rem;color:grey;text-align:right;margin-top:5px}.titlebox.svelte-18y8cud{width:400px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSGVhZC5zdmVsdGUiLCJzb3VyY2VzIjpbIkhlYWQuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGV4cG9ydCBsZXQgaHJlZiA9ICcjJ1xuICBleHBvcnQgbGV0IHRpdGxlID0gJydcbiAgZXhwb3J0IGxldCBzdWIgPSAnJ1xuICBleHBvcnQgbGV0IGNvbG9yID0gJyM3NjliYjUnXG48L3NjcmlwdD5cblxuPGRpdiB7aHJlZn0gY2xhc3M9XCJnb2xlZnRcIj5cbiAgPHN2ZyB3aWR0aD1cIjE1cHhcIiBoZWlnaHQ9XCIzMHB4XCIgdmlld0JveD1cIjAgMCA5MCAxNzBcIj5cbiAgICA8ZyBzdHJva2U9XCJub25lXCIgc3Ryb2tlLXdpZHRoPVwiMVwiIGZpbGw9XCJub25lXCIgZmlsbC1ydWxlPVwiZXZlbm9kZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+XG4gICAgICA8cGF0aFxuICAgICAgICBkPVwiTTgxLjUsNiBDNjkuODI0MDY2NiwyMy41MTM5MDAxIDQ1LjgyNDA2NjYsNDkuOTI3NzYzNSA5LjUsODUuMjQxNTkwMlxuICAgICAgICBDNDUuNzk4NDgxNCwxMjAuODA2ODYgNjkuNzk4NDgxNCwxNDcuMjI2MzMgODEuNSwxNjQuNVwiXG4gICAgICAgIHN0cm9rZT17Y29sb3J9XG4gICAgICAgIHN0cm9rZS13aWR0aD1cIjIwXCJcbiAgICAgICAgZmlsbC1ydWxlPVwibm9uemVyb1wiXG4gICAgICAvPlxuICAgIDwvZz5cbiAgPC9zdmc+XG48L2Rpdj5cbjxkaXYgY2xhc3M9XCJ0aXRsZWJveFwiPlxuICA8ZGl2IGNsYXNzPVwidGl0bGVcIj57dGl0bGV9PC9kaXY+XG4gIDxkaXYgY2xhc3M9XCJzdWJcIj57c3VifTwvZGl2PlxuPC9kaXY+XG5cbjxzdHlsZT5cbiAgLmdvbGVmdCB7XG4gICAgYWxpZ24tc2VsZjogZmxleC1zdGFydDtcbiAgICB0cmFuc2l0aW9uOiBtYXJnaW4tbGVmdCAyNTBtcztcbiAgICBwYWRkaW5nOiAycmVtO1xuICAgIHBhZGRpbmctdG9wOiAxcmVtO1xuICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgfVxuICAuZ29sZWZ0OmhvdmVyIHtcbiAgICBtYXJnaW4tbGVmdDogMC44cmVtO1xuICB9XG4gIC50aXRsZSB7XG4gICAgZm9udC1zaXplOiAxOHB4O1xuICB9XG4gIC5zdWIge1xuICAgIG1hcmdpbi1sZWZ0OiAzcmVtO1xuICAgIGNvbG9yOiBncmV5O1xuICAgIHRleHQtYWxpZ246IHJpZ2h0O1xuICAgIG1hcmdpbi10b3A6IDVweDtcbiAgfVxuICAudGl0bGVib3gge1xuICAgIHdpZHRoOiA0MDBweDtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUEwQkUsT0FBTyxlQUFDLENBQUMsQUFDUCxVQUFVLENBQUUsVUFBVSxDQUN0QixVQUFVLENBQUUsV0FBVyxDQUFDLEtBQUssQ0FDN0IsT0FBTyxDQUFFLElBQUksQ0FDYixXQUFXLENBQUUsSUFBSSxDQUNqQixNQUFNLENBQUUsT0FBTyxBQUNqQixDQUFDLEFBQ0Qsc0JBQU8sTUFBTSxBQUFDLENBQUMsQUFDYixXQUFXLENBQUUsTUFBTSxBQUNyQixDQUFDLEFBQ0QsTUFBTSxlQUFDLENBQUMsQUFDTixTQUFTLENBQUUsSUFBSSxBQUNqQixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixXQUFXLENBQUUsSUFBSSxDQUNqQixLQUFLLENBQUUsSUFBSSxDQUNYLFVBQVUsQ0FBRSxLQUFLLENBQ2pCLFVBQVUsQ0FBRSxHQUFHLEFBQ2pCLENBQUMsQUFDRCxTQUFTLGVBQUMsQ0FBQyxBQUNULEtBQUssQ0FBRSxLQUFLLEFBQ2QsQ0FBQyJ9 */";
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
    	let t2;
    	let div2;
    	let t3;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			svg = svg_element("svg");
    			g = svg_element("g");
    			path = svg_element("path");
    			t0 = space();
    			div3 = element("div");
    			div1 = element("div");
    			t1 = text(/*title*/ ctx[1]);
    			t2 = space();
    			div2 = element("div");
    			t3 = text(/*sub*/ ctx[2]);
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
    			add_location(div2, file, 22, 2, 625);
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
    			append_dev(div1, t1);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, t3);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*color*/ 8) {
    				attr_dev(path, "stroke", /*color*/ ctx[3]);
    			}

    			if (dirty & /*href*/ 1) {
    				attr_dev(div0, "href", /*href*/ ctx[0]);
    			}

    			if (dirty & /*title*/ 2) set_data_dev(t1, /*title*/ ctx[1]);
    			if (dirty & /*sub*/ 4) set_data_dev(t3, /*sub*/ ctx[2]);
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
    	style.id = "svelte-jzwvf5-style";
    	style.textContent = ".page.svelte-jzwvf5{display:flex;flex-direction:column;justify-content:space-around;align-items:center;text-align:center}.mid.svelte-jzwvf5{margin:1rem;padding:1rem;margin-top:0rem;max-width:800px;min-width:400px;flex-grow:1}.shadow.svelte-jzwvf5{padding:2rem;min-height:600px;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2)}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGFnZS5zdmVsdGUiLCJzb3VyY2VzIjpbIlBhZ2Uuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBIZWFkIGZyb20gJy4vSGVhZC5zdmVsdGUnXG4gIGltcG9ydCBGb290IGZyb20gJy4vRm9vdC5zdmVsdGUnXG4gIGV4cG9ydCBsZXQgdGl0bGUgPSAnJ1xuICBleHBvcnQgbGV0IHN1YiA9ICcnXG4gIGV4cG9ydCBsZXQgcGFkZGluZyA9IDE2XG4gIGV4cG9ydCBsZXQgd2lkdGggPSA2MDBcbiAgZXhwb3J0IGxldCBoZWlnaHQgPSA0MDBcbiAgZXhwb3J0IGxldCB5ZWFyID0gU3RyaW5nKG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKSlcbjwvc2NyaXB0PlxuXG48ZGl2IGNsYXNzPVwicGFnZVwiPlxuICA8SGVhZCB7dGl0bGV9IHtzdWJ9IC8+XG4gIDxkaXYgY2xhc3M9XCJtaWRcIiBzdHlsZT1cIndpZHRoOnt3aWR0aH1weDsgXCI+XG4gICAgPGRpdiBjbGFzcz1cInNoYWRvd1wiIHN0eWxlPVwicGFkZGluZzp7cGFkZGluZ31weDsgaGVpZ2h0OntoZWlnaHR9cHg7XCI+XG4gICAgICA8c2xvdCAvPlxuICAgIDwvZGl2PlxuICAgIDxGb290IHt0aXRsZX0ge3llYXJ9IC8+XG4gIDwvZGl2PlxuPC9kaXY+XG5cbjxzdHlsZT5cbiAgLyogZXZlcnl0aGluZyAqL1xuICAucGFnZSB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYXJvdW5kO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICB9XG5cbiAgLyogaW52aXNpYmxlLW1pZGRsZS1jb2x1bW4gKi9cbiAgLm1pZCB7XG4gICAgbWFyZ2luOiAxcmVtO1xuICAgIHBhZGRpbmc6IDFyZW07XG4gICAgbWFyZ2luLXRvcDogMHJlbTtcbiAgICBtYXgtd2lkdGg6IDgwMHB4O1xuICAgIG1pbi13aWR0aDogNDAwcHg7XG4gICAgZmxleC1ncm93OiAxO1xuICB9XG5cbiAgLyogdmlzaWJsZSBtaWRkbGUtY29sdW1uICovXG4gIC5zaGFkb3cge1xuICAgIHBhZGRpbmc6IDJyZW07XG4gICAgbWluLWhlaWdodDogNjAwcHg7XG4gICAgYm94LXNoYWRvdzogMnB4IDJweCA4cHggMHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUF1QkUsS0FBSyxjQUFDLENBQUMsQUFDTCxPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLGVBQWUsQ0FBRSxZQUFZLENBQzdCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFVBQVUsQ0FBRSxNQUFNLEFBQ3BCLENBQUMsQUFHRCxJQUFJLGNBQUMsQ0FBQyxBQUNKLE1BQU0sQ0FBRSxJQUFJLENBQ1osT0FBTyxDQUFFLElBQUksQ0FDYixVQUFVLENBQUUsSUFBSSxDQUNoQixTQUFTLENBQUUsS0FBSyxDQUNoQixTQUFTLENBQUUsS0FBSyxDQUNoQixTQUFTLENBQUUsQ0FBQyxBQUNkLENBQUMsQUFHRCxPQUFPLGNBQUMsQ0FBQyxBQUNQLE9BQU8sQ0FBRSxJQUFJLENBQ2IsVUFBVSxDQUFFLEtBQUssQ0FDakIsVUFBVSxDQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxBQUNoRCxDQUFDIn0= */";
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

    	const default_slot_template = /*#slots*/ ctx[7].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], null);

    	foot = new Foot({
    			props: {
    				title: /*title*/ ctx[0],
    				year: /*year*/ ctx[5]
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
    			attr_dev(div0, "class", "shadow svelte-jzwvf5");
    			set_style(div0, "padding", /*padding*/ ctx[2] + "px");
    			set_style(div0, "height", /*height*/ ctx[4] + "px");
    			add_location(div0, file$2, 14, 4, 360);
    			attr_dev(div1, "class", "mid svelte-jzwvf5");
    			set_style(div1, "width", /*width*/ ctx[3] + "px");
    			add_location(div1, file$2, 13, 2, 312);
    			attr_dev(div2, "class", "page svelte-jzwvf5");
    			add_location(div2, file$2, 11, 0, 266);
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
    				if (default_slot.p && dirty & /*$$scope*/ 64) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[6], dirty, null, null);
    				}
    			}

    			if (!current || dirty & /*padding*/ 4) {
    				set_style(div0, "padding", /*padding*/ ctx[2] + "px");
    			}

    			if (!current || dirty & /*height*/ 16) {
    				set_style(div0, "height", /*height*/ ctx[4] + "px");
    			}

    			const foot_changes = {};
    			if (dirty & /*title*/ 1) foot_changes.title = /*title*/ ctx[0];
    			if (dirty & /*year*/ 32) foot_changes.year = /*year*/ ctx[5];
    			foot.$set(foot_changes);

    			if (!current || dirty & /*width*/ 8) {
    				set_style(div1, "width", /*width*/ ctx[3] + "px");
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
    	let { padding = 16 } = $$props;
    	let { width = 600 } = $$props;
    	let { height = 400 } = $$props;
    	let { year = String(new Date().getFullYear()) } = $$props;
    	const writable_props = ["title", "sub", "padding", "width", "height", "year"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Page> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    		if ("padding" in $$props) $$invalidate(2, padding = $$props.padding);
    		if ("width" in $$props) $$invalidate(3, width = $$props.width);
    		if ("height" in $$props) $$invalidate(4, height = $$props.height);
    		if ("year" in $$props) $$invalidate(5, year = $$props.year);
    		if ("$$scope" in $$props) $$invalidate(6, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		Head,
    		Foot,
    		title,
    		sub,
    		padding,
    		width,
    		height,
    		year
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    		if ("padding" in $$props) $$invalidate(2, padding = $$props.padding);
    		if ("width" in $$props) $$invalidate(3, width = $$props.width);
    		if ("height" in $$props) $$invalidate(4, height = $$props.height);
    		if ("year" in $$props) $$invalidate(5, year = $$props.year);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, sub, padding, width, height, year, $$scope, slots];
    }

    class Page extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-jzwvf5-style")) add_css$2();

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			title: 0,
    			sub: 1,
    			padding: 2,
    			width: 3,
    			height: 4,
    			year: 5
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

    	get padding() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set padding(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get width() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get year() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set year(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var byColor = {
      'Frances Nunziata': '#6699cc',//blue
      'John Filion': '#978BA3', //red
      'Denzil Minnan-Wong': '#335799',//navy
      'Maria Augimeri': '#D68881', //red
      'Joe Mihevc': '#F2C0BB',
      'David Shiner': '#2D85A8',//
      'Paula Fletcher': '#d8b3e6',
      'Michael Thompson': '#7f9c6c',
      'Gloria Lindsay Luby': '#735873',
      'Raymond Cho': '#e6d7b3', //
      // 'Frank Di Giorgio': '#9c896c', //middle
      // 'Mark Grimes': '#2D85A8',
      'Anthony Perruzza': '#2e7794',
      'Gord Perks': '#cc6966',
      'Paul Ainslie': '#275291',
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
    const file$3 = "2022/toronto-council/Post.svelte";

    function add_css$3() {
    	var style = element("style");
    	style.id = "svelte-hvt34n-style";
    	style.textContent = ".right.svelte-hvt34n{text-align:right !important;width:70px !important}.label.svelte-hvt34n{flex:1;flex-wrap:nowrap;position:absolute;transform:rotate(-90deg) translateX(10px);width:100px;height:20px;text-align:left;font-size:12px;line-height:1rem}.rel.svelte-hvt34n{position:relative;width:100%;flex:1}.legend.svelte-hvt34n{position:relative}.term.svelte-hvt34n{flex:1;display:flex;flex-direction:row;justify-content:space-between;align-items:center;text-align:center;flex-wrap:nowrap;align-self:stretch;box-sizing:border-box;min-width:700px}.person.svelte-hvt34n{margin-top:20px;min-height:100px;height:100%;border-left:7px solid lightgrey;box-sizing:border-box;margin-left:0px;margin-top:0px !important}.highlight.svelte-hvt34n{opacity:1;margin-top:0px !important;min-height:120px}.aside.svelte-hvt34n{width:100px;color:grey;font-size:12px}.year.svelte-hvt34n{min-width:45px;max-width:45px;color:grey;font-size:12px;text-align:left;align-self:flex-start;border-right:1px solid lightsteelblue;min-height:110px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCB7IFBhZ2UgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2luZGV4Lm1qcydcbiAgaW1wb3J0IGJ5Q29sb3IgZnJvbSAnLi9jb2xvcnMuanMnXG4gIGltcG9ydCBkYXRhIGZyb20gJy4vZGF0YS5qcydcbiAgaW1wb3J0IGNvdW50cyBmcm9tICcuL2NvdW50cy5qcydcbiAgZXhwb3J0IGxldCB0aXRsZSA9ICdMb25nLXNlcnZpbmcgVG9yb250byBjaXR5IGNvdW5jaWxvcnMnXG4gIGV4cG9ydCBsZXQgc3ViID0gJydcbiAgbGV0IG1pblRlcm1zID0gMlxuPC9zY3JpcHQ+XG5cbjxQYWdlIHt0aXRsZX0ge3N1Yn0gaGVpZ2h0PVwiMTMwMFwiIHdpZHRoPVwiNzMwXCI+XG4gIDxkaXYgY2xhc3M9XCJ0ZXJtIGxlZ2VuZFwiIHN0eWxlPVwibWFyZ2luLWJvdHRvbTo1cHg7IFwiPlxuICAgIDxkaXYgY2xhc3M9XCJ5ZWFyXCIgc3R5bGU9XCJib3JkZXI6bm9uZTtcIiAvPlxuICAgIDxkaXYgY2xhc3M9XCJyZWxcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJsYWJlbFwiIHN0eWxlPVwibGVmdDozJTsgY29sb3I6IzczNTg3MztcIj5HbG9yaWEgTGluZHNheSBMdWJ5PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwibGFiZWxcIiBzdHlsZT1cImxlZnQ6MTUuNSU7IGNvbG9yOiNENjg4ODE7XCI+TWFyaWEgQXVnaW1lcmk8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJsYWJlbFwiIHN0eWxlPVwibGVmdDo0NSU7IGNvbG9yOiM5NzhCQTM7XCI+Sm9obiBGaWxpb248L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJsYWJlbFwiIHN0eWxlPVwibGVmdDo0OSU7IGNvbG9yOiMyRDg1QTg7XCI+RGF2aWQgU2hpbmVyPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwibGFiZWxcIiBzdHlsZT1cImxlZnQ6NDAlOyBjb2xvcjojRjJDMEJCO1wiPkpvZSBNaWhldmM8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJsYWJlbFwiIHN0eWxlPVwibGVmdDo2OSU7IGNvbG9yOiMzMzU3OTk7XCI+RGVuemlsIE1pbm5hbi1Xb25nPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwibGFiZWxcIiBzdHlsZT1cImxlZnQ6ODglOyBjb2xvcjojZTZkN2IzO1wiPlJheW1vbmQgQ2hvPC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImFzaWRlXCIgLz5cbiAgPC9kaXY+XG4gIHsjZWFjaCBPYmplY3Qua2V5cyhkYXRhKSBhcyB5ZWFyfVxuICAgIHsjaWYgeWVhciA9PT0gJzIwMTgnfVxuICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6MjBweDtcIiAvPlxuICAgIHsvaWZ9XG4gICAgeyNpZiB5ZWFyID09PSAnMjAwMCd9XG4gICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDoyMHB4O1wiIC8+XG4gICAgey9pZn1cbiAgICA8ZGl2IGNsYXNzPVwidGVybVwiPlxuICAgICAgPGRpdiBjbGFzcz1cInllYXJcIj57eWVhcn08L2Rpdj5cbiAgICAgIHsjZWFjaCBkYXRhW1N0cmluZyh5ZWFyKV0gYXMgc3RyfVxuICAgICAgICB7I2lmIGNvdW50c1tzdHJdID49IG1pblRlcm1zfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJwZXJzb24gaGlnaGxpZ2h0XCIgc3R5bGU9XCJib3JkZXItbGVmdDo3cHggc29saWQge2J5Q29sb3Jbc3RyXX07XCIgdGl0bGU9e3N0cn0gLz5cbiAgICAgICAgezplbHNlfVxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJwZXJzb25cIiB0aXRsZT17c3RyfSAvPlxuICAgICAgICB7L2lmfVxuICAgICAgey9lYWNofVxuICAgICAgPGRpdiBjbGFzcz1cImFzaWRlXCI+XG4gICAgICAgIHsjaWYgeWVhciA9PT0gJzE5OTcnIHx8IHllYXIgPT09ICcyMDAwJyB8fCB5ZWFyID09PSAnMjAxOCd9XG4gICAgICAgICAge2RhdGFbU3RyaW5nKHllYXIpXS5sZW5ndGh9IHNlYXRzXG4gICAgICAgICAgPGJyIC8+XG4gICAgICAgICAg4oaTXG4gICAgICAgIHsvaWZ9XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgey9lYWNofVxuICA8ZGl2IGNsYXNzPVwidGVybSBsZWdlbmRcIiBzdHlsZT1cIm1hcmdpbi10b3A6IDFyZW07IGFsaWduLWl0ZW1zOiBmbGV4LWVuZDttYXgtaGVpZ2h0OiA0MHB4XCI+XG4gICAgPGRpdiBjbGFzcz1cInllYXJcIiBzdHlsZT1cImJvcmRlcjpub25lO1wiIC8+XG4gICAgPGRpdiBjbGFzcz1cInJlbFwiPlxuICAgICAgPGRpdiBjbGFzcz1cImxhYmVsIHJpZ2h0XCIgc3R5bGU9XCJsZWZ0OjEwJTsgY29sb3I6IzJEODVBODtcIj5BbnRob255IFBlcnJ1enphPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwibGFiZWwgcmlnaHRcIiBzdHlsZT1cImxlZnQ6MTglOyBjb2xvcjojNjY5OWNjO1wiPkZyYW5jZXMgTnVuemlhdGE8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJsYWJlbCByaWdodFwiIHN0eWxlPVwibGVmdDoyNyU7IGNvbG9yOiNjYzY5NjY7XCI+R29yZCBQZXJrczwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImxhYmVsIHJpZ2h0XCIgc3R5bGU9XCJsZWZ0OjYwJTsgY29sb3I6I2Q4YjNlNjtcIj5QYXVsYSBGbGV0Y2hlcjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImxhYmVsIHJpZ2h0XCIgc3R5bGU9XCJsZWZ0Ojc2JTsgY29sb3I6IzdmOWM2YztcIj5NaWNoYWVsIFRob21wc29uPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwibGFiZWwgcmlnaHRcIiBzdHlsZT1cImxlZnQ6ODglOyBjb2xvcjojMjc1MjkxO1wiPlBhdWwgQWluc2xpZTwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJhc2lkZVwiIC8+XG4gIDwvZGl2PlxuPC9QYWdlPlxuXG48c3R5bGU+XG4gIC5yaWdodCB7XG4gICAgdGV4dC1hbGlnbjogcmlnaHQgIWltcG9ydGFudDtcbiAgICB3aWR0aDogNzBweCAhaW1wb3J0YW50O1xuICB9XG4gIC5sYWJlbCB7XG4gICAgZmxleDogMTtcbiAgICBmbGV4LXdyYXA6IG5vd3JhcDtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgdHJhbnNmb3JtOiByb3RhdGUoLTkwZGVnKSB0cmFuc2xhdGVYKDEwcHgpO1xuICAgIHdpZHRoOiAxMDBweDtcbiAgICBoZWlnaHQ6IDIwcHg7XG4gICAgdGV4dC1hbGlnbjogbGVmdDtcbiAgICAvKiBib3JkZXI6IDFweCBzb2xpZCBibHVlOyAqL1xuICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICBsaW5lLWhlaWdodDogMXJlbTtcbiAgfVxuICAucmVsIHtcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgZmxleDogMTtcbiAgfVxuICAubGVnZW5kIHtcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgLyogbWluLXdpZHRoOiA3MDBweDsgKi9cbiAgICAvKiBib3JkZXI6IDFweCBzb2xpZCBncmV5OyAqL1xuICAgIC8qIG1pbi1oZWlnaHQ6IDYwcHg7XG4gICAgbWFyZ2luLWJvdHRvbTogMTdweDtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIG1hcmdpbi1sZWZ0OiA0MHB4O1xuICAgIHBhZGRpbmctcmlnaHQ6IDEwMHB4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7ICovXG4gICAgLyoganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0OyAqL1xuICAgIC8qIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsgKi9cbiAgICAvKiBhbGlnbi1pdGVtczogZmxleC1zdGFydDsgKi9cbiAgICAvKiB0ZXh0LWFsaWduOiBsZWZ0OyAqL1xuICAgIC8qIGZsZXgtd3JhcDogbm93cmFwO1xuICAgIGFsaWduLXNlbGY6IHN0cmV0Y2g7ICovXG4gICAgLyogYm94LXNpemluZzogYm9yZGVyLWJveDsgKi9cbiAgfVxuICAudGVybSB7XG4gICAgZmxleDogMTtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAgLyoganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0OyAqL1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBmbGV4LXdyYXA6IG5vd3JhcDtcbiAgICBhbGlnbi1zZWxmOiBzdHJldGNoO1xuICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgbWluLXdpZHRoOiA3MDBweDtcbiAgfVxuICAucGVyc29uIHtcbiAgICBtYXJnaW4tdG9wOiAyMHB4O1xuICAgIG1pbi1oZWlnaHQ6IDEwMHB4O1xuICAgIGhlaWdodDogMTAwJTtcbiAgICBib3JkZXItbGVmdDogN3B4IHNvbGlkIGxpZ2h0Z3JleTtcbiAgICAvKiBvcGFjaXR5OiAwLjU7ICovXG4gICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICBtYXJnaW4tbGVmdDogMHB4O1xuICAgIG1hcmdpbi10b3A6IDBweCAhaW1wb3J0YW50O1xuICB9XG4gIC5oaWdobGlnaHQge1xuICAgIG9wYWNpdHk6IDE7XG4gICAgbWFyZ2luLXRvcDogMHB4ICFpbXBvcnRhbnQ7XG4gICAgbWluLWhlaWdodDogMTIwcHg7XG4gICAgLyogYm94LXNoYWRvdzogMnB4IDJweCA4cHggMHB4IHJnYmEoMCwgMCwgMCwgMC4yKTsgKi9cbiAgfVxuICAuYXNpZGUge1xuICAgIHdpZHRoOiAxMDBweDtcbiAgICBjb2xvcjogZ3JleTtcbiAgICBmb250LXNpemU6IDEycHg7XG4gIH1cbiAgLnllYXIge1xuICAgIG1pbi13aWR0aDogNDVweDtcbiAgICBtYXgtd2lkdGg6IDQ1cHg7XG4gICAgY29sb3I6IGdyZXk7XG4gICAgZm9udC1zaXplOiAxMnB4O1xuICAgIHRleHQtYWxpZ246IGxlZnQ7XG4gICAgYWxpZ24tc2VsZjogZmxleC1zdGFydDtcbiAgICBib3JkZXItcmlnaHQ6IDFweCBzb2xpZCBsaWdodHN0ZWVsYmx1ZTtcbiAgICBtaW4taGVpZ2h0OiAxMTBweDtcbiAgICAvKiBtYXJnaW4tcmlnaHQ6IDEwcHg7ICovXG4gICAgLyogdGV4dC1kZWNvcmF0aW9uOiB1bmRlcmxpbmU7ICovXG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBZ0VFLE1BQU0sY0FBQyxDQUFDLEFBQ04sVUFBVSxDQUFFLEtBQUssQ0FBQyxVQUFVLENBQzVCLEtBQUssQ0FBRSxJQUFJLENBQUMsVUFBVSxBQUN4QixDQUFDLEFBQ0QsTUFBTSxjQUFDLENBQUMsQUFDTixJQUFJLENBQUUsQ0FBQyxDQUNQLFNBQVMsQ0FBRSxNQUFNLENBQ2pCLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLFNBQVMsQ0FBRSxPQUFPLE1BQU0sQ0FBQyxDQUFDLFdBQVcsSUFBSSxDQUFDLENBQzFDLEtBQUssQ0FBRSxLQUFLLENBQ1osTUFBTSxDQUFFLElBQUksQ0FDWixVQUFVLENBQUUsSUFBSSxDQUVoQixTQUFTLENBQUUsSUFBSSxDQUNmLFdBQVcsQ0FBRSxJQUFJLEFBQ25CLENBQUMsQUFDRCxJQUFJLGNBQUMsQ0FBQyxBQUNKLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLEtBQUssQ0FBRSxJQUFJLENBQ1gsSUFBSSxDQUFFLENBQUMsQUFDVCxDQUFDLEFBQ0QsT0FBTyxjQUFDLENBQUMsQUFDUCxRQUFRLENBQUUsUUFBUSxBQWdCcEIsQ0FBQyxBQUNELEtBQUssY0FBQyxDQUFDLEFBQ0wsSUFBSSxDQUFFLENBQUMsQ0FDUCxPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBRW5CLGVBQWUsQ0FBRSxhQUFhLENBQzlCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLFNBQVMsQ0FBRSxNQUFNLENBQ2pCLFVBQVUsQ0FBRSxPQUFPLENBQ25CLFVBQVUsQ0FBRSxVQUFVLENBQ3RCLFNBQVMsQ0FBRSxLQUFLLEFBQ2xCLENBQUMsQUFDRCxPQUFPLGNBQUMsQ0FBQyxBQUNQLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLFVBQVUsQ0FBRSxLQUFLLENBQ2pCLE1BQU0sQ0FBRSxJQUFJLENBQ1osV0FBVyxDQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUVoQyxVQUFVLENBQUUsVUFBVSxDQUN0QixXQUFXLENBQUUsR0FBRyxDQUNoQixVQUFVLENBQUUsR0FBRyxDQUFDLFVBQVUsQUFDNUIsQ0FBQyxBQUNELFVBQVUsY0FBQyxDQUFDLEFBQ1YsT0FBTyxDQUFFLENBQUMsQ0FDVixVQUFVLENBQUUsR0FBRyxDQUFDLFVBQVUsQ0FDMUIsVUFBVSxDQUFFLEtBQUssQUFFbkIsQ0FBQyxBQUNELE1BQU0sY0FBQyxDQUFDLEFBQ04sS0FBSyxDQUFFLEtBQUssQ0FDWixLQUFLLENBQUUsSUFBSSxDQUNYLFNBQVMsQ0FBRSxJQUFJLEFBQ2pCLENBQUMsQUFDRCxLQUFLLGNBQUMsQ0FBQyxBQUNMLFNBQVMsQ0FBRSxJQUFJLENBQ2YsU0FBUyxDQUFFLElBQUksQ0FDZixLQUFLLENBQUUsSUFBSSxDQUNYLFNBQVMsQ0FBRSxJQUFJLENBQ2YsVUFBVSxDQUFFLElBQUksQ0FDaEIsVUFBVSxDQUFFLFVBQVUsQ0FDdEIsWUFBWSxDQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUN0QyxVQUFVLENBQUUsS0FBSyxBQUduQixDQUFDIn0= */";
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

    // (26:4) {#if year === '2018'}
    function create_if_block_3(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			set_style(div, "margin-top", "20px");
    			add_location(div, file$3, 26, 6, 1111);
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
    		source: "(26:4) {#if year === '2018'}",
    		ctx
    	});

    	return block;
    }

    // (29:4) {#if year === '2000'}
    function create_if_block_2(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			set_style(div, "margin-top", "20px");
    			add_location(div, file$3, 29, 6, 1186);
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
    		source: "(29:4) {#if year === '2000'}",
    		ctx
    	});

    	return block;
    }

    // (37:8) {:else}
    function create_else_block(ctx) {
    	let div;
    	let div_title_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "person svelte-hvt34n");
    			attr_dev(div, "title", div_title_value = /*str*/ ctx[6]);
    			add_location(div, file$3, 37, 10, 1494);
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
    		id: create_else_block.name,
    		type: "else",
    		source: "(37:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (35:8) {#if counts[str] >= minTerms}
    function create_if_block_1(ctx) {
    	let div;
    	let div_title_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "person highlight svelte-hvt34n");
    			set_style(div, "border-left", "7px solid " + byColor[/*str*/ ctx[6]]);
    			attr_dev(div, "title", div_title_value = /*str*/ ctx[6]);
    			add_location(div, file$3, 35, 10, 1377);
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
    		source: "(35:8) {#if counts[str] >= minTerms}",
    		ctx
    	});

    	return block;
    }

    // (34:6) {#each data[String(year)] as str}
    function create_each_block_1(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (counts[/*str*/ ctx[6]] >= /*minTerms*/ ctx[2]) return create_if_block_1;
    		return create_else_block;
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
    		source: "(34:6) {#each data[String(year)] as str}",
    		ctx
    	});

    	return block;
    }

    // (42:8) {#if year === '1997' || year === '2000' || year === '2018'}
    function create_if_block(ctx) {
    	let t0_value = data[String(/*year*/ ctx[3])].length + "";
    	let t0;
    	let t1;
    	let br;
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = text(" seats\n          ");
    			br = element("br");
    			t2 = text("\n          ↓");
    			add_location(br, file$3, 43, 10, 1705);
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
    		id: create_if_block.name,
    		type: "if",
    		source: "(42:8) {#if year === '1997' || year === '2000' || year === '2018'}",
    		ctx
    	});

    	return block;
    }

    // (25:2) {#each Object.keys(data) as year}
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
    	let if_block0 = /*year*/ ctx[3] === "2018" && create_if_block_3(ctx);
    	let if_block1 = /*year*/ ctx[3] === "2000" && create_if_block_2(ctx);
    	let each_value_1 = data[String(/*year*/ ctx[3])];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let if_block2 = (/*year*/ ctx[3] === "1997" || /*year*/ ctx[3] === "2000" || /*year*/ ctx[3] === "2018") && create_if_block(ctx);

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
    			attr_dev(div0, "class", "year svelte-hvt34n");
    			add_location(div0, file$3, 32, 6, 1258);
    			attr_dev(div1, "class", "aside svelte-hvt34n");
    			add_location(div1, file$3, 40, 6, 1563);
    			attr_dev(div2, "class", "term svelte-hvt34n");
    			add_location(div2, file$3, 31, 4, 1233);
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
    		source: "(25:2) {#each Object.keys(data) as year}",
    		ctx
    	});

    	return block;
    }

    // (11:0) <Page {title} {sub} height="1300" width="730">
    function create_default_slot(ctx) {
    	let div10;
    	let div0;
    	let t0;
    	let div8;
    	let div1;
    	let t2;
    	let div2;
    	let t4;
    	let div3;
    	let t6;
    	let div4;
    	let t8;
    	let div5;
    	let t10;
    	let div6;
    	let t12;
    	let div7;
    	let t14;
    	let div9;
    	let t15;
    	let t16;
    	let div20;
    	let div11;
    	let t17;
    	let div18;
    	let div12;
    	let t19;
    	let div13;
    	let t21;
    	let div14;
    	let t23;
    	let div15;
    	let t25;
    	let div16;
    	let t27;
    	let div17;
    	let t29;
    	let div19;
    	let each_value = Object.keys(data);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div8 = element("div");
    			div1 = element("div");
    			div1.textContent = "Gloria Lindsay Luby";
    			t2 = space();
    			div2 = element("div");
    			div2.textContent = "Maria Augimeri";
    			t4 = space();
    			div3 = element("div");
    			div3.textContent = "John Filion";
    			t6 = space();
    			div4 = element("div");
    			div4.textContent = "David Shiner";
    			t8 = space();
    			div5 = element("div");
    			div5.textContent = "Joe Mihevc";
    			t10 = space();
    			div6 = element("div");
    			div6.textContent = "Denzil Minnan-Wong";
    			t12 = space();
    			div7 = element("div");
    			div7.textContent = "Raymond Cho";
    			t14 = space();
    			div9 = element("div");
    			t15 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t16 = space();
    			div20 = element("div");
    			div11 = element("div");
    			t17 = space();
    			div18 = element("div");
    			div12 = element("div");
    			div12.textContent = "Anthony Perruzza";
    			t19 = space();
    			div13 = element("div");
    			div13.textContent = "Frances Nunziata";
    			t21 = space();
    			div14 = element("div");
    			div14.textContent = "Gord Perks";
    			t23 = space();
    			div15 = element("div");
    			div15.textContent = "Paula Fletcher";
    			t25 = space();
    			div16 = element("div");
    			div16.textContent = "Michael Thompson";
    			t27 = space();
    			div17 = element("div");
    			div17.textContent = "Paul Ainslie";
    			t29 = space();
    			div19 = element("div");
    			attr_dev(div0, "class", "year svelte-hvt34n");
    			set_style(div0, "border", "none");
    			add_location(div0, file$3, 12, 4, 382);
    			attr_dev(div1, "class", "label svelte-hvt34n");
    			set_style(div1, "left", "3%");
    			set_style(div1, "color", "#735873");
    			add_location(div1, file$3, 14, 6, 452);
    			attr_dev(div2, "class", "label svelte-hvt34n");
    			set_style(div2, "left", "15.5%");
    			set_style(div2, "color", "#D68881");
    			add_location(div2, file$3, 15, 6, 535);
    			attr_dev(div3, "class", "label svelte-hvt34n");
    			set_style(div3, "left", "45%");
    			set_style(div3, "color", "#978BA3");
    			add_location(div3, file$3, 16, 6, 616);
    			attr_dev(div4, "class", "label svelte-hvt34n");
    			set_style(div4, "left", "49%");
    			set_style(div4, "color", "#2D85A8");
    			add_location(div4, file$3, 17, 6, 692);
    			attr_dev(div5, "class", "label svelte-hvt34n");
    			set_style(div5, "left", "40%");
    			set_style(div5, "color", "#F2C0BB");
    			add_location(div5, file$3, 18, 6, 769);
    			attr_dev(div6, "class", "label svelte-hvt34n");
    			set_style(div6, "left", "69%");
    			set_style(div6, "color", "#335799");
    			add_location(div6, file$3, 19, 6, 844);
    			attr_dev(div7, "class", "label svelte-hvt34n");
    			set_style(div7, "left", "88%");
    			set_style(div7, "color", "#e6d7b3");
    			add_location(div7, file$3, 20, 6, 927);
    			attr_dev(div8, "class", "rel svelte-hvt34n");
    			add_location(div8, file$3, 13, 4, 428);
    			attr_dev(div9, "class", "aside svelte-hvt34n");
    			add_location(div9, file$3, 22, 4, 1012);
    			attr_dev(div10, "class", "term legend svelte-hvt34n");
    			set_style(div10, "margin-bottom", "5px");
    			add_location(div10, file$3, 11, 2, 324);
    			attr_dev(div11, "class", "year svelte-hvt34n");
    			set_style(div11, "border", "none");
    			add_location(div11, file$3, 50, 4, 1869);
    			attr_dev(div12, "class", "label right svelte-hvt34n");
    			set_style(div12, "left", "10%");
    			set_style(div12, "color", "#2D85A8");
    			add_location(div12, file$3, 52, 6, 1939);
    			attr_dev(div13, "class", "label right svelte-hvt34n");
    			set_style(div13, "left", "18%");
    			set_style(div13, "color", "#6699cc");
    			add_location(div13, file$3, 53, 6, 2026);
    			attr_dev(div14, "class", "label right svelte-hvt34n");
    			set_style(div14, "left", "27%");
    			set_style(div14, "color", "#cc6966");
    			add_location(div14, file$3, 54, 6, 2113);
    			attr_dev(div15, "class", "label right svelte-hvt34n");
    			set_style(div15, "left", "60%");
    			set_style(div15, "color", "#d8b3e6");
    			add_location(div15, file$3, 55, 6, 2194);
    			attr_dev(div16, "class", "label right svelte-hvt34n");
    			set_style(div16, "left", "76%");
    			set_style(div16, "color", "#7f9c6c");
    			add_location(div16, file$3, 56, 6, 2279);
    			attr_dev(div17, "class", "label right svelte-hvt34n");
    			set_style(div17, "left", "88%");
    			set_style(div17, "color", "#275291");
    			add_location(div17, file$3, 57, 6, 2366);
    			attr_dev(div18, "class", "rel svelte-hvt34n");
    			add_location(div18, file$3, 51, 4, 1915);
    			attr_dev(div19, "class", "aside svelte-hvt34n");
    			add_location(div19, file$3, 59, 4, 2458);
    			attr_dev(div20, "class", "term legend svelte-hvt34n");
    			set_style(div20, "margin-top", "1rem");
    			set_style(div20, "align-items", "flex-end");
    			set_style(div20, "max-height", "40px");
    			add_location(div20, file$3, 49, 2, 1774);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div10, anchor);
    			append_dev(div10, div0);
    			append_dev(div10, t0);
    			append_dev(div10, div8);
    			append_dev(div8, div1);
    			append_dev(div8, t2);
    			append_dev(div8, div2);
    			append_dev(div8, t4);
    			append_dev(div8, div3);
    			append_dev(div8, t6);
    			append_dev(div8, div4);
    			append_dev(div8, t8);
    			append_dev(div8, div5);
    			append_dev(div8, t10);
    			append_dev(div8, div6);
    			append_dev(div8, t12);
    			append_dev(div8, div7);
    			append_dev(div10, t14);
    			append_dev(div10, div9);
    			insert_dev(target, t15, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, t16, anchor);
    			insert_dev(target, div20, anchor);
    			append_dev(div20, div11);
    			append_dev(div20, t17);
    			append_dev(div20, div18);
    			append_dev(div18, div12);
    			append_dev(div18, t19);
    			append_dev(div18, div13);
    			append_dev(div18, t21);
    			append_dev(div18, div14);
    			append_dev(div18, t23);
    			append_dev(div18, div15);
    			append_dev(div18, t25);
    			append_dev(div18, div16);
    			append_dev(div18, t27);
    			append_dev(div18, div17);
    			append_dev(div20, t29);
    			append_dev(div20, div19);
    		},
    		p: function update(ctx, dirty) {
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
    						each_blocks[i].m(t16.parentNode, t16);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    			if (detaching) detach_dev(t15);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t16);
    			if (detaching) detach_dev(div20);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(11:0) <Page {title} {sub} height=\\\"1300\\\" width=\\\"730\\\">",
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
    				sub: /*sub*/ ctx[1],
    				height: "1300",
    				width: "730",
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
    			if (dirty & /*sub*/ 2) page_changes.sub = /*sub*/ ctx[1];

    			if (dirty & /*$$scope*/ 512) {
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
    	let { title = "Long-serving Toronto city councilors" } = $$props;
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
    		Page,
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
    		if (!document.getElementById("svelte-hvt34n-style")) add_css$3();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { title: 0, sub: 1 });

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
