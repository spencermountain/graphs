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
    	style.id = "svelte-6f921v-style";
    	style.textContent = ".year.svelte-6f921v{min-height:90px}.digit.svelte-6f921v{width:80px;display:flex;flex-direction:row;justify-content:center;align-items:center;margin-bottom:1rem;color:grey}.person.svelte-6f921v{height:80%;width:500px;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2);margin-right:4px;border-radius:5px}.person.svelte-6f921v:hover{box-shadow:4px 4px 8px 0px rgba(0, 0, 0, 0.4)}.other.svelte-6f921v{background-color:lightgrey}.row.svelte-6f921v{display:flex;flex-direction:row;justify-content:center;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch}.people.svelte-6f921v{width:400px;display:flex;flex-direction:row;justify-content:stretch;align-items:flex-start;text-align:left;flex-wrap:nowrap;align-self:stretch}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCB7IFBhZ2UgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2luZGV4Lm1qcydcbiAgaW1wb3J0IG5hbWVzIGZyb20gJy4vY29sb3JzLmpzJ1xuXG4gIGltcG9ydCBkYXRhIGZyb20gJy4vZGF0YS5qcydcbiAgbGV0IGNvbG9ycyA9IHtcbiAgICAnSmVubmlmZXIgS2Vlc21hYXQnOiBuYW1lc1sncGluayddLFxuICAgICdKYWNrIExheXRvbic6IG5hbWVzWyd5ZWxsb3cnXSxcbiAgICAnQmFyYmFyYSBIYWxsJzogbmFtZXNbJ211ZCddLFxuICAgICdBLiBIdW1tZXInOiBuYW1lc1sncGluayddLFxuICAgICdHZW9yZ2UgU21pdGhlcm1hbic6IG5hbWVzWydmdXNjaWEnXSxcbiAgICAnR2lsIFBlw7FhbG9zYSc6IG5hbWVzWydyb3lhbCddLFxuICAgICdKdW5lIFJvd2xhbmRzJzogbmFtZXNbJ3R1bGlwJ10sXG4gICAgJ0pvaG4gVG9yeSc6IG5hbWVzWydzZWEnXSxcbiAgICAnRG91ZyBGb3JkJzogbmFtZXNbJ3NreSddLFxuICAgICdPbGl2aWEgQ2hvdyc6IG5hbWVzWydvbGl2ZSddLFxuICAgICdBcnQgRWdnbGV0b24nOiBuYW1lc1snc3VlZGUnXSxcbiAgICAnTmF0aGFuIFBoaWxsaXBzJzogbmFtZXNbJ3NreSddLFxuICAgICdXaWxsaWFtIERlbm5pc29uJzogbmFtZXNbJ2dyZXlibHVlJ10sXG4gICAgJ1BoaWxpcCBHaXZlbnMnOiBuYW1lc1sndHVsaXAnXSxcbiAgICAnRGF2aWQgQ3JvbWJpZSc6IG5hbWVzWydvcmFuZ2UnXSxcbiAgICBcIlRvbnkgTydEb25vaHVlXCI6IG5hbWVzWydncmVlbiddLFxuICAgICdBbGxhbiBMYW1wb3J0JzogbmFtZXNbJ3JlZCddLFxuICAgICdTdGVwaGVuIENsYXJrc29udCc6IG5hbWVzWydmaXJlJ10sXG4gICAgJ01lbCBMYXN0bWFuJzogbmFtZXNbJ2NoZXJyeSddLFxuICAgICdUb29rZXIgR29tYmVyZyc6IG5hbWVzWydmaXJlJ10sXG4gICAgJ0RhdmlkIE1pbGxlcic6IG5hbWVzWydicm93biddLFxuICAgICdSb2IgRm9yZCc6IG5hbWVzWydmaXJlJ10sXG4gICAgJ0RvdWcgRm9yZCc6IG5hbWVzWydmaXJlJ10sXG4gICAgJ0NobG9lLU1hcmllIEJyb3duJzogbmFtZXNbJ3JlZCddLFxuICAgICdKb2UgUGFudGFsb25lJzogbmFtZXNbJ3NsYXRlJ10sXG4gICAgJ0Nhcm9sYW5uIFdyaWdodCc6IG5hbWVzWydncmVlbiddLFxuICAgICdBbm5lIEpvaG5zdG9uJzogbmFtZXNbJ29saXZlJ10sXG4gICAgJ0pvaG4gU2V3ZWxsJzogbmFtZXNbJ2JsdWUnXSxcbiAgICAnRG9uIEFuZHJld3MnOiBuYW1lc1sncmVkJ10sXG4gICAgJ01hcmdhcmV0IENhbXBiZWxsJzogbmFtZXNbJ3JvdWdlJ10sXG4gICAgJ1N0ZXBoZW4gQ2xhcmtzb24nOiBuYW1lc1snYmVpZ2UnXSxcbiAgICAnRG9uYWxkIFN1bW1lcnZpbGxlJzogbmFtZXNbJ2dyZXlncmVlbiddLFxuICAgICdBcnRodXIgSi4gQnJvd24nOiBuYW1lc1snc2xhdGUnXSxcbiAgICAnRm9yZCBCcmFuZCc6IG5hbWVzWydvbGl2ZSddLFxuICAgICdBcnRodXIgQnJvd24nOiBuYW1lc1snZ3JlZW4nXSxcbiAgICAnTGVzbGllIFNhdW5kZXJzJzogbmFtZXNbJ3B1cnBsZSddLFxuICAgICdSb3kgRS4gQmVseWVhJzogbmFtZXNbJ2dyZXlncmVlbiddLFxuICAgICdSb3NzIERvd3Nvbic6IG5hbWVzWydvcmFuZ2UnXSxcbiAgICAnSGlyYW0gRS4gTWNDYWxsdW0nOiBuYW1lc1sncGluayddLFxuICAgICdSb3NzIERvd3Nvbic6IG5hbWVzWydncmV5cHVycGxlJ10sXG4gICAgJ0NoYXJsZXMgTWFob25leSc6IG5hbWVzWydyb3NlJ10sXG4gIH1cbiAgZXhwb3J0IGxldCB0aXRsZSA9ICdFbGVjdGlvbnMgaW4gVG9yb250bydcbiAgZGF0YS5mb3JFYWNoKChvLCBpKSA9PiB7XG4gICAgbGV0IHN1bSA9IDBcbiAgICBvLnBlb3BsZS5mb3JFYWNoKChwKSA9PiB7XG4gICAgICBsZXQgbnVtID0gcGFyc2VJbnQocC5wZXJjZW50LnJlcGxhY2UoLyUvLCAnJykpXG4gICAgICBzdW0gKz0gbnVtXG4gICAgfSlcbiAgICBvLnllYXJzID0gNFxuICAgIGlmIChkYXRhW2kgKyAxXSkge1xuICAgICAgby55ZWFycyA9IGRhdGFbaSArIDFdLnllYXIgLSBvLnllYXJcbiAgICAgIGlmIChvLnllYXJzIDw9IDApIHtcbiAgICAgICAgby55ZWFycyA9IDFcbiAgICAgIH1cbiAgICB9XG4gICAgby5vdGhlciA9IDEwMCAtIHN1bVxuICB9KVxuPC9zY3JpcHQ+XG5cbjxQYWdlIHt0aXRsZX0gaGVpZ2h0PVwiMzAwMFwiPlxuICB7I2VhY2ggZGF0YSBhcyBvLCBpfVxuICAgIDwhLS0gPGRpdiBjbGFzcz1cInJvd1wiIHN0eWxlPVwiaGVpZ2h0OntvLnllYXJzICogNDB9cHg7XCI+IC0tPlxuICAgIDxkaXYgY2xhc3M9XCJyb3cgeWVhclwiPlxuICAgICAgPGRpdiBjbGFzcz1cImRpZ2l0XCI+e28ueWVhcn08L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJwZW9wbGVcIj5cbiAgICAgICAgeyNlYWNoIG8ucGVvcGxlIGFzIHAsIGl9XG4gICAgICAgICAgPGRpdlxuICAgICAgICAgICAgY2xhc3M9XCJwZXJzb25cIlxuICAgICAgICAgICAgc3R5bGU9XCJ3aWR0aDp7cC5wZXJjZW50fTsgYmFja2dyb3VuZC1jb2xvcjp7Y29sb3JzW3AubmFtZV0gfHwgJ3N0ZWVsYmx1ZSd9O1wiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPCEtLSB7cC5uYW1lfSAtLT5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgey9lYWNofVxuICAgICAgICA8ZGl2IGNsYXNzPVwicGVyc29uIG90aGVyXCIgc3R5bGU9XCJ3aWR0aDp7by5vdGhlcn0lOyBcIiAvPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIHsvZWFjaH1cbjwvUGFnZT5cblxuPHN0eWxlPlxuICAueWVhciB7XG4gICAgbWluLWhlaWdodDogOTBweDtcbiAgfVxuICAuZGlnaXQge1xuICAgIHdpZHRoOiA4MHB4O1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIG1hcmdpbi1ib3R0b206IDFyZW07XG4gICAgY29sb3I6IGdyZXk7XG4gIH1cbiAgLnBlcnNvbiB7XG4gICAgaGVpZ2h0OiA4MCU7XG4gICAgd2lkdGg6IDUwMHB4O1xuICAgIGJveC1zaGFkb3c6IDJweCAycHggOHB4IDBweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gICAgbWFyZ2luLXJpZ2h0OiA0cHg7XG4gICAgYm9yZGVyLXJhZGl1czogNXB4O1xuICB9XG4gIC5wZXJzb246aG92ZXIge1xuICAgIGJveC1zaGFkb3c6IDRweCA0cHggOHB4IDBweCByZ2JhKDAsIDAsIDAsIDAuNCk7XG4gIH1cbiAgLm90aGVyIHtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiBsaWdodGdyZXk7XG4gIH1cbiAgLnJvdyB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIGZsZXgtd3JhcDogd3JhcDtcbiAgICBhbGlnbi1zZWxmOiBzdHJldGNoO1xuICB9XG4gIC5wZW9wbGUge1xuICAgIHdpZHRoOiA0MDBweDtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAganVzdGlmeS1jb250ZW50OiBzdHJldGNoO1xuICAgIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xuICAgIHRleHQtYWxpZ246IGxlZnQ7XG4gICAgZmxleC13cmFwOiBub3dyYXA7XG4gICAgYWxpZ24tc2VsZjogc3RyZXRjaDtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUF1RkUsS0FBSyxjQUFDLENBQUMsQUFDTCxVQUFVLENBQUUsSUFBSSxBQUNsQixDQUFDLEFBQ0QsTUFBTSxjQUFDLENBQUMsQUFDTixLQUFLLENBQUUsSUFBSSxDQUNYLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLEdBQUcsQ0FDbkIsZUFBZSxDQUFFLE1BQU0sQ0FDdkIsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsYUFBYSxDQUFFLElBQUksQ0FDbkIsS0FBSyxDQUFFLElBQUksQUFDYixDQUFDLEFBQ0QsT0FBTyxjQUFDLENBQUMsQUFDUCxNQUFNLENBQUUsR0FBRyxDQUNYLEtBQUssQ0FBRSxLQUFLLENBQ1osVUFBVSxDQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUM5QyxZQUFZLENBQUUsR0FBRyxDQUNqQixhQUFhLENBQUUsR0FBRyxBQUNwQixDQUFDLEFBQ0QscUJBQU8sTUFBTSxBQUFDLENBQUMsQUFDYixVQUFVLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEFBQ2hELENBQUMsQUFDRCxNQUFNLGNBQUMsQ0FBQyxBQUNOLGdCQUFnQixDQUFFLFNBQVMsQUFDN0IsQ0FBQyxBQUNELElBQUksY0FBQyxDQUFDLEFBQ0osT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsR0FBRyxDQUNuQixlQUFlLENBQUUsTUFBTSxDQUN2QixXQUFXLENBQUUsTUFBTSxDQUNuQixVQUFVLENBQUUsTUFBTSxDQUNsQixTQUFTLENBQUUsSUFBSSxDQUNmLFVBQVUsQ0FBRSxPQUFPLEFBQ3JCLENBQUMsQUFDRCxPQUFPLGNBQUMsQ0FBQyxBQUNQLEtBQUssQ0FBRSxLQUFLLENBQ1osT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsR0FBRyxDQUNuQixlQUFlLENBQUUsT0FBTyxDQUN4QixXQUFXLENBQUUsVUFBVSxDQUN2QixVQUFVLENBQUUsSUFBSSxDQUNoQixTQUFTLENBQUUsTUFBTSxDQUNqQixVQUFVLENBQUUsT0FBTyxBQUNyQixDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	child_ctx[4] = i;
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	child_ctx[4] = i;
    	return child_ctx;
    }

    // (73:8) {#each o.people as p, i}
    function create_each_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "person svelte-6f921v");
    			set_style(div, "width", /*p*/ ctx[5].percent);
    			set_style(div, "background-color", /*colors*/ ctx[1][/*p*/ ctx[5].name] || "steelblue");
    			add_location(div, file$3, 73, 10, 2296);
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
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(73:8) {#each o.people as p, i}",
    		ctx
    	});

    	return block;
    }

    // (68:2) {#each data as o, i}
    function create_each_block(ctx) {
    	let div3;
    	let div0;
    	let t0_value = /*o*/ ctx[2].year + "";
    	let t0;
    	let t1;
    	let div2;
    	let t2;
    	let div1;
    	let t3;
    	let each_value_1 = /*o*/ ctx[2].people;
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
    			attr_dev(div0, "class", "digit svelte-6f921v");
    			add_location(div0, file$3, 70, 6, 2192);
    			attr_dev(div1, "class", "person other svelte-6f921v");
    			set_style(div1, "width", /*o*/ ctx[2].other + "%");
    			add_location(div1, file$3, 80, 8, 2500);
    			attr_dev(div2, "class", "people svelte-6f921v");
    			add_location(div2, file$3, 71, 6, 2232);
    			attr_dev(div3, "class", "row year svelte-6f921v");
    			add_location(div3, file$3, 69, 4, 2163);
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
    			if (dirty & /*data, colors*/ 2) {
    				each_value_1 = /*o*/ ctx[2].people;
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
    		source: "(68:2) {#each data as o, i}",
    		ctx
    	});

    	return block;
    }

    // (67:0) <Page {title} height="3000">
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
    			if (dirty & /*data, colors*/ 2) {
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
    		source: "(67:0) <Page {title} height=\\\"3000\\\">",
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
    				height: "3000",
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

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    	};

    	$$self.$capture_state = () => ({ Page, names, data, colors, title });

    	$$self.$inject_state = $$props => {
    		if ("colors" in $$props) $$invalidate(1, colors = $$props.colors);
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, colors];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-6f921v-style")) add_css$3();
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
