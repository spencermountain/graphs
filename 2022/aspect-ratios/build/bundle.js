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

    /* 2022/aspect-ratios/Post.svelte generated by Svelte v3.29.0 */
    const file$3 = "2022/aspect-ratios/Post.svelte";

    function add_css$3() {
    	var style = element("style");
    	style.id = "svelte-y1lpe-style";
    	style.textContent = ".tinier.svelte-y1lpe{font-size:16px !important}.below.svelte-y1lpe{position:absolute;bottom:-30px;color:grey;font-size:18px}.row.svelte-y1lpe{display:flex;flex-direction:row;justify-content:flex-start;text-align:left;flex-wrap:nowrap;align-items:center}.bars.svelte-y1lpe{position:relative;display:flex;flex-direction:row;justify-content:flex-start;flex-wrap:nowrap;width:100%;margin-top:5px}.desc.svelte-y1lpe{position:absolute;font-size:14px;margin-left:20px;top:10px;color:grey;font-style:italic}@media only screen and (max-width: 850px){.desc.svelte-y1lpe{top:-30px;left:100px !important}.row.svelte-y1lpe{flex-wrap:wrap}.bars.svelte-y1lpe{margin-top:10px}}.ratio.svelte-y1lpe{margin-top:3rem}.name.svelte-y1lpe{font-size:20px;font-weight:bold;margin-left:2rem;margin-right:0.2rem;width:80px;color:grey}.col.svelte-y1lpe{display:flex;flex-direction:column;justify-content:flex-start}.one.svelte-y1lpe{background-color:#6d87a5;z-index:3;border-radius:5px 0px 0px 5px}.plus.svelte-y1lpe{background-color:#946da5;border-radius:5px 5px 5px 5px;position:absolute;left:0px;z-index:1}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCB7IFBhZ2UgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2luZGV4Lm1qcydcbiAgZXhwb3J0IGxldCB0aXRsZSA9ICdBc3BlY3QgUmF0aW9zJ1xuICBleHBvcnQgbGV0IHN1YiA9ICcnXG4gIGxldCB4ID0gMjAwXG4gIC8vIGFzcGVjdCByYXRpb3MgYXMgJXM6XG4gIGxldCByYXRpb3MgPSBbXG4gICAge1xuICAgICAgbmFtZTogJzU6NCcsXG4gICAgICBkZXNjOiAnbW9uaXRvcnMnLFxuICAgICAgY3NzOiAnNSAvIDQgJyxcbiAgICAgIHJhdGlvOiAxLjI1LFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJzQ6MycsXG4gICAgICBkZXNjOiAnaXBhZHMsIHBob3RvcycsXG4gICAgICBjc3M6ICc0IC8gMycsXG4gICAgICByYXRpbzogMS4zLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJzE64oiaMicsXG4gICAgICBkZXNjOiAnQTQgcGFwZXInLFxuICAgICAgY3NzOiAnMS40MTQyIC8gMScsXG4gICAgICByYXRpbzogMS40MSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICczOjInLFxuICAgICAgZGVzYzogJzM1bW0gZmlsbScsXG4gICAgICBjc3M6ICczIC8gMicsXG4gICAgICByYXRpbzogMS41LFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ2dvbGRlbicsXG4gICAgICBkZXNjOiAnIHNuYWlscywgZXRjLicsXG4gICAgICBjc3M6ICcxLjYxOCAvIDEnLFxuICAgICAgcmF0aW86IDEuNjE4LFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJzE2OjknLFxuICAgICAgZGVzYzogXCIxMDgwcCwgJ3dpZGVzY3JlZW4nXCIsXG4gICAgICBjc3M6ICcxNiAvIDknLFxuICAgICAgcmF0aW86IDEuNzcsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnMTkuNTo5JyxcbiAgICAgIGRlc2M6ICdyZWNlbnQgaXBob25lcycsXG4gICAgICBjc3M6ICcxOS41IC8gOScsXG4gICAgICByYXRpbzogMi4xNixcbiAgICB9LFxuICBdXG48L3NjcmlwdD5cblxuPFBhZ2Uge3RpdGxlfSB7c3VifSBoZWlnaHQ9XCI4MDBcIiB3aWR0aD1cIjcwMFwiPlxuICB7I2VhY2ggcmF0aW9zIGFzIG99XG4gICAgPGRpdiBjbGFzcz1cInJhdGlvIGNvbFwiPlxuICAgICAgPGRpdiBjbGFzcz1cInJvd1wiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwibmFtZVwiIGNsYXNzOnRpbmllcj17dHJ1ZX0+e28ubmFtZX08L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImJhcnNcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwib25lXCIgc3R5bGU9XCJoZWlnaHQ6NTBweDsgIHdpZHRoOnt4fXB4O1wiIC8+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInBsdXNcIiBzdHlsZT1cImhlaWdodDo1MHB4OyB3aWR0aDp7eCAqIG8ucmF0aW99cHg7XCIgLz5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGVzY1wiIHN0eWxlPVwibGVmdDp7eCAqIG8ucmF0aW99cHg7XCI+e28uZGVzY308L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiYmVsb3dcIiBzdHlsZT1cImxlZnQ6e3h9cHg7IG1hcmdpbi1sZWZ0OjE1cHg7IGNvbG9yOiAjOTQ2ZGE1O1wiPlxuICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJmb250LXNpemU6MTBweDtcIj54PC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJcIj57by5yYXRpb308L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIHsvZWFjaH1cbjwvUGFnZT5cblxuPHN0eWxlPlxuICAudGluaWVyIHtcbiAgICBmb250LXNpemU6IDE2cHggIWltcG9ydGFudDtcbiAgfVxuICAuYmVsb3cge1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBib3R0b206IC0zMHB4O1xuICAgIGNvbG9yOiBncmV5O1xuICAgIGZvbnQtc2l6ZTogMThweDtcbiAgfVxuICAuYWxsIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1hcm91bmQ7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgZmxleC13cmFwOiBub3dyYXA7XG4gICAgYWxpZ24tc2VsZjogc3RyZXRjaDtcbiAgfVxuICAuY29udGFpbmVyIHtcbiAgICBtYXJnaW46IDNyZW07XG4gICAgcGFkZGluZzogMnJlbTtcbiAgICBib3gtc2hhZG93OiAycHggMnB4IDhweCAwcHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIG1heC13aWR0aDogNzUwcHg7XG4gICAgbWluLXdpZHRoOiA0NTBweDtcbiAgICBtaW4taGVpZ2h0OiA1MDBweDtcbiAgICB3aWR0aDogNjUlO1xuICB9XG5cbiAgLnJvdyB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICB0ZXh0LWFsaWduOiBsZWZ0O1xuICAgIGZsZXgtd3JhcDogbm93cmFwO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIH1cblxuICAuYmFycyB7XG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgZmxleC13cmFwOiBub3dyYXA7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgbWFyZ2luLXRvcDogNXB4O1xuICB9XG5cbiAgLmRlc2Mge1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBmb250LXNpemU6IDE0cHg7XG4gICAgbWFyZ2luLWxlZnQ6IDIwcHg7XG4gICAgdG9wOiAxMHB4O1xuICAgIGNvbG9yOiBncmV5O1xuICAgIGZvbnQtc3R5bGU6IGl0YWxpYztcbiAgfVxuICBAbWVkaWEgb25seSBzY3JlZW4gYW5kIChtYXgtd2lkdGg6IDg1MHB4KSB7XG4gICAgLmNvbnRhaW5lciB7XG4gICAgICBtYXJnaW46IDFyZW07XG4gICAgICBwYWRkaW5nOiAxcmVtO1xuICAgIH1cbiAgICAuZGVzYyB7XG4gICAgICB0b3A6IC0zMHB4O1xuICAgICAgbGVmdDogMTAwcHggIWltcG9ydGFudDtcbiAgICAgIC8qIGRpc3BsYXk6IG5vbmU7ICovXG4gICAgfVxuICAgIC5yb3cge1xuICAgICAgZmxleC13cmFwOiB3cmFwO1xuICAgIH1cbiAgICAuYmFycyB7XG4gICAgICBtYXJnaW4tdG9wOiAxMHB4O1xuICAgIH1cbiAgfVxuXG4gIC5yYXRpbyB7XG4gICAgbWFyZ2luLXRvcDogM3JlbTtcbiAgfVxuICAubmFtZSB7XG4gICAgZm9udC1zaXplOiAyMHB4O1xuICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgIG1hcmdpbi1sZWZ0OiAycmVtO1xuICAgIG1hcmdpbi1yaWdodDogMC4ycmVtO1xuICAgIHdpZHRoOiA4MHB4O1xuICAgIGNvbG9yOiBncmV5O1xuICB9XG4gIC5jb2wge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gIH1cbiAgLm9uZSB7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogIzZkODdhNTtcbiAgICB6LWluZGV4OiAzO1xuICAgIGJvcmRlci1yYWRpdXM6IDVweCAwcHggMHB4IDVweDtcbiAgfVxuICAucGx1cyB7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogIzk0NmRhNTtcbiAgICBib3JkZXItcmFkaXVzOiA1cHggNXB4IDVweCA1cHg7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIGxlZnQ6IDBweDtcbiAgICB6LWluZGV4OiAxO1xuICB9XG48L3N0eWxlPlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXdFRSxPQUFPLGFBQUMsQ0FBQyxBQUNQLFNBQVMsQ0FBRSxJQUFJLENBQUMsVUFBVSxBQUM1QixDQUFDLEFBQ0QsTUFBTSxhQUFDLENBQUMsQUFDTixRQUFRLENBQUUsUUFBUSxDQUNsQixNQUFNLENBQUUsS0FBSyxDQUNiLEtBQUssQ0FBRSxJQUFJLENBQ1gsU0FBUyxDQUFFLElBQUksQUFDakIsQ0FBQyxBQW9CRCxJQUFJLGFBQUMsQ0FBQyxBQUNKLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLEdBQUcsQ0FDbkIsZUFBZSxDQUFFLFVBQVUsQ0FDM0IsVUFBVSxDQUFFLElBQUksQ0FDaEIsU0FBUyxDQUFFLE1BQU0sQ0FDakIsV0FBVyxDQUFFLE1BQU0sQUFDckIsQ0FBQyxBQUVELEtBQUssYUFBQyxDQUFDLEFBQ0wsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsR0FBRyxDQUNuQixlQUFlLENBQUUsVUFBVSxDQUMzQixTQUFTLENBQUUsTUFBTSxDQUNqQixLQUFLLENBQUUsSUFBSSxDQUNYLFVBQVUsQ0FBRSxHQUFHLEFBQ2pCLENBQUMsQUFFRCxLQUFLLGFBQUMsQ0FBQyxBQUNMLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLFNBQVMsQ0FBRSxJQUFJLENBQ2YsV0FBVyxDQUFFLElBQUksQ0FDakIsR0FBRyxDQUFFLElBQUksQ0FDVCxLQUFLLENBQUUsSUFBSSxDQUNYLFVBQVUsQ0FBRSxNQUFNLEFBQ3BCLENBQUMsQUFDRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFlBQVksS0FBSyxDQUFDLEFBQUMsQ0FBQyxBQUt6QyxLQUFLLGFBQUMsQ0FBQyxBQUNMLEdBQUcsQ0FBRSxLQUFLLENBQ1YsSUFBSSxDQUFFLEtBQUssQ0FBQyxVQUFVLEFBRXhCLENBQUMsQUFDRCxJQUFJLGFBQUMsQ0FBQyxBQUNKLFNBQVMsQ0FBRSxJQUFJLEFBQ2pCLENBQUMsQUFDRCxLQUFLLGFBQUMsQ0FBQyxBQUNMLFVBQVUsQ0FBRSxJQUFJLEFBQ2xCLENBQUMsQUFDSCxDQUFDLEFBRUQsTUFBTSxhQUFDLENBQUMsQUFDTixVQUFVLENBQUUsSUFBSSxBQUNsQixDQUFDLEFBQ0QsS0FBSyxhQUFDLENBQUMsQUFDTCxTQUFTLENBQUUsSUFBSSxDQUNmLFdBQVcsQ0FBRSxJQUFJLENBQ2pCLFdBQVcsQ0FBRSxJQUFJLENBQ2pCLFlBQVksQ0FBRSxNQUFNLENBQ3BCLEtBQUssQ0FBRSxJQUFJLENBQ1gsS0FBSyxDQUFFLElBQUksQUFDYixDQUFDLEFBQ0QsSUFBSSxhQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLGVBQWUsQ0FBRSxVQUFVLEFBQzdCLENBQUMsQUFDRCxJQUFJLGFBQUMsQ0FBQyxBQUNKLGdCQUFnQixDQUFFLE9BQU8sQ0FDekIsT0FBTyxDQUFFLENBQUMsQ0FDVixhQUFhLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxBQUNoQyxDQUFDLEFBQ0QsS0FBSyxhQUFDLENBQUMsQUFDTCxnQkFBZ0IsQ0FBRSxPQUFPLENBQ3pCLGFBQWEsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQzlCLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLElBQUksQ0FBRSxHQUFHLENBQ1QsT0FBTyxDQUFFLENBQUMsQUFDWixDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (54:2) {#each ratios as o}
    function create_each_block(ctx) {
    	let div7;
    	let div6;
    	let div0;
    	let t0_value = /*o*/ ctx[4].name + "";
    	let t0;
    	let t1;
    	let div5;
    	let div1;
    	let t2;
    	let div2;
    	let t3;
    	let div3;
    	let t4_value = /*o*/ ctx[4].desc + "";
    	let t4;
    	let t5;
    	let div4;
    	let span0;
    	let t7;
    	let span1;
    	let t8_value = /*o*/ ctx[4].ratio + "";
    	let t8;
    	let t9;

    	const block = {
    		c: function create() {
    			div7 = element("div");
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
    			t4 = text(t4_value);
    			t5 = space();
    			div4 = element("div");
    			span0 = element("span");
    			span0.textContent = "x";
    			t7 = space();
    			span1 = element("span");
    			t8 = text(t8_value);
    			t9 = space();
    			attr_dev(div0, "class", "name svelte-y1lpe");
    			toggle_class(div0, "tinier", true);
    			add_location(div0, file$3, 56, 8, 1034);
    			attr_dev(div1, "class", "one svelte-y1lpe");
    			set_style(div1, "height", "50px");
    			set_style(div1, "width", /*x*/ ctx[2] + "px");
    			add_location(div1, file$3, 58, 10, 1124);
    			attr_dev(div2, "class", "plus svelte-y1lpe");
    			set_style(div2, "height", "50px");
    			set_style(div2, "width", /*x*/ ctx[2] * /*o*/ ctx[4].ratio + "px");
    			add_location(div2, file$3, 59, 10, 1189);
    			attr_dev(div3, "class", "desc svelte-y1lpe");
    			set_style(div3, "left", /*x*/ ctx[2] * /*o*/ ctx[4].ratio + "px");
    			add_location(div3, file$3, 60, 10, 1264);
    			set_style(span0, "font-size", "10px");
    			add_location(span0, file$3, 62, 12, 1423);
    			add_location(span1, file$3, 63, 12, 1474);
    			attr_dev(div4, "class", "below svelte-y1lpe");
    			set_style(div4, "left", /*x*/ ctx[2] + "px");
    			set_style(div4, "margin-left", "15px");
    			set_style(div4, "color", "#946da5");
    			add_location(div4, file$3, 61, 10, 1337);
    			attr_dev(div5, "class", "bars svelte-y1lpe");
    			add_location(div5, file$3, 57, 8, 1095);
    			attr_dev(div6, "class", "row svelte-y1lpe");
    			add_location(div6, file$3, 55, 6, 1008);
    			attr_dev(div7, "class", "ratio col svelte-y1lpe");
    			add_location(div7, file$3, 54, 4, 978);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div7, anchor);
    			append_dev(div7, div6);
    			append_dev(div6, div0);
    			append_dev(div0, t0);
    			append_dev(div6, t1);
    			append_dev(div6, div5);
    			append_dev(div5, div1);
    			append_dev(div5, t2);
    			append_dev(div5, div2);
    			append_dev(div5, t3);
    			append_dev(div5, div3);
    			append_dev(div3, t4);
    			append_dev(div5, t5);
    			append_dev(div5, div4);
    			append_dev(div4, span0);
    			append_dev(div4, t7);
    			append_dev(div4, span1);
    			append_dev(span1, t8);
    			append_dev(div7, t9);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(54:2) {#each ratios as o}",
    		ctx
    	});

    	return block;
    }

    // (53:0) <Page {title} {sub} height="800" width="700">
    function create_default_slot(ctx) {
    	let each_1_anchor;
    	let each_value = /*ratios*/ ctx[3];
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
    			if (dirty & /*x, ratios*/ 12) {
    				each_value = /*ratios*/ ctx[3];
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
    		source: "(53:0) <Page {title} {sub} height=\\\"800\\\" width=\\\"700\\\">",
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
    				height: "800",
    				width: "700",
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

    			if (dirty & /*$$scope*/ 128) {
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
    	let { title = "Aspect Ratios" } = $$props;
    	let { sub = "" } = $$props;
    	let x = 200;

    	// aspect ratios as %s:
    	let ratios = [
    		{
    			name: "5:4",
    			desc: "monitors",
    			css: "5 / 4 ",
    			ratio: 1.25
    		},
    		{
    			name: "4:3",
    			desc: "ipads, photos",
    			css: "4 / 3",
    			ratio: 1.3
    		},
    		{
    			name: "1:√2",
    			desc: "A4 paper",
    			css: "1.4142 / 1",
    			ratio: 1.41
    		},
    		{
    			name: "3:2",
    			desc: "35mm film",
    			css: "3 / 2",
    			ratio: 1.5
    		},
    		{
    			name: "golden",
    			desc: " snails, etc.",
    			css: "1.618 / 1",
    			ratio: 1.618
    		},
    		{
    			name: "16:9",
    			desc: "1080p, 'widescreen'",
    			css: "16 / 9",
    			ratio: 1.77
    		},
    		{
    			name: "19.5:9",
    			desc: "recent iphones",
    			css: "19.5 / 9",
    			ratio: 2.16
    		}
    	];

    	const writable_props = ["title", "sub"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    	};

    	$$self.$capture_state = () => ({ Page, title, sub, x, ratios });

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(1, sub = $$props.sub);
    		if ("x" in $$props) $$invalidate(2, x = $$props.x);
    		if ("ratios" in $$props) $$invalidate(3, ratios = $$props.ratios);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, sub, x, ratios];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-y1lpe-style")) add_css$3();
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
