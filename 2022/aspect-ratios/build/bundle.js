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
    	style.id = "svelte-1q0tlpp-style";
    	style.textContent = "{}.container.svelte-1q0tlpp{align-self:flex-start;margin:1rem;padding:1rem;height:20px;transition:margin-left 250ms}.name.svelte-1q0tlpp{font-size:0.5rem;color:grey}.container.svelte-1q0tlpp:hover{margin-left:0.8rem}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSGVhZC5zdmVsdGUiLCJzb3VyY2VzIjpbIkhlYWQuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGV4cG9ydCBsZXQgaHJlZiA9ICcjJ1xuICBleHBvcnQgbGV0IGNvbG9yID0gJyMzMDNiNTAnXG4gIGV4cG9ydCBsZXQgbGFiZWwgPSAnJ1xuICBleHBvcnQgbGV0IHRpdGxlID0gJydcbiAgbGV0IGhvdmVyID0gZmFsc2Vcbjwvc2NyaXB0PlxuXG48YSB7aHJlZn0gY2xhc3M9XCJjb250YWluZXJcIj5cbiAgPHN2ZyB3aWR0aD1cIjE1cHhcIiBoZWlnaHQ9XCIzMHB4XCIgdmlld0JveD1cIjAgMCA5MCAxNzBcIj5cbiAgICA8ZyBzdHJva2U9XCJub25lXCIgc3Ryb2tlLXdpZHRoPVwiMVwiIGZpbGw9XCJub25lXCIgZmlsbC1ydWxlPVwiZXZlbm9kZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+XG4gICAgICA8cGF0aFxuICAgICAgICBkPVwiTTgxLjUsNiBDNjkuODI0MDY2NiwyMy41MTM5MDAxIDQ1LjgyNDA2NjYsNDkuOTI3NzYzNSA5LjUsODUuMjQxNTkwMlxuICAgICAgICBDNDUuNzk4NDgxNCwxMjAuODA2ODYgNjkuNzk4NDgxNCwxNDcuMjI2MzMgODEuNSwxNjQuNVwiXG4gICAgICAgIHN0cm9rZT17Y29sb3J9XG4gICAgICAgIHN0cm9rZS13aWR0aD1cIjIwXCJcbiAgICAgICAgZmlsbC1ydWxlPVwibm9uemVyb1wiXG4gICAgICAvPlxuICAgIDwvZz5cbiAgPC9zdmc+XG4gIHsjaWYgaG92ZXJ9XG4gICAgPGRpdiBjbGFzcz1cIm5hbWVcIj57bGFiZWx9PC9kaXY+XG4gIHsvaWZ9XG48L2E+XG5cbjxzdHlsZT5cbiAgLmdvbGVmdCB7XG4gIH1cbiAgLmNvbnRhaW5lciB7XG4gICAgYWxpZ24tc2VsZjogZmxleC1zdGFydDtcbiAgICBtYXJnaW46IDFyZW07XG4gICAgcGFkZGluZzogMXJlbTtcbiAgICBoZWlnaHQ6IDIwcHg7XG4gICAgdHJhbnNpdGlvbjogbWFyZ2luLWxlZnQgMjUwbXM7XG4gIH1cbiAgLm5hbWUge1xuICAgIGZvbnQtc2l6ZTogMC41cmVtO1xuICAgIGNvbG9yOiBncmV5O1xuICB9XG5cbiAgLmNvbnRhaW5lcjpob3ZlciB7XG4gICAgbWFyZ2luLWxlZnQ6IDAuOHJlbTtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUEwQlUsQ0FBQyxBQUNULENBQUMsQUFDRCxVQUFVLGVBQUMsQ0FBQyxBQUNWLFVBQVUsQ0FBRSxVQUFVLENBQ3RCLE1BQU0sQ0FBRSxJQUFJLENBQ1osT0FBTyxDQUFFLElBQUksQ0FDYixNQUFNLENBQUUsSUFBSSxDQUNaLFVBQVUsQ0FBRSxXQUFXLENBQUMsS0FBSyxBQUMvQixDQUFDLEFBQ0QsS0FBSyxlQUFDLENBQUMsQUFDTCxTQUFTLENBQUUsTUFBTSxDQUNqQixLQUFLLENBQUUsSUFBSSxBQUNiLENBQUMsQUFFRCx5QkFBVSxNQUFNLEFBQUMsQ0FBQyxBQUNoQixXQUFXLENBQUUsTUFBTSxBQUNyQixDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    // (21:2) {#if hover}
    function create_if_block(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*label*/ ctx[2]);
    			attr_dev(div, "class", "name svelte-1q0tlpp");
    			add_location(div, file, 21, 4, 599);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*label*/ 4) set_data_dev(t, /*label*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(21:2) {#if hover}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let a;
    	let svg;
    	let g;
    	let path;
    	let t;
    	let if_block = /*hover*/ ctx[3] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			a = element("a");
    			svg = svg_element("svg");
    			g = svg_element("g");
    			path = svg_element("path");
    			t = space();
    			if (if_block) if_block.c();
    			attr_dev(path, "d", "M81.5,6 C69.8240666,23.5139001 45.8240666,49.9277635 9.5,85.2415902\n        C45.7984814,120.80686 69.7984814,147.22633 81.5,164.5");
    			attr_dev(path, "stroke", /*color*/ ctx[1]);
    			attr_dev(path, "stroke-width", "20");
    			attr_dev(path, "fill-rule", "nonzero");
    			add_location(path, file, 11, 6, 329);
    			attr_dev(g, "stroke", "none");
    			attr_dev(g, "stroke-width", "1");
    			attr_dev(g, "fill", "none");
    			attr_dev(g, "fill-rule", "evenodd");
    			attr_dev(g, "stroke-linejoin", "round");
    			add_location(g, file, 10, 4, 232);
    			attr_dev(svg, "width", "15px");
    			attr_dev(svg, "height", "30px");
    			attr_dev(svg, "viewBox", "0 0 90 170");
    			add_location(svg, file, 9, 2, 174);
    			attr_dev(a, "href", /*href*/ ctx[0]);
    			attr_dev(a, "class", "container svelte-1q0tlpp");
    			add_location(a, file, 8, 0, 143);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, svg);
    			append_dev(svg, g);
    			append_dev(g, path);
    			append_dev(a, t);
    			if (if_block) if_block.m(a, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*color*/ 2) {
    				attr_dev(path, "stroke", /*color*/ ctx[1]);
    			}

    			if (/*hover*/ ctx[3]) if_block.p(ctx, dirty);

    			if (dirty & /*href*/ 1) {
    				attr_dev(a, "href", /*href*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (if_block) if_block.d();
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
    	let { color = "#303b50" } = $$props;
    	let { label = "" } = $$props;
    	let { title = "" } = $$props;
    	let hover = false;
    	const writable_props = ["href", "color", "label", "title"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Head> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("href" in $$props) $$invalidate(0, href = $$props.href);
    		if ("color" in $$props) $$invalidate(1, color = $$props.color);
    		if ("label" in $$props) $$invalidate(2, label = $$props.label);
    		if ("title" in $$props) $$invalidate(4, title = $$props.title);
    	};

    	$$self.$capture_state = () => ({ href, color, label, title, hover });

    	$$self.$inject_state = $$props => {
    		if ("href" in $$props) $$invalidate(0, href = $$props.href);
    		if ("color" in $$props) $$invalidate(1, color = $$props.color);
    		if ("label" in $$props) $$invalidate(2, label = $$props.label);
    		if ("title" in $$props) $$invalidate(4, title = $$props.title);
    		if ("hover" in $$props) $$invalidate(3, hover = $$props.hover);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [href, color, label, hover, title];
    }

    class Head extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1q0tlpp-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, { href: 0, color: 1, label: 2, title: 4 });

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

    	get color() {
    		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Head>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label() {
    		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<Head>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get title() {
    		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
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

    /* 2022/aspect-ratios/Post.svelte generated by Svelte v3.29.0 */
    const file$2 = "2022/aspect-ratios/Post.svelte";

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-y1lpe-style";
    	style.textContent = ".tinier.svelte-y1lpe{font-size:16px !important}.below.svelte-y1lpe{position:absolute;bottom:-30px;color:grey;font-size:18px}.all.svelte-y1lpe{display:flex;flex-direction:column;justify-content:space-around;align-items:center;text-align:center;flex-wrap:nowrap;align-self:stretch}.container.svelte-y1lpe{margin:3rem;padding:2rem;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2);max-width:750px;min-width:450px;min-height:500px;width:65%}.row.svelte-y1lpe{display:flex;flex-direction:row;justify-content:flex-start;text-align:left;flex-wrap:nowrap;align-items:center}.bars.svelte-y1lpe{position:relative;display:flex;flex-direction:row;justify-content:flex-start;flex-wrap:nowrap;width:100%;margin-top:5px}.desc.svelte-y1lpe{position:absolute;font-size:14px;margin-left:20px;top:10px;color:grey;font-style:italic}@media only screen and (max-width: 850px){.container.svelte-y1lpe{margin:1rem;padding:1rem}.desc.svelte-y1lpe{top:-30px;left:100px !important}.row.svelte-y1lpe{flex-wrap:wrap}.bars.svelte-y1lpe{margin-top:10px}}.ratio.svelte-y1lpe{margin-top:3rem}.name.svelte-y1lpe{font-size:20px;font-weight:bold;margin-left:2rem;margin-right:0.2rem;width:80px;color:grey}.col.svelte-y1lpe{display:flex;flex-direction:column;justify-content:flex-start}.one.svelte-y1lpe{background-color:#6d87a5;z-index:3;border-radius:5px 0px 0px 5px}.plus.svelte-y1lpe{background-color:#946da5;border-radius:5px 5px 5px 5px;position:absolute;left:0px;z-index:1}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBIZWFkIGZyb20gJy4uLy4uL2NvbXBvbmVudHMvSGVhZC5zdmVsdGUnXG4gIGltcG9ydCBGb290IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvRm9vdC5zdmVsdGUnXG4gIGV4cG9ydCBsZXQgdGl0bGUgPSAnQXNwZWN0IFJhdGlvcydcbiAgZXhwb3J0IGxldCBzdWIgPSAnJ1xuICBsZXQgeCA9IDIwMFxuICAvLyBhc3BlY3QgcmF0aW9zIGFzICVzOlxuICBsZXQgcmF0aW9zID0gW1xuICAgIHtcbiAgICAgIG5hbWU6ICc1OjQnLFxuICAgICAgZGVzYzogJ21vbml0b3JzJyxcbiAgICAgIGNzczogJzUgLyA0ICcsXG4gICAgICByYXRpbzogMS4yNSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICc0OjMnLFxuICAgICAgZGVzYzogJ2lwYWRzLCBwaG90b3MnLFxuICAgICAgY3NzOiAnNCAvIDMnLFxuICAgICAgcmF0aW86IDEuMyxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICcxOuKImjInLFxuICAgICAgZGVzYzogJ0E0IHBhcGVyJyxcbiAgICAgIGNzczogJzEuNDE0MiAvIDEnLFxuICAgICAgcmF0aW86IDEuNDEsXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnMzoyJyxcbiAgICAgIGRlc2M6ICczNW1tIGZpbG0nLFxuICAgICAgY3NzOiAnMyAvIDInLFxuICAgICAgcmF0aW86IDEuNSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdnb2xkZW4nLFxuICAgICAgZGVzYzogJyBzbmFpbHMsIGV0Yy4nLFxuICAgICAgY3NzOiAnMS42MTggLyAxJyxcbiAgICAgIHJhdGlvOiAxLjYxOCxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICcxNjo5JyxcbiAgICAgIGRlc2M6IFwiMTA4MHAsICd3aWRlc2NyZWVuJ1wiLFxuICAgICAgY3NzOiAnMTYgLyA5JyxcbiAgICAgIHJhdGlvOiAxLjc3LFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJzE5LjU6OScsXG4gICAgICBkZXNjOiAncmVjZW50IGlwaG9uZXMnLFxuICAgICAgY3NzOiAnMTkuNSAvIDknLFxuICAgICAgcmF0aW86IDIuMTYsXG4gICAgfSxcbiAgXVxuPC9zY3JpcHQ+XG5cbjxkaXY+XG4gIDxkaXYgY2xhc3M9XCJhbGxcIj5cbiAgICA8SGVhZCB7dGl0bGV9IHtzdWJ9IG51bT1cIjEyXCIgLz5cbiAgICA8ZGl2IGNsYXNzPVwiY29udGFpbmVyXCI+XG4gICAgICB7I2VhY2ggcmF0aW9zIGFzIG99XG4gICAgICAgIDxkaXYgY2xhc3M9XCJyYXRpbyBjb2xcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwicm93XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibmFtZVwiIGNsYXNzOnRpbmllcj17dHJ1ZX0+e28ubmFtZX08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJiYXJzXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJvbmVcIiBzdHlsZT1cImhlaWdodDo1MHB4OyAgd2lkdGg6e3h9cHg7XCIgLz5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInBsdXNcIiBzdHlsZT1cImhlaWdodDo1MHB4OyB3aWR0aDp7eCAqIG8ucmF0aW99cHg7XCIgLz5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImRlc2NcIiBzdHlsZT1cImxlZnQ6e3ggKiBvLnJhdGlvfXB4O1wiPntvLmRlc2N9PC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJiZWxvd1wiIHN0eWxlPVwibGVmdDp7eH1weDsgbWFyZ2luLWxlZnQ6MTVweDsgY29sb3I6ICM5NDZkYTU7XCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJmb250LXNpemU6MTBweDtcIj54PC9zcGFuPlxuICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwiXCI+e28ucmF0aW99PC9zcGFuPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIHsvZWFjaH1cbiAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOjNyZW07XCIgLz5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+XG4gIDxGb290IHt0aXRsZX0gLz5cbjwvZGl2PlxuXG48c3R5bGU+XG4gIC50aW5pZXIge1xuICAgIGZvbnQtc2l6ZTogMTZweCAhaW1wb3J0YW50O1xuICB9XG4gIC5iZWxvdyB7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIGJvdHRvbTogLTMwcHg7XG4gICAgY29sb3I6IGdyZXk7XG4gICAgZm9udC1zaXplOiAxOHB4O1xuICB9XG4gIC5hbGwge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWFyb3VuZDtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBmbGV4LXdyYXA6IG5vd3JhcDtcbiAgICBhbGlnbi1zZWxmOiBzdHJldGNoO1xuICB9XG4gIC5jb250YWluZXIge1xuICAgIG1hcmdpbjogM3JlbTtcbiAgICBwYWRkaW5nOiAycmVtO1xuICAgIGJveC1zaGFkb3c6IDJweCAycHggOHB4IDBweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gICAgbWF4LXdpZHRoOiA3NTBweDtcbiAgICBtaW4td2lkdGg6IDQ1MHB4O1xuICAgIG1pbi1oZWlnaHQ6IDUwMHB4O1xuICAgIHdpZHRoOiA2NSU7XG4gIH1cblxuICAucm93IHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgIHRleHQtYWxpZ246IGxlZnQ7XG4gICAgZmxleC13cmFwOiBub3dyYXA7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgfVxuXG4gIC5iYXJzIHtcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICBmbGV4LXdyYXA6IG5vd3JhcDtcbiAgICB3aWR0aDogMTAwJTtcbiAgICBtYXJnaW4tdG9wOiA1cHg7XG4gIH1cblxuICAuZGVzYyB7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICBtYXJnaW4tbGVmdDogMjBweDtcbiAgICB0b3A6IDEwcHg7XG4gICAgY29sb3I6IGdyZXk7XG4gICAgZm9udC1zdHlsZTogaXRhbGljO1xuICB9XG4gIEBtZWRpYSBvbmx5IHNjcmVlbiBhbmQgKG1heC13aWR0aDogODUwcHgpIHtcbiAgICAuY29udGFpbmVyIHtcbiAgICAgIG1hcmdpbjogMXJlbTtcbiAgICAgIHBhZGRpbmc6IDFyZW07XG4gICAgfVxuICAgIC5kZXNjIHtcbiAgICAgIHRvcDogLTMwcHg7XG4gICAgICBsZWZ0OiAxMDBweCAhaW1wb3J0YW50O1xuICAgICAgLyogZGlzcGxheTogbm9uZTsgKi9cbiAgICB9XG4gICAgLnJvdyB7XG4gICAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgfVxuICAgIC5iYXJzIHtcbiAgICAgIG1hcmdpbi10b3A6IDEwcHg7XG4gICAgfVxuICB9XG5cbiAgLnJhdGlvIHtcbiAgICBtYXJnaW4tdG9wOiAzcmVtO1xuICB9XG4gIC5uYW1lIHtcbiAgICBmb250LXNpemU6IDIwcHg7XG4gICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgbWFyZ2luLWxlZnQ6IDJyZW07XG4gICAgbWFyZ2luLXJpZ2h0OiAwLjJyZW07XG4gICAgd2lkdGg6IDgwcHg7XG4gICAgY29sb3I6IGdyZXk7XG4gIH1cbiAgLmNvbCB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgfVxuICAub25lIHtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjNmQ4N2E1O1xuICAgIHotaW5kZXg6IDM7XG4gICAgYm9yZGVyLXJhZGl1czogNXB4IDBweCAwcHggNXB4O1xuICB9XG4gIC5wbHVzIHtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjOTQ2ZGE1O1xuICAgIGJvcmRlci1yYWRpdXM6IDVweCA1cHggNXB4IDVweDtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgbGVmdDogMHB4O1xuICAgIHotaW5kZXg6IDE7XG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBZ0ZFLE9BQU8sYUFBQyxDQUFDLEFBQ1AsU0FBUyxDQUFFLElBQUksQ0FBQyxVQUFVLEFBQzVCLENBQUMsQUFDRCxNQUFNLGFBQUMsQ0FBQyxBQUNOLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLE1BQU0sQ0FBRSxLQUFLLENBQ2IsS0FBSyxDQUFFLElBQUksQ0FDWCxTQUFTLENBQUUsSUFBSSxBQUNqQixDQUFDLEFBQ0QsSUFBSSxhQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLGVBQWUsQ0FBRSxZQUFZLENBQzdCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLFNBQVMsQ0FBRSxNQUFNLENBQ2pCLFVBQVUsQ0FBRSxPQUFPLEFBQ3JCLENBQUMsQUFDRCxVQUFVLGFBQUMsQ0FBQyxBQUNWLE1BQU0sQ0FBRSxJQUFJLENBQ1osT0FBTyxDQUFFLElBQUksQ0FDYixVQUFVLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQzlDLFNBQVMsQ0FBRSxLQUFLLENBQ2hCLFNBQVMsQ0FBRSxLQUFLLENBQ2hCLFVBQVUsQ0FBRSxLQUFLLENBQ2pCLEtBQUssQ0FBRSxHQUFHLEFBQ1osQ0FBQyxBQUVELElBQUksYUFBQyxDQUFDLEFBQ0osT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsR0FBRyxDQUNuQixlQUFlLENBQUUsVUFBVSxDQUMzQixVQUFVLENBQUUsSUFBSSxDQUNoQixTQUFTLENBQUUsTUFBTSxDQUNqQixXQUFXLENBQUUsTUFBTSxBQUNyQixDQUFDLEFBRUQsS0FBSyxhQUFDLENBQUMsQUFDTCxRQUFRLENBQUUsUUFBUSxDQUNsQixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxVQUFVLENBQzNCLFNBQVMsQ0FBRSxNQUFNLENBQ2pCLEtBQUssQ0FBRSxJQUFJLENBQ1gsVUFBVSxDQUFFLEdBQUcsQUFDakIsQ0FBQyxBQUVELEtBQUssYUFBQyxDQUFDLEFBQ0wsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsU0FBUyxDQUFFLElBQUksQ0FDZixXQUFXLENBQUUsSUFBSSxDQUNqQixHQUFHLENBQUUsSUFBSSxDQUNULEtBQUssQ0FBRSxJQUFJLENBQ1gsVUFBVSxDQUFFLE1BQU0sQUFDcEIsQ0FBQyxBQUNELE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsWUFBWSxLQUFLLENBQUMsQUFBQyxDQUFDLEFBQ3pDLFVBQVUsYUFBQyxDQUFDLEFBQ1YsTUFBTSxDQUFFLElBQUksQ0FDWixPQUFPLENBQUUsSUFBSSxBQUNmLENBQUMsQUFDRCxLQUFLLGFBQUMsQ0FBQyxBQUNMLEdBQUcsQ0FBRSxLQUFLLENBQ1YsSUFBSSxDQUFFLEtBQUssQ0FBQyxVQUFVLEFBRXhCLENBQUMsQUFDRCxJQUFJLGFBQUMsQ0FBQyxBQUNKLFNBQVMsQ0FBRSxJQUFJLEFBQ2pCLENBQUMsQUFDRCxLQUFLLGFBQUMsQ0FBQyxBQUNMLFVBQVUsQ0FBRSxJQUFJLEFBQ2xCLENBQUMsQUFDSCxDQUFDLEFBRUQsTUFBTSxhQUFDLENBQUMsQUFDTixVQUFVLENBQUUsSUFBSSxBQUNsQixDQUFDLEFBQ0QsS0FBSyxhQUFDLENBQUMsQUFDTCxTQUFTLENBQUUsSUFBSSxDQUNmLFdBQVcsQ0FBRSxJQUFJLENBQ2pCLFdBQVcsQ0FBRSxJQUFJLENBQ2pCLFlBQVksQ0FBRSxNQUFNLENBQ3BCLEtBQUssQ0FBRSxJQUFJLENBQ1gsS0FBSyxDQUFFLElBQUksQUFDYixDQUFDLEFBQ0QsSUFBSSxhQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLGVBQWUsQ0FBRSxVQUFVLEFBQzdCLENBQUMsQUFDRCxJQUFJLGFBQUMsQ0FBQyxBQUNKLGdCQUFnQixDQUFFLE9BQU8sQ0FDekIsT0FBTyxDQUFFLENBQUMsQ0FDVixhQUFhLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxBQUNoQyxDQUFDLEFBQ0QsS0FBSyxhQUFDLENBQUMsQUFDTCxnQkFBZ0IsQ0FBRSxPQUFPLENBQ3pCLGFBQWEsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQzlCLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLElBQUksQ0FBRSxHQUFHLENBQ1QsT0FBTyxDQUFFLENBQUMsQUFDWixDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (58:6) {#each ratios as o}
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
    			attr_dev(div0, "class", "name svelte-y1lpe");
    			toggle_class(div0, "tinier", true);
    			add_location(div0, file$2, 60, 12, 1142);
    			attr_dev(div1, "class", "one svelte-y1lpe");
    			set_style(div1, "height", "50px");
    			set_style(div1, "width", /*x*/ ctx[2] + "px");
    			add_location(div1, file$2, 62, 14, 1240);
    			attr_dev(div2, "class", "plus svelte-y1lpe");
    			set_style(div2, "height", "50px");
    			set_style(div2, "width", /*x*/ ctx[2] * /*o*/ ctx[4].ratio + "px");
    			add_location(div2, file$2, 63, 14, 1309);
    			attr_dev(div3, "class", "desc svelte-y1lpe");
    			set_style(div3, "left", /*x*/ ctx[2] * /*o*/ ctx[4].ratio + "px");
    			add_location(div3, file$2, 64, 14, 1388);
    			set_style(span0, "font-size", "10px");
    			add_location(span0, file$2, 66, 16, 1555);
    			add_location(span1, file$2, 67, 16, 1610);
    			attr_dev(div4, "class", "below svelte-y1lpe");
    			set_style(div4, "left", /*x*/ ctx[2] + "px");
    			set_style(div4, "margin-left", "15px");
    			set_style(div4, "color", "#946da5");
    			add_location(div4, file$2, 65, 14, 1465);
    			attr_dev(div5, "class", "bars svelte-y1lpe");
    			add_location(div5, file$2, 61, 12, 1207);
    			attr_dev(div6, "class", "row svelte-y1lpe");
    			add_location(div6, file$2, 59, 10, 1112);
    			attr_dev(div7, "class", "ratio col svelte-y1lpe");
    			add_location(div7, file$2, 58, 8, 1078);
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
    		source: "(58:6) {#each ratios as o}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div3;
    	let div2;
    	let head;
    	let t0;
    	let div1;
    	let t1;
    	let div0;
    	let t2;
    	let foot;
    	let current;

    	head = new Head({
    			props: {
    				title: /*title*/ ctx[0],
    				sub: /*sub*/ ctx[1],
    				num: "12"
    			},
    			$$inline: true
    		});

    	let each_value = /*ratios*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	foot = new Foot({
    			props: { title: /*title*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			create_component(head.$$.fragment);
    			t0 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			div0 = element("div");
    			t2 = space();
    			create_component(foot.$$.fragment);
    			set_style(div0, "margin-top", "3rem");
    			add_location(div0, file$2, 73, 6, 1734);
    			attr_dev(div1, "class", "container svelte-y1lpe");
    			add_location(div1, file$2, 56, 4, 1020);
    			attr_dev(div2, "class", "all svelte-y1lpe");
    			add_location(div2, file$2, 54, 2, 962);
    			add_location(div3, file$2, 53, 0, 954);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			mount_component(head, div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div3, t2);
    			mount_component(foot, div3, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const head_changes = {};
    			if (dirty & /*title*/ 1) head_changes.title = /*title*/ ctx[0];
    			if (dirty & /*sub*/ 2) head_changes.sub = /*sub*/ ctx[1];
    			head.$set(head_changes);

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
    						each_blocks[i].m(div1, t1);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			const foot_changes = {};
    			if (dirty & /*title*/ 1) foot_changes.title = /*title*/ ctx[0];
    			foot.$set(foot_changes);
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
    			if (detaching) detach_dev(div3);
    			destroy_component(head);
    			destroy_each(each_blocks, detaching);
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

    	$$self.$capture_state = () => ({ Head, Foot, title, sub, x, ratios });

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
    		if (!document.getElementById("svelte-y1lpe-style")) add_css$2();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { title: 0, sub: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$2.name
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
