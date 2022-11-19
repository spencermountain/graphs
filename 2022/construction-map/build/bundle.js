var app = (function (mapboxgl) {
    'use strict';

    function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

    var mapboxgl__default = /*#__PURE__*/_interopDefaultLegacy(mapboxgl);

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
    function element(name) {
        return document.createElement(name);
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
    	style.id = "svelte-1odckek-style";
    	style.textContent = ".blue.svelte-1odckek{color:#69c}.goleft.svelte-1odckek{align-self:flex-start}.f1.svelte-1odckek{font-size:0.8rem}.m3.svelte-1odckek{margin-left:3rem;margin-top:1rem;margin-bottom:1rem}a.svelte-1odckek{color:#69c;cursor:pointer;padding:1px;text-decoration:none;border-bottom:1px solid #69c}.link.svelte-1odckek:hover{text-decoration-color:#cc7066;font-weight:500;border-bottom:1px solid #23415a}.sub.svelte-1odckek{font-size:0.7rem}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSGVhZC5zdmVsdGUiLCJzb3VyY2VzIjpbIkhlYWQuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGxldCB5ZWFyID0gbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpXG4gIGV4cG9ydCBsZXQgbnVtID0gJzAxJ1xuICBleHBvcnQgbGV0IHRpdGxlID0gJydcbiAgZXhwb3J0IGxldCBzdWIgPSAnJ1xuPC9zY3JpcHQ+XG5cbjwhLS0gdGl0bGUgLS0+XG48ZGl2IGNsYXNzPVwiYmx1ZSBtbDEgZ29sZWZ0IGxlZnRcIj5cbiAgPGEgY2xhc3M9XCJsaW5rIGYxIGJsdWVcIiBocmVmPVwiLi4vLi4vXCI+44CxIC4ve3llYXJ9LyB7bnVtfTwvYT5cbjwvZGl2PlxueyNpZiB0aXRsZX1cbiAgPGRpdiBjbGFzcz1cIm0zXCI+XG4gICAgPHNwYW4gY2xhc3M9XCJtbDIgZ3JleVwiPnt0aXRsZX08L3NwYW4+XG4gICAgPGRpdiBjbGFzcz1cImJyb3duIG1sMSBzdWJcIj57c3VifTwvZGl2PlxuICA8L2Rpdj5cbnsvaWZ9XG5cbjxzdHlsZT5cbiAgLmJsdWUge1xuICAgIGNvbG9yOiAjNjljO1xuICB9XG4gIC5nb2xlZnQge1xuICAgIGFsaWduLXNlbGY6IGZsZXgtc3RhcnQ7XG4gIH1cbiAgLmYxIHtcbiAgICBmb250LXNpemU6IDAuOHJlbTtcbiAgfVxuICAubTMge1xuICAgIG1hcmdpbi1sZWZ0OiAzcmVtO1xuICAgIG1hcmdpbi10b3A6IDFyZW07XG4gICAgbWFyZ2luLWJvdHRvbTogMXJlbTtcbiAgfVxuICBhIHtcbiAgICBjb2xvcjogIzY5YztcbiAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgcGFkZGluZzogMXB4O1xuICAgIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcbiAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgIzY5YztcbiAgfVxuICAubGluazpob3ZlciB7XG4gICAgdGV4dC1kZWNvcmF0aW9uLWNvbG9yOiAjY2M3MDY2O1xuICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gICAgLyogYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkI2NjNzA2NjsgKi9cbiAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgIzIzNDE1YTtcbiAgfVxuICAuc3ViIHtcbiAgICBmb250LXNpemU6IDAuN3JlbTtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFtQkUsS0FBSyxlQUFDLENBQUMsQUFDTCxLQUFLLENBQUUsSUFBSSxBQUNiLENBQUMsQUFDRCxPQUFPLGVBQUMsQ0FBQyxBQUNQLFVBQVUsQ0FBRSxVQUFVLEFBQ3hCLENBQUMsQUFDRCxHQUFHLGVBQUMsQ0FBQyxBQUNILFNBQVMsQ0FBRSxNQUFNLEFBQ25CLENBQUMsQUFDRCxHQUFHLGVBQUMsQ0FBQyxBQUNILFdBQVcsQ0FBRSxJQUFJLENBQ2pCLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLGFBQWEsQ0FBRSxJQUFJLEFBQ3JCLENBQUMsQUFDRCxDQUFDLGVBQUMsQ0FBQyxBQUNELEtBQUssQ0FBRSxJQUFJLENBQ1gsTUFBTSxDQUFFLE9BQU8sQ0FDZixPQUFPLENBQUUsR0FBRyxDQUNaLGVBQWUsQ0FBRSxJQUFJLENBQ3JCLGFBQWEsQ0FBRSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQUFDL0IsQ0FBQyxBQUNELG9CQUFLLE1BQU0sQUFBQyxDQUFDLEFBQ1gscUJBQXFCLENBQUUsT0FBTyxDQUM5QixXQUFXLENBQUUsR0FBRyxDQUVoQixhQUFhLENBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLEFBQ2xDLENBQUMsQUFDRCxJQUFJLGVBQUMsQ0FBQyxBQUNKLFNBQVMsQ0FBRSxNQUFNLEFBQ25CLENBQUMifQ== */";
    	append_dev(document.head, style);
    }

    // (12:0) {#if title}
    function create_if_block(ctx) {
    	let div1;
    	let span;
    	let t0;
    	let t1;
    	let div0;
    	let t2;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			span = element("span");
    			t0 = text(/*title*/ ctx[1]);
    			t1 = space();
    			div0 = element("div");
    			t2 = text(/*sub*/ ctx[2]);
    			attr_dev(span, "class", "ml2 grey");
    			add_location(span, file, 13, 4, 282);
    			attr_dev(div0, "class", "brown ml1 sub svelte-1odckek");
    			add_location(div0, file, 14, 4, 324);
    			attr_dev(div1, "class", "m3 svelte-1odckek");
    			add_location(div1, file, 12, 2, 261);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, span);
    			append_dev(span, t0);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*title*/ 2) set_data_dev(t0, /*title*/ ctx[1]);
    			if (dirty & /*sub*/ 4) set_data_dev(t2, /*sub*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(12:0) {#if title}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div;
    	let a;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let if_block_anchor;
    	let if_block = /*title*/ ctx[1] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			a = element("a");
    			t0 = text("〱 ./");
    			t1 = text(/*year*/ ctx[3]);
    			t2 = text("/ ");
    			t3 = text(/*num*/ ctx[0]);
    			t4 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(a, "class", "link f1 blue svelte-1odckek");
    			attr_dev(a, "href", "../../");
    			add_location(a, file, 9, 2, 180);
    			attr_dev(div, "class", "blue ml1 goleft left svelte-1odckek");
    			add_location(div, file, 8, 0, 143);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, a);
    			append_dev(a, t0);
    			append_dev(a, t1);
    			append_dev(a, t2);
    			append_dev(a, t3);
    			insert_dev(target, t4, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*num*/ 1) set_data_dev(t3, /*num*/ ctx[0]);

    			if (/*title*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t4);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	let year = new Date().getFullYear();
    	let { num = "01" } = $$props;
    	let { title = "" } = $$props;
    	let { sub = "" } = $$props;
    	const writable_props = ["num", "title", "sub"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Head> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("num" in $$props) $$invalidate(0, num = $$props.num);
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(2, sub = $$props.sub);
    	};

    	$$self.$capture_state = () => ({ year, num, title, sub });

    	$$self.$inject_state = $$props => {
    		if ("year" in $$props) $$invalidate(3, year = $$props.year);
    		if ("num" in $$props) $$invalidate(0, num = $$props.num);
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(2, sub = $$props.sub);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [num, title, sub, year];
    }

    class Head extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1odckek-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, { num: 0, title: 1, sub: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Head",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get num() {
    		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set num(value) {
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

    const colors = {
      "Spadina-Fort York": "#cc7066",
      "Toronto Centre": "#2D85A8",
      "University-Rosedale": "#C4ABAB",
      "Etobicoke-Lakeshore": "#735873",
      "Toronto-St. Paul's": "#8BA3A2",
      "Davenport": "#6accb2",
      "Parkdale-High Park": "#2D85A8",
      "Toronto-Danforth": "#e6b3bc",
      "Willowdale": "#6D5685",
      "Eglinton-Lawrence": "#cc8a66",
      "Don Valley North": "#d8b3e6",
      "Etobicoke Centre": "#6699cc",
      "Beaches-East York": "#735873",
      "York South-Weston": "#d8b3e6",
      "York Centre": "#cc6966",
      "Don Valley West": "#AB5850",
      "Scarborough Southwest": "#9c896c",
      "Don Valley East": "#838B91",
      "Scarborough-Agincourt": "#2D85A8",
      "Etobicoke North": "#978BA3",
      "Scarborough-Rouge Park": "#7f9c6c",
      "Scarborough Centre": "#914045",
      "Scarborough-Guildwood": "#d8b3e6",
      "Humber River-Black Creek": "#cc8a66",
      "Scarborough North": "#C4ABAB",
    };


    let data = {
      "type": "FeatureCollection", "features": [
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.5078301632192, 43.717755170299], [-79.5107123841607, 43.7293037597358], [-79.51224583569622, 43.7359300061701], [-79.513221023395, 43.7393893286881], [-79.51236888402802, 43.7395434439611], [-79.5113076014097, 43.7394527315655], [-79.510381238191, 43.739526260413], [-79.5068854723044, 43.74032436557], [-79.5034011819604, 43.7410764571488], [-79.497023646026, 43.7425188149772], [-79.49731959070401, 43.7429021750607], [-79.4972227415031, 43.7433292083764], [-79.4978842288617, 43.7435970086561], [-79.4978487327067, 43.7446224261933], [-79.498058567024, 43.7452594367091], [-79.4979603830721, 43.7459123558268], [-79.4996274217983, 43.7465366163174], [-79.500481793879, 43.7466902215438], [-79.5019292009025, 43.7471239025161], [-79.5022124787254, 43.7476740242088], [-79.503449584425, 43.7481318939755], [-79.5038554066285, 43.7486278744822], [-79.5047368055003, 43.7491526746467], [-79.5030576615607, 43.749313052363], [-79.497769710548, 43.75049213921], [-79.4966284701516, 43.7509512445898], [-79.494908422866, 43.7521753532944], [-79.4938908382557, 43.7525838679054], [-79.4917305581402, 43.7530207672587], [-79.4906267918296, 43.7527354610711], [-79.4894699236512, 43.7518257800638], [-79.4881735629245, 43.7520237517077], [-79.4887625068059, 43.7545124715302], [-79.4899806571011, 43.7593255316339], [-79.4900820250133, 43.75982840988231], [-79.4916590072426, 43.7657154539496], [-79.4920479001098, 43.7673129296763], [-79.4939610215053, 43.7748195549116], [-79.4945741214528, 43.7774193374245], [-79.4946752401325, 43.7787088392807], [-79.494303645952, 43.7805034630471], [-79.4945063595238, 43.7815790749568], [-79.504339154684, 43.7792364478206], [-79.5110925903654, 43.7777181895058], [-79.5170107512026, 43.7763624451289], [-79.5190058267566, 43.775977340092], [-79.5199438842346, 43.7758645667069], [-79.5216160016868, 43.7755045222112], [-79.5234479016865, 43.774991211747], [-79.5350772073467, 43.7726429715053], [-79.5521956585059, 43.7691171401983], [-79.5549881135823, 43.7685669032639], [-79.5647842958979, 43.7665453900781], [-79.5748719500655, 43.7643434795002], [-79.5775376329862, 43.7637016102077], [-79.5806438818039, 43.7630179182296], [-79.57952737217691, 43.762270954238], [-79.5792491647708, 43.7622086612556], [-79.5777904805649, 43.7624097506643], [-79.577533983927, 43.7621263246425], [-79.5789272931887, 43.7613169745734], [-79.5793286818626, 43.7608414250738], [-79.5806227685616, 43.7603638887415], [-79.5807788119002, 43.7597883416506], [-79.5805746331664, 43.759236019831405], [-79.5807665880169, 43.7589271435657], [-79.5818001213737, 43.7585840663182], [-79.5827117072503, 43.7585237233906], [-79.5838189764281, 43.7586957215887], [-79.5840671337725, 43.7582012029804], [-79.583818917751, 43.7576128064063], [-79.5840243466353, 43.7572928252327], [-79.5849929413253, 43.7571040561756], [-79.5852117269988, 43.7564970328686], [-79.5841627118898, 43.7552352306272], [-79.5842866355847, 43.7548124971789], [-79.5839395322833, 43.754195648603], [-79.5831251031601, 43.7537221327563], [-79.583102609624, 43.7527494886288], [-79.5825542590978, 43.7523978490961], [-79.5800029685875, 43.7515698246867], [-79.5792004869672, 43.7509625504352], [-79.5782702914092, 43.7504831390866], [-79.5771065514607, 43.7501923811147], [-79.5755216981474, 43.7500302744664], [-79.5732689816388, 43.7503607707071], [-79.5726947944886, 43.7497103323261], [-79.5733424684195, 43.7480032180334], [-79.5733046529314, 43.74741778578], [-79.5728482385064, 43.7469618693643], [-79.5724664347146, 43.7468404067294], [-79.5712720981473, 43.7467991040603], [-79.569395648064, 43.746386644181], [-79.56522093938261, 43.7456791861558], [-79.5639816007272, 43.7452563526535], [-79.5634043371822, 43.7447963523789], [-79.5623526335084, 43.7443130257753], [-79.5621660109076, 43.7440740642195], [-79.5624486912418, 43.7434490098824], [-79.5622928648703, 43.7428537365903], [-79.56189799115661, 43.7427018485814], [-79.5604862224065, 43.7426227096062], [-79.5597640448481, 43.7424966224172], [-79.55928066225171, 43.7429663055108], [-79.5587584990848, 43.7429168794269], [-79.5580701324317, 43.7424986027114], [-79.5578490680293, 43.7421316632333], [-79.5583361402025, 43.741838651121], [-79.558376260099, 43.741461209617], [-79.55783408884011, 43.7409645100125], [-79.556821424404, 43.7413801000659], [-79.556980542714, 43.7422610689302], [-79.556736662411, 43.74286286748921], [-79.5560334800443, 43.7432099501637], [-79.5543721603638, 43.7432222920798], [-79.55295119719, 43.743588813541805], [-79.5519384529601, 43.7440597716501], [-79.5512095828039, 43.7442382435337], [-79.5503706405526, 43.744075568355], [-79.54983877384382, 43.7435867745818], [-79.5499364108813, 43.742943829236], [-79.5504066872699, 43.7425407464228], [-79.5499851646704, 43.7422843518862], [-79.549489438832, 43.7425256651616], [-79.5493484964657, 43.7419499813248], [-79.5487815264533, 43.7416966154276], [-79.5476142499566, 43.7417338956159], [-79.546403725737, 43.7409468859699], [-79.5461769223658, 43.7406856724582], [-79.546182744285, 43.7400547206654], [-79.5464266315336, 43.7397896979675], [-79.5478362183224, 43.7390595318107], [-79.5482171818281, 43.7389846796057], [-79.5483645459697, 43.7384914764259], [-79.5488746713003, 43.738024177013], [-79.5498804616178, 43.7379736507105], [-79.5500531934688, 43.7371926830749], [-79.5505592625798, 43.736403863062], [-79.5502851072173, 43.7358717595358], [-79.54916129013502, 43.7359332947328], [-79.5491192700389, 43.7357078320846], [-79.5496368204395, 43.735278006961], [-79.550479112988, 43.734804245534], [-79.5504990744773, 43.7339472477669], [-79.5500146986765, 43.733302576651], [-79.5491889009071, 43.7330991831636], [-79.5488660132456, 43.7328274214873], [-79.5478061822091, 43.7323905358536], [-79.5475558166576, 43.7319530274043], [-79.5463242788161, 43.731443235278], [-79.5454997943137, 43.7315305813709], [-79.5451247676817, 43.7321466303675], [-79.5447989039955, 43.7323638592582], [-79.5440766855671, 43.7322737136667], [-79.5438423966924, 43.7317832276212], [-79.5440062765236, 43.7315446229773], [-79.5448550011636, 43.7310176939156], [-79.5442415991935, 43.7303698261183], [-79.543219136828, 43.729920155544], [-79.54114950106252, 43.729592392263], [-79.5401458355902, 43.7297818021389], [-79.5392827914331, 43.7308848162774], [-79.5394910991193, 43.7319469350095], [-79.5386318501611, 43.7319337358022], [-79.538422545757, 43.7316187452103], [-79.5386187623326, 43.72984086332111], [-79.5388639145477, 43.7292601735004], [-79.5382294635565, 43.7272575309714], [-79.5382788771441, 43.726906448073], [-79.5388134026676, 43.7264471775412], [-79.5396079528955, 43.7262308661881], [-79.5408657326509, 43.726126900147], [-79.5413036750452, 43.7256271558088], [-79.5412725103929, 43.7249250431239], [-79.5407644621164, 43.7239125494684], [-79.5407877210953, 43.7222652771005], [-79.5412271039853, 43.7216800293449], [-79.5422656109076, 43.7209685513827], [-79.5428034846283, 43.7203607758502], [-79.5430357585697, 43.7197576048145], [-79.5440354676611, 43.718033394111], [-79.5440778940447, 43.7177047959644], [-79.5436508592293, 43.7171513376391], [-79.5424398276147, 43.71676924031941], [-79.5412981735861, 43.7168596890654], [-79.5406879163732, 43.7165358356898], [-79.5407375276308, 43.7153565722686], [-79.5402572350749, 43.715055191265], [-79.5394392828022, 43.7149339504168], [-79.5382066350366, 43.7145787923277], [-79.5378466144462, 43.7137102364611], [-79.5378418799993, 43.7129901010899], [-79.53221059328, 43.7143278208681], [-79.5268433682294, 43.7155355290775], [-79.5247120595825, 43.7159100930063], [-79.5156320373104, 43.7168737677625], [-79.5078301632192, 43.717755170299]]] }, "properties": { "_id": 701, "AREA_ID": 2457740, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993196, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 7, "AREA_LONG_CODE": 7, "AREA_NAME": "Humber River-Black Creek", "AREA_DESC": "Humber River-Black Creek (7)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344785, "Shape__Area": 58868732.515625, "Shape__Length": 43438.9430476219 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.440433878524, 43.7633975096661], [-79.4414485315034, 43.7677016776661], [-79.4417019654174, 43.768570411594], [-79.442608665069, 43.7723153397268], [-79.4435842030302, 43.776055782625804], [-79.445550105497, 43.7839327657752], [-79.4466552188864, 43.788262865416804], [-79.4465725403749, 43.7890189227718], [-79.4454403678408, 43.7905665841201], [-79.4453833384008, 43.7909311030197], [-79.44575516760682, 43.792407466692], [-79.4530346336878, 43.7908118086972], [-79.4576350005287, 43.7898475501653], [-79.4631884218653, 43.7886477313178], [-79.4700896742123, 43.7872832010882], [-79.4873055772169, 43.7832181609663], [-79.4945063595238, 43.7815790749568], [-79.494303645952, 43.7805034630471], [-79.4946752401325, 43.7787088392807], [-79.4945741214528, 43.7774193374245], [-79.4939610215053, 43.7748195549116], [-79.4920479001098, 43.7673129296763], [-79.4916590072426, 43.7657154539496], [-79.4900820250133, 43.75982840988231], [-79.4899806571011, 43.7593255316339], [-79.4887625068059, 43.7545124715302], [-79.4881735629245, 43.7520237517077], [-79.4894699236512, 43.7518257800638], [-79.4906267918296, 43.7527354610711], [-79.4917305581402, 43.7530207672587], [-79.4938908382557, 43.7525838679054], [-79.494908422866, 43.7521753532944], [-79.4966284701516, 43.7509512445898], [-79.497769710548, 43.75049213921], [-79.5030576615607, 43.749313052363], [-79.5047368055003, 43.7491526746467], [-79.5038554066285, 43.7486278744822], [-79.503449584425, 43.7481318939755], [-79.5022124787254, 43.7476740242088], [-79.5019292009025, 43.7471239025161], [-79.500481793879, 43.7466902215438], [-79.4996274217983, 43.7465366163174], [-79.4979603830721, 43.7459123558268], [-79.498058567024, 43.7452594367091], [-79.4978487327067, 43.7446224261933], [-79.4978842288617, 43.7435970086561], [-79.4972227415031, 43.7433292083764], [-79.49731959070401, 43.7429021750607], [-79.497023646026, 43.7425188149772], [-79.5034011819604, 43.7410764571488], [-79.5068854723044, 43.74032436557], [-79.510381238191, 43.739526260413], [-79.5113076014097, 43.7394527315655], [-79.51236888402802, 43.7395434439611], [-79.513221023395, 43.7393893286881], [-79.51224583569622, 43.7359300061701], [-79.5107123841607, 43.7293037597358], [-79.5078301632192, 43.717755170299], [-79.5020820091586, 43.7184122410568], [-79.4997777501461, 43.718795623187], [-79.4914106264141, 43.720290147594], [-79.4894098913557, 43.7207258202844], [-79.4882899842869, 43.7210262087651], [-79.4725666844142, 43.7248699022048], [-79.4700386791348, 43.725465779889], [-79.466145437156, 43.7262810607126], [-79.4492751842417, 43.7299282236442], [-79.4437087383412, 43.7311183624022], [-79.4423825633705, 43.7314932150404], [-79.4413598288712, 43.7318676772703], [-79.4399231952323, 43.7325258213692], [-79.4362636370212, 43.7346462572346], [-79.431046793689, 43.7377020795955], [-79.4266625320039, 43.7403069953391], [-79.4198604902038, 43.744645190955], [-79.4182498616409, 43.7457416490059], [-79.4176528567426, 43.7462370430891], [-79.4153777629284, 43.748865642121906], [-79.4141373872663, 43.7499296405487], [-79.4114492180327, 43.751653633058], [-79.4121276514994, 43.7517761589228], [-79.4133922065392, 43.7515620674272], [-79.41418573226801, 43.7515597765685], [-79.4149455929719, 43.7519442457449], [-79.4156929234726, 43.7517524347681], [-79.4159434842275, 43.751405433989206], [-79.4161842944729, 43.7505779593249], [-79.416508249055, 43.7503175035914], [-79.4176383886104, 43.7498162544205], [-79.4192572969532, 43.7496793940538], [-79.4201280705346, 43.74931158657851], [-79.4207075766434, 43.7493062202958], [-79.4222907421622, 43.7496097660865], [-79.4225795003657, 43.7498693857385], [-79.4230819623809, 43.7509219565867], [-79.4234706383109, 43.7513097372232], [-79.4260838631869, 43.7531836346277], [-79.4272337355057, 43.7538181468088], [-79.4280572742622, 43.7541313787285], [-79.4284044534193, 43.7547578279675], [-79.4286715659904, 43.7555944130456], [-79.4292348549758, 43.7561341957517], [-79.4301124189409, 43.7573756131494], [-79.43079559914992, 43.7575740460566], [-79.432982086036, 43.7571882977582], [-79.4336864820586, 43.757535218491], [-79.4336907265325, 43.7579537583465], [-79.43460748175181, 43.7582692921931], [-79.4352580703734, 43.7588637140975], [-79.4362327364724, 43.7590937743528], [-79.4377072311299, 43.75903151614], [-79.438139581529, 43.7593962991111], [-79.437613622935, 43.7601971549839], [-79.4378398041513, 43.7606383543864], [-79.4383314717827, 43.7607106212138], [-79.438737181859, 43.761322947056], [-79.4393385142481, 43.7615483154267], [-79.4399843054519, 43.7615576575323], [-79.440433878524, 43.7633975096661]]] }, "properties": { "_id": 702, "AREA_ID": 2457739, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993195, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 6, "AREA_LONG_CODE": 6, "AREA_NAME": "York Centre", "AREA_DESC": "York Centre (6)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344801, "Shape__Area": 67805388.546875, "Shape__Length": 40910.1746192152 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.408388704346, 43.7536163537944], [-79.4032864941989, 43.7568429403413], [-79.3986662636602, 43.7597200744556], [-79.3962869448145, 43.76088787849311], [-79.3951757944996, 43.7613312713679], [-79.3933248375784, 43.7619333312937], [-79.3921283194167, 43.7622404898496], [-79.38715209799, 43.763311731433106], [-79.3880562118249, 43.7665892748458], [-79.3885776057336, 43.7690555301608], [-79.3891868688771, 43.77165293328], [-79.3893860928262, 43.7725456100829], [-79.3895832658445, 43.7734759632987], [-79.3897839574707, 43.7743335179971], [-79.39120878258, 43.7806331655169], [-79.3921089600341, 43.7847640261134], [-79.3935963878887, 43.7922977653692], [-79.394227231636, 43.7951251930779], [-79.3953798353624, 43.7999527398002], [-79.395812180754, 43.801872201101204], [-79.39623005788661, 43.8032701311798], [-79.426378474157, 43.7966223806342], [-79.4292679942717, 43.7960076369876], [-79.4365648852745, 43.7944144259901], [-79.4389508493451, 43.7939206540047], [-79.4433486621435, 43.7929598420596], [-79.44575516760682, 43.792407466692], [-79.4453833384008, 43.7909311030197], [-79.4454403678408, 43.7905665841201], [-79.4465725403749, 43.7890189227718], [-79.4466552188864, 43.788262865416804], [-79.445550105497, 43.7839327657752], [-79.4435842030302, 43.776055782625804], [-79.442608665069, 43.7723153397268], [-79.4417019654174, 43.768570411594], [-79.4414485315034, 43.7677016776661], [-79.440433878524, 43.7633975096661], [-79.4399843054519, 43.7615576575323], [-79.4393385142481, 43.7615483154267], [-79.438737181859, 43.761322947056], [-79.4383314717827, 43.7607106212138], [-79.4378398041513, 43.7606383543864], [-79.437613622935, 43.7601971549839], [-79.438139581529, 43.7593962991111], [-79.4377072311299, 43.75903151614], [-79.4362327364724, 43.7590937743528], [-79.4352580703734, 43.7588637140975], [-79.43460748175181, 43.7582692921931], [-79.4336907265325, 43.7579537583465], [-79.4336864820586, 43.757535218491], [-79.432982086036, 43.7571882977582], [-79.43079559914992, 43.7575740460566], [-79.4301124189409, 43.7573756131494], [-79.4292348549758, 43.7561341957517], [-79.4286715659904, 43.7555944130456], [-79.4284044534193, 43.7547578279675], [-79.4280572742622, 43.7541313787285], [-79.4272337355057, 43.7538181468088], [-79.4260838631869, 43.7531836346277], [-79.4234706383109, 43.7513097372232], [-79.4230819623809, 43.7509219565867], [-79.4225795003657, 43.7498693857385], [-79.4222907421622, 43.7496097660865], [-79.4207075766434, 43.7493062202958], [-79.4201280705346, 43.74931158657851], [-79.4192572969532, 43.7496793940538], [-79.4176383886104, 43.7498162544205], [-79.416508249055, 43.7503175035914], [-79.4161842944729, 43.7505779593249], [-79.4159434842275, 43.751405433989206], [-79.4156929234726, 43.7517524347681], [-79.4149455929719, 43.7519442457449], [-79.41418573226801, 43.7515597765685], [-79.4133922065392, 43.7515620674272], [-79.4121276514994, 43.7517761589228], [-79.4114492180327, 43.751653633058], [-79.408388704346, 43.7536163537944]]] }, "properties": { "_id": 703, "AREA_ID": 2457738, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993194, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 18, "AREA_LONG_CODE": 18, "AREA_NAME": "Willowdale", "AREA_DESC": "Willowdale (18)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344817, "Shape__Area": 37926494.109375, "Shape__Length": 24766.996983523597 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.3848473659846, 43.6940268867582], [-79.3891249054345, 43.6931049639157], [-79.3890698794723, 43.692517180075505], [-79.38874183639071, 43.6917249723705], [-79.3909188985912, 43.6913013363369], [-79.3900734382196, 43.6905810347878], [-79.3897761640267, 43.6897844397294], [-79.3882161336675, 43.6886397508118], [-79.3872749049071, 43.6882652725358], [-79.3866459126664, 43.6877014211196], [-79.3907253918597, 43.6867926166736], [-79.3902572917164, 43.68559309553601], [-79.3928542300674, 43.6850259296234], [-79.391194825918, 43.681081122778], [-79.3984396599047, 43.6777672851479], [-79.4002825619128, 43.6770488202039], [-79.4015776356744, 43.676667386558], [-79.4049670168388, 43.6759208047062], [-79.4073338149418, 43.675429007407], [-79.4218189621437, 43.6724249826802], [-79.4293964137968, 43.670972707104006], [-79.4275714482316, 43.6665208027825], [-79.425659480152, 43.6619849168039], [-79.4223536939668, 43.65350375421081], [-79.4207821526692, 43.6493340834881], [-79.4170702372387, 43.6500687255106], [-79.4159861553624, 43.6502976846687], [-79.4084890143657, 43.6517940218507], [-79.4060223641094, 43.6523116870524], [-79.4053616100253, 43.6523649340544], [-79.4037475308531, 43.6517410074764], [-79.4022664973862, 43.6520294685818], [-79.3972709038512, 43.6531172591201], [-79.3914607906137, 43.6543333741155], [-79.390004517453, 43.6545125042976], [-79.3887311279821, 43.6548028707821], [-79.3883145100963, 43.6547901866588], [-79.3837661930223, 43.6557159692698], [-79.3809264046243, 43.6563287749711], [-79.3813699642643, 43.6574159511334], [-79.3827961686227, 43.660583357971], [-79.3831103705459, 43.6613718103314], [-79.3858549461133, 43.6608156633898], [-79.386127321637, 43.6617926077787], [-79.38772398934121, 43.6656448971218], [-79.38886911734551, 43.6681966792186], [-79.3861602636501, 43.6687422757801], [-79.3856034277011, 43.6687418819131], [-79.3843306464514, 43.6690191653021], [-79.3799057240718, 43.6699739729667], [-79.37937257874731, 43.6712592333632], [-79.379468072457, 43.6718257155842], [-79.3768542862929, 43.6723585535877], [-79.3771450315158, 43.673147823563], [-79.3755127139894, 43.6730182927934], [-79.374422861228, 43.67304680509831], [-79.3736124168794, 43.6729405604069], [-79.3704029794067, 43.6726681873031], [-79.36912588118521, 43.672265084164], [-79.3685295006808, 43.6719078753035], [-79.3677565359953, 43.6716872883271], [-79.365865786904, 43.6716443633414], [-79.361707163492, 43.6702394044539], [-79.3612611669296, 43.6700543367832], [-79.3604877711873, 43.670030901185406], [-79.3597108499133, 43.6704618791026], [-79.3601300580848, 43.6713896555625], [-79.3605255527314, 43.6719707333508], [-79.3615664294586, 43.6726831033154], [-79.3629509953311, 43.6732428267766], [-79.3630429912276, 43.6736884935503], [-79.3628797706027, 43.6743994203713], [-79.3633907880318, 43.6753226406503], [-79.3649564974, 43.6767286258956], [-79.3648318516554, 43.6770075194399], [-79.3641068310927, 43.6774792290063], [-79.36359511001, 43.6780636961135], [-79.3637314492195, 43.67879746595711], [-79.3644311643571, 43.679410378339], [-79.3661084007488, 43.6806905146653], [-79.3663684190196, 43.6813973948914], [-79.3658303100122, 43.6819908330589], [-79.3646530867365, 43.6827410275896], [-79.3633904006036, 43.683212067244], [-79.3620935417814, 43.6843735329363], [-79.3618502488393, 43.6847291237982], [-79.3616529398897, 43.6855353030927], [-79.361734106836, 43.6859526207483], [-79.3623818658898, 43.6871987416797], [-79.3625634908512, 43.6880065929483], [-79.3621680058351, 43.6884665602725], [-79.3624628145494, 43.6887896569665], [-79.3630563248612, 43.6886994744209], [-79.3632305367357, 43.6881299817208], [-79.3637431087658, 43.6883433755963], [-79.3637594621279, 43.68892782246921], [-79.3632026262453, 43.68986050207231], [-79.3623085408374, 43.6906818770973], [-79.3619867207247, 43.6912450061215], [-79.3621126794713, 43.692436749502], [-79.3625777810641, 43.6929993323397], [-79.3634683206274, 43.693486622295], [-79.3647313768332, 43.6938076517909], [-79.3662789708703, 43.6940882876906], [-79.3668785003559, 43.6943545165468], [-79.3693155299187, 43.6921386541412], [-79.3708543515811, 43.6906295716362], [-79.3718292877754, 43.6910009912938], [-79.3726897496608, 43.6914900301212], [-79.3739589544036, 43.6923556869459], [-79.3748942816455, 43.6927432840077], [-79.3765001775949, 43.693095675689804], [-79.3786783396821, 43.6939537250912], [-79.3801995935193, 43.6946755858609], [-79.3806167865017, 43.6947054835628], [-79.3813532167439, 43.6950870228904], [-79.3818832980219, 43.6946593714947], [-79.3848473659846, 43.6940268867582]]] }, "properties": { "_id": 704, "AREA_ID": 2457737, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993193, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 11, "AREA_LONG_CODE": 11, "AREA_NAME": "University-Rosedale", "AREA_DESC": "University-Rosedale (11)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344833, "Shape__Area": 26002990.5859375, "Shape__Length": 29861.631463743797 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.2923237336991, 43.700339830268106], [-79.295985574503, 43.7087765307836], [-79.2977082737701, 43.7129590139749], [-79.300179431088, 43.7187690262323], [-79.3005925599442, 43.719785826787], [-79.3044687444519, 43.7189068722779], [-79.306793438146, 43.7184156665213], [-79.3195020581948, 43.7156321727074], [-79.3200740071906, 43.7155584000227], [-79.3200117067112, 43.7148543406514], [-79.3202486417874, 43.7146071789126], [-79.320882557995, 43.7145780558243], [-79.3207280901187, 43.7140588461249], [-79.3203014590988, 43.713954724745705], [-79.3206527784705, 43.7134421147331], [-79.3215911826241, 43.7126030455862], [-79.321358013108, 43.7122554667641], [-79.3206783545156, 43.712280965255], [-79.3199481143287, 43.7125678306704], [-79.319185347287, 43.7124360903314], [-79.3185750144187, 43.7115079752649], [-79.3185820742291, 43.7112244466922], [-79.319217427686, 43.7107798817847], [-79.3209553699854, 43.7102875657469], [-79.3230921862928, 43.7102054258274], [-79.324850658126, 43.7095710783109], [-79.3251904345109, 43.708815276039], [-79.32625526402691, 43.7082184142758], [-79.3276467762721, 43.7080399554753], [-79.3285240249072, 43.7077534322891], [-79.3292447418563, 43.7072413578532], [-79.3301704617418, 43.7063617736705], [-79.3314196113292, 43.70625867695], [-79.3322054245165, 43.7058544069144], [-79.3327837966381, 43.7053101014183], [-79.3330914324973, 43.7033709024658], [-79.3321194840694, 43.7030365489097], [-79.3318188011953, 43.7019854148348], [-79.3313033230546, 43.7016569817106], [-79.3302864130642, 43.7015685240519], [-79.3296527463287, 43.7016691158952], [-79.3289542135835, 43.7015382023136], [-79.327362414431, 43.7014370742688], [-79.32709986130472, 43.701504367047], [-79.3289256708713, 43.6990794508328], [-79.3295965399394, 43.6982704634436], [-79.329556600972, 43.6979385625621], [-79.3287818995071, 43.6959416036837], [-79.3280183000274, 43.6941365360735], [-79.3261985788728, 43.6896731746276], [-79.32559525655701, 43.6880499516796], [-79.3218411831007, 43.6791093392087], [-79.3202036570495, 43.6750652109883], [-79.3183863164117, 43.6707328364946], [-79.31757755342511, 43.668701848131], [-79.3148681478337, 43.6622739414704], [-79.31492459201341, 43.6619658989816], [-79.3143494490133, 43.6616218712527], [-79.3133580721576, 43.6616502853797], [-79.3134037824506, 43.6613234042779], [-79.3140373147152, 43.6611938001789], [-79.3144081473905, 43.6609288542471], [-79.3137607184837, 43.66028872395], [-79.3120473255335, 43.6588006888104], [-79.3117004323373, 43.6583410312789], [-79.3116734890907, 43.6577783757148], [-79.31224663489711, 43.6572347009674], [-79.3122942741038, 43.6567351863564], [-79.31163893109742, 43.65692314571721], [-79.310749157919, 43.656615621267], [-79.3102510331795, 43.6569478544251], [-79.3111506606932, 43.6572013999277], [-79.3109232998452, 43.6579346699279], [-79.3103437822735, 43.6583972972809], [-79.3096047636415, 43.6580675016472], [-79.3093884361852, 43.6582336660505], [-79.3074986246002, 43.6576699764051], [-79.3068792134407, 43.6572265964301], [-79.3080547442865, 43.6565668331769], [-79.3083106182017, 43.6561668735074], [-79.3087711887572, 43.655910719364], [-79.3101547842852, 43.6561424069216], [-79.3111601574029, 43.6559235930909], [-79.3112061972937, 43.6554741056861], [-79.3106497664956, 43.655163025812], [-79.3102261206473, 43.655422039284], [-79.309373247872, 43.655227910316604], [-79.3086244205861, 43.6541631674021], [-79.3083466729951, 43.6543574283464], [-79.3084207136149, 43.6549763684066], [-79.3077734061727, 43.65612201782161], [-79.3068913289673, 43.6565835425571], [-79.3063726870391, 43.6566194537607], [-79.3053898323881, 43.6564403501635], [-79.3049931280337, 43.6568923429502], [-79.3059708993322, 43.6579281985779], [-79.3060823506709, 43.6586586669192], [-79.3056113669519, 43.6593385847156], [-79.3052743512793, 43.659400786505], [-79.304969302645, 43.6598599201066], [-79.30567435398771, 43.6603832257453], [-79.3064212627985, 43.6605940802713], [-79.3058705212477, 43.6618427125667], [-79.3050061241604, 43.6630172663929], [-79.3036583928023, 43.6641909392827], [-79.3033770878132, 43.6645480698745], [-79.3025934914075, 43.6649113364858], [-79.3020554771812, 43.6647561142237], [-79.3013537699531, 43.6651755924116], [-79.3003510293517, 43.6653508657601], [-79.2993210596661, 43.6656656572019], [-79.2989888488072, 43.6654719228742], [-79.2984027628952, 43.665521280248306], [-79.2980490060315, 43.6652607332821], [-79.2969575800859, 43.6653380026416], [-79.2953699332512, 43.6658742975545], [-79.295181410626, 43.6662454179649], [-79.2946824740646, 43.66620697834621], [-79.2939167924878, 43.6670315358287], [-79.2935318954764, 43.6672889364751], [-79.2926978432563, 43.6673146560126], [-79.2921687835972, 43.6677566958728], [-79.2914880858933, 43.6679337906321], [-79.2905528874031, 43.668412625966], [-79.2896730876894, 43.6685799655325], [-79.2886115523924, 43.6686282888689], [-79.2881716444771, 43.6690534714367], [-79.2876092412067, 43.669203569187], [-79.2866974939212, 43.6691773789124], [-79.2860788883203, 43.669431851661706], [-79.2855857345591, 43.6698323419322], [-79.2847794518772, 43.6697973598083], [-79.2843099224017, 43.6701423508359], [-79.2833861833085, 43.6702782344229], [-79.2827944266321, 43.6701298498383], [-79.2823521914744, 43.6705738092375], [-79.2819018015782, 43.6707269274971], [-79.2813315635504, 43.6705808087341], [-79.28070184540331, 43.6710162207121], [-79.2800829207476, 43.6710165258938], [-79.2790326884178, 43.6716713902779], [-79.280207080446, 43.6742744154676], [-79.2818987803938, 43.6783412103258], [-79.283155233091, 43.6786372685676], [-79.2839098368616, 43.6804496535381], [-79.28406044800691, 43.6808114397811], [-79.2862501028141, 43.6861002220003], [-79.2886966186186, 43.6920872127841], [-79.2894330096528, 43.6938429863115], [-79.2898204750099, 43.694949921804], [-79.290959064225, 43.6976556809163], [-79.2911565034098, 43.6980722791645], [-79.2922231987733, 43.700106982489906], [-79.2923237336991, 43.700339830268106]]] }, "properties": { "_id": 705, "AREA_ID": 2457736, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993192, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 19, "AREA_LONG_CODE": 19, "AREA_NAME": "Beaches-East York", "AREA_DESC": "Beaches-East York (19)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344849, "Shape__Area": 32155032.5859375, "Shape__Length": 30975.8780338131 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.2790326884178, 43.6716713902779], [-79.2783673489722, 43.6721849419467], [-79.277736779687, 43.6719770292296], [-79.2772253727435, 43.6730773455934], [-79.2768743689386, 43.6732982015381], [-79.2765828285787, 43.673926410401], [-79.275936004389, 43.6742576891572], [-79.2754231238176, 43.675220318951006], [-79.2750895276526, 43.6752545881911], [-79.2748271124203, 43.6759002672058], [-79.2742395239942, 43.6762320399677], [-79.27368174108601, 43.6771220763203], [-79.2733463176988, 43.67720709526011], [-79.2729630737473, 43.678133425139706], [-79.2723765744213, 43.6787197744965], [-79.2719184322216, 43.6786407568938], [-79.2716549468055, 43.6793169945539], [-79.2711738887046, 43.6798919635064], [-79.2708275794281, 43.6797592385031], [-79.2702087429242, 43.6808015451016], [-79.2697702418272, 43.6807366364458], [-79.2693778371504, 43.681621925304206], [-79.2685504278292, 43.6824528559559], [-79.2682440421166, 43.6826147807872], [-79.2678775344273, 43.6832661817672], [-79.26763033458512, 43.6832730695944], [-79.2672783408323, 43.6838827140223], [-79.2668916641966, 43.6839434050454], [-79.2663817142999, 43.6846131411621], [-79.2651436545504, 43.6857087811143], [-79.2637804438524, 43.6866460230398], [-79.2625639368904, 43.6879374664211], [-79.2620550161904, 43.6886021981687], [-79.2599685400992, 43.6905939542028], [-79.259419368202, 43.69126686155441], [-79.2592999695776, 43.6916920202849], [-79.2588228615959, 43.6919854378929], [-79.258604821581, 43.6925440838517], [-79.2581211338551, 43.6928886749276], [-79.25777119808261, 43.6934298205664], [-79.2571514439349, 43.6936369664234], [-79.2568492298656, 43.6941294325608], [-79.2562977238506, 43.6942715225871], [-79.2556045511247, 43.6950622999596], [-79.2536658173093, 43.6959717689206], [-79.2532064760929, 43.696286156130405], [-79.2514649362995, 43.6968324152827], [-79.2501885424498, 43.697499688447], [-79.2497607572183, 43.697853007217], [-79.2489184187519, 43.6982035872622], [-79.2474091994212, 43.6986809486216], [-79.2458431913976, 43.6993738074164], [-79.2438675477254, 43.70039069165221], [-79.2438237560246, 43.701033617778], [-79.2431494328894, 43.7019064165019], [-79.2415934376891, 43.7028166649316], [-79.2403652746763, 43.7031610339992], [-79.2396296597699, 43.703141916283], [-79.238947450691, 43.7029503433953], [-79.2385567450343, 43.7025786159401], [-79.2379859058928, 43.7029642106385], [-79.2380591317073, 43.7032810972744], [-79.2394306322993, 43.7036690543769], [-79.2391886995232, 43.7040293276196], [-79.2383543552214, 43.70434214131671], [-79.2385762620681, 43.7046428864531], [-79.2372508630341, 43.7050534198831], [-79.2366571183617, 43.7046070486998], [-79.2367476475572, 43.7041868348444], [-79.2374803593094, 43.7036029872142], [-79.23763830804242, 43.7031588849955], [-79.2383096661971, 43.7025329721654], [-79.2389845302212, 43.7025199241333], [-79.2392137618889, 43.7023179186708], [-79.2387616224072, 43.7018938353002], [-79.2382582743235, 43.7021852522722], [-79.237524561409, 43.7023217484045], [-79.2370559112226, 43.7020841718054], [-79.2365989684985, 43.7014659743048], [-79.2361213243246, 43.7011993800035], [-79.23548040289822, 43.7014251628441], [-79.2354178988886, 43.7017264169048], [-79.2360361289254, 43.7020497678534], [-79.2364809892974, 43.702536809123], [-79.23658590278, 43.7031041311986], [-79.236398016243, 43.7035942944523], [-79.2357783535717, 43.7044886163378], [-79.2352646117323, 43.7048385762301], [-79.2338740231448, 43.705447487496905], [-79.23357352663251, 43.7058206192036], [-79.2341916814278, 43.7061991395019], [-79.2339779131128, 43.7065756963234], [-79.2331435834388, 43.706929868694], [-79.2326302386579, 43.7066100692212], [-79.233106007531, 43.7058652459833], [-79.2327778628238, 43.7053269415117], [-79.2319385051203, 43.7048932662665], [-79.2316121149443, 43.7052667731859], [-79.2309613128693, 43.7053467857582], [-79.2299186635153, 43.7051044880967], [-79.2291761661368, 43.7046831010819], [-79.2288860201636, 43.7048573619655], [-79.2292381123894, 43.7055692338432], [-79.2284041518341, 43.7069543327764], [-79.2276662151726, 43.70713168422], [-79.2285458165975, 43.7074381723365], [-79.2286605312773, 43.707080581348], [-79.2295126378256, 43.7059665067166], [-79.2298167983503, 43.7058745850074], [-79.231815726899, 43.7067002890781], [-79.2334367253041, 43.7075882482497], [-79.2333335094792, 43.7083475072957], [-79.2329848062642, 43.709040717759], [-79.2330236649682, 43.70933261149501], [-79.2324802498064, 43.7098881411032], [-79.23159025846782, 43.7104458881916], [-79.2307366482462, 43.7105541730142], [-79.2301210490156, 43.7102011229214], [-79.2303296415025, 43.7098885063195], [-79.231161258645, 43.7096349644245], [-79.2315132927795, 43.7093129705442], [-79.23187018171471, 43.7085190236522], [-79.2312685159308, 43.7085082493984], [-79.2308970561053, 43.7087769363587], [-79.2298975291968, 43.7084849181494], [-79.2294967869999, 43.7080372377045], [-79.229087717921, 43.708795021526], [-79.2296212029743, 43.7092718754672], [-79.2290349328724, 43.7096486662582], [-79.2280451925072, 43.709263005949005], [-79.2278262603562, 43.7096482249849], [-79.2283003925114, 43.7099682587046], [-79.2280338074239, 43.7104636482679], [-79.2280383588309, 43.7110652313791], [-79.2273055874746, 43.7112031491213], [-79.2273609942899, 43.7116383301918], [-79.2282523103048, 43.7117777128969], [-79.2292293437909, 43.7116573713639], [-79.2291511763762, 43.7105060239473], [-79.2300120911705, 43.7103438866652], [-79.2305888645206, 43.7112535378107], [-79.2300407954183, 43.7121099117476], [-79.2294353013807, 43.7125532503045], [-79.2285540658278, 43.7126737491041], [-79.2266685807812, 43.712401675552], [-79.2264245414699, 43.7120928886303], [-79.2263131191092, 43.7111929279925], [-79.2267467793267, 43.7097425120928], [-79.2271043214111, 43.7088792089762], [-79.2280506363214, 43.7083828212832], [-79.2278658336818, 43.7080955021391], [-79.2268654008752, 43.7081180224545], [-79.2264319823894, 43.7079279683949], [-79.2258355402836, 43.707973210923], [-79.2263664850494, 43.708488410409], [-79.2264912862027, 43.70886852645191], [-79.2256819630582, 43.7106228773931], [-79.2250191447283, 43.7110612754119], [-79.22578360424131, 43.7116980607939], [-79.2255914815673, 43.7121802922517], [-79.2252080566355, 43.71240369149], [-79.2260084984359, 43.7126916729709], [-79.2253439077337, 43.7145706474961], [-79.2247508015488, 43.7156049861202], [-79.2240919840583, 43.717059350293], [-79.2235474682073, 43.71802622711011], [-79.2229530234687, 43.7187712704162], [-79.2205130785049, 43.7210864818528], [-79.2191929937617, 43.7220620506704], [-79.2187656545706, 43.72224624560321], [-79.2176941683912, 43.7217840727941], [-79.2170814471259, 43.723158667759], [-79.2164277524936, 43.7234515144729], [-79.2161673880067, 43.7243729552579], [-79.2156488427634, 43.7249251526112], [-79.2151283833658, 43.7249337310274], [-79.2147352792042, 43.7259630592727], [-79.2140122736659, 43.7263699717062], [-79.2127612905359, 43.7280935596794], [-79.2134131730933, 43.730012260330305], [-79.2147584726277, 43.7333740285108], [-79.2159388618348, 43.7360684957892], [-79.2170359507545, 43.7387768123413], [-79.2189135347958, 43.7431820122067], [-79.2205617781862, 43.7428349435208], [-79.22516266622, 43.7417927324263], [-79.2286728302396, 43.7410178693341], [-79.2352565277612, 43.7395300514172], [-79.238361641913, 43.738853081911], [-79.2437417303308, 43.7376320226885], [-79.2502249138769, 43.736224055122], [-79.252051263814, 43.7358499622413], [-79.2591712432005, 43.734307901948], [-79.266060766818, 43.732674814911505], [-79.2679317209071, 43.7322015547776], [-79.2712101564479, 43.7314341033418], [-79.2759581110826, 43.7303724429686], [-79.2828712238961, 43.7289094290531], [-79.29742801756042, 43.7256682912462], [-79.2994139463992, 43.7252036210534], [-79.301254497822, 43.72483768628171], [-79.3026450183565, 43.7247230254748], [-79.3016556339878, 43.7222731637887], [-79.3005925599442, 43.719785826787], [-79.300179431088, 43.7187690262323], [-79.2977082737701, 43.7129590139749], [-79.295985574503, 43.7087765307836], [-79.2923237336991, 43.700339830268106], [-79.2922231987733, 43.700106982489906], [-79.2911565034098, 43.6980722791645], [-79.290959064225, 43.6976556809163], [-79.2898204750099, 43.694949921804], [-79.2894330096528, 43.6938429863115], [-79.2886966186186, 43.6920872127841], [-79.2862501028141, 43.6861002220003], [-79.28406044800691, 43.6808114397811], [-79.2839098368616, 43.6804496535381], [-79.283155233091, 43.6786372685676], [-79.2818987803938, 43.6783412103258], [-79.280207080446, 43.6742744154676], [-79.2790326884178, 43.6716713902779]]] }, "properties": { "_id": 706, "AREA_ID": 2457735, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993191, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 20, "AREA_LONG_CODE": 20, "AREA_NAME": "Scarborough Southwest", "AREA_DESC": "Scarborough Southwest (20)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344865, "Shape__Area": 53987872.90625, "Shape__Length": 45132.3461099565 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.1792029490005, 43.7518781562957], [-79.1787177779526, 43.7522951510403], [-79.1774275755476, 43.7527169854895], [-79.1750729064925, 43.7540753195705], [-79.1735321998199, 43.7546650617789], [-79.17274674772192, 43.7548743705399], [-79.1701249573734, 43.7558615461353], [-79.1684602853231, 43.7563293188884], [-79.167280471169, 43.7568344755552], [-79.1661684929133, 43.7569977730934], [-79.1640349389623, 43.7574596012367], [-79.1633491621416, 43.7575341114655], [-79.161751514186, 43.7579974741433], [-79.1604448997859, 43.7582591437991], [-79.1589754605121, 43.7586939816235], [-79.1568745692524, 43.7590180913007], [-79.15531461205521, 43.7591264073824], [-79.1532276665619, 43.7591027223883], [-79.1527708178871, 43.7592839153744], [-79.1515157201078, 43.7601541281865], [-79.1494897386385, 43.7624734055008], [-79.1486228785425, 43.7635479775042], [-79.1474359973332, 43.7647047448462], [-79.1472231927072, 43.7650299216614], [-79.1464086955008, 43.7657394244667], [-79.1455871467368, 43.7660243683065], [-79.14413995772692, 43.7670135557555], [-79.1437627010356, 43.7674247330749], [-79.1428089984975, 43.7681435962163], [-79.1423429326853, 43.7686645304446], [-79.1416685222578, 43.7690561740581], [-79.1407377026734, 43.7689421326006], [-79.1400493638156, 43.7699805195526], [-79.1385984300223, 43.7708117349037], [-79.1381950433142, 43.77140346424981], [-79.1373394292113, 43.7715219891907], [-79.137090637407, 43.7722596007427], [-79.1364312461144, 43.7728703941057], [-79.1359888795439, 43.7728398403235], [-79.1358659412112, 43.7733741265696], [-79.1354064934984, 43.773977017633406], [-79.1348195862864, 43.7741571563131], [-79.1342873224224, 43.7738966801484], [-79.1339971840238, 43.7742648708727], [-79.1340610989889, 43.7746330518287], [-79.1337716227227, 43.775321415164704], [-79.1337901643696, 43.7758453508084], [-79.1330170848702, 43.7765086775229], [-79.1320394251615, 43.7775303154282], [-79.1310523004834, 43.778326084358], [-79.1291180836339, 43.7804869407756], [-79.1282706244654, 43.7808635409406], [-79.1276905148002, 43.7816316467252], [-79.1268904770031, 43.7822359129713], [-79.1267718465394, 43.7827285452975], [-79.125673205797, 43.7839151734206], [-79.12486638022652, 43.7841463867254], [-79.124631901534, 43.7849601120822], [-79.1237563247688, 43.785405507824606], [-79.1237510833323, 43.7860272352291], [-79.123253625482, 43.786091223807], [-79.1227904069074, 43.787226368542], [-79.1219116593424, 43.7876785173515], [-79.1219449707059, 43.7881318797095], [-79.1215962062855, 43.788540817215], [-79.1211751263664, 43.7884908071682], [-79.1207618125355, 43.7889478462132], [-79.1210402299295, 43.789149251958], [-79.12080539661152, 43.7896598274247], [-79.1202050980928, 43.789784714136], [-79.1200593344532, 43.7902126745374], [-79.1204298222085, 43.790570080326], [-79.1202810873384, 43.7910139270796], [-79.11852682643492, 43.792820039488], [-79.1169525370164, 43.7941716578235], [-79.1154514950547, 43.794555969822], [-79.1162205544202, 43.794748892643], [-79.1171359300426, 43.7943652204404], [-79.118413062868, 43.7944806195011], [-79.1193212413309, 43.7947972112552], [-79.121003344313, 43.7947406038787], [-79.1211120332515, 43.7953253982287], [-79.1202725471391, 43.7956184340415], [-79.1203061840931, 43.7961544636336], [-79.1211740217565, 43.7970220902171], [-79.121932277766, 43.7974029991345], [-79.1223445925156, 43.7974262170393], [-79.1234741868708, 43.7971785517614], [-79.1242252226761, 43.7974272942291], [-79.1243552741194, 43.7977321396357], [-79.124201774365, 43.7983530632938], [-79.1242266730957, 43.7990102268028], [-79.1248743553258, 43.799925895872], [-79.1255725741139, 43.8002169322739], [-79.1264003294182, 43.8001573533943], [-79.127683111259, 43.8002863669536], [-79.1284635370376, 43.8006346305157], [-79.1302314083948, 43.8016077407289], [-79.1310270675971, 43.8017819814644], [-79.1317852151327, 43.8017330932153], [-79.1342698544199, 43.8008711944559], [-79.1352561294056, 43.8006718482234], [-79.1352147933857, 43.8013155660677], [-79.1346555333434, 43.8017419536762], [-79.1337707984169, 43.8027165169259], [-79.1336949827722, 43.8032725966846], [-79.1343907542408, 43.8044286769497], [-79.1343028666158, 43.8052182250895], [-79.1339485572849, 43.8059525263558], [-79.1340371751162, 43.8067930634637], [-79.1355874892799, 43.8079231463636], [-79.1362604794488, 43.8080737994581], [-79.1370503040589, 43.8077117657374], [-79.1376114361268, 43.8078620645964], [-79.1381632167493, 43.8074947675703], [-79.13841021343622, 43.8079590971894], [-79.1389460176127, 43.807992294999], [-79.1395819059702, 43.8084443483002], [-79.1406399326833, 43.8084476619858], [-79.140698179421, 43.8087808859461], [-79.1412431316351, 43.8089131048762], [-79.1419726431514, 43.8096414124513], [-79.1424645237881, 43.8094458281614], [-79.1431510569595, 43.8096302461494], [-79.1428768045716, 43.8100782474371], [-79.1434286485845, 43.8106196764962], [-79.143638133229, 43.8100622616307], [-79.1452815962063, 43.809993835309], [-79.146095795582, 43.8100667120699], [-79.1464044233751, 43.8104812769468], [-79.1461283374886, 43.8108369650208], [-79.1466722155067, 43.8113421332666], [-79.1482264905451, 43.812319622569], [-79.1494726812546, 43.8124794315347], [-79.1512320930711, 43.8138819014438], [-79.1517428539905, 43.8139846672972], [-79.1521581508901, 43.8146850290788], [-79.152795994535, 43.8167212606017], [-79.1554974647575, 43.8225805471385], [-79.1588972437805, 43.830214719359404], [-79.16049670158452, 43.8338537529815], [-79.1625004420541, 43.8382415754789], [-79.16495186063642, 43.84371757669151], [-79.1659064612318, 43.8459082109445], [-79.1674396092199, 43.8492089006759], [-79.1702915177967, 43.8554571861712], [-79.1769472036027, 43.8539057032944], [-79.1814444542456, 43.8528253230682], [-79.1950315102283, 43.8494942540992], [-79.1989288286159, 43.8485991190225], [-79.2044977667187, 43.847253686673], [-79.2092959545785, 43.8462038242408], [-79.21483858773331, 43.8449665800727], [-79.2278142704233, 43.8420905838785], [-79.2269196339853, 43.841327887549], [-79.2265631541165, 43.84075097663361], [-79.2261796095168, 43.839809456890904], [-79.2255577292308, 43.8394884456499], [-79.2251255380572, 43.8395054180837], [-79.2238774346985, 43.8392279040785], [-79.2227983124317, 43.8387122583673], [-79.2226261230132, 43.8384643204549], [-79.2228533952514, 43.837542254158805], [-79.2219748484088, 43.8367705474938], [-79.2220597545012, 43.83630719029801], [-79.223227464425, 43.8357924270622], [-79.2239800202871, 43.8353126631789], [-79.2240779861091, 43.8347098193899], [-79.2236350248054, 43.833772647193], [-79.2225164881988, 43.8330633890728], [-79.2218932199053, 43.8324768316356], [-79.2214794148288, 43.8323048126031], [-79.2196088088061, 43.832493788485], [-79.2191529368445, 43.83242967064201], [-79.2186478524833, 43.8319153943735], [-79.218306855309, 43.8312979900789], [-79.2183537187868, 43.830996569705306], [-79.2175231260072, 43.830379278518], [-79.2229041708457, 43.8287594142945], [-79.2322978138953, 43.8257250560645], [-79.2318381774536, 43.8246884221644], [-79.2314048806435, 43.8239779753712], [-79.2309613671146, 43.8235543673292], [-79.2301429534698, 43.8230341463964], [-79.2305523976284, 43.8226053376785], [-79.230539321233, 43.8217479894662], [-79.2290174636585, 43.8182793770248], [-79.22822057203571, 43.8174352975763], [-79.2276590281086, 43.81663030719831], [-79.22760056909982, 43.8162658575853], [-79.2263911370706, 43.8136144138533], [-79.225745726855, 43.8122196586578], [-79.2251849227878, 43.8112440412852], [-79.2251105651546, 43.8111443732756], [-79.2247171138135, 43.81074930396441], [-79.2236391240619, 43.81007048543841], [-79.2210168117054, 43.8088781287267], [-79.220028959087, 43.8082125835447], [-79.2195339246432, 43.8077119793511], [-79.2175470088073, 43.8050712191431], [-79.2172220332259, 43.8043509836183], [-79.217285815342, 43.8031624542912], [-79.2182488430156, 43.801139500197], [-79.2183727997375, 43.8004403737787], [-79.21819263064292, 43.7994689068421], [-79.2178088146512, 43.7984545415328], [-79.215721815678, 43.7936789796981], [-79.2134014102026, 43.79414450169071], [-79.1970100599685, 43.7965219057717], [-79.196720621825, 43.7957887525269], [-79.196278003411, 43.7938989155955], [-79.1958756800204, 43.792811229356], [-79.19435615288, 43.7892773724244], [-79.193767105969, 43.7879884890298], [-79.193625852829, 43.7873669959036], [-79.1935841293527, 43.7859175384586], [-79.1921892271157, 43.7825763910866], [-79.1898661329994, 43.7771014707958], [-79.1891253029611, 43.77579040202501], [-79.1868657256296, 43.7706126705875], [-79.1863354125094, 43.769240509847], [-79.1860023082925, 43.7674542583898], [-79.1804950889411, 43.7547835709701], [-79.1792029490005, 43.7518781562957]]] }, "properties": { "_id": 707, "AREA_ID": 2457734, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993190, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 25, "AREA_LONG_CODE": 25, "AREA_NAME": "Scarborough-Rouge Park", "AREA_DESC": "Scarborough-Rouge Park (25)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344881, "Shape__Area": 103900635.804688, "Shape__Length": 52384.382993714404 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.2263911370706, 43.8136144138533], [-79.22760056909982, 43.8162658575853], [-79.2276590281086, 43.81663030719831], [-79.22822057203571, 43.8174352975763], [-79.2290174636585, 43.8182793770248], [-79.230539321233, 43.8217479894662], [-79.2305523976284, 43.8226053376785], [-79.2301429534698, 43.8230341463964], [-79.2309613671146, 43.8235543673292], [-79.2314048806435, 43.8239779753712], [-79.2318381774536, 43.8246884221644], [-79.2322978138953, 43.8257250560645], [-79.2229041708457, 43.8287594142945], [-79.2175231260072, 43.830379278518], [-79.2183537187868, 43.830996569705306], [-79.218306855309, 43.8312979900789], [-79.2186478524833, 43.8319153943735], [-79.2191529368445, 43.83242967064201], [-79.2196088088061, 43.832493788485], [-79.2214794148288, 43.8323048126031], [-79.2218932199053, 43.8324768316356], [-79.2225164881988, 43.8330633890728], [-79.2236350248054, 43.833772647193], [-79.2240779861091, 43.8347098193899], [-79.2239800202871, 43.8353126631789], [-79.223227464425, 43.8357924270622], [-79.2220597545012, 43.83630719029801], [-79.2219748484088, 43.8367705474938], [-79.2228533952514, 43.837542254158805], [-79.2226261230132, 43.8384643204549], [-79.2227983124317, 43.8387122583673], [-79.2238774346985, 43.8392279040785], [-79.2251255380572, 43.8395054180837], [-79.2255577292308, 43.8394884456499], [-79.2261796095168, 43.839809456890904], [-79.2265631541165, 43.84075097663361], [-79.2269196339853, 43.841327887549], [-79.2278142704233, 43.8420905838785], [-79.2297359009406, 43.8416540027351], [-79.23924855632161, 43.8393897624241], [-79.248490375191, 43.8372411833503], [-79.2511891488379, 43.8365989872391], [-79.260035298539, 43.8345650760383], [-79.2679625210449, 43.8327043091125], [-79.2755227567675, 43.8309714187814], [-79.2767814066946, 43.8306658763414], [-79.2872021430405, 43.82829493398561], [-79.2959933881964, 43.8262721484992], [-79.2973325288169, 43.8259504741618], [-79.2952480205023, 43.8214462432239], [-79.2947873273507, 43.8202752843301], [-79.2922319345689, 43.814609023816], [-79.2888003517962, 43.8070508608343], [-79.2882423064453, 43.8062487383092], [-79.2873032467618, 43.8053469012557], [-79.2866165944347, 43.804463521110605], [-79.2834364743932, 43.7970594282981], [-79.2831701633094, 43.7963560703564], [-79.2825353168023, 43.79491471057091], [-79.2814428344595, 43.7922393354447], [-79.2791092392982, 43.7867802672807], [-79.2783694778168, 43.7848149925162], [-79.277177685215, 43.7830835998816], [-79.2747764602797, 43.7772824387948], [-79.2690559158931, 43.7785026331619], [-79.26034465530202, 43.7802078259237], [-79.2549798538438, 43.781222537134], [-79.2507144273161, 43.7820478729994], [-79.2478246126028, 43.782570035916706], [-79.243730720745, 43.7834408730397], [-79.2404588438344, 43.7841995865015], [-79.2389887712312, 43.7845784363654], [-79.2346231156842, 43.7857834565037], [-79.2318755307811, 43.78663586080171], [-79.22933108568981, 43.7875191760261], [-79.227618028048, 43.788212802607], [-79.2253849056361, 43.7893261652135], [-79.2220367231067, 43.7913090054401], [-79.2194422217498, 43.7924892043416], [-79.2175508060284, 43.7931668584674], [-79.215721815678, 43.7936789796981], [-79.2178088146512, 43.7984545415328], [-79.21819263064292, 43.7994689068421], [-79.2183727997375, 43.8004403737787], [-79.2182488430156, 43.801139500197], [-79.217285815342, 43.8031624542912], [-79.2172220332259, 43.8043509836183], [-79.2175470088073, 43.8050712191431], [-79.2195339246432, 43.8077119793511], [-79.220028959087, 43.8082125835447], [-79.2210168117054, 43.8088781287267], [-79.2236391240619, 43.81007048543841], [-79.2247171138135, 43.81074930396441], [-79.2251105651546, 43.8111443732756], [-79.2251849227878, 43.8112440412852], [-79.225745726855, 43.8122196586578], [-79.2263911370706, 43.8136144138533]]] }, "properties": { "_id": 708, "AREA_ID": 2457733, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993189, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 23, "AREA_LONG_CODE": 23, "AREA_NAME": "Scarborough North", "AREA_DESC": "Scarborough North (23)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344897, "Shape__Area": 58475793.5898438, "Shape__Length": 33292.5789433519 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.1792029490005, 43.7518781562957], [-79.1804950889411, 43.7547835709701], [-79.1860023082925, 43.7674542583898], [-79.1863354125094, 43.769240509847], [-79.1868657256296, 43.7706126705875], [-79.1891253029611, 43.77579040202501], [-79.1898661329994, 43.7771014707958], [-79.1921892271157, 43.7825763910866], [-79.1935841293527, 43.7859175384586], [-79.193625852829, 43.7873669959036], [-79.193767105969, 43.7879884890298], [-79.19435615288, 43.7892773724244], [-79.1958756800204, 43.792811229356], [-79.196278003411, 43.7938989155955], [-79.196720621825, 43.7957887525269], [-79.1970100599685, 43.7965219057717], [-79.2134014102026, 43.79414450169071], [-79.215721815678, 43.7936789796981], [-79.2175508060284, 43.7931668584674], [-79.2194422217498, 43.7924892043416], [-79.2220367231067, 43.7913090054401], [-79.2253849056361, 43.7893261652135], [-79.227618028048, 43.788212802607], [-79.22933108568981, 43.7875191760261], [-79.2318755307811, 43.78663586080171], [-79.2346231156842, 43.7857834565037], [-79.2389887712312, 43.7845784363654], [-79.2404588438344, 43.7841995865015], [-79.243730720745, 43.7834408730397], [-79.2478246126028, 43.782570035916706], [-79.2507144273161, 43.7820478729994], [-79.2549798538438, 43.781222537134], [-79.254225318459, 43.77960696551101], [-79.2518721140703, 43.7736494692383], [-79.2516057018878, 43.7728626749516], [-79.2513322064066, 43.7716015931157], [-79.2502110994834, 43.76863775512171], [-79.2482072081534, 43.7634756490909], [-79.2466700381705, 43.75961974665811], [-79.2456368361459, 43.7568721620127], [-79.2454227767629, 43.755548528507106], [-79.2432328661623, 43.7560026995996], [-79.2352672256062, 43.7577217927048], [-79.2353034268332, 43.7566060172556], [-79.23370414821561, 43.7528211446352], [-79.2335584279283, 43.7524626384769], [-79.2297940424874, 43.7435425388311], [-79.2290390161143, 43.7416815963285], [-79.2286728302396, 43.7410178693341], [-79.22516266622, 43.7417927324263], [-79.2205617781862, 43.7428349435208], [-79.2189135347958, 43.7431820122067], [-79.2170359507545, 43.7387768123413], [-79.2159388618348, 43.7360684957892], [-79.2147584726277, 43.7333740285108], [-79.2134131730933, 43.730012260330305], [-79.2127612905359, 43.7280935596794], [-79.2121725777517, 43.7290054787978], [-79.2113969279071, 43.7293678388063], [-79.2113149803483, 43.729765441262], [-79.2109441276428, 43.7300374483213], [-79.2101927008367, 43.7301859021132], [-79.2098135457344, 43.7306513118465], [-79.2101591819988, 43.7309331531811], [-79.2099490427964, 43.7312977909564], [-79.2092904321257, 43.7316627107645], [-79.2075945150275, 43.7333466637968], [-79.2069535532587, 43.7333254176124], [-79.2064270867393, 43.7341851687319], [-79.20523862580481, 43.7348380111742], [-79.2023764556137, 43.7357322646344], [-79.2011881235302, 43.7366113017519], [-79.1994571377754, 43.7377769577586], [-79.1975442710124, 43.739144651501], [-79.1964037578126, 43.7406628779908], [-79.195842819855, 43.7412311364137], [-79.1952177814828, 43.7413934375107], [-79.1940743255657, 43.7425650047114], [-79.1914590563129, 43.744495827002], [-79.1904529171833, 43.7454139569285], [-79.1897800797921, 43.7458721213086], [-79.1886883316032, 43.74684509944401], [-79.1880360723065, 43.7468377942982], [-79.1871753924134, 43.7473547392917], [-79.1863502034252, 43.7476469071421], [-79.1857465927806, 43.7481980129055], [-79.1831111065331, 43.7495140297742], [-79.1807733824594, 43.75090475338501], [-79.1806156866465, 43.7512450081], [-79.1797512313242, 43.751509978766], [-79.1792029490005, 43.7518781562957]]] }, "properties": { "_id": 709, "AREA_ID": 2457732, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993188, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 24, "AREA_LONG_CODE": 24, "AREA_NAME": "Scarborough-Guildwood", "AREA_DESC": "Scarborough-Guildwood (24)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344913, "Shape__Area": 50102587.5664063, "Shape__Length": 31659.0590874056 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.23370414821561, 43.7528211446352], [-79.2353034268332, 43.7566060172556], [-79.2352672256062, 43.7577217927048], [-79.2432328661623, 43.7560026995996], [-79.2454227767629, 43.755548528507106], [-79.2456368361459, 43.7568721620127], [-79.2466700381705, 43.75961974665811], [-79.2482072081534, 43.7634756490909], [-79.2502110994834, 43.76863775512171], [-79.2513322064066, 43.7716015931157], [-79.2516057018878, 43.7728626749516], [-79.2518721140703, 43.7736494692383], [-79.254225318459, 43.77960696551101], [-79.2549798538438, 43.781222537134], [-79.26034465530202, 43.7802078259237], [-79.2690559158931, 43.7785026331619], [-79.2747764602797, 43.7772824387948], [-79.2773952796138, 43.7766942670116], [-79.2898861329807, 43.7737728943586], [-79.2935914465039, 43.772923293212], [-79.2991651819614, 43.77160986265811], [-79.3039285423153, 43.7705176865907], [-79.3100686334796, 43.7690841321655], [-79.3123784882532, 43.76867037388781], [-79.3137279154124, 43.7685134313458], [-79.315906667163, 43.7683843471083], [-79.3197941465542, 43.7683633049312], [-79.3193753882357, 43.7674347579502], [-79.3185961859286, 43.7654216440876], [-79.3175317247447, 43.7630209373757], [-79.3172400603424, 43.7623798302727], [-79.3152454343223, 43.7578694237401], [-79.3132628277443, 43.7522133081246], [-79.3114143506855, 43.7467284328825], [-79.310029396735, 43.74272051099], [-79.3093483452118, 43.7409191071266], [-79.3045078328946, 43.7291909126082], [-79.3026450183565, 43.7247230254748], [-79.301254497822, 43.72483768628171], [-79.2994139463992, 43.7252036210534], [-79.29742801756042, 43.7256682912462], [-79.2828712238961, 43.7289094290531], [-79.2759581110826, 43.7303724429686], [-79.2712101564479, 43.7314341033418], [-79.2679317209071, 43.7322015547776], [-79.266060766818, 43.732674814911505], [-79.2591712432005, 43.734307901948], [-79.252051263814, 43.7358499622413], [-79.2502249138769, 43.736224055122], [-79.2437417303308, 43.7376320226885], [-79.238361641913, 43.738853081911], [-79.2352565277612, 43.7395300514172], [-79.2286728302396, 43.7410178693341], [-79.2290390161143, 43.7416815963285], [-79.2297940424874, 43.7435425388311], [-79.2335584279283, 43.7524626384769], [-79.23370414821561, 43.7528211446352]]] }, "properties": { "_id": 710, "AREA_ID": 2457731, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993187, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 21, "AREA_LONG_CODE": 21, "AREA_NAME": "Scarborough Centre", "AREA_DESC": "Scarborough Centre (21)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344929, "Shape__Area": 54085225.4570313, "Shape__Length": 31081.9504946095 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.3197941465542, 43.7683633049312], [-79.315906667163, 43.7683843471083], [-79.3137279154124, 43.7685134313458], [-79.3123784882532, 43.76867037388781], [-79.3100686334796, 43.7690841321655], [-79.3039285423153, 43.7705176865907], [-79.2991651819614, 43.77160986265811], [-79.2935914465039, 43.772923293212], [-79.2898861329807, 43.7737728943586], [-79.2773952796138, 43.7766942670116], [-79.2747764602797, 43.7772824387948], [-79.277177685215, 43.7830835998816], [-79.2783694778168, 43.7848149925162], [-79.2791092392982, 43.7867802672807], [-79.2814428344595, 43.7922393354447], [-79.2825353168023, 43.79491471057091], [-79.2831701633094, 43.7963560703564], [-79.2834364743932, 43.7970594282981], [-79.2866165944347, 43.804463521110605], [-79.2873032467618, 43.8053469012557], [-79.2882423064453, 43.8062487383092], [-79.2888003517962, 43.8070508608343], [-79.2922319345689, 43.814609023816], [-79.2947873273507, 43.8202752843301], [-79.2952480205023, 43.8214462432239], [-79.2973325288169, 43.8259504741618], [-79.3054912072424, 43.8240743335248], [-79.3070666398246, 43.8236899303012], [-79.320373485425, 43.8205880350589], [-79.3266866868434, 43.8190945288962], [-79.3320837684822, 43.817878419184], [-79.3374751847611, 43.816626212889], [-79.3413178929128, 43.81565075423731], [-79.3397894183636, 43.8120928177632], [-79.3384124880604, 43.8087513966747], [-79.3353840702956, 43.8020050779449], [-79.3351201214223, 43.801374628035], [-79.3318284859423, 43.7940161724994], [-79.330787882511, 43.7917643710237], [-79.3272251961383, 43.7842432223519], [-79.3242315376932, 43.7778750406544], [-79.3209779918419, 43.7707501875879], [-79.3197941465542, 43.7683633049312]]] }, "properties": { "_id": 711, "AREA_ID": 2457730, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993186, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 22, "AREA_LONG_CODE": 22, "AREA_NAME": "Scarborough-Agincourt", "AREA_DESC": "Scarborough-Agincourt (22)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344945, "Shape__Area": 41093408.3320313, "Shape__Length": 25980.7020486281 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.3346939799612, 43.7030774853307], [-79.3342185704537, 43.7040572697499], [-79.3337099880079, 43.7066408323834], [-79.3337008164375, 43.7075795794753], [-79.3338437318838, 43.7085062698606], [-79.3343949847785, 43.7099964553998], [-79.3350937816921, 43.7098267476798], [-79.3358796637445, 43.7094325881664], [-79.3379109060016, 43.7088807115245], [-79.338258509252, 43.7095170713888], [-79.3393878091822, 43.7101374017687], [-79.3394429568307, 43.7107128040811], [-79.340052512426, 43.7110527272754], [-79.3402897783158, 43.7116957492328], [-79.3394939779139, 43.7124861245228], [-79.3395280156406, 43.7127934843732], [-79.3402129635135, 43.7130042903122], [-79.3407569241113, 43.7126931557328], [-79.3414781838446, 43.7127820465916], [-79.3428587112222, 43.7133543717086], [-79.3434426251721, 43.7140803504385], [-79.3444637036485, 43.7145464163791], [-79.3449448086809, 43.7152190049102], [-79.3457945651835, 43.7150735869838], [-79.3462041596096, 43.7152700061857], [-79.3466048259545, 43.716058226541], [-79.3489195159251, 43.7163104551611], [-79.3498868155188, 43.7160303323287], [-79.3500202816837, 43.7158578544335], [-79.3510806172482, 43.7156986673793], [-79.3523211689513, 43.7157348777119], [-79.3526276415439, 43.7162332047491], [-79.3499797944943, 43.7170987413729], [-79.3503340155183, 43.7177742727645], [-79.3504272110557, 43.7184804800259], [-79.35018873754632, 43.71951824604], [-79.3491445619983, 43.722300481779804], [-79.3488224387122, 43.7236079101053], [-79.348967565935, 43.7247351296184], [-79.3493010260647, 43.7254024177426], [-79.3499549896187, 43.72619818663501], [-79.351426136026, 43.72738591358301], [-79.3522331577934, 43.7281418305163], [-79.3543052483291, 43.7303141122363], [-79.3548550317409, 43.7309727838322], [-79.355272524315, 43.731730217815], [-79.3557111435612, 43.7332576870295], [-79.3558333646959, 43.733823181411], [-79.3568836019381, 43.7383123947843], [-79.35735796006011, 43.7404906437303], [-79.3587251175452, 43.7470832814591], [-79.3599702259251, 43.7529544978379], [-79.3612699273421, 43.758721050077405], [-79.3616532313565, 43.7603025102689], [-79.3619159069717, 43.7616917468028], [-79.3619440085579, 43.7645558308108], [-79.3622782549691, 43.765455973894], [-79.3629278029548, 43.7663407333661], [-79.3715811133045, 43.7659373594165], [-79.3751323283503, 43.76562550594], [-79.376746017903, 43.7653997437088], [-79.3797418238159, 43.7648736927255], [-79.38715209799, 43.763311731433106], [-79.3921283194167, 43.7622404898496], [-79.3933248375784, 43.7619333312937], [-79.3951757944996, 43.7613312713679], [-79.3962869448145, 43.76088787849311], [-79.3986662636602, 43.7597200744556], [-79.4032864941989, 43.7568429403413], [-79.408388704346, 43.7536163537944], [-79.4080884844505, 43.7519246074708], [-79.4081687335567, 43.7503605601952], [-79.4081097503073, 43.7497935450057], [-79.4070357719152, 43.7456878291731], [-79.4068603972384, 43.7446521150863], [-79.4064978759447, 43.7433035454409], [-79.406251643319, 43.7418582436851], [-79.4051401344049, 43.7369793764915], [-79.4045311142273, 43.7341706849335], [-79.4032939870537, 43.7291580918882], [-79.4021952907712, 43.7251017926697], [-79.4011419122536, 43.719547306134], [-79.40010896802282, 43.7149488281025], [-79.3989974316929, 43.7095833507147], [-79.3912268870284, 43.711128749686], [-79.3901971744214, 43.7084077534108], [-79.3889339559755, 43.7051797212184], [-79.3870311308924, 43.7005063734658], [-79.386478759635, 43.6981745569168], [-79.3862291956072, 43.6975037220317], [-79.3848473659846, 43.6940268867582], [-79.3818832980219, 43.6946593714947], [-79.3813532167439, 43.6950870228904], [-79.3806167865017, 43.6947054835628], [-79.3801995935193, 43.6946755858609], [-79.3786783396821, 43.6939537250912], [-79.3765001775949, 43.693095675689804], [-79.3748942816455, 43.6927432840077], [-79.3739589544036, 43.6923556869459], [-79.3726897496608, 43.6914900301212], [-79.3718292877754, 43.6910009912938], [-79.3708543515811, 43.6906295716362], [-79.3693155299187, 43.6921386541412], [-79.3668785003559, 43.6943545165468], [-79.3662789708703, 43.6940882876906], [-79.3647313768332, 43.6938076517909], [-79.3634683206274, 43.693486622295], [-79.3625777810641, 43.6929993323397], [-79.3621126794713, 43.692436749502], [-79.3619867207247, 43.6912450061215], [-79.3623085408374, 43.6906818770973], [-79.3632026262453, 43.68986050207231], [-79.3637594621279, 43.68892782246921], [-79.3637431087658, 43.6883433755963], [-79.3632305367357, 43.6881299817208], [-79.3630563248612, 43.6886994744209], [-79.3624628145494, 43.6887896569665], [-79.3621680058351, 43.6884665602725], [-79.3616756627984, 43.6888553797722], [-79.3600546991794, 43.6912922992574], [-79.3600633618551, 43.6919948339184], [-79.361254522401, 43.69277662608701], [-79.3617634848387, 43.6934792895321], [-79.3616687237251, 43.6941791963243], [-79.3606512266121, 43.6949474447503], [-79.3599967328217, 43.6953068405967], [-79.3588350021532, 43.6955456742125], [-79.3576620094105, 43.6952708054492], [-79.3569281630571, 43.6954248824872], [-79.35620260299, 43.6961540035203], [-79.3560022937927, 43.6970622422423], [-79.3550205923027, 43.6980465430698], [-79.354659126594, 43.6982289181291], [-79.3535263553282, 43.6983531931389], [-79.3527501527903, 43.698599326122], [-79.3514742383015, 43.6987330366743], [-79.3510982916581, 43.6988703032065], [-79.3501239659486, 43.6998628344381], [-79.349381895934, 43.6999810540165], [-79.348369420045, 43.699930712451], [-79.347344355544, 43.6991507551844], [-79.3466074310952, 43.6989454665369], [-79.3454643289574, 43.6983560980347], [-79.344452660439, 43.698264442969], [-79.3437488900331, 43.6984907115313], [-79.3428717603532, 43.6990249955192], [-79.34184296375102, 43.6992400485331], [-79.3404848838388, 43.6999898584467], [-79.3390873109582, 43.701261139675], [-79.3372519654418, 43.7021597132627], [-79.3365886334937, 43.7027143437305], [-79.3354178284738, 43.7031996690207], [-79.3346939799612, 43.7030774853307]]] }, "properties": { "_id": 712, "AREA_ID": 2457729, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993185, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 15, "AREA_LONG_CODE": 15, "AREA_NAME": "Don Valley West", "AREA_DESC": "Don Valley West (15)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344961, "Shape__Area": 58048830.4765625, "Shape__Length": 37532.8144065602 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4049670168388, 43.6759208047062], [-79.4015776356744, 43.676667386558], [-79.4002825619128, 43.6770488202039], [-79.3984396599047, 43.6777672851479], [-79.391194825918, 43.681081122778], [-79.3928542300674, 43.6850259296234], [-79.3902572917164, 43.68559309553601], [-79.3907253918597, 43.6867926166736], [-79.3866459126664, 43.6877014211196], [-79.3872749049071, 43.6882652725358], [-79.3882161336675, 43.6886397508118], [-79.3897761640267, 43.6897844397294], [-79.3900734382196, 43.6905810347878], [-79.3909188985912, 43.6913013363369], [-79.38874183639071, 43.6917249723705], [-79.3890698794723, 43.692517180075505], [-79.3891249054345, 43.6931049639157], [-79.3848473659846, 43.6940268867582], [-79.3862291956072, 43.6975037220317], [-79.386478759635, 43.6981745569168], [-79.3870311308924, 43.7005063734658], [-79.3889339559755, 43.7051797212184], [-79.3901971744214, 43.7084077534108], [-79.3912268870284, 43.711128749686], [-79.3989974316929, 43.7095833507147], [-79.3983665000037, 43.7067319904649], [-79.4002822433353, 43.7063511777225], [-79.4037502206298, 43.7056026882376], [-79.4132319388084, 43.7036120588724], [-79.419884215513, 43.7021857657636], [-79.4276123994154, 43.7005666040414], [-79.4299028501137, 43.7000633116904], [-79.4383244817957, 43.698276523348305], [-79.44025595536772, 43.6978456674863], [-79.4502789805454, 43.6956920028916], [-79.4489548896469, 43.6925461788247], [-79.4461172265153, 43.6855663935808], [-79.4439721378385, 43.6860344203186], [-79.4406263415209, 43.6867093774743], [-79.4386937707147, 43.6871340019649], [-79.4382584452398, 43.6863629590337], [-79.4358169158062, 43.6868948064494], [-79.4346396357324, 43.6870982979164], [-79.43377713560511, 43.6849043725654], [-79.4337822066276, 43.6845003068423], [-79.4333068305918, 43.6833441005053], [-79.4338158053278, 43.6830246698281], [-79.4329795684655, 43.6809709925509], [-79.4326971769691, 43.6807965882232], [-79.4318309860072, 43.6786087374875], [-79.4302261813582, 43.6747352755612], [-79.4309834971531, 43.67472270139161], [-79.4293964137968, 43.670972707104006], [-79.4218189621437, 43.6724249826802], [-79.4073338149418, 43.675429007407], [-79.4049670168388, 43.6759208047062]]] }, "properties": { "_id": 713, "AREA_ID": 2457728, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993184, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 12, "AREA_LONG_CODE": 12, "AREA_NAME": "Toronto-St. Paul's", "AREA_DESC": "Toronto-St. Paul's (12)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344977, "Shape__Area": 25109621.808593802, "Shape__Length": 23816.299191398302 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4600458827451, 43.6672259620873], [-79.465363725387, 43.667296755306], [-79.4661518376909, 43.6672683761419], [-79.4728846153158, 43.6673553150798], [-79.4749769499394, 43.6672932419678], [-79.4805276749425, 43.6669853964486], [-79.4826414064519, 43.6668272504568], [-79.4914429435288, 43.6662911474469], [-79.5002179127562, 43.6658076636786], [-79.50562352908182, 43.66547434106781], [-79.507619382975, 43.6652221520005], [-79.5087813515432, 43.6648935018018], [-79.50998125987792, 43.6643262829786], [-79.5111450741051, 43.663547496527], [-79.5122116343354, 43.6626336614198], [-79.51130288457482, 43.66212070537641], [-79.51024739127061, 43.6619363043415], [-79.5092899993516, 43.6621209406891], [-79.507087751107, 43.6629133065681], [-79.5061655884544, 43.6630124017849], [-79.5055219916522, 43.6628054218342], [-79.5040929486376, 43.6619458537385], [-79.50191296557162, 43.6602807343122], [-79.5001449124321, 43.659344646206], [-79.4995196790461, 43.6586875469094], [-79.4995289961899, 43.6579134129492], [-79.5000256761463, 43.6571662838643], [-79.5016112080644, 43.6560815646569], [-79.5022549494845, 43.655473926453], [-79.5026906701104, 43.6547988064916], [-79.5028575540711, 43.65405168098221], [-79.5027792636753, 43.6532145747912], [-79.5020680061343, 43.6525845308631], [-79.5003399235002, 43.6521705405961], [-79.497861141438, 43.6519860022418], [-79.4966463840316, 43.6519769626991], [-79.4942653480216, 43.6522874329231], [-79.4930575046471, 43.6522603798781], [-79.491961264966, 43.6519137557393], [-79.4914956669504, 43.6516256785584], [-79.49093214851891, 43.65045092172671], [-79.4910228324512, 43.6496812854456], [-79.4922706961263, 43.6481016103021], [-79.49276980587, 43.6471188378476], [-79.4927043168302, 43.6459030909994], [-79.4917366965356, 43.6449453784886], [-79.4909819439112, 43.64383304005571], [-79.490591228959, 43.6430755700945], [-79.4901944155879, 43.6419982163356], [-79.4897980092811, 43.6414557227842], [-79.4891046937299, 43.6412077969294], [-79.4875046659531, 43.6418087720856], [-79.486662788906, 43.642025160026], [-79.4854396999909, 43.6420933672244], [-79.48498957077521, 43.6417367915592], [-79.485126009913, 43.6396368242323], [-79.4850445081831, 43.6388233679868], [-79.4848333120482, 43.6384761119348], [-79.4838523953829, 43.6380514454804], [-79.48247869169431, 43.6379682954638], [-79.4798512074069, 43.6381354502651], [-79.4788468502256, 43.6381194083997], [-79.4774989205305, 43.6377333518459], [-79.4770853588417, 43.6372125037609], [-79.4768301429787, 43.6364431941531], [-79.4754993659415, 43.6341070392367], [-79.47396106399361, 43.6332928027301], [-79.4727977820541, 43.6328193198417], [-79.47202297479811, 43.6323665789974], [-79.4712285274822, 43.631699270778], [-79.4709151922421, 43.6320034384896], [-79.4702971696033, 43.6322199430431], [-79.46923703913801, 43.6327774967905], [-79.4687671452691, 43.6331671205093], [-79.4683897431303, 43.63375397028351], [-79.4678325804732, 43.63413440251771], [-79.4667097757013, 43.6344797343111], [-79.46580611485271, 43.6346411414858], [-79.465035851797, 43.6352289600194], [-79.4639120891753, 43.6357057922048], [-79.4630385469775, 43.6357808366919], [-79.4626133410201, 43.635673960007004], [-79.46185896606012, 43.63629056664911], [-79.461256378142, 43.6363616729731], [-79.4601892925035, 43.6367608147296], [-79.4586645794401, 43.6367922915052], [-79.4578993565609, 43.63717593921311], [-79.4563743615098, 43.6372041448388], [-79.4552313714824, 43.6374782990929], [-79.4538319182158, 43.6372954915035], [-79.4525925455566, 43.6367268170047], [-79.451043120729, 43.6364932711799], [-79.4497550217066, 43.6365200764964], [-79.4492370909813, 43.636179073312604], [-79.4476412898037, 43.6365328910426], [-79.446747870465, 43.6363161301119], [-79.4439132452861, 43.6351538660021], [-79.4432248569311, 43.6347150777054], [-79.4420043856851, 43.6349480600135], [-79.4411410113958, 43.6348739964159], [-79.4399953173539, 43.634228424473704], [-79.4400062461706, 43.6339065406156], [-79.4392908053542, 43.6335700781164], [-79.4393578345295, 43.6332300232549], [-79.436942579939, 43.63216607555271], [-79.4358422282108, 43.6318114566401], [-79.4350802334675, 43.6313995908885], [-79.4334849415635, 43.630825366193], [-79.4317202805512, 43.6304330083023], [-79.4294813569131, 43.63002360698861], [-79.4277754764607, 43.629793474517], [-79.4281670995517, 43.6309475737771], [-79.4287065660649, 43.6329132750031], [-79.4277926632574, 43.6332208459316], [-79.42542438496672, 43.6338795502891], [-79.4280062840758, 43.640599719745], [-79.4286441986526, 43.6422084224097], [-79.4282100821178, 43.6423113693663], [-79.4344320526108, 43.6452442076641], [-79.4365361704554, 43.6461906828553], [-79.4388843845511, 43.6473035501615], [-79.440799286143, 43.648371165624], [-79.4422439897742, 43.6493845400506], [-79.44404972012, 43.6509155885405], [-79.4498705732511, 43.6568753864178], [-79.4600458827451, 43.6672259620873]]] }, "properties": { "_id": 714, "AREA_ID": 2457727, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993183, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 4, "AREA_LONG_CODE": 4, "AREA_NAME": "Parkdale-High Park", "AREA_DESC": "Parkdale-High Park (4)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344993, "Shape__Area": 29293133.5976563, "Shape__Length": 28220.033151902597 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.5378418799993, 43.7129901010899], [-79.5378466144462, 43.7137102364611], [-79.5382066350366, 43.7145787923277], [-79.5394392828022, 43.7149339504168], [-79.5402572350749, 43.715055191265], [-79.5407375276308, 43.7153565722686], [-79.5406879163732, 43.7165358356898], [-79.5412981735861, 43.7168596890654], [-79.5424398276147, 43.71676924031941], [-79.5436508592293, 43.7171513376391], [-79.5440778940447, 43.7177047959644], [-79.5440354676611, 43.718033394111], [-79.5430357585697, 43.7197576048145], [-79.5428034846283, 43.7203607758502], [-79.5422656109076, 43.7209685513827], [-79.5412271039853, 43.7216800293449], [-79.5407877210953, 43.7222652771005], [-79.5407644621164, 43.7239125494684], [-79.5412725103929, 43.7249250431239], [-79.5413036750452, 43.7256271558088], [-79.5408657326509, 43.726126900147], [-79.5396079528955, 43.7262308661881], [-79.5388134026676, 43.7264471775412], [-79.5382788771441, 43.726906448073], [-79.5382294635565, 43.7272575309714], [-79.5388639145477, 43.7292601735004], [-79.5386187623326, 43.72984086332111], [-79.538422545757, 43.7316187452103], [-79.5386318501611, 43.7319337358022], [-79.5394910991193, 43.7319469350095], [-79.5392827914331, 43.7308848162774], [-79.5401458355902, 43.7297818021389], [-79.54114950106252, 43.729592392263], [-79.543219136828, 43.729920155544], [-79.5442415991935, 43.7303698261183], [-79.5448550011636, 43.7310176939156], [-79.5440062765236, 43.7315446229773], [-79.5438423966924, 43.7317832276212], [-79.5440766855671, 43.7322737136667], [-79.5447989039955, 43.7323638592582], [-79.5451247676817, 43.7321466303675], [-79.5454997943137, 43.7315305813709], [-79.5463242788161, 43.731443235278], [-79.5475558166576, 43.7319530274043], [-79.5478061822091, 43.7323905358536], [-79.5488660132456, 43.7328274214873], [-79.5491889009071, 43.7330991831636], [-79.5500146986765, 43.733302576651], [-79.5504990744773, 43.7339472477669], [-79.550479112988, 43.734804245534], [-79.5496368204395, 43.735278006961], [-79.5491192700389, 43.7357078320846], [-79.54916129013502, 43.7359332947328], [-79.5502851072173, 43.7358717595358], [-79.5505592625798, 43.736403863062], [-79.5500531934688, 43.7371926830749], [-79.5498804616178, 43.7379736507105], [-79.5488746713003, 43.738024177013], [-79.5483645459697, 43.7384914764259], [-79.5482171818281, 43.7389846796057], [-79.5478362183224, 43.7390595318107], [-79.5464266315336, 43.7397896979675], [-79.546182744285, 43.7400547206654], [-79.5461769223658, 43.7406856724582], [-79.546403725737, 43.7409468859699], [-79.5476142499566, 43.7417338956159], [-79.5487815264533, 43.7416966154276], [-79.5493484964657, 43.7419499813248], [-79.549489438832, 43.7425256651616], [-79.5499851646704, 43.7422843518862], [-79.5504066872699, 43.7425407464228], [-79.5499364108813, 43.742943829236], [-79.54983877384382, 43.7435867745818], [-79.5503706405526, 43.744075568355], [-79.5512095828039, 43.7442382435337], [-79.5519384529601, 43.7440597716501], [-79.55295119719, 43.743588813541805], [-79.5543721603638, 43.7432222920798], [-79.5560334800443, 43.7432099501637], [-79.556736662411, 43.74286286748921], [-79.556980542714, 43.7422610689302], [-79.556821424404, 43.7413801000659], [-79.55783408884011, 43.7409645100125], [-79.558376260099, 43.741461209617], [-79.5583361402025, 43.741838651121], [-79.5578490680293, 43.7421316632333], [-79.5580701324317, 43.7424986027114], [-79.5587584990848, 43.7429168794269], [-79.55928066225171, 43.7429663055108], [-79.5597640448481, 43.7424966224172], [-79.5604862224065, 43.7426227096062], [-79.56189799115661, 43.7427018485814], [-79.5622928648703, 43.7428537365903], [-79.5624486912418, 43.7434490098824], [-79.5621660109076, 43.7440740642195], [-79.5623526335084, 43.7443130257753], [-79.5634043371822, 43.7447963523789], [-79.5639816007272, 43.7452563526535], [-79.56522093938261, 43.7456791861558], [-79.569395648064, 43.746386644181], [-79.5712720981473, 43.7467991040603], [-79.5724664347146, 43.7468404067294], [-79.5728482385064, 43.7469618693643], [-79.5733046529314, 43.74741778578], [-79.5733424684195, 43.7480032180334], [-79.5726947944886, 43.7497103323261], [-79.5732689816388, 43.7503607707071], [-79.5755216981474, 43.7500302744664], [-79.5771065514607, 43.7501923811147], [-79.5782702914092, 43.7504831390866], [-79.5792004869672, 43.7509625504352], [-79.5800029685875, 43.7515698246867], [-79.5825542590978, 43.7523978490961], [-79.583102609624, 43.7527494886288], [-79.5831251031601, 43.7537221327563], [-79.5839395322833, 43.754195648603], [-79.5842866355847, 43.7548124971789], [-79.5841627118898, 43.7552352306272], [-79.5852117269988, 43.7564970328686], [-79.5849929413253, 43.7571040561756], [-79.5840243466353, 43.7572928252327], [-79.583818917751, 43.7576128064063], [-79.5840671337725, 43.7582012029804], [-79.5838189764281, 43.7586957215887], [-79.5827117072503, 43.7585237233906], [-79.5818001213737, 43.7585840663182], [-79.5807665880169, 43.7589271435657], [-79.5805746331664, 43.759236019831405], [-79.5807788119002, 43.7597883416506], [-79.5806227685616, 43.7603638887415], [-79.5793286818626, 43.7608414250738], [-79.5789272931887, 43.7613169745734], [-79.577533983927, 43.7621263246425], [-79.5777904805649, 43.7624097506643], [-79.5792491647708, 43.7622086612556], [-79.57952737217691, 43.762270954238], [-79.5806438818039, 43.7630179182296], [-79.5904153157141, 43.7607798335846], [-79.6020523373788, 43.7581532282044], [-79.6112275727958, 43.7561121535561], [-79.62491153441772, 43.7530507442462], [-79.6296041298404, 43.7519692102324], [-79.631721857084, 43.7515094653301], [-79.6331431368219, 43.7513061196545], [-79.6352527965954, 43.7512343784588], [-79.6364548228442, 43.7510550500096], [-79.6373669492935, 43.7507621474884], [-79.6392649324429, 43.7498707479426], [-79.6376119524667, 43.7483009597757], [-79.63690857296922, 43.747136895347], [-79.6366395622805, 43.7464841526325], [-79.6356625935042, 43.7446205357672], [-79.6341306133891, 43.7420748204539], [-79.6314880673702, 43.737534615727], [-79.631346766638, 43.7370297285756], [-79.6303547109175, 43.7354695478806], [-79.629260372833, 43.7346389423447], [-79.62897049812102, 43.7338072233035], [-79.6281816698101, 43.7335293065926], [-79.6278393000436, 43.7332549005057], [-79.6269454871014, 43.7314240112182], [-79.6266396192809, 43.730060627669], [-79.626322420991, 43.7290342707815], [-79.625430905688, 43.7273479616418], [-79.6203399873422, 43.7183793008029], [-79.6191476713094, 43.7162516271379], [-79.6155643082986, 43.710166754135], [-79.6132234260489, 43.706271070269], [-79.6097445928854, 43.7007699305929], [-79.6072497398261, 43.696924267763], [-79.6058845771872, 43.6946798539543], [-79.6043923941018, 43.6920170238349], [-79.602993747828, 43.6892661010413], [-79.60219054037671, 43.6877974496568], [-79.6014616540281, 43.68668618606821], [-79.6001496835619, 43.6851074430882], [-79.5999540271655, 43.6837251306252], [-79.5947473748081, 43.6750176692098], [-79.5945516762254, 43.6742113487651], [-79.5910867990462, 43.6685878284164], [-79.5866606178312, 43.6701859363727], [-79.583665164003, 43.6713403830692], [-79.5819082034639, 43.6722567123934], [-79.5785425157414, 43.6727662541851], [-79.5711117480985, 43.6737159873554], [-79.5693226793274, 43.6739960013354], [-79.5676823599195, 43.6741859581037], [-79.5631767235789, 43.6744777585563], [-79.5686375567498, 43.6866106307516], [-79.5693803555609, 43.6882224596102], [-79.5700177072976, 43.6898043824985], [-79.5708382592862, 43.69159248871011], [-79.5675278373638, 43.692265241807], [-79.5640038673633, 43.6930280676695], [-79.5625167197123, 43.6934015712337], [-79.558649130603, 43.6942496435162], [-79.5552900517256, 43.6950388946071], [-79.5540612610641, 43.6953409625773], [-79.5503338326319, 43.6962110100576], [-79.5487565947864, 43.6966211442977], [-79.5451605685962, 43.697428200799], [-79.543407253445, 43.6977844668752], [-79.5342720956626, 43.699821681158], [-79.5276619742478, 43.7011962484318], [-79.5259742600834, 43.7015979484891], [-79.526091989064, 43.7016506151712], [-79.5277357268606, 43.702230486646], [-79.5285699277462, 43.7024152124689], [-79.529170833521, 43.703253529775], [-79.529715144469, 43.70382434958691], [-79.5307411292849, 43.70458470410501], [-79.5311573120798, 43.7047826284806], [-79.5321907533139, 43.7049668682554], [-79.5331706313042, 43.7050070848393], [-79.535437127193, 43.7044806131583], [-79.5359612062898, 43.7045893739186], [-79.5359501435472, 43.7049921304565], [-79.5356002722633, 43.7056904598077], [-79.5354427499811, 43.7067796807862], [-79.5356588659721, 43.7078940159504], [-79.5362940583394, 43.7083367145174], [-79.5374125248112, 43.7082610762941], [-79.5381279302365, 43.70848801394181], [-79.5389018828899, 43.7089999793716], [-79.5393259690637, 43.7096590421179], [-79.5395981412305, 43.7107121143573], [-79.5391274678259, 43.7113783880766], [-79.5384026353576, 43.7118197048526], [-79.5379419348259, 43.7123959575792], [-79.5378418799993, 43.7129901010899]]] }, "properties": { "_id": 715, "AREA_ID": 2457726, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993182, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 1, "AREA_LONG_CODE": 1, "AREA_NAME": "Etobicoke North", "AREA_DESC": "Etobicoke North (1)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345009, "Shape__Area": 92641345.765625, "Shape__Length": 51338.9218600238 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4712285274822, 43.631699270778], [-79.47202297479811, 43.6323665789974], [-79.4727977820541, 43.6328193198417], [-79.47396106399361, 43.6332928027301], [-79.4754993659415, 43.6341070392367], [-79.4768301429787, 43.6364431941531], [-79.4770853588417, 43.6372125037609], [-79.4774989205305, 43.6377333518459], [-79.4788468502256, 43.6381194083997], [-79.4798512074069, 43.6381354502651], [-79.48247869169431, 43.6379682954638], [-79.4838523953829, 43.6380514454804], [-79.4848333120482, 43.6384761119348], [-79.4850445081831, 43.6388233679868], [-79.485126009913, 43.6396368242323], [-79.48498957077521, 43.6417367915592], [-79.4854396999909, 43.6420933672244], [-79.486662788906, 43.642025160026], [-79.4875046659531, 43.6418087720856], [-79.4891046937299, 43.6412077969294], [-79.4897980092811, 43.6414557227842], [-79.4901944155879, 43.6419982163356], [-79.490591228959, 43.6430755700945], [-79.4909819439112, 43.64383304005571], [-79.4917366965356, 43.6449453784886], [-79.4927043168302, 43.6459030909994], [-79.49276980587, 43.6471188378476], [-79.4922706961263, 43.6481016103021], [-79.4910228324512, 43.6496812854456], [-79.49093214851891, 43.65045092172671], [-79.4914956669504, 43.6516256785584], [-79.491961264966, 43.6519137557393], [-79.4930575046471, 43.6522603798781], [-79.4942653480216, 43.6522874329231], [-79.4966463840316, 43.6519769626991], [-79.497861141438, 43.6519860022418], [-79.5003399235002, 43.6521705405961], [-79.5020680061343, 43.6525845308631], [-79.5027792636753, 43.6532145747912], [-79.5028575540711, 43.65405168098221], [-79.5026906701104, 43.6547988064916], [-79.5022549494845, 43.655473926453], [-79.5016112080644, 43.6560815646569], [-79.5000256761463, 43.6571662838643], [-79.4995289961899, 43.6579134129492], [-79.4995196790461, 43.6586875469094], [-79.5001449124321, 43.659344646206], [-79.50191296557162, 43.6602807343122], [-79.5040929486376, 43.6619458537385], [-79.5055219916522, 43.6628054218342], [-79.507193360455, 43.6619248355716], [-79.5082499120096, 43.661486263759706], [-79.51484928636572, 43.6589516461576], [-79.5159608573265, 43.6584374473708], [-79.5174834276711, 43.6578684023978], [-79.5187845071735, 43.6544848937852], [-79.520208373706, 43.6506797589968], [-79.5206713024133, 43.649926649333], [-79.5214048219589, 43.6491136642889], [-79.5224017400885, 43.6482693883743], [-79.5237497775318, 43.6490798331075], [-79.5247422090145, 43.6499796958682], [-79.5255610444464, 43.6505330994388], [-79.5265521608893, 43.6508929189559], [-79.5279104294814, 43.6509556229256], [-79.5289987624355, 43.6511714026723], [-79.5307372725108, 43.6508943726447], [-79.5309736581818, 43.6501587086168], [-79.5319850613329, 43.6500365336641], [-79.5322862954334, 43.650383019404], [-79.53222495518871, 43.6508196027154], [-79.53240378264921, 43.65186821957371], [-79.5328816452207, 43.6521426515636], [-79.5346448805904, 43.6521602415209], [-79.5355063577207, 43.65250207380801], [-79.537155730203, 43.6526276406324], [-79.5375193098668, 43.6529065729624], [-79.5371680133123, 43.6542118753687], [-79.53816546635362, 43.6551521522389], [-79.5390620498129, 43.65521936854], [-79.5401566658913, 43.6548094726671], [-79.5401071604362, 43.654377434029804], [-79.539673252428, 43.653868999867], [-79.5398950352564, 43.6535628855811], [-79.540476698974, 43.6535618079735], [-79.539395411824, 43.65097795878631], [-79.5385383417625, 43.6490953190808], [-79.5353609571934, 43.64179494861], [-79.5395563842449, 43.6408929952618], [-79.5422270901346, 43.640262222613], [-79.5450464411757, 43.6396728433821], [-79.5524672201532, 43.6379466163366], [-79.5595857324343, 43.6362382298188], [-79.5590187235812, 43.6344909591001], [-79.5581907005935, 43.6321374215886], [-79.5567688031798, 43.6285327906689], [-79.5585237484381, 43.6281181835655], [-79.5605920011032, 43.6277185332125], [-79.5637603220542, 43.6270261958096], [-79.5634614752462, 43.6264420183159], [-79.5636018205713, 43.6248884696888], [-79.5642615589661, 43.6243885139429], [-79.56508580734442, 43.6245815867887], [-79.5656115130545, 43.6240411931447], [-79.5659037860801, 43.6225242524724], [-79.565548658927, 43.6217773129728], [-79.5656528881072, 43.621480206749304], [-79.56681892169, 43.6208674174729], [-79.5669262082913, 43.6205523054381], [-79.5667450548659, 43.6199313051479], [-79.5668236421643, 43.6188645741524], [-79.5665102195911, 43.6179511046525], [-79.5669686541703, 43.6172892241817], [-79.5678508018179, 43.6167801241472], [-79.567825714082, 43.6161860366704], [-79.56833903819171, 43.6145024481026], [-79.5682941833462, 43.6142234309512], [-79.5677121756653, 43.613778197935], [-79.566536385265, 43.6134323426664], [-79.5648626840304, 43.61338380571771], [-79.56408674817682, 43.6129836801434], [-79.5639484204595, 43.6125336865783], [-79.5642159914611, 43.6122409814071], [-79.5652828794248, 43.6117569557945], [-79.5661453524044, 43.6110696604886], [-79.5671692674104, 43.6106647375411], [-79.5673336638491, 43.61022279692801], [-79.5672737183703, 43.609601715893], [-79.5669969783086, 43.6089537577337], [-79.5666447684118, 43.6086794290846], [-79.5655466432163, 43.6086406827223], [-79.5648040920637, 43.6083834852034], [-79.564638166016, 43.6078029870406], [-79.5648729052982, 43.6072177522052], [-79.5642265695321, 43.606988598695], [-79.5626406853583, 43.6067194807543], [-79.5618664264614, 43.6060445700384], [-79.5604576364042, 43.6054597355961], [-79.5592627567759, 43.6047545319023], [-79.5583362720758, 43.6037693333931], [-79.557604584038, 43.6032611143235], [-79.556311083331, 43.6025686391816], [-79.5561497252577, 43.602213161786], [-79.5562518632238, 43.6014129197549], [-79.5560091974546, 43.6008900012885], [-79.5558334280694, 43.5999854335394], [-79.5553831446087, 43.5994230714867], [-79.5542917798842, 43.5991175909585], [-79.5536707799422, 43.5984742990324], [-79.5534845101654, 43.5979027856554], [-79.5539542240828, 43.5963318397424], [-79.5537118815292, 43.5957648896993], [-79.5529669840787, 43.5954187085046], [-79.5521061449384, 43.5953021032687], [-79.5512303175155, 43.5953250117125], [-79.549114722288, 43.5951603855203], [-79.5487324653008, 43.594853545692], [-79.5486576890478, 43.5942144656307], [-79.548768294082, 43.59362481450031], [-79.5494240961002, 43.5924408779659], [-79.5495707057377, 43.5918827513988], [-79.5495470658683, 43.5906173371568], [-79.54934886276011, 43.5903382157258], [-79.5484764600024, 43.5901729801785], [-79.5464074329289, 43.5889304044527], [-79.54815794509442, 43.5869967340056], [-79.54465152682852, 43.58527706857001], [-79.5438825698345, 43.581392216061], [-79.5434064053223, 43.5809960000775], [-79.5425650170297, 43.5830372195517], [-79.54210586640882, 43.5837845203418], [-79.5411039789549, 43.5846379898581], [-79.5410157581715, 43.5848875511511], [-79.5398920097531, 43.58615266343731], [-79.5393586545046, 43.586602894411], [-79.5371092462848, 43.5880287129564], [-79.5360085916359, 43.5881747175384], [-79.5354230427398, 43.5881208917072], [-79.5340024505072, 43.5877891691677], [-79.5334857440994, 43.5881079823591], [-79.5311094772172, 43.5885722378178], [-79.5306714009165, 43.58787023334071], [-79.5298304960457, 43.5878929684965], [-79.5292451471249, 43.5882351752002], [-79.5285280778936, 43.5891040061567], [-79.5278366612732, 43.589464234909904], [-79.5272325728757, 43.5896129134491], [-79.5247766194712, 43.589748493937], [-79.5233343268125, 43.5899963374761], [-79.5198377456312, 43.5902130236246], [-79.5185660076543, 43.590720325244], [-79.5182041995343, 43.5903888148006], [-79.51723476128, 43.5905599747153], [-79.516534537025, 43.5900875016782], [-79.516101561441, 43.58911087834791], [-79.5154795123504, 43.5889083864448], [-79.5149144736353, 43.5889695454502], [-79.5150475687576, 43.58938699763101], [-79.5156531162795, 43.5894095729945], [-79.5154212599593, 43.59012729067971], [-79.5129876125491, 43.5906657541034], [-79.5116151750561, 43.5902876875998], [-79.5110805397432, 43.5890911229466], [-79.5113068049194, 43.5886160758217], [-79.51214707824631, 43.5883240093003], [-79.5122007595088, 43.5879435658913], [-79.5130750124087, 43.5877090712265], [-79.5135334464753, 43.587996947584], [-79.5146622959979, 43.58762876567971], [-79.515273547157, 43.5879947750398], [-79.5168604202132, 43.5884237416198], [-79.5170477301782, 43.5882644330193], [-79.51577282522, 43.5879107776353], [-79.5145804082462, 43.587189486860304], [-79.51402912409, 43.58706316632], [-79.5131598505388, 43.587072469178], [-79.5119128325824, 43.5872891450687], [-79.5108792435453, 43.5873319780318], [-79.5096212582243, 43.5871957096828], [-79.5094521610791, 43.587674268449206], [-79.5100664343323, 43.5877838447984], [-79.5104656429694, 43.5883291984007], [-79.5103599311645, 43.5891745440194], [-79.5097395072875, 43.5900268745452], [-79.5087256590782, 43.5902364563197], [-79.5088468461555, 43.5905425955309], [-79.5101004172621, 43.5907585265913], [-79.51087196119582, 43.5910429198153], [-79.510826905925, 43.5917284658691], [-79.5103272015756, 43.5923689025076], [-79.5096688229825, 43.5923755581491], [-79.5097652046148, 43.5927856291368], [-79.5104381863805, 43.59290566704891], [-79.5107632170852, 43.593422509272], [-79.5105821639297, 43.593710959672], [-79.5096814281954, 43.5937515460261], [-79.5089313842543, 43.5939136151914], [-79.5086294765832, 43.5937426018136], [-79.5070608517855, 43.5941611598845], [-79.5064117613319, 43.594116145872], [-79.50618565779261, 43.593481538048], [-79.5056588957176, 43.5935175261328], [-79.5048601053817, 43.5942466713799], [-79.5037318530215, 43.59421967342], [-79.5023203057964, 43.5944852445522], [-79.50091801392442, 43.5949938462963], [-79.5003889094817, 43.5953989235066], [-79.5003067995439, 43.5962495875548], [-79.4995620170387, 43.5975323291697], [-79.4993077114119, 43.5977528723087], [-79.4983628322392, 43.5980544110654], [-79.4978630860199, 43.5985134674422], [-79.4981858575097, 43.5995036316971], [-79.4979152216045, 43.6002102312135], [-79.4965374598498, 43.6015513852776], [-79.4959517611735, 43.6019519390388], [-79.4949332644359, 43.6021994469743], [-79.4930689710267, 43.602010363967], [-79.4925054345067, 43.602270469958704], [-79.49249828832681, 43.6026617619587], [-79.490578482485, 43.6044630501114], [-79.49018976789182, 43.60496258797401], [-79.4894642485688, 43.6055296136714], [-79.4891195918666, 43.6063757069523], [-79.48854313015131, 43.60674921000451], [-79.4879937241854, 43.6073927558542], [-79.4875631079146, 43.6082073301078], [-79.4872986877083, 43.6083288203128], [-79.4869733623084, 43.6093346751686], [-79.4865353265029, 43.6096874983154], [-79.4867313746737, 43.6107351250586], [-79.4867841608109, 43.6118139877396], [-79.4865465352973, 43.6126444131778], [-79.4870275385939, 43.6129517142637], [-79.4866899607179, 43.613597905401], [-79.486292323828, 43.6135970302837], [-79.4859390348412, 43.6139885401081], [-79.4859710009734, 43.6143515982493], [-79.4853304134571, 43.615653257797], [-79.4852061294625, 43.6163843727636], [-79.484393670375, 43.6176339130496], [-79.4831384924993, 43.6183959564152], [-79.4825333170356, 43.6184367589685], [-79.48163157209521, 43.6187682656442], [-79.4812219812268, 43.6185309218941], [-79.48117556019942, 43.6180404903283], [-79.4805613706696, 43.6183779495012], [-79.4788469134069, 43.6170904430837], [-79.4800606043648, 43.6161680072105], [-79.4804264719501, 43.6161905739762], [-79.4805478134712, 43.6156955078209], [-79.480127790018, 43.6154614077585], [-79.4804236293261, 43.6141067364567], [-79.48083867736901, 43.6140257940074], [-79.4819316079954, 43.6140979743158], [-79.4827009116227, 43.6139585713238], [-79.4833244239834, 43.6147372776504], [-79.483733495977, 43.6138011890763], [-79.4841443856268, 43.6133016770204], [-79.4840298511392, 43.6130631234453], [-79.48278920914481, 43.6123923555549], [-79.4826194525805, 43.6130584260118], [-79.4817908648738, 43.6133688460293], [-79.4805759954989, 43.6133596446509], [-79.4802911344381, 43.613062558036304], [-79.4799568917259, 43.6122883867298], [-79.4794366911265, 43.6119192360507], [-79.4789294773904, 43.61209017070931], [-79.47890577155731, 43.6123917139604], [-79.4792779949225, 43.6130308829145], [-79.4787410525527, 43.6140749489895], [-79.4782786596454, 43.6144394195138], [-79.477284559584, 43.6141916963094], [-79.476923628569, 43.6144481734461], [-79.4775485269116, 43.6151110542487], [-79.4770364979578, 43.6160653727134], [-79.475913311093, 43.6173802572409], [-79.4751941451358, 43.6179875188022], [-79.4758246195644, 43.6181981969005], [-79.47673252890291, 43.6174602784472], [-79.4772739662552, 43.6173516322854], [-79.4783375106112, 43.6179184867138], [-79.4788402378225, 43.6186026881856], [-79.4783243469938, 43.6191066705576], [-79.47767719475041, 43.6184134373562], [-79.4772710761206, 43.6183143418037], [-79.476665052906, 43.6185527661236], [-79.4764794765642, 43.6188992824292], [-79.4771293145005, 43.619610516707205], [-79.4778335616752, 43.6197141716407], [-79.4789826282242, 43.6201554577273], [-79.4803951138219, 43.6210724571131], [-79.4801326928148, 43.6213796838514], [-79.479532747521, 43.6210666530891], [-79.4795060937371, 43.621691967066], [-79.4785578180926, 43.62150108933441], [-79.4775433188162, 43.6215819162148], [-79.4770495245067, 43.62080769711171], [-79.477235594227, 43.6204083238237], [-79.4770579072371, 43.6201055889248], [-79.4756173597159, 43.6196417361709], [-79.4753078843803, 43.6189260576172], [-79.4748971667281, 43.6187144440079], [-79.4744046405644, 43.6188538746739], [-79.4743452600239, 43.6192499234386], [-79.4748211257673, 43.6201771654399], [-79.4743903558926, 43.6208071863513], [-79.47323832965381, 43.6220581540569], [-79.4727774689504, 43.6223325971224], [-79.4704673922664, 43.6225616225438], [-79.4696160244636, 43.6223768886308], [-79.4692024123316, 43.6225613157647], [-79.4692274031704, 43.6229528836083], [-79.469910070545, 43.6237181846699], [-79.470211195857, 43.6248524402474], [-79.4706678931338, 43.6253296326039], [-79.471978775172, 43.624965368681], [-79.4715585106733, 43.6243351667612], [-79.4723979428326, 43.6234892136242], [-79.4733850701713, 43.6232163000954], [-79.4740613981299, 43.6225724950573], [-79.4745702381531, 43.6226948214551], [-79.4753764892578, 43.6232044774592], [-79.4765716976684, 43.6235535330515], [-79.4768534994517, 43.6238961838694], [-79.4763525341305, 43.6247315285095], [-79.4766462157641, 43.6247740034865], [-79.4762354429252, 43.6257533702761], [-79.4760708222685, 43.6264711885564], [-79.475590344088, 43.6272488798116], [-79.4753671380535, 43.6280197926058], [-79.474770036563, 43.6288378622763], [-79.4736409214633, 43.6296477060247], [-79.4726066947335, 43.6296827843502], [-79.4723741756082, 43.6304187363299], [-79.4719454208419, 43.63068709844941], [-79.470858635823, 43.6306866825575], [-79.4708363113973, 43.6309800412363], [-79.4714479256399, 43.6314425070986], [-79.4712285274822, 43.631699270778]]] }, "properties": { "_id": 716, "AREA_ID": 2457725, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993181, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 3, "AREA_LONG_CODE": 3, "AREA_NAME": "Etobicoke-Lakeshore", "AREA_DESC": "Etobicoke-Lakeshore (3)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345025, "Shape__Area": 76412570.2265625, "Shape__Length": 60137.672264100496 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.5259742600834, 43.7015979484891], [-79.5276619742478, 43.7011962484318], [-79.5342720956626, 43.699821681158], [-79.543407253445, 43.6977844668752], [-79.5451605685962, 43.697428200799], [-79.5487565947864, 43.6966211442977], [-79.5503338326319, 43.6962110100576], [-79.5540612610641, 43.6953409625773], [-79.5552900517256, 43.6950388946071], [-79.558649130603, 43.6942496435162], [-79.5625167197123, 43.6934015712337], [-79.5640038673633, 43.6930280676695], [-79.5675278373638, 43.692265241807], [-79.5708382592862, 43.69159248871011], [-79.5700177072976, 43.6898043824985], [-79.5693803555609, 43.6882224596102], [-79.5686375567498, 43.6866106307516], [-79.5631767235789, 43.6744777585563], [-79.5676823599195, 43.6741859581037], [-79.5693226793274, 43.6739960013354], [-79.5711117480985, 43.6737159873554], [-79.5785425157414, 43.6727662541851], [-79.5819082034639, 43.6722567123934], [-79.583665164003, 43.6713403830692], [-79.5866606178312, 43.6701859363727], [-79.5910867990462, 43.6685878284164], [-79.5904868648261, 43.6675094771409], [-79.5899612422856, 43.6668231442077], [-79.5887784056154, 43.6646223420356], [-79.5956806091768, 43.6582880278361], [-79.5984101019578, 43.65583422897281], [-79.608734677802, 43.6464513180578], [-79.6081656116201, 43.6458212761433], [-79.607683357736, 43.6449385261636], [-79.6071596410596, 43.6446959453156], [-79.6056082023461, 43.6448328057016], [-79.6050051852386, 43.6444739545067], [-79.6039720753034, 43.6445050263854], [-79.6033406409018, 43.6447127744638], [-79.6024811609222, 43.6445252665423], [-79.6019893568293, 43.6441258475055], [-79.5992188918142, 43.6436891537729], [-79.5983773398603, 43.6431003092407], [-79.5967290709474, 43.6430387152024], [-79.5956284959256, 43.6432061755429], [-79.5950506036744, 43.6434676972857], [-79.5935085048134, 43.6444051206666], [-79.5924526407722, 43.6447165267285], [-79.5918098438861, 43.6446045276568], [-79.5903776118865, 43.6440025861263], [-79.5893067737029, 43.6431483064118], [-79.5887020135614, 43.64282473685691], [-79.5880797675962, 43.6419475930762], [-79.5882173137965, 43.6414569121051], [-79.5873801791213, 43.6406474402513], [-79.5869372782967, 43.6394911099755], [-79.5862870447055, 43.6385014689571], [-79.5856163453577, 43.6377998835857], [-79.5852630927809, 43.6369585274457], [-79.5860533928455, 43.6354457118936], [-79.5859899383431, 43.6349416820917], [-79.5855064722142, 43.6343119567329], [-79.58583355421, 43.6336410903025], [-79.58534645248521, 43.6329033501915], [-79.5850553371865, 43.6316433726355], [-79.5851410858316, 43.6312157427427], [-79.58600336342471, 43.6297381578499], [-79.58599786607452, 43.6294112673719], [-79.5855901572194, 43.62891926008731], [-79.5837396969582, 43.6282913519993], [-79.582414847427, 43.6279503067416], [-79.5817813100068, 43.6279597811136], [-79.5805881674285, 43.6276096009698], [-79.5797062832202, 43.626921621341204], [-79.5767534560018, 43.6261405743158], [-79.5755805807942, 43.6255562647788], [-79.5745086881419, 43.6255299732179], [-79.5736925627655, 43.6259760985179], [-79.5724605976547, 43.6261524223163], [-79.5705696868422, 43.6267927045286], [-79.5697949910604, 43.626982200484], [-79.5685857329421, 43.6267443953196], [-79.5677018983598, 43.6273210206248], [-79.5674377512439, 43.6280052829175], [-79.5668617232265, 43.62821715408], [-79.56479212432691, 43.6281598367137], [-79.5639025479781, 43.6277803164769], [-79.5637603220542, 43.6270261958096], [-79.5605920011032, 43.6277185332125], [-79.5585237484381, 43.6281181835655], [-79.5567688031798, 43.6285327906689], [-79.5581907005935, 43.6321374215886], [-79.5590187235812, 43.6344909591001], [-79.5595857324343, 43.6362382298188], [-79.5524672201532, 43.6379466163366], [-79.5450464411757, 43.6396728433821], [-79.5422270901346, 43.640262222613], [-79.5395563842449, 43.6408929952618], [-79.5353609571934, 43.64179494861], [-79.5385383417625, 43.6490953190808], [-79.539395411824, 43.65097795878631], [-79.540476698974, 43.6535618079735], [-79.5398950352564, 43.6535628855811], [-79.539673252428, 43.653868999867], [-79.5401071604362, 43.654377434029804], [-79.5401566658913, 43.6548094726671], [-79.5390620498129, 43.65521936854], [-79.53816546635362, 43.6551521522389], [-79.5371680133123, 43.6542118753687], [-79.5375193098668, 43.6529065729624], [-79.537155730203, 43.6526276406324], [-79.5355063577207, 43.65250207380801], [-79.5346448805904, 43.6521602415209], [-79.5328816452207, 43.6521426515636], [-79.53240378264921, 43.65186821957371], [-79.53222495518871, 43.6508196027154], [-79.5322862954334, 43.650383019404], [-79.5319850613329, 43.6500365336641], [-79.5309736581818, 43.6501587086168], [-79.5307372725108, 43.6508943726447], [-79.5289987624355, 43.6511714026723], [-79.5279104294814, 43.6509556229256], [-79.5265521608893, 43.6508929189559], [-79.5255610444464, 43.6505330994388], [-79.5247422090145, 43.6499796958682], [-79.5237497775318, 43.6490798331075], [-79.5224017400885, 43.6482693883743], [-79.5214048219589, 43.6491136642889], [-79.5206713024133, 43.649926649333], [-79.520208373706, 43.6506797589968], [-79.5187845071735, 43.6544848937852], [-79.5174834276711, 43.6578684023978], [-79.5159608573265, 43.6584374473708], [-79.51484928636572, 43.6589516461576], [-79.5082499120096, 43.661486263759706], [-79.507193360455, 43.6619248355716], [-79.5055219916522, 43.6628054218342], [-79.5061655884544, 43.6630124017849], [-79.507087751107, 43.6629133065681], [-79.5092899993516, 43.6621209406891], [-79.51024739127061, 43.6619363043415], [-79.51130288457482, 43.66212070537641], [-79.5122116343354, 43.6626336614198], [-79.5125837874867, 43.6633222236746], [-79.5130485756881, 43.6653429632245], [-79.512986576215, 43.666544666736804], [-79.5125291329052, 43.6671433245882], [-79.511786833036, 43.6675935062651], [-79.5112739940851, 43.6682776863479], [-79.5117383380644, 43.6698933876567], [-79.5118691908284, 43.6707845057905], [-79.5122493090987, 43.6721166442307], [-79.5124395570694, 43.6735163028494], [-79.5120475763723, 43.6743219633395], [-79.5112207161894, 43.6749656330835], [-79.5092443740741, 43.67603695826381], [-79.5085201092123, 43.6767526014928], [-79.5072424624144, 43.67926859386441], [-79.5069367167245, 43.67959715183701], [-79.5057624411482, 43.6802363734113], [-79.50546642611312, 43.6809204877818], [-79.5057022156682, 43.68196003781], [-79.5064054101019, 43.6823425112837], [-79.5074484499779, 43.6824323711717], [-79.5084472907873, 43.6823647108813], [-79.5092493182043, 43.6826301424535], [-79.5100111950506, 43.683516689263], [-79.5106474606317, 43.684974960644], [-79.5109746593185, 43.6860757983924], [-79.5116199824212, 43.68747847078931], [-79.5125522883929, 43.6888217984749], [-79.5131128642543, 43.690783928708], [-79.5133132447883, 43.6919828062266], [-79.5132891036969, 43.6933839865311], [-79.512816156095, 43.6942392083436], [-79.5126453906653, 43.6951714100832], [-79.5120285102376, 43.6960855846417], [-79.5119646660839, 43.696694069448], [-79.5122456167362, 43.6969497392804], [-79.5135356370615, 43.6972481755086], [-79.5163391557657, 43.6968006881954], [-79.5171945690155, 43.6968427967643], [-79.5188158132893, 43.6971218243443], [-79.5194862567126, 43.697470655914906], [-79.5203151577485, 43.6982495819289], [-79.5206910088955, 43.698751849237], [-79.5210425465488, 43.6995299010764], [-79.5214336140373, 43.69986916779641], [-79.5233284770577, 43.7006850690794], [-79.5255772442768, 43.7014203167337], [-79.5259742600834, 43.7015979484891]]] }, "properties": { "_id": 717, "AREA_ID": 2457724, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993180, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 2, "AREA_LONG_CODE": 2, "AREA_NAME": "Etobicoke Centre", "AREA_DESC": "Etobicoke Centre (2)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345041, "Shape__Area": 71410521.4023438, "Shape__Length": 45328.6431346332 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4646206444876, 43.6921556119541], [-79.4630531790546, 43.6928428599805], [-79.45852825390752, 43.6938441239507], [-79.4515724271389, 43.695418108866704], [-79.4502789805454, 43.6956920028916], [-79.44025595536772, 43.6978456674863], [-79.4383244817957, 43.698276523348305], [-79.4299028501137, 43.7000633116904], [-79.4276123994154, 43.7005666040414], [-79.419884215513, 43.7021857657636], [-79.4132319388084, 43.7036120588724], [-79.4037502206298, 43.7056026882376], [-79.4002822433353, 43.7063511777225], [-79.3983665000037, 43.7067319904649], [-79.3989974316929, 43.7095833507147], [-79.40010896802282, 43.7149488281025], [-79.4011419122536, 43.719547306134], [-79.4021952907712, 43.7251017926697], [-79.4032939870537, 43.7291580918882], [-79.4045311142273, 43.7341706849335], [-79.4051401344049, 43.7369793764915], [-79.406251643319, 43.7418582436851], [-79.4064978759447, 43.7433035454409], [-79.4068603972384, 43.7446521150863], [-79.4070357719152, 43.7456878291731], [-79.4081097503073, 43.7497935450057], [-79.4081687335567, 43.7503605601952], [-79.4080884844505, 43.7519246074708], [-79.408388704346, 43.7536163537944], [-79.4114492180327, 43.751653633058], [-79.4141373872663, 43.7499296405487], [-79.4153777629284, 43.748865642121906], [-79.4176528567426, 43.7462370430891], [-79.4182498616409, 43.7457416490059], [-79.4198604902038, 43.744645190955], [-79.4266625320039, 43.7403069953391], [-79.431046793689, 43.7377020795955], [-79.4362636370212, 43.7346462572346], [-79.4399231952323, 43.7325258213692], [-79.4413598288712, 43.7318676772703], [-79.4423825633705, 43.7314932150404], [-79.4437087383412, 43.7311183624022], [-79.4492751842417, 43.7299282236442], [-79.466145437156, 43.7262810607126], [-79.4700386791348, 43.725465779889], [-79.4725666844142, 43.7248699022048], [-79.470109249994, 43.7124168531092], [-79.4688363649464, 43.706090340875704], [-79.4679722833845, 43.7026627762265], [-79.4665453148825, 43.6977590448909], [-79.4654991432383, 43.6939894890229], [-79.465029749493, 43.6928251551261], [-79.4646206444876, 43.6921556119541]]] }, "properties": { "_id": 718, "AREA_ID": 2457723, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993179, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 8, "AREA_LONG_CODE": 8, "AREA_NAME": "Eglinton-Lawrence", "AREA_DESC": "Eglinton-Lawrence (8)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345057, "Shape__Area": 43406745.9609375, "Shape__Length": 28793.624012969103 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.38715209799, 43.763311731433106], [-79.3797418238159, 43.7648736927255], [-79.376746017903, 43.7653997437088], [-79.3751323283503, 43.76562550594], [-79.3715811133045, 43.7659373594165], [-79.3629278029548, 43.7663407333661], [-79.3507455918096, 43.766896391932], [-79.3406259294097, 43.7674917755767], [-79.3371010706156, 43.7677292347837], [-79.32887196645511, 43.7682233010623], [-79.3244750260462, 43.7683485543955], [-79.3197941465542, 43.7683633049312], [-79.3209779918419, 43.7707501875879], [-79.3242315376932, 43.7778750406544], [-79.3272251961383, 43.7842432223519], [-79.330787882511, 43.7917643710237], [-79.3318284859423, 43.7940161724994], [-79.3351201214223, 43.801374628035], [-79.3353840702956, 43.8020050779449], [-79.3384124880604, 43.8087513966747], [-79.3397894183636, 43.8120928177632], [-79.3413178929128, 43.81565075423731], [-79.3422010596824, 43.8154179844849], [-79.3485557932883, 43.8139697808004], [-79.3519658922389, 43.813215950828], [-79.3575556725031, 43.8119179303512], [-79.3645757810187, 43.810309406576], [-79.3677550711533, 43.8095983065908], [-79.3717562163925, 43.8086516200708], [-79.3725082420786, 43.8085079576189], [-79.3819043429221, 43.8064035656288], [-79.38486321341742, 43.8057742114416], [-79.3894001690219, 43.8047607917959], [-79.39623005788661, 43.8032701311798], [-79.395812180754, 43.801872201101204], [-79.3953798353624, 43.7999527398002], [-79.394227231636, 43.7951251930779], [-79.3935963878887, 43.7922977653692], [-79.3921089600341, 43.7847640261134], [-79.39120878258, 43.7806331655169], [-79.3897839574707, 43.7743335179971], [-79.3895832658445, 43.7734759632987], [-79.3893860928262, 43.7725456100829], [-79.3891868688771, 43.77165293328], [-79.3885776057336, 43.7690555301608], [-79.3880562118249, 43.7665892748458], [-79.38715209799, 43.763311731433106]]] }, "properties": { "_id": 719, "AREA_ID": 2457722, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993178, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 17, "AREA_LONG_CODE": 17, "AREA_NAME": "Don Valley North", "AREA_DESC": "Don Valley North (17)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345073, "Shape__Area": 46882591.9140625, "Shape__Length": 27888.8175228336 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.3330914324973, 43.7033709024658], [-79.3327837966381, 43.7053101014183], [-79.3322054245165, 43.7058544069144], [-79.3314196113292, 43.70625867695], [-79.3301704617418, 43.7063617736705], [-79.3292447418563, 43.7072413578532], [-79.3285240249072, 43.7077534322891], [-79.3276467762721, 43.7080399554753], [-79.32625526402691, 43.7082184142758], [-79.3251904345109, 43.708815276039], [-79.324850658126, 43.7095710783109], [-79.3230921862928, 43.7102054258274], [-79.3209553699854, 43.7102875657469], [-79.319217427686, 43.7107798817847], [-79.3185820742291, 43.7112244466922], [-79.3185750144187, 43.7115079752649], [-79.319185347287, 43.7124360903314], [-79.3199481143287, 43.7125678306704], [-79.3206783545156, 43.712280965255], [-79.321358013108, 43.7122554667641], [-79.3215911826241, 43.7126030455862], [-79.3206527784705, 43.7134421147331], [-79.3203014590988, 43.713954724745705], [-79.3207280901187, 43.7140588461249], [-79.320882557995, 43.7145780558243], [-79.3202486417874, 43.7146071789126], [-79.3200117067112, 43.7148543406514], [-79.3200740071906, 43.7155584000227], [-79.3195020581948, 43.7156321727074], [-79.306793438146, 43.7184156665213], [-79.3044687444519, 43.7189068722779], [-79.3005925599442, 43.719785826787], [-79.3016556339878, 43.7222731637887], [-79.3026450183565, 43.7247230254748], [-79.3045078328946, 43.7291909126082], [-79.3093483452118, 43.7409191071266], [-79.310029396735, 43.74272051099], [-79.3114143506855, 43.7467284328825], [-79.3132628277443, 43.7522133081246], [-79.3152454343223, 43.7578694237401], [-79.3172400603424, 43.7623798302727], [-79.3175317247447, 43.7630209373757], [-79.3185961859286, 43.7654216440876], [-79.3193753882357, 43.7674347579502], [-79.3197941465542, 43.7683633049312], [-79.3244750260462, 43.7683485543955], [-79.32887196645511, 43.7682233010623], [-79.3371010706156, 43.7677292347837], [-79.3406259294097, 43.7674917755767], [-79.3507455918096, 43.766896391932], [-79.3629278029548, 43.7663407333661], [-79.3622782549691, 43.765455973894], [-79.3619440085579, 43.7645558308108], [-79.3619159069717, 43.7616917468028], [-79.3616532313565, 43.7603025102689], [-79.3612699273421, 43.758721050077405], [-79.3599702259251, 43.7529544978379], [-79.3587251175452, 43.7470832814591], [-79.35735796006011, 43.7404906437303], [-79.3568836019381, 43.7383123947843], [-79.3558333646959, 43.733823181411], [-79.3557111435612, 43.7332576870295], [-79.355272524315, 43.731730217815], [-79.3548550317409, 43.7309727838322], [-79.3543052483291, 43.7303141122363], [-79.3522331577934, 43.7281418305163], [-79.351426136026, 43.72738591358301], [-79.3499549896187, 43.72619818663501], [-79.3493010260647, 43.7254024177426], [-79.348967565935, 43.7247351296184], [-79.3488224387122, 43.7236079101053], [-79.3491445619983, 43.722300481779804], [-79.35018873754632, 43.71951824604], [-79.3504272110557, 43.7184804800259], [-79.3503340155183, 43.7177742727645], [-79.3499797944943, 43.7170987413729], [-79.3526276415439, 43.7162332047491], [-79.3523211689513, 43.7157348777119], [-79.3510806172482, 43.7156986673793], [-79.3500202816837, 43.7158578544335], [-79.3498868155188, 43.7160303323287], [-79.3489195159251, 43.7163104551611], [-79.3466048259545, 43.716058226541], [-79.3462041596096, 43.7152700061857], [-79.3457945651835, 43.7150735869838], [-79.3449448086809, 43.7152190049102], [-79.3444637036485, 43.7145464163791], [-79.3434426251721, 43.7140803504385], [-79.3428587112222, 43.7133543717086], [-79.3414781838446, 43.7127820465916], [-79.3407569241113, 43.7126931557328], [-79.3402129635135, 43.7130042903122], [-79.3395280156406, 43.7127934843732], [-79.3394939779139, 43.7124861245228], [-79.3402897783158, 43.7116957492328], [-79.340052512426, 43.7110527272754], [-79.3394429568307, 43.7107128040811], [-79.3393878091822, 43.7101374017687], [-79.338258509252, 43.7095170713888], [-79.3379109060016, 43.7088807115245], [-79.3358796637445, 43.7094325881664], [-79.3350937816921, 43.7098267476798], [-79.3343949847785, 43.7099964553998], [-79.3338437318838, 43.7085062698606], [-79.3337008164375, 43.7075795794753], [-79.3337099880079, 43.7066408323834], [-79.3342185704537, 43.7040572697499], [-79.3346939799612, 43.7030774853307], [-79.33343560226031, 43.7030664592728], [-79.3330914324973, 43.7033709024658]]] }, "properties": { "_id": 720, "AREA_ID": 2457721, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993177, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 16, "AREA_LONG_CODE": 16, "AREA_NAME": "Don Valley East", "AREA_DESC": "Don Valley East (16)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345089, "Shape__Area": 44017098.9648438, "Shape__Length": 30862.9870733169 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4293964137968, 43.670972707104006], [-79.4309834971531, 43.67472270139161], [-79.4302261813582, 43.6747352755612], [-79.4318309860072, 43.6786087374875], [-79.4326971769691, 43.6807965882232], [-79.4329795684655, 43.6809709925509], [-79.4338158053278, 43.6830246698281], [-79.4333068305918, 43.6833441005053], [-79.4337822066276, 43.6845003068423], [-79.43377713560511, 43.6849043725654], [-79.4346396357324, 43.6870982979164], [-79.4358169158062, 43.6868948064494], [-79.4382584452398, 43.6863629590337], [-79.4386937707147, 43.6871340019649], [-79.4406263415209, 43.6867093774743], [-79.4439721378385, 43.6860344203186], [-79.4461172265153, 43.6855663935808], [-79.4489548896469, 43.6925461788247], [-79.4502789805454, 43.6956920028916], [-79.4515724271389, 43.695418108866704], [-79.45852825390752, 43.6938441239507], [-79.4630531790546, 43.6928428599805], [-79.4646206444876, 43.6921556119541], [-79.4637604148868, 43.6907453434114], [-79.4629324999454, 43.6889762777141], [-79.461833752889, 43.6846823933359], [-79.4612985347611, 43.6832389166322], [-79.4665429158658, 43.6820568816036], [-79.4674484442923, 43.6818869372582], [-79.4676043950252, 43.6817118880485], [-79.4664530229404, 43.6806018741342], [-79.4705581756293, 43.6796952496402], [-79.4695233182969, 43.67687365058], [-79.4687075356506, 43.6761409567622], [-79.4661436402339, 43.6734251751952], [-79.4600458827451, 43.6672259620873], [-79.4498705732511, 43.6568753864178], [-79.44404972012, 43.6509155885405], [-79.4422439897742, 43.6493845400506], [-79.440799286143, 43.648371165624], [-79.4388843845511, 43.6473035501615], [-79.4365361704554, 43.6461906828553], [-79.4344320526108, 43.6452442076641], [-79.4282100821178, 43.6423113693663], [-79.4266987608462, 43.6416078440176], [-79.4243860867713, 43.6409855668681], [-79.4226733486885, 43.6407054775233], [-79.4213971910843, 43.6406113979274], [-79.4214164277034, 43.640820387101904], [-79.4224102955295, 43.6434915575894], [-79.4247515152879, 43.6494378865496], [-79.4207821526692, 43.6493340834881], [-79.4223536939668, 43.65350375421081], [-79.425659480152, 43.6619849168039], [-79.4275714482316, 43.6665208027825], [-79.4293964137968, 43.670972707104006]]] }, "properties": { "_id": 721, "AREA_ID": 2457720, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993176, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 9, "AREA_LONG_CODE": 9, "AREA_NAME": "Davenport", "AREA_DESC": "Davenport (9)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345105, "Shape__Area": 23129406.894531302, "Shape__Length": 24054.749603152402 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.3597108499133, 43.6704618791026], [-79.3604877711873, 43.670030901185406], [-79.3612611669296, 43.6700543367832], [-79.361707163492, 43.6702394044539], [-79.365865786904, 43.6716443633414], [-79.3677565359953, 43.6716872883271], [-79.3685295006808, 43.6719078753035], [-79.36912588118521, 43.672265084164], [-79.3704029794067, 43.6726681873031], [-79.3736124168794, 43.6729405604069], [-79.374422861228, 43.67304680509831], [-79.3755127139894, 43.6730182927934], [-79.3771450315158, 43.673147823563], [-79.3768542862929, 43.6723585535877], [-79.379468072457, 43.6718257155842], [-79.37937257874731, 43.6712592333632], [-79.3799057240718, 43.6699739729667], [-79.3843306464514, 43.6690191653021], [-79.3856034277011, 43.6687418819131], [-79.3861602636501, 43.6687422757801], [-79.38886911734551, 43.6681966792186], [-79.38772398934121, 43.6656448971218], [-79.386127321637, 43.6617926077787], [-79.3858549461133, 43.6608156633898], [-79.3831103705459, 43.6613718103314], [-79.3827961686227, 43.660583357971], [-79.3813699642643, 43.6574159511334], [-79.3809264046243, 43.6563287749711], [-79.3837661930223, 43.6557159692698], [-79.3823360419431, 43.6521516709262], [-79.3815498064014, 43.6517030684006], [-79.3808101970891, 43.6498927202986], [-79.3791349753174, 43.6459870607196], [-79.3780335161361, 43.6462294228396], [-79.3769743175951, 43.6468847935012], [-79.3765030771403, 43.6457838773097], [-79.3733125752073, 43.6472572672328], [-79.3717413242899, 43.6480415953011], [-79.3684924704294, 43.6487714791228], [-79.3623094689756, 43.6502002672523], [-79.3621413294392, 43.650197319193], [-79.3573920382912, 43.6513298410318], [-79.3526160273598, 43.6524418238029], [-79.3520129294318, 43.6525014437518], [-79.35119065181091, 43.6531282478933], [-79.3509666963745, 43.6537104158205], [-79.3503832959599, 43.6536700747899], [-79.3501806346631, 43.6531829170711], [-79.3495236876076, 43.6535994380291], [-79.3517417941799, 43.6555656754336], [-79.3535339763437, 43.6570467996008], [-79.3542050943883, 43.6576642319021], [-79.354395626334, 43.6580290293437], [-79.3547323157895, 43.6593121676191], [-79.3563478447871, 43.6646653897439], [-79.3573207284055, 43.6681907476975], [-79.3578058754617, 43.6690149650072], [-79.3593294713202, 43.6700564946546], [-79.3597108499133, 43.6704618791026]]] }, "properties": { "_id": 722, "AREA_ID": 2457719, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993175, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 13, "AREA_LONG_CODE": 13, "AREA_NAME": "Toronto Centre", "AREA_DESC": "Toronto Centre (13)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345121, "Shape__Area": 11208160.4492188, "Shape__Length": 14958.0646795112 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4646206444876, 43.6921556119541], [-79.465029749493, 43.6928251551261], [-79.4654991432383, 43.6939894890229], [-79.4665453148825, 43.6977590448909], [-79.4679722833845, 43.7026627762265], [-79.4688363649464, 43.706090340875704], [-79.470109249994, 43.7124168531092], [-79.4725666844142, 43.7248699022048], [-79.4882899842869, 43.7210262087651], [-79.4894098913557, 43.7207258202844], [-79.4914106264141, 43.720290147594], [-79.4997777501461, 43.718795623187], [-79.5020820091586, 43.7184122410568], [-79.5078301632192, 43.717755170299], [-79.5156320373104, 43.7168737677625], [-79.5247120595825, 43.7159100930063], [-79.5268433682294, 43.7155355290775], [-79.53221059328, 43.7143278208681], [-79.5378418799993, 43.7129901010899], [-79.5379419348259, 43.7123959575792], [-79.5384026353576, 43.7118197048526], [-79.5391274678259, 43.7113783880766], [-79.5395981412305, 43.7107121143573], [-79.5393259690637, 43.7096590421179], [-79.5389018828899, 43.7089999793716], [-79.5381279302365, 43.70848801394181], [-79.5374125248112, 43.7082610762941], [-79.5362940583394, 43.7083367145174], [-79.5356588659721, 43.7078940159504], [-79.5354427499811, 43.7067796807862], [-79.5356002722633, 43.7056904598077], [-79.5359501435472, 43.7049921304565], [-79.5359612062898, 43.7045893739186], [-79.535437127193, 43.7044806131583], [-79.5331706313042, 43.7050070848393], [-79.5321907533139, 43.7049668682554], [-79.5311573120798, 43.7047826284806], [-79.5307411292849, 43.70458470410501], [-79.529715144469, 43.70382434958691], [-79.529170833521, 43.703253529775], [-79.5285699277462, 43.7024152124689], [-79.5277357268606, 43.702230486646], [-79.526091989064, 43.7016506151712], [-79.5255772442768, 43.7014203167337], [-79.5233284770577, 43.7006850690794], [-79.5214336140373, 43.69986916779641], [-79.5210425465488, 43.6995299010764], [-79.5206910088955, 43.698751849237], [-79.5203151577485, 43.6982495819289], [-79.5194862567126, 43.697470655914906], [-79.5188158132893, 43.6971218243443], [-79.5171945690155, 43.6968427967643], [-79.5163391557657, 43.6968006881954], [-79.5135356370615, 43.6972481755086], [-79.5122456167362, 43.6969497392804], [-79.5119646660839, 43.696694069448], [-79.5120285102376, 43.6960855846417], [-79.5126453906653, 43.6951714100832], [-79.512816156095, 43.6942392083436], [-79.5132891036969, 43.6933839865311], [-79.5133132447883, 43.6919828062266], [-79.5131128642543, 43.690783928708], [-79.5125522883929, 43.6888217984749], [-79.5116199824212, 43.68747847078931], [-79.5109746593185, 43.6860757983924], [-79.5106474606317, 43.684974960644], [-79.5100111950506, 43.683516689263], [-79.5092493182043, 43.6826301424535], [-79.5084472907873, 43.6823647108813], [-79.5074484499779, 43.6824323711717], [-79.5064054101019, 43.6823425112837], [-79.5057022156682, 43.68196003781], [-79.50546642611312, 43.6809204877818], [-79.5057624411482, 43.6802363734113], [-79.5069367167245, 43.67959715183701], [-79.5072424624144, 43.67926859386441], [-79.5085201092123, 43.6767526014928], [-79.5092443740741, 43.67603695826381], [-79.5112207161894, 43.6749656330835], [-79.5120475763723, 43.6743219633395], [-79.5124395570694, 43.6735163028494], [-79.5122493090987, 43.6721166442307], [-79.5118691908284, 43.6707845057905], [-79.5117383380644, 43.6698933876567], [-79.5112739940851, 43.6682776863479], [-79.511786833036, 43.6675935062651], [-79.5125291329052, 43.6671433245882], [-79.512986576215, 43.666544666736804], [-79.5130485756881, 43.6653429632245], [-79.5125837874867, 43.6633222236746], [-79.5122116343354, 43.6626336614198], [-79.5111450741051, 43.663547496527], [-79.50998125987792, 43.6643262829786], [-79.5087813515432, 43.6648935018018], [-79.507619382975, 43.6652221520005], [-79.50562352908182, 43.66547434106781], [-79.5002179127562, 43.6658076636786], [-79.4914429435288, 43.6662911474469], [-79.4826414064519, 43.6668272504568], [-79.4805276749425, 43.6669853964486], [-79.4749769499394, 43.6672932419678], [-79.4728846153158, 43.6673553150798], [-79.4661518376909, 43.6672683761419], [-79.465363725387, 43.667296755306], [-79.4600458827451, 43.6672259620873], [-79.4661436402339, 43.6734251751952], [-79.4687075356506, 43.6761409567622], [-79.4695233182969, 43.67687365058], [-79.4705581756293, 43.6796952496402], [-79.4664530229404, 43.6806018741342], [-79.4676043950252, 43.6817118880485], [-79.4674484442923, 43.6818869372582], [-79.4665429158658, 43.6820568816036], [-79.4612985347611, 43.6832389166322], [-79.461833752889, 43.6846823933359], [-79.4629324999454, 43.6889762777141], [-79.4637604148868, 43.6907453434114], [-79.4646206444876, 43.6921556119541]]] }, "properties": { "_id": 723, "AREA_ID": 2457718, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993174, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 5, "AREA_LONG_CODE": 5, "AREA_NAME": "York South-Weston", "AREA_DESC": "York South-Weston (5)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345137, "Shape__Area": 47807729.9414063, "Shape__Length": 34744.1176803513 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.31492459201341, 43.6619658989816], [-79.3148681478337, 43.6622739414704], [-79.31757755342511, 43.668701848131], [-79.3183863164117, 43.6707328364946], [-79.3202036570495, 43.6750652109883], [-79.3218411831007, 43.6791093392087], [-79.32559525655701, 43.6880499516796], [-79.3261985788728, 43.6896731746276], [-79.3280183000274, 43.6941365360735], [-79.3287818995071, 43.6959416036837], [-79.329556600972, 43.6979385625621], [-79.3295965399394, 43.6982704634436], [-79.3289256708713, 43.6990794508328], [-79.32709986130472, 43.701504367047], [-79.327362414431, 43.7014370742688], [-79.3289542135835, 43.7015382023136], [-79.3296527463287, 43.7016691158952], [-79.3302864130642, 43.7015685240519], [-79.3313033230546, 43.7016569817106], [-79.3318188011953, 43.7019854148348], [-79.3321194840694, 43.7030365489097], [-79.3330914324973, 43.7033709024658], [-79.33343560226031, 43.7030664592728], [-79.3346939799612, 43.7030774853307], [-79.3354178284738, 43.7031996690207], [-79.3365886334937, 43.7027143437305], [-79.3372519654418, 43.7021597132627], [-79.3390873109582, 43.701261139675], [-79.3404848838388, 43.6999898584467], [-79.34184296375102, 43.6992400485331], [-79.3428717603532, 43.6990249955192], [-79.3437488900331, 43.6984907115313], [-79.344452660439, 43.698264442969], [-79.3454643289574, 43.6983560980347], [-79.3466074310952, 43.6989454665369], [-79.347344355544, 43.6991507551844], [-79.348369420045, 43.699930712451], [-79.349381895934, 43.6999810540165], [-79.3501239659486, 43.6998628344381], [-79.3510982916581, 43.6988703032065], [-79.3514742383015, 43.6987330366743], [-79.3527501527903, 43.698599326122], [-79.3535263553282, 43.6983531931389], [-79.354659126594, 43.6982289181291], [-79.3550205923027, 43.6980465430698], [-79.3560022937927, 43.6970622422423], [-79.35620260299, 43.6961540035203], [-79.3569281630571, 43.6954248824872], [-79.3576620094105, 43.6952708054492], [-79.3588350021532, 43.6955456742125], [-79.3599967328217, 43.6953068405967], [-79.3606512266121, 43.6949474447503], [-79.3616687237251, 43.6941791963243], [-79.3617634848387, 43.6934792895321], [-79.361254522401, 43.69277662608701], [-79.3600633618551, 43.6919948339184], [-79.3600546991794, 43.6912922992574], [-79.3616756627984, 43.6888553797722], [-79.3621680058351, 43.6884665602725], [-79.3625634908512, 43.6880065929483], [-79.3623818658898, 43.6871987416797], [-79.361734106836, 43.6859526207483], [-79.3616529398897, 43.6855353030927], [-79.3618502488393, 43.6847291237982], [-79.3620935417814, 43.6843735329363], [-79.3633904006036, 43.683212067244], [-79.3646530867365, 43.6827410275896], [-79.3658303100122, 43.6819908330589], [-79.3663684190196, 43.6813973948914], [-79.3661084007488, 43.6806905146653], [-79.3644311643571, 43.679410378339], [-79.3637314492195, 43.67879746595711], [-79.36359511001, 43.6780636961135], [-79.3641068310927, 43.6774792290063], [-79.3648318516554, 43.6770075194399], [-79.3649564974, 43.6767286258956], [-79.3633907880318, 43.6753226406503], [-79.3628797706027, 43.6743994203713], [-79.3630429912276, 43.6736884935503], [-79.3629509953311, 43.6732428267766], [-79.3615664294586, 43.6726831033154], [-79.3605255527314, 43.6719707333508], [-79.3601300580848, 43.6713896555625], [-79.3597108499133, 43.6704618791026], [-79.3593294713202, 43.6700564946546], [-79.3578058754617, 43.6690149650072], [-79.3573207284055, 43.6681907476975], [-79.3563478447871, 43.6646653897439], [-79.3547323157895, 43.6593121676191], [-79.354395626334, 43.6580290293437], [-79.3542050943883, 43.6576642319021], [-79.3535339763437, 43.6570467996008], [-79.3517417941799, 43.6555656754336], [-79.3495236876076, 43.6535994380291], [-79.347731009249, 43.6514226695539], [-79.3472969332, 43.6507487979107], [-79.3476541079523, 43.6504189245783], [-79.3543455109449, 43.647647800631304], [-79.3598538981138, 43.6452985787937], [-79.3536843702146, 43.6380668863781], [-79.349647800299, 43.6333942966004], [-79.3470841780091, 43.6332016059977], [-79.3470266114685, 43.6341693850197], [-79.3465624133464, 43.6347238333161], [-79.3455101015291, 43.6349925025937], [-79.3450633225912, 43.63554141440561], [-79.3442017217549, 43.6362101083082], [-79.3432444747351, 43.6372351101977], [-79.3424166310304, 43.6377223779156], [-79.3416016259929, 43.6380022656124], [-79.3415816912667, 43.6384052207194], [-79.3406485042618, 43.6391130522775], [-79.3392089114386, 43.6393790615108], [-79.3374115608223, 43.6393995538672], [-79.336505510174, 43.6392087826524], [-79.3363890654187, 43.6394146125684], [-79.337354787119, 43.6400687074356], [-79.3373730147543, 43.6403415200555], [-79.333860426318, 43.6435590865656], [-79.33353244923, 43.6439501870299], [-79.3323361884113, 43.6449565830771], [-79.3309579742482, 43.64588161319891], [-79.3304531607182, 43.6465874098193], [-79.3288741482392, 43.6474135336154], [-79.3282119453724, 43.6476351891416], [-79.3272952018116, 43.6472410063068], [-79.3273884135604, 43.6470481038289], [-79.325800593322, 43.6468412022612], [-79.3255964955847, 43.6465671955592], [-79.3253599461881, 43.6456348059853], [-79.3268227780294, 43.6439759009155], [-79.3272959249159, 43.6439988770911], [-79.3282398347998, 43.6443511545787], [-79.3271611845698, 43.6432783028154], [-79.3272042501182, 43.642493799409], [-79.3275973881499, 43.642165851905], [-79.3274119591344, 43.6417681795085], [-79.3276805151202, 43.641191974666], [-79.3286629356806, 43.6408621917629], [-79.3285605537321, 43.6406277324881], [-79.3289066198997, 43.6401129762354], [-79.3298737653115, 43.6398028100017], [-79.3297294630232, 43.6394541698845], [-79.33008223325331, 43.6389602851425], [-79.3308597316998, 43.6388019607439], [-79.3302970005994, 43.6382686592393], [-79.330233889721, 43.637885790901606], [-79.3294780297447, 43.6370577451663], [-79.3289181820838, 43.6372611410133], [-79.3285871381835, 43.6376724402304], [-79.32886084202092, 43.6381104703536], [-79.3277269283793, 43.6392155316113], [-79.32679021250141, 43.6403573179261], [-79.3262423382625, 43.640284466486506], [-79.3250550957606, 43.639904588982006], [-79.3247525300767, 43.6401966792577], [-79.3262970315575, 43.6407976459734], [-79.3253275311595, 43.6422724659406], [-79.3244607095134, 43.6442470560163], [-79.3245811308147, 43.644395772453706], [-79.3243223243259, 43.6452055431525], [-79.3216831921554, 43.6448233544955], [-79.3217441104305, 43.6437477409237], [-79.3219464505958, 43.6433024704398], [-79.3223589772359, 43.6414622506756], [-79.32262350268411, 43.6412061132798], [-79.3225997070174, 43.6404724283468], [-79.3229948908432, 43.6389787674924], [-79.3229740717941, 43.638281110475106], [-79.3234019327958, 43.637530130094206], [-79.3244682208688, 43.6364560893693], [-79.3253276037919, 43.6358810742333], [-79.3261823206466, 43.6355776802128], [-79.326323065381, 43.6350039209308], [-79.3269562490307, 43.6348853697679], [-79.3275071433981, 43.634505110735], [-79.3281023198986, 43.634352425617], [-79.3290936972304, 43.6336251058755], [-79.3289487962915, 43.6334418639751], [-79.3277084452712, 43.6342933326779], [-79.3266108316821, 43.6346015638297], [-79.32622049962201, 43.6345731838626], [-79.3256244057232, 43.6342178106398], [-79.32572562674021, 43.6333667399743], [-79.3263739077301, 43.6327122274393], [-79.3266052796253, 43.6318730101644], [-79.3275561126911, 43.6317170141175], [-79.3290061322984, 43.6320892212866], [-79.3292035037432, 43.6324072923387], [-79.3285844273131, 43.6331847786892], [-79.3293831957036, 43.6332937382186], [-79.32998140526901, 43.632854920726], [-79.3305626008862, 43.6327786147339], [-79.3314437798015, 43.6322759386911], [-79.3333007585769, 43.6315762652688], [-79.3345596251782, 43.6316058543014], [-79.3348951673093, 43.6308778389293], [-79.335422797924, 43.6306304314071], [-79.3359628745652, 43.6300701059279], [-79.3363385204461, 43.6299209061776], [-79.3364513008172, 43.6293322054981], [-79.3358917740454, 43.6294025866631], [-79.3349830614324, 43.62972053095], [-79.33451354032, 43.6294591539171], [-79.3337222407961, 43.6296587547558], [-79.3339052281057, 43.6301842609777], [-79.3336950714572, 43.6305146755562], [-79.3327926120402, 43.6306945751394], [-79.3319513698197, 43.630486282617], [-79.3313482329035, 43.6312604231127], [-79.3300345457354, 43.6312851846316], [-79.328908422377, 43.6309421090871], [-79.3286560486503, 43.6306714463554], [-79.3287876166359, 43.6301661433687], [-79.3292435504106, 43.6295645871849], [-79.329974945967, 43.62832787773531], [-79.3306515132317, 43.6281467477685], [-79.3308492022729, 43.6278065446872], [-79.331517807986, 43.6272695906285], [-79.3315805914334, 43.6266014824787], [-79.3309897529194, 43.6261253097238], [-79.3313555774849, 43.6258147256557], [-79.3322265420183, 43.6260853200143], [-79.3339710921172, 43.6257502605408], [-79.3344371973938, 43.6251408937228], [-79.3348707911519, 43.6252512569088], [-79.3354287838893, 43.6256886293848], [-79.3357581060723, 43.62634620504651], [-79.3349060993867, 43.6270831013439], [-79.3349891919605, 43.6274297750582], [-79.3359035117825, 43.6275706037818], [-79.3368915575573, 43.627513508705], [-79.3373229209847, 43.6278201707963], [-79.3374999134038, 43.6283956116437], [-79.3373629281092, 43.6288106601461], [-79.3376888162201, 43.62907764556711], [-79.3381812243305, 43.6288909076188], [-79.3392322358007, 43.6294078372707], [-79.3393981480706, 43.6291825585783], [-79.3383835507847, 43.6277392313817], [-79.3373110383427, 43.6259221463885], [-79.3370274086909, 43.6248351385179], [-79.33740015611652, 43.6238587112745], [-79.3380326139952, 43.6231649438888], [-79.337374918295, 43.6229153284272], [-79.3384873399966, 43.6221595363892], [-79.3390115107339, 43.6222319809261], [-79.339161426569, 43.6225573316491], [-79.3388571840937, 43.6229741182391], [-79.3396097117367, 43.623033730633], [-79.3405277108482, 43.6237678370521], [-79.3412178868486, 43.6236716456115], [-79.3416777456026, 43.6233687741226], [-79.3423796091585, 43.6232310953807], [-79.3432344269939, 43.6233447162971], [-79.3428347489434, 43.622828810212], [-79.3422360369061, 43.6228607776569], [-79.3411391989793, 43.6224452301851], [-79.3411221698346, 43.6220703970569], [-79.3405803443428, 43.6216497542414], [-79.34005997228611, 43.621487002106], [-79.3396461178413, 43.6208653343598], [-79.3400475101268, 43.6201772980604], [-79.3412294740746, 43.6194993304094], [-79.3421277413767, 43.6193610525774], [-79.3427135566293, 43.6195148840088], [-79.3429773710666, 43.6212232366563], [-79.3434597076405, 43.6222033680206], [-79.3442721646349, 43.622291683246], [-79.3450538310093, 43.6217728242428], [-79.3439426490108, 43.6211306287514], [-79.3433797330289, 43.6203484108326], [-79.3434448195243, 43.6197229111562], [-79.3437323105789, 43.6192253105727], [-79.3446723472034, 43.6184277705781], [-79.3447671714516, 43.6180265894926], [-79.3443590291302, 43.6177169441079], [-79.34376564219, 43.6167266004795], [-79.3436935427512, 43.6153315168002], [-79.3441227420691, 43.6132564751468], [-79.343429071726, 43.6127320857254], [-79.3429669117922, 43.6128207459115], [-79.3420597776082, 43.6144584023877], [-79.3416197885125, 43.614869194396], [-79.3409495584595, 43.615131060224805], [-79.3396758250552, 43.6168383704989], [-79.3382264009126, 43.6183248200218], [-79.3370970425623, 43.6191421195379], [-79.3360743029468, 43.6194281535854], [-79.3348525977942, 43.619440122388], [-79.3345505589243, 43.6198750837693], [-79.3338918170561, 43.6201362404961], [-79.33242558036092, 43.6204180140228], [-79.330670153293, 43.6203319303372], [-79.3295189280927, 43.6200946255365], [-79.3279672674898, 43.6194542903096], [-79.3277216958384, 43.6189111715703], [-79.3272018033815, 43.6188435874672], [-79.3267084030688, 43.6195651226399], [-79.3267901812287, 43.6201079954423], [-79.3286572105745, 43.6213233614034], [-79.3286438619714, 43.6216737660909], [-79.327696960954, 43.6219194404004], [-79.3260338305603, 43.6220832045753], [-79.3254776888541, 43.6219833414719], [-79.3248263847073, 43.6215817828322], [-79.3248845929051, 43.6209637995216], [-79.3251555283279, 43.6204875717626], [-79.32505447721822, 43.6194217945645], [-79.3256483110724, 43.6185180601771], [-79.326311035938, 43.6181190823327], [-79.3270326894333, 43.6179798084781], [-79.3270670662252, 43.6174714697997], [-79.3253126127107, 43.6177917910103], [-79.3240545214764, 43.6172695080947], [-79.323493651046, 43.6176334887123], [-79.3241095668156, 43.6181331431487], [-79.3242560946832, 43.6188759847886], [-79.32406183249601, 43.6208469942152], [-79.3238452630205, 43.6216605497696], [-79.3233650781778, 43.6221422751132], [-79.3229393481247, 43.6222846308309], [-79.3219490895433, 43.622251182839], [-79.3219019480852, 43.6226061337563], [-79.3227405919017, 43.6227682022517], [-79.3231239600726, 43.6230743486529], [-79.323142770218, 43.6239913235329], [-79.3228161494472, 43.6253171380315], [-79.3224278525611, 43.625658156627], [-79.3215053519029, 43.6257773117178], [-79.3215690469099, 43.6260654468798], [-79.3224631054949, 43.6262142007181], [-79.3227014639448, 43.6266968654887], [-79.3223448369289, 43.6288197769054], [-79.3221133863664, 43.6291275436735], [-79.3212923609862, 43.629213351637404], [-79.3211901692596, 43.629474439253], [-79.3222039203049, 43.6297004161018], [-79.3223687653645, 43.6300992359756], [-79.3220489671936, 43.6322289084507], [-79.3218906755739, 43.632744450442], [-79.32103201620451, 43.6330713449826], [-79.3209205517072, 43.6333391146934], [-79.3225139696581, 43.6339809771004], [-79.3231122208066, 43.6344600039072], [-79.323165395345, 43.6347744685149], [-79.3229520746722, 43.6357011637811], [-79.3225102260676, 43.6368867256745], [-79.3222208280521, 43.6373418988465], [-79.3216050527881, 43.6377686671214], [-79.3215976272539, 43.6381126972335], [-79.3220625820318, 43.6389130863044], [-79.3212028251463, 43.6411021395654], [-79.320639405571, 43.6417759098873], [-79.3206756597364, 43.6420177976387], [-79.3212711067565, 43.6423900817498], [-79.3212964716725, 43.6426853123828], [-79.320839606245, 43.6442033354516], [-79.320339646479, 43.6455413512477], [-79.3197755047527, 43.6461078193635], [-79.3200655682834, 43.646965800353], [-79.3199439657915, 43.6479573701408], [-79.3202153526598, 43.6484144814066], [-79.3201012518389, 43.6493886272717], [-79.3194559512369, 43.6515973985517], [-79.3184046310085, 43.6534644417559], [-79.3180075086009, 43.6543276971172], [-79.3168264262113, 43.6555670881108], [-79.3160044572589, 43.6560932201891], [-79.3162342823022, 43.6567165192687], [-79.3167487602611, 43.6572980671659], [-79.3161575581473, 43.657604450929306], [-79.3147496175453, 43.6573730126593], [-79.3137163164044, 43.657574646924], [-79.313140220612, 43.6580733264547], [-79.3143403817163, 43.6589071053675], [-79.3150725852838, 43.6592514234951], [-79.3160473514316, 43.6598869969395], [-79.3170668599223, 43.660788029205605], [-79.3171125851442, 43.6614746167282], [-79.31492459201341, 43.6619658989816]]] }, "properties": { "_id": 724, "AREA_ID": 2457717, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993173, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 14, "AREA_LONG_CODE": 14, "AREA_NAME": "Toronto-Danforth", "AREA_DESC": "Toronto-Danforth (14)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345153, "Shape__Area": 41685482.890625, "Shape__Length": 61191.203214624504 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.3837661930223, 43.6557159692698], [-79.3883145100963, 43.6547901866588], [-79.3887311279821, 43.6548028707821], [-79.390004517453, 43.6545125042976], [-79.3914607906137, 43.6543333741155], [-79.3972709038512, 43.6531172591201], [-79.4022664973862, 43.6520294685818], [-79.4037475308531, 43.6517410074764], [-79.4053616100253, 43.6523649340544], [-79.4060223641094, 43.6523116870524], [-79.4084890143657, 43.6517940218507], [-79.4159861553624, 43.6502976846687], [-79.4170702372387, 43.6500687255106], [-79.4207821526692, 43.6493340834881], [-79.4247515152879, 43.6494378865496], [-79.4224102955295, 43.6434915575894], [-79.4214164277034, 43.640820387101904], [-79.4213971910843, 43.6406113979274], [-79.4226733486885, 43.6407054775233], [-79.4243860867713, 43.6409855668681], [-79.4266987608462, 43.6416078440176], [-79.4282100821178, 43.6423113693663], [-79.4286441986526, 43.6422084224097], [-79.4280062840758, 43.640599719745], [-79.42542438496672, 43.6338795502891], [-79.4277926632574, 43.6332208459316], [-79.4287065660649, 43.6329132750031], [-79.4281670995517, 43.6309475737771], [-79.4277754764607, 43.629793474517], [-79.4259640354286, 43.6296573398357], [-79.4201395041337, 43.6301301961376], [-79.4186976838766, 43.6294982451583], [-79.4184275974182, 43.6294961894685], [-79.4180323723606, 43.6282277722599], [-79.4190334795977, 43.6278714002904], [-79.4193506552455, 43.6281461670748], [-79.4193953456288, 43.629190378439205], [-79.4200504987752, 43.6292538212564], [-79.4224664079757, 43.6290618383046], [-79.4220533021724, 43.6283909714469], [-79.4225440272579, 43.6277341850621], [-79.4223859998322, 43.6274595442783], [-79.4213771433781, 43.6275354027725], [-79.4204594105194, 43.6272287474188], [-79.4200139206804, 43.626755881206], [-79.4194588284729, 43.626890530451], [-79.4186349803506, 43.626750452393], [-79.418375914036, 43.6270293200526], [-79.4177541694152, 43.6269118832685], [-79.4178333463407, 43.62734400728931], [-79.4173341771496, 43.6279242645219], [-79.4161950598646, 43.6281035080669], [-79.4156326609556, 43.6276440321861], [-79.4154553603797, 43.6270588013799], [-79.414366294601, 43.6271750539529], [-79.4133136232645, 43.6270212728243], [-79.4128085627911, 43.6273539674408], [-79.4114602776154, 43.6272989587752], [-79.4110469976734, 43.6273751678244], [-79.4103768397526, 43.62779774605941], [-79.4100302394061, 43.6283285921811], [-79.4102388923475, 43.6291389177556], [-79.4098760763184, 43.6293861886458], [-79.4091521369427, 43.6295161538464], [-79.4094608196914, 43.6310160397365], [-79.4096320817863, 43.6312249535134], [-79.4087925320673, 43.6317001632942], [-79.4086244122116, 43.6330664039131], [-79.4066484102976, 43.6328512944726], [-79.405063443553, 43.6331162682793], [-79.4029433249194, 43.6314673777376], [-79.4028763695927, 43.63118895286261], [-79.4023342669007, 43.6310362774904], [-79.3988630444965, 43.6328769598804], [-79.3982779902794, 43.6329550589135], [-79.3978540749822, 43.6326778792284], [-79.3987655310305, 43.6315514189895], [-79.4027981706151, 43.6293444560756], [-79.4048993790719, 43.6278384356606], [-79.4042866474789, 43.6264410874429], [-79.4033497559452, 43.6266561887355], [-79.4013600684978, 43.6253943833933], [-79.3998895928315, 43.6243334782285], [-79.39851387283642, 43.6231843343451], [-79.39801516213322, 43.622575566645], [-79.3954961465048, 43.620734898536], [-79.3944706554178, 43.6198606668943], [-79.3934340167476, 43.6187066156912], [-79.3919193737047, 43.6166509814803], [-79.3916147358676, 43.6161071066609], [-79.3916141534939, 43.6150586392325], [-79.3908515610217, 43.6145075760718], [-79.389936811102, 43.6136556870088], [-79.3896112361239, 43.6130417193599], [-79.3897639442667, 43.6123008518077], [-79.3889590268805, 43.6119761026854], [-79.38806906395442, 43.6121157919911], [-79.3868070259763, 43.6120972936603], [-79.3848970206598, 43.6119634617379], [-79.3840152878856, 43.6120124384553], [-79.3830329528703, 43.6122109000988], [-79.3820636578514, 43.6122566396451], [-79.3808736700349, 43.6131050498703], [-79.379761088599, 43.6137006071719], [-79.3789937626234, 43.6137748243764], [-79.3779639030311, 43.6140551409907], [-79.3770757960337, 43.6144726023888], [-79.3760824816177, 43.614436550507], [-79.3737147004097, 43.6158463626319], [-79.3723353141221, 43.6164702668372], [-79.3719448395172, 43.6163381484364], [-79.3711697556205, 43.6171475398339], [-79.370493424694, 43.6175982595047], [-79.3675863513867, 43.6189035094274], [-79.3664531220754, 43.619338102491], [-79.3633207811359, 43.6215892619876], [-79.3620852358659, 43.6223973914765], [-79.3589299040671, 43.6246295617448], [-79.3578217925513, 43.6254492066633], [-79.3567762519894, 43.6264102860815], [-79.3559408320384, 43.6273138227813], [-79.355175771946, 43.6284244744651], [-79.3544121352382, 43.6297705810501], [-79.3532673362382, 43.6298764319882], [-79.3509907301687, 43.6298154912369], [-79.3497604744627, 43.6296396320818], [-79.3495339685719, 43.6309062440365], [-79.3493872836886, 43.6310230779534], [-79.3525152582638, 43.6337126393982], [-79.349647800299, 43.6333942966004], [-79.3536843702146, 43.6380668863781], [-79.3598538981138, 43.6452985787937], [-79.3543455109449, 43.647647800631304], [-79.3476541079523, 43.6504189245783], [-79.3472969332, 43.6507487979107], [-79.347731009249, 43.6514226695539], [-79.3495236876076, 43.6535994380291], [-79.3501806346631, 43.6531829170711], [-79.3503832959599, 43.6536700747899], [-79.3509666963745, 43.6537104158205], [-79.35119065181091, 43.6531282478933], [-79.3520129294318, 43.6525014437518], [-79.3526160273598, 43.6524418238029], [-79.3573920382912, 43.6513298410318], [-79.3621413294392, 43.650197319193], [-79.3623094689756, 43.6502002672523], [-79.3684924704294, 43.6487714791228], [-79.3717413242899, 43.6480415953011], [-79.3733125752073, 43.6472572672328], [-79.3765030771403, 43.6457838773097], [-79.3769743175951, 43.6468847935012], [-79.3780335161361, 43.6462294228396], [-79.3791349753174, 43.6459870607196], [-79.3808101970891, 43.6498927202986], [-79.3815498064014, 43.6517030684006], [-79.3823360419431, 43.6521516709262], [-79.3837661930223, 43.6557159692698]]] }, "properties": { "_id": 725, "AREA_ID": 2457716, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993172, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 10, "AREA_LONG_CODE": 10, "AREA_NAME": "Spadina-Fort York", "AREA_DESC": "Spadina-Fort York (10)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345169, "Shape__Area": 35724182.2929688, "Shape__Length": 38163.5568548265 } }
      ]
    };

    data.features = data.features.map(o => {
      o.properties.color = colors[o.properties.AREA_NAME] || 'red';
      return o
    });

    const addWards = function (map) {
      map.addSource('wards', {
        type: 'geojson',
        data: data,
      });
      map.addLayer({
        id: 'outline',
        type: 'line',
        source: 'wards',
        layout: {},
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
        },
      });

    };

    var pipeline = [
      {
        "start": "2010-07-23",
        "issued": "2011-01-21",
        "desc": "Revision: Proposed interior alterations (includes creation of 6th unit) and rear three storey addition (comprised of group c and e). See 10-131409.          see c of a final & binding  A0326/10TEYE restaurant occupant load = 30 persons[New 3rd storey and 3 storey rear addition to a multiple building. for 5 units]",
        "units": 6,
        "postal": "M6H",
        "address": "1052 BLOOR ST W",
        "geo": {
          "lat": 43.66074039999999,
          "lng": -79.4325219
        },
        "ward": "Davenport"
      },
      {
        "start": "2010-07-27",
        "issued": "2011-03-09",
        "desc": "Addition of 28 units",
        "units": 42,
        "postal": "M3C",
        "address": "120 DALLIMORE CRCL",
        "geo": {
          "lat": 43.7302666,
          "lng": -79.3320493
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2010-01-28",
        "issued": "2010-04-20",
        "desc": "Interior alteration associated with permit #06-198751:- 8 loft units (#12 - 7th thru 22nd floors) splited into 16 units @ floor.- 8 large units (#8 - 13th thru 20th floors) converted into 8 smaller units plus 4 loft units (#9).A total of 12 more units created.",
        "units": 28,
        "postal": "",
        "address": "185 LEGION RD N",
        "geo": {
          "lat": 43.6246597,
          "lng": -79.4881868
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2011-11-28",
        "issued": "2012-04-24",
        "desc": "REVISION - to add 25 residential units.Proposal to construct a 66 storey hotel and dwelling building",
        "units": 30,
        "postal": "",
        "address": "180 UNIVERSITY AVE",
        "geo": {
          "lat": 43.6489491,
          "lng": -79.3857768
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2009-09-01",
        "issued": "2009-11-10",
        "desc": "Revision to add 12 units on floors 20 and 21 of Tower A, thus making floors 7 to 21 identical.",
        "units": 12,
        "postal": "M4P",
        "address": "70 ROEHAMPTON AVE",
        "geo": {
          "lat": 43.70895540000001,
          "lng": -79.3960994
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2010-11-02",
        "issued": "2011-01-20",
        "desc": "Revision: to permit 4 additional typical floors (floors 44-47) containing 54 residentail units- 36, 16, 2 one, two and three bedroom units.  The two three bedroom units (penthouse units) are multileveled and are located at the new 51st floor of the building together with rooftop mechanical equipmentOriginal: Construct 46-storey mixed use building with 581 dwelling units complete with 5 levels of below grade parking & commercial at grade.",
        "units": 54,
        "postal": "M5J",
        "address": "33 BAY ST",
        "geo": {
          "lat": 43.6427616,
          "lng": -79.3770382
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2012-12-14",
        "issued": "2013-07-18",
        "desc": "Revision to divide 18 residential suites into 36 smaller suites within 3 approved towers.  65 EAST LIBERTY ST (divide suite 312 into 312 and 312A, 410 into 410 and 411, 510 into 510 and 511, 610 into 610 and 611, 710 into 710 and 711).  75 EAST LIBERTY ST (divide suite 412 into 412 and 413, 418 into 418 and 418A, 512 into 512 and 513, 518 into 518 and 518A, 612 into 612 and 613, 618 into 618 and 618A, 712 into 712 and 713, 718 into 718 and 718A).  85 EAST LIBERTY ST (divide suite 316 into 316 and 316A, 413 into 413 and 414, 513 into 513 and 514, 613 into 613 and 614, 713 into 713 and 714).",
        "units": 36,
        "postal": "",
        "address": "65 EAST LIBERTY ST",
        "geo": {
          "lat": 43.63836999999999,
          "lng": -79.4142019
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2008-01-22",
        "issued": "2008-04-29",
        "desc": "New three storey freehold townhouse (LEAD PERMIT)",
        "units": 7,
        "postal": "M2N",
        "address": "65 FINCH AVE W",
        "geo": {
          "lat": 43.7783577,
          "lng": -79.4211294
        },
        "ward": "Willowdale"
      },
      {
        "start": "2008-02-12",
        "issued": "2010-05-05",
        "desc": "To demolish the existing buildings and to construct a six-storey, 21-unit residential building with a rear second floor terrace and retail at-grade.  There will be parking on the ground level with dual parking stackers located at the rear of the building. 4 dwelling units within the existing building would be demolished",
        "units": 21,
        "postal": "M6G",
        "address": "799 COLLEGE ST",
        "geo": {
          "lat": 43.6545511,
          "lng": -79.4207285
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2008-02-14",
        "issued": "2013-01-30",
        "desc": "Convert the existing non-residential building into 6 residential dwelling units.",
        "units": 6,
        "postal": "M6H",
        "address": "811 ST CLARENS AVE",
        "geo": {
          "lat": 43.6684182,
          "lng": -79.4456483
        },
        "ward": "Davenport"
      },
      {
        "start": "2008-03-13",
        "issued": "2010-03-16",
        "desc": "BIN 2194 Proposal to construct a new 36 sty condo with 3 partial sty's of retail and 5 below grade parking levels.   281 residential units.  373-375 King St WPLEASE NOTE THAT NEW DRAWINGS SUBMITTED DEC 22 2009 - UNITS INCREASED 281- 305.  NUMBER OF STOREYS NOT CHANGED. NEW PARKING SPACES 142 PROVIDED.",
        "units": 305,
        "postal": "M5V",
        "address": "373 KING ST W",
        "geo": {
          "lat": 43.6457101,
          "lng": -79.39290369999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2008-03-13",
        "issued": "2010-12-17",
        "desc": "Proposed development of two residential condominium buildings, 27 and 36 storeys respectively, containing 489 suites (including 8 live-work units on Legion Road under Building A) and retail commerical units extending along Lake Shore Boulevard West.",
        "units": 489,
        "postal": "M8V",
        "address": "2242 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.6208485,
          "lng": -79.4831924
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2010-02-03",
        "issued": "2010-05-03",
        "desc": "Revision re; To subdivide units previously approved to create an additional 13 units, as per Committee of Adjustment Variance granted. Related Committee of Adjustment File #A24/10 EYK.  **   (New 14-storey (196units) Condominium Apartment Building with 2 levels of underground parking garage.)**",
        "units": 30,
        "postal": "",
        "address": "1135 ROYAL YORK RD",
        "geo": {
          "lat": 43.660143,
          "lng": -79.5161418
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2008-03-17",
        "issued": "2009-05-20",
        "desc": "Permit for 6 new row houses.",
        "units": 6,
        "postal": "M4E",
        "address": "736 KINGSTON RD",
        "geo": {
          "lat": 43.6797572,
          "lng": -79.2952165
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2008-04-02",
        "issued": "2010-06-08",
        "desc": "Superstructure Permit - Proposed 21 storey condominum tower - Block 13 (Building A)",
        "units": 228,
        "postal": "M2N",
        "address": "1 OAKBURN CRES",
        "geo": {
          "lat": 43.75830999999999,
          "lng": -79.40583
        },
        "ward": "Willowdale"
      },
      {
        "start": "2008-04-07",
        "issued": "2009-12-23",
        "desc": "Superstructure Permit - Proposed 22 storey building - Block 6 (Lot II - Building E)Dec 04/09 - NOTE TO FRONT COUNTER STAFF (MAGGIE/ANNIE).  There are additional EDC ($11,424.00) and DC ($92,541.00) for the 21 additional units proposed under revised plans.  Please be sure this is charged prior to issuance of the permit.   Thanks  Larry Jewell (5-5730)",
        "units": 332,
        "postal": "",
        "address": "105 HARRISON GARDEN BLVD",
        "geo": {
          "lat": 43.7575473,
          "lng": -79.4050075
        },
        "ward": "Willowdale"
      },
      {
        "start": "2008-04-08",
        "issued": "2013-06-06",
        "desc": "Interior alterations and additions at all floor levels of existing church premises for use as a residential building containing 17 dwelling units complete with 1 level of below grade parking accessed via rear public lane.  Access to building is provided via driveway to existing adjacent single family dwelling.",
        "units": 17,
        "postal": "M6H",
        "address": "40 WESTMORELAND AVE",
        "geo": {
          "lat": 43.6619355,
          "lng": -79.431225
        },
        "ward": "Davenport"
      },
      {
        "start": "2008-04-10",
        "issued": "2009-06-05",
        "desc": "4-storey residential condominium ",
        "units": 22,
        "postal": "M2K",
        "address": "15 REAN DR",
        "geo": {
          "lat": 43.7668047,
          "lng": -79.38215079999999
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2008-04-11",
        "issued": "2009-04-15",
        "desc": "10-storey residential condominium (retirement home)",
        "units": 155,
        "postal": "M2K",
        "address": "19 REAN DR",
        "geo": {
          "lat": 43.7671998,
          "lng": -79.3824121
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2008-04-14",
        "issued": "2009-05-01",
        "desc": "9-storey residential condominium",
        "units": 94,
        "postal": "M2K",
        "address": "23 REAN DR",
        "geo": {
          "lat": 43.76709169999999,
          "lng": -79.38166609999999
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2008-04-15",
        "issued": "2008-12-24",
        "desc": "16 storey residential building (Building \"B\") with 268 dwelling units and a shared three level underground parking garage with Building \"A\"",
        "units": 268,
        "postal": "",
        "address": "1070 SHEPPARD AVE W",
        "geo": {
          "lat": 43.7506004,
          "lng": -79.465034
        },
        "ward": "York Centre"
      },
      {
        "start": "2008-05-27",
        "issued": "2011-10-18",
        "desc": "permit to construct new residential building - retail at grade - 87 units - 21 storey - 4 levels below grade parking. TARRION 38126Excav & Shoring , Foundation and Structural partial permits have been issued.This permit has also included the addition of the 3 residential storeys from 6th to 8th floors + the 25th floor level. (Now become 25-storey building)",
        "units": 87,
        "postal": "M5R",
        "address": "76 DAVENPORT RD",
        "geo": {
          "lat": 43.673238,
          "lng": -79.3901736
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2008-06-10",
        "issued": "2011-06-24",
        "desc": "Proposal to construct a new 10 sty and 16 sty condo with retail on ground floor and 3 levels of below grade parking.  Total 233 residential units.",
        "units": 233,
        "postal": "M5V",
        "address": "650 KING ST W",
        "geo": {
          "lat": 43.6442315,
          "lng": -79.4018613
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2008-06-12",
        "issued": "2011-05-10",
        "desc": "Proposed 38 storey residential tower and 18 storey residential tower with bridge connection, with 10 storey podium and 3 levels of underground parking, retail at grade. ",
        "units": 906,
        "postal": "",
        "address": "476 BREMNER BLVD",
        "geo": {
          "lat": 43.64046,
          "lng": -79.3926106
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2008-06-13",
        "issued": "2010-07-26",
        "desc": "Building \"B\" 28 Storey, 316 unit condominium with 3 level below grade parking. ",
        "units": 316,
        "postal": "M2K",
        "address": "1015 SHEPPARD AVE E",
        "geo": {
          "lat": 43.7697204,
          "lng": -79.37280050000001
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2008-06-13",
        "issued": "2011-08-12",
        "desc": "Proposal to construct a 16 sty mixed use building (4 levels of below grade parking, floors 1-4 to be occupied by Kintore College, floors 5-16 condo with 46 residential units).LARGE BIN 40",
        "units": 77,
        "postal": "M5S",
        "address": "77 CHARLES ST W",
        "geo": {
          "lat": 43.6677468,
          "lng": -79.3903146
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2008-06-17",
        "issued": "2010-08-05",
        "desc": "New 7-storey mixed-use building development containing 96 residential dwelling units and approximately 9,725 square metres of retail space 3 storeys above grade parking",
        "units": 96,
        "postal": "M5V",
        "address": "585 QUEEN ST W",
        "geo": {
          "lat": 43.6473535,
          "lng": -79.40169279999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2008-06-24",
        "issued": "2010-02-12",
        "desc": "New twelve storey mixed-use building containing ground floor retail and residential amenity space with 102 residential dwelling units and three levels of below-grade parking. ",
        "units": 102,
        "postal": "M5V",
        "address": "400 WELLINGTON ST W",
        "geo": {
          "lat": 43.64412129999999,
          "lng": -79.3959476
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2008-07-07",
        "issued": "2011-12-15",
        "desc": "Proposed 39 storeys 391 suites residential condo with retail space at grade.",
        "units": 389,
        "postal": "",
        "address": "2139 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.6265551,
          "lng": -79.47910689999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2008-07-08",
        "issued": null,
        "desc": "To construct a mixed use building (Phase 1 Building 'H' and \"F\" only) consisting of 10 storey residential towers (Building H - 186 units of which 148 units are affordable housing) with ground floor retail and 2 storeys of below grade parking.Scope of project revised to one 10 storey tower only (Building 'H' ), but with U/G parking for buildings \"H' and 'I'.  See part foundation permit.",
        "units": 362,
        "postal": "M9M",
        "address": "3415-3499 WESTON RD",
        "geo": {
          "lat": 43.748506,
          "lng": -79.54148219999999
        },
        "ward": "Humber River-Black Creek"
      },
      {
        "start": "2008-07-09",
        "issued": "2010-01-18",
        "desc": "Proposal to construct new 4 storey, 15 live/work unit building, with parking at grade. See site plan approval draft . See PPR.",
        "units": 15,
        "postal": "",
        "address": "53 COLGATE AVE",
        "geo": {
          "lat": 43.661813,
          "lng": -79.34178010000001
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2008-07-09",
        "issued": "2012-02-28",
        "desc": "New 3 storey building- 9 live/work unit and commercial building with parking at grade- SPA pending.NOTE: Oct. 2011 - design change from original 5 storey and 19 units.",
        "units": 9,
        "postal": "",
        "address": "59 COLGATE AVE",
        "geo": {
          "lat": 43.66205069999999,
          "lng": -79.34113649999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2008-07-18",
        "issued": "2011-12-28",
        "desc": "PHASE 1 - East Tower; Permit for construction of phase 1 portion of 575 unit residential condo live work with 3 levels of below grade parking - Phase 1-440 units- contains 369 dwelling units (standard) and 71 live work units do be devoted  exclusively to art/scape. Phase 1 also includes entire below grade area of development to be sprinklered.",
        "units": 370,
        "postal": "M6J",
        "address": "150 SUDBURY ST",
        "geo": {
          "lat": 43.64154140000001,
          "lng": -79.4240739
        },
        "ward": "Davenport"
      },
      {
        "start": "2008-07-29",
        "issued": "2009-02-20",
        "desc": "Permit to construct front additions (1 storey, 3 storey 4 storey) to church and apartment building. Interior alterations on ground to church, and replacing windows and cladding to existing 11 storey tower.",
        "units": 11,
        "postal": "M6K",
        "address": "1355 KING ST W",
        "geo": {
          "lat": 43.637607,
          "lng": -79.43291160000001
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2008-07-31",
        "issued": "2012-03-19",
        "desc": "Proposal to construct a new 37 sty condo with 322 units, 5 levels of underground parking, and amenities.  New address - 825 Church St.  C.O.A. - A0620/06TEY",
        "units": 322,
        "postal": "",
        "address": "837 YONGE ST",
        "geo": {
          "lat": 43.67321889999999,
          "lng": -79.38772879999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2008-08-15",
        "issued": "2013-08-28",
        "desc": "Proposal to construct a14 storey condo building with 712 residential units and 4 levels of underground parking (BUILDING B - PHASE 1)",
        "units": 712,
        "postal": "",
        "address": "25 QUEENS QUAY   E",
        "geo": {
          "lat": 43.6419079,
          "lng": -79.3728922
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2008-08-18",
        "issued": "2010-04-22",
        "desc": "Proposal to construct a 22 sty condo with 4 levels of underground parking.  517 units.  Future address - 15 Machells Ave.  ",
        "units": 332,
        "postal": "M6K",
        "address": "1100 KING ST W",
        "geo": {
          "lat": 43.6401005,
          "lng": -79.4226486
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2008-09-15",
        "issued": "2013-04-11",
        "desc": "Revised 39 storey residential building with 423 dwelling units, Tower - A - ground floor retail and 5 levels of underground parking - Ultra, Phase II, Heron's Hill",
        "units": 425,
        "postal": "M2J",
        "address": "2025 SHEPPARD AVE E",
        "geo": {
          "lat": 43.7753573,
          "lng": -79.3370812
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2008-09-18",
        "issued": "2011-09-30",
        "desc": "New 30-storey highrise condominium with 4 underground parking levels. (See 06-135967 for site plan application, and see 06-198751 for phase 1 of the project).",
        "units": 368,
        "postal": "",
        "address": "155 LEGION RD N",
        "geo": {
          "lat": 43.6239698,
          "lng": -79.4884113
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2008-09-30",
        "issued": "2010-04-26",
        "desc": "permit to construct new 8 storey / 44 suites - Community Housing Building - See 07 287294STE for site plan approval.",
        "units": 44,
        "postal": "M4J",
        "address": "270 DONLANDS AVE",
        "geo": {
          "lat": 43.6900828,
          "lng": -79.34158200000002
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2008-10-03",
        "issued": "2011-02-17",
        "desc": "Proposal to construct a new 12 sty condo (178 dwelling units) with ground floor retail and 4 levels of below grade parking.",
        "units": 180,
        "postal": "M5V",
        "address": "478 KING ST W",
        "geo": {
          "lat": 43.6455365,
          "lng": -79.3964818
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2008-10-15",
        "issued": "2011-12-21",
        "desc": "Building C  -  22 Storey condo with 300 units  three levels of underground parking garages and 5 podium townhouses ",
        "units": 293,
        "postal": "M2N",
        "address": "1 ANNDALE DR",
        "geo": {
          "lat": 43.7606532,
          "lng": -79.40853899999999
        },
        "ward": "Willowdale"
      },
      {
        "start": "2008-11-04",
        "issued": "2010-02-04",
        "desc": "Proposal to construct a condo consisting of 15 townhomes (3 buildings) with common parking.  359-377 Roehampton Ave.",
        "units": 15,
        "postal": "M4P",
        "address": "359 ROEHAMPTON AVE",
        "geo": {
          "lat": 43.7101806,
          "lng": -79.3871142
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2008-11-14",
        "issued": "2009-01-05",
        "desc": "permit for interior alterations and addition to convert existing rooming house - to alternative housing - 28 units with program space on ground floor.Separate permit required for sprinklers.",
        "units": 28,
        "postal": "M4M",
        "address": "650 QUEEN ST E",
        "geo": {
          "lat": 43.6585476,
          "lng": -79.3519551
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2008-11-26",
        "issued": "2011-04-19",
        "desc": "17 storey retirement home containing 165 dwellings and 1 level of underground parking - Canterbury Place Retirement Residence (Phase 2)",
        "units": 165,
        "postal": "",
        "address": "5270 YONGE ST",
        "geo": {
          "lat": 43.7718358,
          "lng": -79.41392859999999
        },
        "ward": "Willowdale"
      },
      {
        "start": "2008-12-23",
        "issued": "2011-12-12",
        "desc": "Proposal to build new 5 sty mixed use building containing 87 alternate housing units and community centre + place of worship on ground floor and basement.  See PPR 08 219429 and COA - A0106/09TEY.",
        "units": 87,
        "postal": "M5A",
        "address": "40 OAK ST",
        "geo": {
          "lat": 43.6614027,
          "lng": -79.3652523
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2009-01-29",
        "issued": "2009-02-12",
        "desc": "interior alterations & convert existing retail store to take out restaurant and new kitchen exhaust system for  \"Hong Kong Gourmet\"",
        "units": 9,
        "postal": "M9C",
        "address": "460 RENFORTH DR",
        "geo": {
          "lat": 43.6503514,
          "lng": -79.5797466
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2009-02-11",
        "issued": "2010-11-16",
        "desc": "Proposed new 16 and 10 storey residential tower, and 4 levels below grade parking. 379 dwelling units PHASE 2B - Building will be conncted to PHASE 2A - Connected above and below grade.",
        "units": 380,
        "postal": "M5V",
        "address": "640 FLEET ST",
        "geo": {
          "lat": 43.6361494,
          "lng": -79.4045107
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2009-02-13",
        "issued": "2011-01-28",
        "desc": "Proposal to construct a 11-storey mixed-use building with 121 live/work units.  See Demo 09 109528.Separate sprinkler permit application charged on this permit.",
        "units": 125,
        "postal": "M4M",
        "address": "319 CARLAW AVE",
        "geo": {
          "lat": 43.66428800000001,
          "lng": -79.3412041
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2014-05-23",
        "issued": "2015-01-28",
        "desc": "REVISON - To add mezzanine and roof deck for units 122-127 inclusive 147,153,154. Revision for interior alterations to relocate mezzanine level to units 122 to 126 inclusive, and increase floor area of mezzanine in unit 134 from 22.38m2 to 52.76m2 (increase of 30.38m2).6 units are being converted from artist's studio to live-work units (1194.92.36 s.m.). mezzanines are added to 1 existing live-work unit and 2 artist studios (69.68 s.m.).",
        "units": 6,
        "postal": "M4M",
        "address": "320 CARLAW AVE",
        "geo": {
          "lat": 43.66383270000001,
          "lng": -79.3413534
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2009-05-21",
        "issued": "2010-05-17",
        "desc": "Permit for New 3 stoery stacked townhomes containing 14 units - no parking - Rental units - WEST BLOCK OF 30 REGENT ST.",
        "units": 14,
        "postal": "M5A",
        "address": "30 REGENT ST",
        "geo": {
          "lat": 43.6585261,
          "lng": -79.36445800000001
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2009-05-21",
        "issued": "2010-03-16",
        "desc": "BLOCK 14 - permit to construct new 3 storey - 12 units -no parking - stacked townhouse - ",
        "units": 12,
        "postal": "",
        "address": "620 DUNDAS ST E",
        "geo": {
          "lat": 43.66099500000001,
          "lng": -79.3618872
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2010-10-28",
        "issued": "2011-09-27",
        "desc": "PHASE 2 - revise to include 12 town homes",
        "units": 12,
        "postal": "M6K",
        "address": "1636 DUNDAS ST W",
        "geo": {
          "lat": 43.6501926,
          "lng": -79.4365005
        },
        "ward": "Davenport"
      },
      {
        "start": "2009-08-14",
        "issued": "2011-03-02",
        "desc": "Permit to construct new 40 storey residential building with retail at grade.   4 levels below grade parking. 348 residentail units and 348 parking spaces. (Gooderham and Worts) - PHASE 1 - CLEAR SPIRITS.",
        "units": 344,
        "postal": "",
        "address": "390 CHERRY ST",
        "geo": {
          "lat": 43.65055359999999,
          "lng": -79.3573819
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2009-08-19",
        "issued": "2012-09-19",
        "desc": "LEAD PERMIT for 20 units townhouses (Block A & Block B) and underground Garage. Block A-Unit #1 (previous unit#1)Three storey ten unit townhouses linked together with 1 underground parking garage with Block B building. The townhouse was revised from 16 units to 20 units by the new owner. Based on manager's decision, additional fees had been charged for the alterations. Applicant applied new permits (#12-138942, 12-138956, 12-138970, 12-138974) for additional 4 new units (unit #9, #10, #19, and #20). Foundation permit see # 09-161771 and 09-161771-01 and 02. ",
        "units": 20,
        "postal": "M2L",
        "address": "2425 BAYVIEW AVE",
        "geo": {
          "lat": 43.73824320000001,
          "lng": -79.3815544
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2009-08-31",
        "issued": "2012-01-19",
        "desc": "Proposal to construct a 10 sty condo (16 residential units) with 1 level of below grade parking.",
        "units": 16,
        "postal": "M5V",
        "address": "500 WELLINGTON ST W",
        "geo": {
          "lat": 43.6433782,
          "lng": -79.3987573
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2009-09-16",
        "issued": "2013-06-18",
        "desc": "Proposal to construct 2 condo towers (Tower A -35 sty with 408 residential units & Tower B-16 sty with 300 residential units) on a 5 sty podium, commercial on grade, and 4 levels of below grade parking.  Total # of residential units = 708. 25 Lower Simcoe St & 19 Grand Trunk Cres.",
        "units": 708,
        "postal": "",
        "address": "25 LOWER SIMCOE ST",
        "geo": {
          "lat": 43.6414307,
          "lng": -79.383268
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2009-10-09",
        "issued": "2012-01-18",
        "desc": "Interior alterations to existing  non conforming rooming house to 8 DWELLING ROOMS AND 5 DWELLING UNITS. - SEE 2000 131024 BLD FOR PREVIOUS BUILDING PERMIT -  ",
        "units": 5,
        "postal": "M6K",
        "address": "17 MAYNARD AVE",
        "geo": {
          "lat": 43.63755099999999,
          "lng": -79.43713790000001
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2009-10-19",
        "issued": "2010-04-30",
        "desc": "Proposal to construct a 8 sty mixed use podium (commercial at grade, above grade parkng, and dwelling units).  105 residentail units.  PHASE 1 - Market Wharf.",
        "units": 105,
        "postal": "M5E",
        "address": "18 LOWER JARVIS ST",
        "geo": {
          "lat": 43.64756029999999,
          "lng": -79.37088539999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2009-10-29",
        "issued": "2012-02-23",
        "desc": "To construct one 44 storey condominium building with 9 townhouse units, commercial complex and 4 levels of underground parking garage.See 09-160040-BLD for shoring",
        "units": 342,
        "postal": "M8V",
        "address": "2230 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.6216137,
          "lng": -79.482918
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2009-11-03",
        "issued": "2010-09-03",
        "desc": "Constructino of a 16 storey Apartment Building with commercial on the ground floor and 3 Level under ground parking.  (Building C)",
        "units": 302,
        "postal": "",
        "address": "1060 SHEPPARD AVE W",
        "geo": {
          "lat": 43.7506127,
          "lng": -79.4639474
        },
        "ward": "York Centre"
      },
      {
        "start": "2009-11-16",
        "issued": "2013-05-29",
        "desc": "Erect Phase 1 (Tower B) of 3 phased redevelopment consisting of a new 57-storey mixed use condominium building with 600 dwelling units and 268m2 of retail . Included in the proposal is 5 levels of below grade parking. Lands are recognized as Parcel 1 of by law 494-2009. (New municipal Address 12 York Street)",
        "units": 600,
        "postal": "",
        "address": "12 YORK ST",
        "geo": {
          "lat": 43.6418481,
          "lng": -79.3815635
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2009-11-18",
        "issued": "2013-04-04",
        "desc": "PLEASE NOTE NEW DRAWINGS SUBMITTED ON OCT 14 2011. PROJECT RE DESIGNEDNEW PROJECT DESCRIPTION - Construction of 3 buildings - 2 x 4 storey 1  x 8 storey - 243 residential units - Affordable housing building.Proposal to construct 3 residential buildings (with commercial at grade) - 1-8 sty building & 2-4 sty buildings with common underground parking (57 spaces).  Total # of residential units = 243.(West Donlands)",
        "units": 243,
        "postal": "M5A",
        "address": "589 KING ST E",
        "geo": {
          "lat": 43.65651030000001,
          "lng": -79.3564493
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2009-12-03",
        "issued": "2012-09-27",
        "desc": " Proposal to construct a 13 sty mixed use building containing 295 live/work units, 2 guest suites and 4 levels of below grade parking, 133 parking spaces of which are exclusive for commercial parking purposes. ",
        "units": 297,
        "postal": "",
        "address": "5 HANNA AVE",
        "geo": {
          "lat": 43.6374534,
          "lng": -79.41838659999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2009-12-22",
        "issued": "2012-04-05",
        "desc": "Proposal to construct new 41 storey building with 427 residential units, commercial area and below grade parking spaces (one level) See permit 09-188949 PSPShoring and excavation under 09-174306 BLD",
        "units": 427,
        "postal": "",
        "address": "510 BREMNER BLVD",
        "geo": {
          "lat": 43.64046,
          "lng": -79.3926106
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2009-12-23",
        "issued": "2012-08-01",
        "desc": "Construct new 13  storey residential apartment building (Building E) on former lands occupied by American Standard containing 303 residential dwelling units complete with two levels of below grade parking  and 16 visitor parking spaces above grade.  Refer to related permit for new apartment building located at 816 Lansdowne Ave-Building F. ",
        "units": 303,
        "postal": "",
        "address": "812 LANSDOWNE AVE",
        "geo": {
          "lat": 43.66529939999999,
          "lng": -79.4476767
        },
        "ward": "Davenport"
      },
      {
        "start": "2009-12-23",
        "issued": "2012-08-01",
        "desc": "Construct new 14  storey residential apartment building (Building F) on former lands occupied by American Standard containing 297 residential dwelling units complete with two levels of below grade parking.  Refer to related permit for new apartment building located at 812 Lansdowne Ave-Building EROLL PLAN BIN 2261. ",
        "units": 267,
        "postal": "",
        "address": "816 LANSDOWNE AVE",
        "geo": {
          "lat": 43.6656823,
          "lng": -79.4475781
        },
        "ward": "Davenport"
      },
      {
        "start": "2009-12-24",
        "issued": "2013-04-08",
        "desc": "- 36 storey residential building, 479 dwelling units, retail on lower ground level and 4 levels of underground parking - Building A7/A8, Emerald City.- As per Magda Ishak, the permit will be released with a portion of the elevation for building A8 noted as \"not part of this permit\", as the Limiting Distance Agreements have not yet been met. A revision to permit will be required for the section of the building affected. AS",
        "units": 479,
        "postal": "M2J",
        "address": "100 PARKWAY FOREST DR",
        "geo": {
          "lat": 43.7733062,
          "lng": -79.3418483
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2010-01-06",
        "issued": "2016-07-21",
        "desc": "Proposal to construct a 61 sty  (including mech) condo tower with 3 levels of below ground parking in conjunction with existing performing arts centre.  \"Sony Centre for the Performing Arts\".  New address - 8 The Esplanade.",
        "units": 585,
        "postal": "",
        "address": "8 THE ESPLANADE",
        "geo": {
          "lat": 43.6466495,
          "lng": -79.3759458
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2010-01-11",
        "issued": "2011-09-13",
        "desc": "Proposed construction of a 27-storey residential condominium building containing 313 units (BLDG B) and a single storey office/retail building (BLDG C) over a 3-storey underground parking structure.",
        "units": 313,
        "postal": "M8Y",
        "address": "60 PARK LAWN RD",
        "geo": {
          "lat": 43.6237954,
          "lng": -79.4843918
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2010-01-22",
        "issued": "2012-01-10",
        "desc": "Proposal to construct 1 condo consisting of 2 towers (1-49 sty & 1-13 sty) with podium, commercial on ground floor, 5 levels of below grade parking, with 684 residential units.",
        "units": 684,
        "postal": "",
        "address": "300 FRONT ST W",
        "geo": {
          "lat": 43.6441279,
          "lng": -79.3894049
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2010-02-02",
        "issued": "2012-07-13",
        "desc": "Proposal to construct a 10 sty condo with retail on ground floor and 4 levels of below grade parking.  Total 84 residential units.Separate sprinkler permit required - charged on this permit. '\" ROLLED DRAWINGS IN BIN\"",
        "units": 84,
        "postal": "M4M",
        "address": "1201 DUNDAS ST E",
        "geo": {
          "lat": 43.6647841,
          "lng": -79.34107379999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2010-02-08",
        "issued": "2012-06-18",
        "desc": "Construct 8 storey mixed use building with 2 levels of underground parking garage. There will be retail/commercial uses on the ground floor and floors 2 through to 8 will be residential (192 residential units).",
        "units": 192,
        "postal": "M5A",
        "address": "510 KING ST E",
        "geo": {
          "lat": 43.6565816,
          "lng": -79.3570955
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2010-02-08",
        "issued": "2011-09-28",
        "desc": "Construction of a 8 storey mixed use building. The ground floor will be retail/commercial and floors 2 through to 8 will be residential for 53 residential units.",
        "units": 54,
        "postal": "M6J",
        "address": "2 GLADSTONE AVE",
        "geo": {
          "lat": 43.6427483,
          "lng": -79.427444
        },
        "ward": "Davenport"
      },
      {
        "start": "2010-02-09",
        "issued": "2012-02-16",
        "desc": "Permit to construct  24 storey mixed use building, comprised of 465 dwelling units and retail uses at grade. - 4 levels of underground parking - See 09 158623 STE for Site Plan Approval Application",
        "units": 465,
        "postal": "",
        "address": "352 FRONT ST W",
        "geo": {
          "lat": 43.6433534,
          "lng": -79.39245149999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2010-02-19",
        "issued": "2013-05-16",
        "desc": "Construct a new 12 storeys high-rise twin towers linked by a 5 storeys low-rise, total 303 residential units w/ 3 levels U/G parking, mixed use building with some live/work units and commercial at grade",
        "units": 303,
        "postal": "M8Z",
        "address": "1061 THE QUEENSWAY",
        "geo": {
          "lat": 43.6220805,
          "lng": -79.5205162
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2010-02-22",
        "issued": "2011-09-07",
        "desc": "Construct a 14-storey mixed-use building containing 215 dwelling units and retail at grade and below grade parking.",
        "units": 215,
        "postal": "",
        "address": "330 KING ST E",
        "geo": {
          "lat": 43.6527813,
          "lng": -79.36343819999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2010-02-26",
        "issued": "2012-09-10",
        "desc": "Proposal to construct a 12 sty condo with retail on ground floor and 4 levels of below grade parking.  108 residential units.  1638-1650 BLOOR ST W.",
        "units": 108,
        "postal": "M6P",
        "address": "1638 BLOOR ST W",
        "geo": {
          "lat": 43.6556704,
          "lng": -79.4564269
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2010-03-25",
        "issued": "2021-03-31",
        "desc": "34 storey mixed use building containing 478 residential dwelling units, 3 floors of non-residential uses and 5 levels of underground parking.",
        "units": 479,
        "postal": "M2N",
        "address": "4917-4975 YONGE ST",
        "geo": {
          "lat": 43.7645881,
          "lng": -79.4113531
        },
        "ward": "Willowdale"
      },
      {
        "start": "2010-03-26",
        "issued": "2011-12-16",
        "desc": "Proposal to construct a new 30 sty condo with 438 live-work units and below grade parking. (New revised residential gfa is 30,502.85 square metres) Note: GFA has been revised. See Site Stats (FC)BIN 2240 (2 parts)",
        "units": 391,
        "postal": "",
        "address": "125 WESTERN BATTERY RD",
        "geo": {
          "lat": 43.639859,
          "lng": -79.4166948
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2010-03-30",
        "issued": "2013-04-08",
        "desc": "Permit to construct new mixed use building - Building 6N - 248 Residential Units - 12 Stories; non-residential at grade & 3 levels of underground parking.",
        "units": 248,
        "postal": "M5V",
        "address": "24 BATHURST ST",
        "geo": {
          "lat": 43.6382801,
          "lng": -79.4007453
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2010-03-31",
        "issued": "2013-10-11",
        "desc": "6 storey Apartment addition and renovation to existing parking structure.  Refer folder #No. 12 - 224243 for Foundation.",
        "units": 201,
        "postal": "",
        "address": "15 JAMES FINLAY WAY",
        "geo": {
          "lat": 43.7261589,
          "lng": -79.4792655
        },
        "ward": "York Centre"
      },
      {
        "start": "2010-04-07",
        "issued": "2011-07-20",
        "desc": "10 storey, 240 unit affordable rental seniors building with 2 levels of underground parking.",
        "units": 240,
        "postal": "",
        "address": "485 PATRICIA AVE",
        "geo": {
          "lat": 43.783814,
          "lng": -79.4450705
        },
        "ward": "Willowdale"
      },
      {
        "start": "2010-04-16",
        "issued": "2012-10-11",
        "desc": "Construction of  a new 42 storey high rise building with residential and assembly occupancies. 36 stories of this building will be residential units and storey's 1 thru 6 will be assembly occupancies. There are also 4 below grade parking levels. The ROYAL CANADIAN MILITARY INSTITUTE / TRIBUTE COMMUNITIES CONDOMINIUM building will be a 42 storey mixed use development consisting of Royal Canadian Military Institute (RCMI) assembly space (Group A, Division 2 major occupancy with Group D subsidiary offices occupancies) on the Ground to 6th Floors while the remaining 7th through 42nd Floors will consist of residential condominium suites (Group C major occupancy). Four underground levels will be provided beneath the residential building for tenant storage, bicycle storage, and vehicle parking. The building will be protected throughout by electronically supervised automatic sprinkler protection. 2269",
        "units": 318,
        "postal": "M5G",
        "address": "426 UNIVERSITY AVE",
        "geo": {
          "lat": 43.6539589,
          "lng": -79.388583
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2010-04-28",
        "issued": "2012-05-23",
        "desc": "Construct 24 new  three storey stacked townhouse units,  BLOCK D  on top of a common underground garage under permit file no. 10 165127 BLD",
        "units": 24,
        "postal": "M6H",
        "address": "980 LANSDOWNE AVE",
        "geo": {
          "lat": 43.6680967,
          "lng": -79.4471269
        },
        "ward": "Davenport"
      },
      {
        "start": "2010-05-20",
        "issued": "2010-09-21",
        "desc": "MODEL NAME \"BLOCK 'B'\" To construct new 3 storey stacked townhouse with 5 residential dwellings on vacant land.",
        "units": 5,
        "postal": "M8W",
        "address": "20 MARINA AVE",
        "geo": {
          "lat": 43.5937484,
          "lng": -79.53281400000002
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2010-07-14",
        "issued": "2012-05-07",
        "desc": "To construct new  23-storey residential condominium building (bldg. D) containing 270 units, retail area on ground floor and three levels of underground parking.",
        "units": 270,
        "postal": "",
        "address": "205 SHERWAY GARDENS RD",
        "geo": {
          "lat": 43.6097383,
          "lng": -79.557351
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2010-07-16",
        "issued": "2012-09-11",
        "desc": "Proposal to erect a 11 sty mixed use building containg 152 units (9- live/work units on gorund floor and 143 residential units above), retail at grade and 3 levels of below grade parking.",
        "units": 152,
        "postal": "",
        "address": "40 DOVERCOURT RD",
        "geo": {
          "lat": 43.6415394,
          "lng": -79.42205729999999
        },
        "ward": "Davenport"
      },
      {
        "start": "2010-07-21",
        "issued": "2010-11-03",
        "desc": "Permit to construct new 3 storey residential live work townhouse - 23 residential unit with 1 amenity space.  1 level below grade parking with 24 spaces.  See 06 194365 STE 20 SA.",
        "units": 23,
        "postal": "M6G",
        "address": "483 DUPONT ST",
        "geo": {
          "lat": 43.6727844,
          "lng": -79.41533539999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2010-08-17",
        "issued": "2013-06-21",
        "desc": "Construct 46-storey mixed-use building containing 588 dwelling units, commercial at grade and 6 levels below grade.",
        "units": 587,
        "postal": "M5V",
        "address": "295 ADELAIDE ST W",
        "geo": {
          "lat": 43.6476298,
          "lng": -79.390408
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2010-08-24",
        "issued": "2014-07-18",
        "desc": "Gibson Square - 42 storey condominium tower including a 2 storey podium with ground floor retail and town homes and 5 levels of underground parking  SOUTH  TOWER",
        "units": 496,
        "postal": "",
        "address": "5162 YONGE ST",
        "geo": {
          "lat": 43.7693761,
          "lng": -79.41385749999999
        },
        "ward": "Willowdale"
      },
      {
        "start": "2010-08-25",
        "issued": "2012-05-14",
        "desc": "Palm Condominium Residence - 23 storey apartment building with 216 units and 3 levels of underground parking",
        "units": 216,
        "postal": "M2M",
        "address": "5740 YONGE ST",
        "geo": {
          "lat": 43.7829067,
          "lng": -79.4173935
        },
        "ward": "Willowdale"
      },
      {
        "start": "2010-09-15",
        "issued": "2011-08-02",
        "desc": "Interior alterations to ground floor and 2nd floor to reduce commercial space on ground floor and add dwelling units.  Increase number of dwelling units from 3 to 8.  See multiple PPR's and COA.",
        "units": 5,
        "postal": "M6J",
        "address": "783 DUNDAS ST W",
        "geo": {
          "lat": 43.6519415,
          "lng": -79.4074411
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2010-09-20",
        "issued": "2013-05-07",
        "desc": "Proposal to construct a 35 sty condo with 5 levels of below grade parking.  308 units.  New Address - 75 St Nicholas St.",
        "units": 308,
        "postal": "M4Y",
        "address": "75 ST NICHOLAS ST",
        "geo": {
          "lat": 43.6677008,
          "lng": -79.3866075
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2010-09-29",
        "issued": "2013-09-06",
        "desc": "Proposal to construct a 27 sty condo with 5 levels of below grade parking and 233 residential units.",
        "units": 245,
        "postal": "M4T",
        "address": "1815 YONGE ST",
        "geo": {
          "lat": 43.6960167,
          "lng": -79.3956852
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2010-10-06",
        "issued": "2013-10-02",
        "desc": "New 27 storey residential tower with 318 units and 5 levels of under ground parking. Increased to 33 storeys and 402 units and 5 levels of underground parking.",
        "units": 404,
        "postal": "",
        "address": "275 YORKLAND RD",
        "geo": {
          "lat": 43.774764,
          "lng": -79.33691859999999
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2010-10-28",
        "issued": "2012-07-25",
        "desc": "Proposal to construct Phase 1 of 3-phase project: 22 storey apartment building  (Tower 'A') with 216 residential units with (1) level of underground and (3) levels above grade parking. TOWNHOUSES NOT PART OF THIS PERMIT",
        "units": 216,
        "postal": "M9B",
        "address": "1 VALHALLA INN RD",
        "geo": {
          "lat": 43.6405992,
          "lng": -79.5596315
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2010-11-03",
        "issued": "2011-06-23",
        "desc": "Proposal for interior alterations to convert existing multi use building into a lodging house.  See related permit 10 113024 BLD.",
        "units": 6,
        "postal": "M5V",
        "address": "7 CLARENCE SQ",
        "geo": {
          "lat": 43.6447372,
          "lng": -79.3939254
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2010-11-12",
        "issued": "2011-09-28",
        "desc": "To construct a 3 storey block of stacked townhouses, 16 units",
        "units": 16,
        "postal": "M1B",
        "address": "1795 MARKHAM RD",
        "geo": {
          "lat": 43.79519459999999,
          "lng": -79.23930349999999
        },
        "ward": "Scarborough North"
      },
      {
        "start": "2010-11-19",
        "issued": "2014-12-24",
        "desc": "Permit to construct new mixed-use building - 2 floors commercial with P1 level commercial concourse, 75 Residential stories (789 residential units) - 6 levels below grade parking.Hold for final fee assesment.",
        "units": 789,
        "postal": "M4W",
        "address": "1 BLOOR ST E",
        "geo": {
          "lat": 43.67015869999999,
          "lng": -79.38624620000002
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2010-11-19",
        "issued": "2011-10-17",
        "desc": "Proposal to construct a new eight storey mixed use building.  Building comprised of 82 residential units, ground floor retail use and three below grade parking facilities.  See also 10 165672 STE and 10 247123 MV.",
        "units": 82,
        "postal": "M5A",
        "address": "2 EASTERN AVE",
        "geo": {
          "lat": 43.6523301,
          "lng": -79.3609922
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2010-11-29",
        "issued": "2013-11-27",
        "desc": "Tower B (West Tower, from 4th fl. to 30th fl.) apartment building 30 Storey 238 Units linked to tower A with a three storey commercial podium and 5 levels of underground parking - Emerald Park.This permit is reviewed under permit no. 10 304919 BLD 00 NB.",
        "units": 238,
        "postal": "M2N",
        "address": "4726-4728 YONGE ST",
        "geo": {
          "lat": 43.759704,
          "lng": -79.41076799999999
        },
        "ward": "Willowdale"
      },
      {
        "start": "2010-12-03",
        "issued": "2014-07-17",
        "desc": "Gibson Square - 42 storey 409 unit  condominium NORTH TOWER third floor and up",
        "units": 409,
        "postal": "",
        "address": "5168 YONGE ST",
        "geo": {
          "lat": 43.76988,
          "lng": -79.41353
        },
        "ward": "Willowdale"
      },
      {
        "start": "2010-12-16",
        "issued": "2012-05-07",
        "desc": "Phase 2- Tower \"C\" - 29 stories, 323 units condo building sitting on foundation and u/g garage of tower \"D\". ",
        "units": 323,
        "postal": "",
        "address": "215 SHERWAY GARDENS RD",
        "geo": {
          "lat": 43.6095311,
          "lng": -79.55709519999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2010-12-16",
        "issued": "2012-01-18",
        "desc": "Proposal to construct a 12 sty condo with 87 residential units,  and 1 community facility space at grade.",
        "units": 87,
        "postal": "M5V",
        "address": "32 CAMDEN ST",
        "geo": {
          "lat": 43.6472244,
          "lng": -79.397228
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2010-12-24",
        "issued": "2013-08-30",
        "desc": "Permit to construct new 30 Storey Residential Rental apartment building with 336 residential units - 3 levels below grade parking - 244 private parking spaces, 26 paid parking spaces - 84 parking spaces  (Below Grade) - Additional Bike Parking spaces above grade - 7 Storey Podium - See 08 191459 STE 21 SA for site plan approval application.",
        "units": 336,
        "postal": "M5P",
        "address": "320 TWEEDSMUIR AVE",
        "geo": {
          "lat": 43.6858985,
          "lng": -79.41456199999999
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2011-01-05",
        "issued": "2014-07-16",
        "desc": "Mixed use condominium/retail building that will have 493 residential units. This building will be 45 storeys above grade and 7 storeys below grade. Proposal has been revised as follows: The building will be 48 storeys above grade and 6 storeys below grade and will contain 539 dwelling units.",
        "units": 539,
        "postal": "M4Y",
        "address": "5 ST JOSEPH ST",
        "geo": {
          "lat": 43.6657586,
          "lng": -79.3856777
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2012-11-05",
        "issued": "2013-11-26",
        "desc": "Revision - to add 8 floors (92 Additional dwelling units) + extend level P5.",
        "units": 94,
        "postal": "M4Y",
        "address": "45 CHARLES ST E",
        "geo": {
          "lat": 43.6687226,
          "lng": -79.3839991
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2011-01-10",
        "issued": "2011-06-01",
        "desc": "Proposed interior alterations to existing 9 storey apartment building to convert storage space on 2nd to 9th floors to create eight new batchelor units.",
        "units": 8,
        "postal": "M6M",
        "address": "2110 KEELE ST",
        "geo": {
          "lat": 43.6999724,
          "lng": -79.4767178
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2011-01-18",
        "issued": "2012-10-10",
        "desc": "12 storey condominium with ground floor retail",
        "units": 105,
        "postal": "",
        "address": "85 THE DONWAY   W",
        "geo": {
          "lat": 43.733112,
          "lng": -79.3461251
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2011-02-07",
        "issued": "2012-01-31",
        "desc": "Construct 32 stacked townhouse condominium units with underground parking garage.  2316-2320 Gerrard St E.Separate sprinkler permit required - charged on this permit.",
        "units": 32,
        "postal": "M4E",
        "address": "2316 GERRARD ST E",
        "geo": {
          "lat": 43.6855394,
          "lng": -79.2943696
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2011-02-23",
        "issued": "2012-03-27",
        "desc": "Permit for construction of an 8 unit, four level condominium with an underground parking garage containing 13 parking stalls - See 08 150183 STE 22 SA, for site plan approval application and OMB report ",
        "units": 8,
        "postal": "M4V",
        "address": "271 RUSSELL HILL RD",
        "geo": {
          "lat": 43.6858877,
          "lng": -79.40779909999999
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2011-03-11",
        "issued": "2012-07-17",
        "desc": "Proposal to construct 2 condo buildings (1-7 sty & 1- 16 sty) with link, commercial on ground floor, 349 residential units, and no below grade parking.  West Don lands PHASE 1 (Block 4 West & Block 3).",
        "units": 349,
        "postal": "",
        "address": "635 KING ST E",
        "geo": {
          "lat": 43.6438901,
          "lng": -79.4017301
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2011-04-04",
        "issued": "2012-01-31",
        "desc": "Proposal to construct a 8 sty condo with commercial on ground floor, 3 levels of below grade parking, and 98 residential units.  Also see active SHORING permit 11 134250.",
        "units": 98,
        "postal": "M4M",
        "address": "630 QUEEN ST E",
        "geo": {
          "lat": 43.6583113,
          "lng": -79.35284109999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2011-04-07",
        "issued": "2012-01-30",
        "desc": "Construct 6 storey, 28 unit  residential condo with basement parking and ground floor retail.1864, 1866, 1868, 1870, 1872, 1874, 1876 Queen St E.  Also see Site Plan  - 07 272100Separate sprinkler permit required - charged on this permit.",
        "units": 28,
        "postal": "M4L",
        "address": "1864 QUEEN ST E",
        "geo": {
          "lat": 43.66869579999999,
          "lng": -79.30683479999999
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2011-04-21",
        "issued": "2015-06-22",
        "desc": "Permit to construct new 11 storey residential condo building - 96 residential suites - 3 levels below grade parking - 64 parking spaces including visitor spaces - 10 bicycle parking spaces. - see 10 189510 STE 20 SA for siteplan - 11 169993 MV of C of A.",
        "units": 96,
        "postal": "M5T",
        "address": "15 BEVERLEY ST",
        "geo": {
          "lat": 43.6505174,
          "lng": -79.392129
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2011-05-02",
        "issued": "2011-12-02",
        "desc": "November 28/11, condominium *118 residential units. Applicant and owner advised today that the Brownfields, edc and dc charges will be amended to include the additional 3 suites. dd Nov.28/11 9-storey mixed use condominium building containing (115*) residential units and 250 square meters  of  commercial space located om ground floor.",
        "units": 118,
        "postal": "M3H",
        "address": "760 SHEPPARD AVE W",
        "geo": {
          "lat": 43.7538406,
          "lng": -79.4479522
        },
        "ward": "York Centre"
      },
      {
        "start": "2011-06-10",
        "issued": "2012-04-20",
        "desc": "Block 2 - construction of 36 Stacked Townhouses as part of a total development of 63 stacked townhouses and below grade parking garage. Separate sprinkler permit required - charged on this permit.",
        "units": 36,
        "postal": "M4M",
        "address": "150 BROADVIEW AVE",
        "geo": {
          "lat": 43.6601183,
          "lng": -79.35071099999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2011-06-14",
        "issued": "2012-12-10",
        "desc": "Proposal to Demolish an existing Rooming House (Demolition Permit Application # 10-233657 DEM) and Construct a new 3 sty residential building with 5 dwelling units.  Refer to OMB Order.",
        "units": 5,
        "postal": "M5R",
        "address": "126 A SPADINA RD",
        "geo": {
          "lat": 43.6727316,
          "lng": -79.40652940000001
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2011-06-24",
        "issued": null,
        "desc": "PHASE 1 - Permit to construct new 31 storey building with ground floor community space - 337 residentail units - 485 parking spaces (PHASE 1 and Partial PHASE  2 and visitor parking spaces) - 5 levels below grade parking. - 396 Bicycle parking spaces.",
        "units": 333,
        "postal": "M5V",
        "address": "199 RICHMOND ST W",
        "geo": {
          "lat": 43.6495164,
          "lng": -79.3879544
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2011-06-21",
        "issued": "2013-11-25",
        "desc": "Seven storey condo with 172 units and two levels of underground parking - Phantom Dev.",
        "units": 171,
        "postal": "M2N",
        "address": "399 SPRING GARDEN AVE",
        "geo": {
          "lat": 43.768609,
          "lng": -79.3895119
        },
        "ward": "Willowdale"
      },
      {
        "start": "2011-06-24",
        "issued": "2013-09-05",
        "desc": "Proposal to construct a new (48) storey condominium building with (490) units, (5) levels of underground parking, (1) floor of ground floor retail shell space for Block A 520m2 only- Phase 1.",
        "units": 490,
        "postal": "M8V",
        "address": "2200 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.6227486,
          "lng": -79.481943
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2011-07-14",
        "issued": "2012-01-26",
        "desc": "Proposal to construct a 4 sty condo building with 60 residential units and 1 level of below grade parking.  See 6 demo permits (6 single family dwelling's 66-76 Kippendavie Ave).",
        "units": 60,
        "postal": "M4L",
        "address": "66 KIPPENDAVIE AVE",
        "geo": {
          "lat": 43.6678037,
          "lng": -79.3036858
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2011-07-18",
        "issued": "2012-01-31",
        "desc": "Proposal to construct a condo/townhouse building with retail on ground floor .Separate sprinkler permit required - charged on this permit.",
        "units": 29,
        "postal": "",
        "address": "2000 QUEEN ST E",
        "geo": {
          "lat": 43.6701805,
          "lng": -79.3002078
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2011-07-19",
        "issued": "2013-05-22",
        "desc": "Construct a new (5) storey, (15) commercial units, and (105) senior residential units apartment building. At grade parking.",
        "units": 105,
        "postal": "",
        "address": "136 WESTMORE DR",
        "geo": {
          "lat": 43.7354966,
          "lng": -79.60262259999999
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2011-07-20",
        "issued": "2014-05-30",
        "desc": "Proposal to construct a 20 sty condo with 175 residential units, ground floor commercial, and below grade parking.",
        "units": 175,
        "postal": "M5R",
        "address": "164 AVENUE RD",
        "geo": {
          "lat": 43.6755775,
          "lng": -79.39716399999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2011-07-25",
        "issued": "2014-04-04",
        "desc": "Proposed 12 storey (and mechanical penthouse level) mixed-use residential condominium building with 280 residential units and 999.78m2 of retail space. (Phase 1)",
        "units": 280,
        "postal": "M6S",
        "address": "2490 BLOOR ST W",
        "geo": {
          "lat": 43.6482864,
          "lng": -79.48649
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2011-08-16",
        "issued": "2012-01-12",
        "desc": "18 - Three storey residential units over four live/work units with surface parkingDo not issue! Hold until the C of A is f & b on Jan 4th 2012. RM.",
        "units": 22,
        "postal": "M3H",
        "address": "724 SHEPPARD AVE W",
        "geo": {
          "lat": 43.7541357,
          "lng": -79.44603780000001
        },
        "ward": "York Centre"
      },
      {
        "start": "2011-08-25",
        "issued": "2013-04-04",
        "desc": "Proposal to construct a 29 sty condo with commercial at grade, 2 levels of below grade parking, and 364 residential units. Note: This permit does not include the above-grade portion of the library block.",
        "units": 364,
        "postal": "",
        "address": "170 FORT YORK BLVD",
        "geo": {
          "lat": 43.6394203,
          "lng": -79.3997418
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2011-09-13",
        "issued": "2013-06-20",
        "desc": "Residences of Avonshire Inc. Superstructural residential building 21-storeys, 284 units  (Building C) with 8 storey link , 3 levels u/g parking.",
        "units": 286,
        "postal": "",
        "address": "120 HARRISON GARDEN BLVD",
        "geo": {
          "lat": 43.75773,
          "lng": -79.40315
        },
        "ward": "Willowdale"
      },
      {
        "start": "2011-09-16",
        "issued": "2013-05-31",
        "desc": "PLEASE SEE RELATED ZONING AND PLANNING FOLDERS UNDER 24 BATHURST ST. 09-188168-03 Permit to construct new mixed use building retail at grade and residential above - 28 Storeys, 420 Residential units plus one guest suite, (408 Condo Suites with 12 Town homes).  5 levels below grade parking, 385 parking spaces( 335 Residential 50 Visitor) 250 Residential Bicycle Parking spaces - 40 Visitor Parking Spaces. - ",
        "units": 412,
        "postal": "",
        "address": "75 IANNUZZI ST",
        "geo": {
          "lat": 43.6376698,
          "lng": -79.4011668
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2011-10-06",
        "issued": "2013-05-21",
        "desc": "Proposal to construct a 11 storey residential builidng with 89 dwelling units.Total 28 parking spaces provided (including 5 off-site parking spaces). See 3 demo permits (508, 512, and 516 wellington St W).  Lot comprised of 508, 512 and 516  Wellington St. W.",
        "units": 89,
        "postal": "M5V",
        "address": "508 WELLINGTON ST W",
        "geo": {
          "lat": 43.6434202,
          "lng": -79.3991997
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2011-10-13",
        "issued": "2015-12-22",
        "desc": "Proposal to construct a new mixed use building consisting of one 36 storey (previously 33 storey), and one 33 storey (previously 30 storey) tower above a 7 storey podium, plus mezzanine, with 5 levels below grade parking including one level commercial parking garage. Total residential units revised to 700 (including 2 guest suites). (Previously 646 dwelling units). Lands municipally known as 79 Dunfield Ave, 85 Eglinton Avenue East, 97 Eglinton Avenue East, 101-105 Eglinton Avenue East,109-11 Eglinton Avenue East and 117 Eglinton Avenue East inclusive.",
        "units": 704,
        "postal": "M4P",
        "address": "85 EGLINTON AVE E",
        "geo": {
          "lat": 43.7071258,
          "lng": -79.3950646
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2011-10-18",
        "issued": "2012-01-30",
        "desc": "permit to construct new seven storey apartment building. Building comprised of 2 lower level parking 239 parking spaces - and 230 dwelling units. 188 bicycle parking spaces.Separate sprinkler permit required -charged on this permit.",
        "units": 228,
        "postal": "",
        "address": "64 COLGATE AVE",
        "geo": {
          "lat": 43.6621069,
          "lng": -79.3412941
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2011-10-19",
        "issued": "2014-11-13",
        "desc": "To construct new 10 storey residential building and 39 storey mixed use building with commercial uses on the ground floor, 516 units (Building A and Building B). Foundation drawings in the Kingsway Room",
        "units": 516,
        "postal": "M8V",
        "address": "2157 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.6252707,
          "lng": -79.4798067
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2011-10-26",
        "issued": "2015-02-25",
        "desc": "Proposal to construct new 17-storey mixed-use building consisting of underground parking (3223.4m2), 132 residential units (10704.49m2), retail (362.33m2), mechanical space (883.73m2), with sprinklers included throughout the building (14272.73m2).  Also see STE files 08-186000 for rezoning, and 08-186022 for site plan approval.",
        "units": 132,
        "postal": "M5A",
        "address": "251 KING ST E",
        "geo": {
          "lat": 43.6511783,
          "lng": -79.3679551
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2011-11-02",
        "issued": "2014-01-27",
        "desc": "Orchardview Holdings Inc.  20-storey with 5 levels U/G parking apartment building containing 218 units and 140 parking spaces.",
        "units": 218,
        "postal": "M4R",
        "address": "58 ORCHARD VIEW BLVD",
        "geo": {
          "lat": 43.7081369,
          "lng": -79.4005574
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2011-11-03",
        "issued": "2015-03-19",
        "desc": "Construction of a 21 and 20  storey condominium on common podium complete with 4 below grade levels of parking garage.",
        "units": 666,
        "postal": "M6J",
        "address": "2 LISGAR ST",
        "geo": {
          "lat": 43.6414135,
          "lng": -79.4230524
        },
        "ward": "Davenport"
      },
      {
        "start": "2011-11-10",
        "issued": "2013-06-06",
        "desc": "Tower A - East - 13 Storey apartment building with a 7 storey interconnected podium and three levels of underground parking ",
        "units": 193,
        "postal": "M3H",
        "address": "545 WILSON AVE",
        "geo": {
          "lat": 43.7343048,
          "lng": -79.44742529999999
        },
        "ward": "York Centre"
      },
      {
        "start": "2011-11-17",
        "issued": "2015-11-10",
        "desc": "Proposal to construct a mixed use building comprising of one 16 storey and one 11 storey tower, and 6 levels below grade parking, which includes four levels (P1, P1 Mezz, P2 and P3) commercial parking garage. Total 408 residential dwelling units.  (This includes three additional floors added as per by-law 1116-2013 applied for Dec/13). Public Pool On The Roof Require Separate Permit.(Note-see active stand alone Shoring permit and STR 00 CP)",
        "units": 408,
        "postal": "M5V",
        "address": "621 KING ST W",
        "geo": {
          "lat": 43.64409860000001,
          "lng": -79.4011708
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2011-11-18",
        "issued": "2014-05-09",
        "desc": "Emerald City Developent lll ( Building A1 / A3 on Parkway Forest ) 25 Storey Residential Building over 4 levels of below garde parking, total 316 new residential condominium units.",
        "units": 316,
        "postal": "M2J",
        "address": "130 GEORGE HENRY BLVD",
        "geo": {
          "lat": 43.77360059999999,
          "lng": -79.345354
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2011-11-21",
        "issued": "2012-11-13",
        "desc": "This is for the construction of a mixed use condominium building consisting of eight (8) storey's, with retail on the ground floor and two levels of below grade parking. BIN 2269",
        "units": 89,
        "postal": "M6J",
        "address": "8 GLADSTONE AVE",
        "geo": {
          "lat": 43.6432076,
          "lng": -79.42755559999999
        },
        "ward": "Davenport"
      },
      {
        "start": "2011-12-01",
        "issued": "2013-10-22",
        "desc": "Proposal to construct a 31 sty condo with 5 levels of below grade parking.",
        "units": 233,
        "postal": "M5R",
        "address": "32 DAVENPORT RD",
        "geo": {
          "lat": 43.67327179999999,
          "lng": -79.3898897
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2011-12-02",
        "issued": "2013-01-31",
        "desc": "Proposal to construct new 6 storey 18 unit apartment building with retail use on ground floor.",
        "units": 19,
        "postal": "M8Z",
        "address": "892 THE QUEENSWAY",
        "geo": {
          "lat": 43.6245839,
          "lng": -79.51160639999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2011-12-07",
        "issued": "2016-01-19",
        "desc": "This is for a new seven (7) storey residential condominium with three (3) below grade parking levels. This building will have 19 units. please refer to planning folders associated with this address. The new address of the building will be 36 Haazelton Avenue.",
        "units": 20,
        "postal": "M5R",
        "address": "34 HAZELTON AVE",
        "geo": {
          "lat": 43.6718103,
          "lng": -79.3938088
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2011-12-13",
        "issued": "2015-04-22",
        "desc": "Block 33: This is for a new condominium with 943 units with one tower at 41 storeys located at the southeast is known as tower AA and one tower of 39 storeys located northwest on the property and known as Tower BB. This building will have four(4) levels of below grade parking and the ground floor of both towers will be commercial space.  Interior Fitout and Cladding Permit under 13-241121",
        "units": 87,
        "postal": "",
        "address": "511 BREMNER BLVD",
        "geo": {
          "lat": 43.64046,
          "lng": -79.3926106
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2011-12-16",
        "issued": "2012-12-12",
        "desc": "permit to construct new 5 storey residential building with 75 units - 2 levels below grade parking - 67 parking spaces - 77 bicycle parking spaces. - see 09 108744 STE 19 SA",
        "units": 75,
        "postal": "M6H",
        "address": "707 DOVERCOURT RD",
        "geo": {
          "lat": 43.6604896,
          "lng": -79.4287137
        },
        "ward": "Davenport"
      },
      {
        "start": "2011-12-16",
        "issued": "2013-10-23",
        "desc": ".3Proposal to construct a 25 Storey (+ Mech. Penthouse) residential tower, 3 levels of below grade parking, and  296 residential units. There will be no Non-Residential uses.",
        "units": 296,
        "postal": "",
        "address": "210 SIMCOE ST",
        "geo": {
          "lat": 43.6523246,
          "lng": -79.38915680000001
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2011-12-21",
        "issued": "2013-12-23",
        "desc": "Construct a new 9 storey residential condominium complete with ground floor retail space. A total of 195 units are to be provided. ",
        "units": 195,
        "postal": "M5S",
        "address": "783 BATHURST ST",
        "geo": {
          "lat": 43.66457949999999,
          "lng": -79.4106917
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2011-12-22",
        "issued": "2014-01-09",
        "desc": "Proposal to construct a 8 storey condo with ground floor commercial and 2 levels of underground parking.  70 residential units.",
        "units": 70,
        "postal": "M6K",
        "address": "1205 QUEEN ST W",
        "geo": {
          "lat": 43.6418891,
          "lng": -79.4289684
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2015-04-02",
        "issued": "2016-05-20",
        "desc": "Revision to add 3 addtional residential floors to mixed-use building currently under construction",
        "units": 18,
        "postal": "M5V",
        "address": "56 BLUE JAYS WAY",
        "geo": {
          "lat": 43.6453654,
          "lng": -79.392192
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2012-01-12",
        "issued": "2014-07-28",
        "desc": "Proposal to construct a 32 sty condo with commercial at grade, 232 dwelling units, and 4 levels of below grade parking.",
        "units": 232,
        "postal": "M5V",
        "address": "11 CHARLOTTE ST",
        "geo": {
          "lat": 43.6464256,
          "lng": -79.3934118
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2012-01-18",
        "issued": "2014-06-11",
        "desc": "Proposal to construct a new 33 storey mixed use condo with ground floor retail, 412 residential units, and 5 levels of below grade parking with 163 parking spaces.(TENTATIVE ADDRESS 8 MERCER ST)",
        "units": 412,
        "postal": "M9N",
        "address": "60 JOHN ST",
        "geo": {
          "lat": 43.7038034,
          "lng": -79.51598229999999
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2012-01-24",
        "issued": "2012-05-09",
        "desc": "permit for interior alterations to create 6 new apartment units and res. amenity space on floor 5 of existing apartment building and   see previous PPR's on file.",
        "units": 6,
        "postal": "M6K",
        "address": "103 WEST LODGE AVE",
        "geo": {
          "lat": 43.6450252,
          "lng": -79.4357162
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2012-01-24",
        "issued": "2015-08-24",
        "desc": "Proposal to construct a 40 sty condo with commercial on ground floor, 4 levels of below grade parking, and 336 dwelling units.  252 & 258 Victoria St and 21 Dundas Sq.",
        "units": 336,
        "postal": "M5B",
        "address": "252 VICTORIA ST",
        "geo": {
          "lat": 43.65563849999999,
          "lng": -79.3794872
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2012-02-03",
        "issued": "2013-07-17",
        "desc": "New mixed use building consisting of 2. 14 storey towers connected by a 4 storey podium complete with ground floor commercial in each and 602 residential units above. Included in the proposal is a 4 storey below grade garage facility. ",
        "units": 602,
        "postal": "M6K",
        "address": "1030 KING ST W",
        "geo": {
          "lat": 43.6415814,
          "lng": -79.4159055
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2012-03-08",
        "issued": "2013-05-31",
        "desc": "To construct new six(6) storey - 110 units - Condominium Apartment Building, with 3 above grade parking levels.   Phase 2.",
        "units": 110,
        "postal": "",
        "address": "8 FIELDWAY RD",
        "geo": {
          "lat": 43.64275500000001,
          "lng": -79.52745759999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2012-03-21",
        "issued": "2014-11-06",
        "desc": "Proposal to construct a 10 storey residential building consisting of 215 dwelling units and below grade parking spaces",
        "units": 215,
        "postal": "M6S",
        "address": "2 OLD MILL DR",
        "geo": {
          "lat": 43.6480687,
          "lng": -79.4869791
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2012-03-28",
        "issued": "2014-05-13",
        "desc": "Proposal to construct a 6 sty condo with 28 residential units and ground floor retail.  NOTE:  See active stand alone shoring permit.",
        "units": 28,
        "postal": "M6J",
        "address": "41 OSSINGTON AVE",
        "geo": {
          "lat": 43.6452096,
          "lng": -79.418776
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2012-05-03",
        "issued": null,
        "desc": "Convert 3 storey commercial building to residential units and retail space at ground level and recladding with new windows on north side of building",
        "units": 9,
        "postal": "M6E",
        "address": "416 OAKWOOD AVE",
        "geo": {
          "lat": 43.68852690000001,
          "lng": -79.43951770000001
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2012-05-18",
        "issued": "2013-05-24",
        "desc": "Block 25 South Tower and Podium - New Address will be 55 Belshaw. - Permit to construct new 29 storey mixed use building with 5 storey podium - First 2 levels mixed use commercial / retail / office space, remainder residential - 416 residential units - 2 levels below grade parking",
        "units": 416,
        "postal": "M5T",
        "address": "591 DUNDAS ST E",
        "geo": {
          "lat": 43.6603557,
          "lng": -79.36180379999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2015-03-31",
        "issued": "2016-06-03",
        "desc": "Revision # 01 - For a 2 floor addition (floors 39-40) with an additional 24 residential units to the existing Condo.Proposal to construct a 40 sty condo with commercial on ground floor, below and above grade parking, and 369 residential units.",
        "units": 24,
        "postal": "M5V",
        "address": "290 ADELAIDE ST W",
        "geo": {
          "lat": 43.6480809,
          "lng": -79.3910262
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2012-05-31",
        "issued": "2013-09-18",
        "desc": "Proposed 6/7 storey mixed use building comprising 140 dwelling units. The building has a gross floor area of 10,421.0 square metres including 475 square metres of ground floor commercial space and 2 levels of underground parking.",
        "units": 140,
        "postal": "M2K",
        "address": "18 REAN DR",
        "geo": {
          "lat": 43.7672355,
          "lng": -79.3832439
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2012-06-11",
        "issued": "2014-10-28",
        "desc": "Construction of a new mixed use building 12 storeis in height containing 141 residential dwelling units and ground floor related commercial units (11528m2 of GFA). The project includes a parking area located below grade with 2 levels.       PB folder 10-263084",
        "units": 148,
        "postal": "M4C",
        "address": "2055 DANFORTH AVE",
        "geo": {
          "lat": 43.6852149,
          "lng": -79.31333169999999
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2012-06-13",
        "issued": "2012-08-23",
        "desc": "To construct a rear second and third floor addition to the existing three-storey mixed-use building.  Further, to increase the number of dwelling units from one to six. This will also include interior alterations to the existing portions of the second and third floors..",
        "units": 5,
        "postal": "M4K",
        "address": "523 DANFORTH AVE",
        "geo": {
          "lat": 43.6779748,
          "lng": -79.3481618
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2012-06-26",
        "issued": "2014-11-06",
        "desc": "New 20 storey residential building \"Love Condo\"",
        "units": 296,
        "postal": "",
        "address": "0 BONIS AVE",
        "geo": {
          "lat": 43.7847599,
          "lng": -79.2943455
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2012-06-27",
        "issued": "2014-03-27",
        "desc": "Permit to construct new 30 Storey Residential Rental apartment building with 251 residential units above and 3 levels parking garage secured under related building permit 10-319982. ",
        "units": 251,
        "postal": "M5P",
        "address": "310 TWEEDSMUIR AVE",
        "geo": {
          "lat": 43.6853415,
          "lng": -79.41443550000001
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2012-07-04",
        "issued": "2015-04-09",
        "desc": "43 storey condo with 483 units, linked together with 8 storey condo, two levels of amenedies,  and 4 levels of underground parking ",
        "units": 486,
        "postal": "",
        "address": "55 ANN O'REILLY RD",
        "geo": {
          "lat": 43.773715,
          "lng": -79.3293261
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2012-07-26",
        "issued": "2015-04-14",
        "desc": "Proposal to construct a 34 storey condo with 397 residential units and four levels of below grade parking. Toronto Parking Authority will occupy the upper two of the four levels of below grade parking. Residents' parking to occupy the lowest two levels with additional parking within adjacent #2345 Yonge St.",
        "units": 397,
        "postal": "",
        "address": "30 ROEHAMPTON AVE",
        "geo": {
          "lat": 43.708472,
          "lng": -79.3974985
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2012-08-02",
        "issued": "2013-12-17",
        "desc": "Proposed new development of 11 storey  (132 residential units) Condominium Apartment Building with retail component at the ground floor and underground parking areas.",
        "units": 132,
        "postal": "M8V",
        "address": "13 SUPERIOR AVE",
        "geo": {
          "lat": 43.6152255,
          "lng": -79.489216
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2012-09-12",
        "issued": "2014-01-30",
        "desc": "Proposal to construct new 3 storey mixed use building with 7 commercial and 7 residential units. The entire development is to be a condominium. Building B",
        "units": 7,
        "postal": "M6M",
        "address": "475 ROGERS RD",
        "geo": {
          "lat": 43.6819356,
          "lng": -79.4667289
        },
        "ward": "Davenport"
      },
      {
        "start": "2012-09-13",
        "issued": "2014-09-04",
        "desc": "Construction of a 39-storey mixed-use building with 402 residential units, 5 level below grade parking and the first three levels will be used for a mix of retail and office components. This will be named \"PICASSO\".",
        "units": 402,
        "postal": "M5V",
        "address": "318 RICHMOND ST W",
        "geo": {
          "lat": 43.6489615,
          "lng": -79.3921889
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2012-09-13",
        "issued": "2014-10-07",
        "desc": "Proposal to construct a new 4 storey apartment building with 10 residential units and parking at ground level.",
        "units": 10,
        "postal": "M6P",
        "address": "332 HIGH PARK AVE",
        "geo": {
          "lat": 43.6649931,
          "lng": -79.4706741
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2012-10-11",
        "issued": "2014-01-29",
        "desc": "Proposal to construct a new 23 storey apartment building (please refer to 12-261326 DM) ",
        "units": 211,
        "postal": "M4Y",
        "address": "66 ISABELLA ST",
        "geo": {
          "lat": 43.6684625,
          "lng": -79.382852
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2012-10-23",
        "issued": "2015-08-04",
        "desc": "Construct a new 11 storey mixed use building with 236 residential units (14167m2), 3 levels of below grade parking (4941m2), green roof (1132m2), and commercial at grade (913m2).  See related Site Plan Approval file 11-237693 (still under review), OMB file 11-300231, and Rezoning file 12-104040 (still open)",
        "units": 236,
        "postal": "M5V",
        "address": "434 ADELAIDE ST W",
        "geo": {
          "lat": 43.6465497,
          "lng": -79.3975517
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2012-11-01",
        "issued": "2013-08-20",
        "desc": "Interior Alterations and one floor addition to convert a 14 storey office building into a 15 storey Residential Condominium.",
        "units": 168,
        "postal": "M3C",
        "address": "75 THE DONWAY   W",
        "geo": {
          "lat": 43.7328063,
          "lng": -79.34567009999999
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2012-11-13",
        "issued": "2015-09-04",
        "desc": "Proposal to construct a new 6 storey condominium with 45 units and 3 levels of underground parking (4211.0m2). See related demo permit 09-191786, as well as 09-192003 STE 32 OZ, 09 192015 STE 32 SA, 11-131533 CO & 11-196147 OA.",
        "units": 47,
        "postal": "M4E",
        "address": "580 KINGSTON RD",
        "geo": {
          "lat": 43.6786875,
          "lng": -79.3000965
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2012-11-22",
        "issued": "2017-12-11",
        "desc": "Proposal to construct a 21 sty condo with 3 levels of below grade parking and 406 residential units.  See stand alone shoring 12 123243.",
        "units": 476,
        "postal": "M6J",
        "address": "48 ABELL ST",
        "geo": {
          "lat": 43.64225039999999,
          "lng": -79.4241566
        },
        "ward": "Davenport"
      },
      {
        "start": "2012-12-05",
        "issued": "2017-05-26",
        "desc": "Interior alterations to all floors to convert existing hotel into condo's (total 489 units) and small portion of retail space.  NOTE:  see active BLD permits.",
        "units": 489,
        "postal": "M5R",
        "address": "155 YORKVILLE AVE",
        "geo": {
          "lat": 43.6703938,
          "lng": -79.39430279999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2012-12-14",
        "issued": "2017-06-30",
        "desc": "Proposal to make interior alterations to existing detached house for converted house containing 5 units and construct 3rd floor sundeck. Also construct addition (71m2) to existing 1 1/2 storey garage at rear and make interior alterations (61.16m2) for use as a detached house. Also attach trellis structure at rear of converted house to side wall of detached house. Please see OMB order.",
        "units": 5,
        "postal": "M6H",
        "address": "953 DUFFERIN ST",
        "geo": {
          "lat": 43.6581773,
          "lng": -79.4344563
        },
        "ward": "Davenport"
      },
      {
        "start": "2012-12-20",
        "issued": "2014-09-30",
        "desc": "Proposal to construct a 7 sty condo with commercial on the ground floor and 2 levels of below grade parking.  51 dwelling units.  \"IT LOFTS\".",
        "units": 47,
        "postal": "M6H",
        "address": "998 COLLEGE ST",
        "geo": {
          "lat": 43.6534906,
          "lng": -79.4286099
        },
        "ward": "Davenport"
      },
      {
        "start": "2012-12-21",
        "issued": "2014-02-26",
        "desc": "Proposal to construct new mixed use building: two residential towers on 5 storey residential/commercial podium and underground parking (19 storey tower \"A\" with podium).",
        "units": 199,
        "postal": "M9A",
        "address": "25 FONTENAY CRT",
        "geo": {
          "lat": 43.6825151,
          "lng": -79.51112979999999
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2012-12-27",
        "issued": "2020-02-18",
        "desc": "Construct a mixed use building with commercial retail/multiple residential uses, Phase 1B, Building I. (28) stories, 272 units and (2) levels of parking (above street level), and Retail on Street level (P3).",
        "units": 272,
        "postal": "M9M",
        "address": "3425 WESTON RD",
        "geo": {
          "lat": 43.7493974,
          "lng": -79.5411611
        },
        "ward": "Humber River-Black Creek"
      },
      {
        "start": "2013-01-08",
        "issued": "2018-02-28",
        "desc": "Feb 20/14 C of A approved 130 m height and 381 unitsConstruct new (41) storey residential only condo with (5) level of underground parking. June 10, 2015,   total number of units: 382 ",
        "units": 381,
        "postal": "M8V",
        "address": "2175 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.6243317,
          "lng": -79.4801493
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2013-01-21",
        "issued": "2014-09-09",
        "desc": "New 20-unit three-storey apartment building with attached townhomes (3198m2), below grade parking  which will be sprinklered (777m2), and mechanical services (12.54m2).  Includes addresses 842, 844, and 846 Richmond St W.  See demolition permit 13-109064 DEM, and STE file 11-240844.",
        "units": 20,
        "postal": "M6J",
        "address": "850 RICHMOND ST W",
        "geo": {
          "lat": 43.6447085,
          "lng": -79.41198779999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2013-02-14",
        "issued": "2014-06-12",
        "desc": "Proposed 4 storey building for offices, 16 respite care rooms, recreational - mixed uses (Seniors Multi Service Centre).",
        "units": 16,
        "postal": "",
        "address": "300 SILVER STAR BLVD",
        "geo": {
          "lat": 43.8125721,
          "lng": -79.29492540000001
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2013-02-26",
        "issued": "2014-01-29",
        "desc": "New 14 storey mixed use residential with commercial on ground floor",
        "units": 401,
        "postal": "M6P",
        "address": "1844 BLOOR ST W",
        "geo": {
          "lat": 43.6542799,
          "lng": -79.46305699999999
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2013-03-01",
        "issued": "2014-12-18",
        "desc": "BUILDING 1 - Proposal to construct a 3 sty stacked and back-to-back townhouse building with 16 residential units with basement parking garage.  Refer to LEAD FILE 13-127046 BLD for drawings, documents and approvals.  BUILDING 2 is under file 13-127053 BLD.",
        "units": 16,
        "postal": "M4L",
        "address": "1321 GERRARD ST E",
        "geo": {
          "lat": 43.6711864,
          "lng": -79.326092
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2013-03-12",
        "issued": "2016-04-05",
        "desc": "Proposal to construct a new 58 storey multi use building with 489 residential suites, ground floor retail and office space, and 5 levels of below grade parking with 362 parking spaces.  See also 11 259298 STE.",
        "units": 525,
        "postal": "",
        "address": "40 SCOTT ST",
        "geo": {
          "lat": 43.6486632,
          "lng": -79.3765973
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-01-18",
        "issued": "2017-06-14",
        "desc": "REV. #3 - see cover letter 1 new floor added on both residential towers. 20 new units",
        "units": 25,
        "postal": "",
        "address": "90 HARBOUR ST",
        "geo": {
          "lat": 43.641756,
          "lng": -79.3798912
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2013-04-09",
        "issued": "2015-01-22",
        "desc": "Proposal to construct a new 3 storey (plus mezzanine) residential condo with 8 units.  See also 13 146613 DEM, 11 248837 ZPR, 11 248849 STE, 11 296890 MV and Final and binding A0842/11TEY.",
        "units": 8,
        "postal": "M4E",
        "address": "715 KINGSTON RD",
        "geo": {
          "lat": 43.6793196,
          "lng": -79.2956811
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2013-04-22",
        "issued": "2014-12-22",
        "desc": "Construction of 12 storey residential building with 94 units & 3 levels of under ground parking.",
        "units": 94,
        "postal": "",
        "address": "28 AVONDALE AVE",
        "geo": {
          "lat": 43.7588543,
          "lng": -79.4086256
        },
        "ward": "Willowdale"
      },
      {
        "start": "2013-05-07",
        "issued": "2017-04-04",
        "desc": "Proposal to construct a new 9 sty condo with commercial at grade, 91 residential units, and 3 levels of below grade parking.  925-935 Eglinton Ave W .  See Demo permit under 925 Eglinton Ave W - 13 164199.  ",
        "units": 91,
        "postal": "M6C",
        "address": "927 A EGLINTON AVE W",
        "geo": {
          "lat": 43.7002499,
          "lng": -79.42784999999999
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2013-05-24",
        "issued": "2016-08-22",
        "desc": "Proposal to construct 47 storey apartment building with 523 residential units, retail store, amenity area and 4 levels of underground parking garage.Available roof area 874m2, 60 percent required 524m2, provided 524m2",
        "units": 523,
        "postal": "M8Y",
        "address": "10 PARK LAWN RD",
        "geo": {
          "lat": 43.6232425,
          "lng": -79.48385929999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2013-06-06",
        "issued": "2015-01-15",
        "desc": "Proposal to construct a new 12-storey mixed use building containing office use at grade, 311 dwelling units, and 328 parking spaces below grade.  See also 11 235813 STE and 12 257660 DEM.  See 12-273090 for Shoring Permit and CP Shoring for this project.",
        "units": 311,
        "postal": "M4M",
        "address": "345 CARLAW AVE",
        "geo": {
          "lat": 43.6651693,
          "lng": -79.34151279999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2013-06-28",
        "issued": "2016-10-24",
        "desc": "Proposal to construct a 56 sty condo with 3 sty podium, 474 residential units, and 4 levels of below grade parking.  NOTE: See active stand alone shoring permit 12 289406.",
        "units": 470,
        "postal": "M4Y",
        "address": "42 CHARLES ST E",
        "geo": {
          "lat": 43.66930079999999,
          "lng": -79.38417079999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2013-06-28",
        "issued": "2015-04-07",
        "desc": "PHASE I- Construct a 8 sty condo with commercial at ground floor, 2 level of below grade parking, and 81 residential units.  See active stand alone Shoring Permit 13 160064.",
        "units": 81,
        "postal": "M6R",
        "address": "24 HOWARD PARK AVE",
        "geo": {
          "lat": 43.651682,
          "lng": -79.4509118
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2013-06-28",
        "issued": "2015-07-03",
        "desc": "Proposal to construct a 32 sty condo with a 14 sty podium, 458 residential units, ground floor commercial, and 3 levels of below grade parking.",
        "units": 458,
        "postal": "",
        "address": "1000 BAY ST",
        "geo": {
          "lat": 43.6650475,
          "lng": -79.387829
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2013-08-01",
        "issued": "2015-07-30",
        "desc": "Construct new (29) storey hi-rise, 278 units and (2) levels underground garage Bldg C Phase 3.June01/15 Revised drawings submitted with proposed increase of number of Appartment Units from 278 to 298.",
        "units": 298,
        "postal": "",
        "address": "9 VALHALLA INN RD",
        "geo": {
          "lat": 43.63996789999999,
          "lng": -79.5594655
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2013-08-02",
        "issued": "2014-05-07",
        "desc": "Proposal to construct a 8 sty condo with commercial at grade, 2 levels of undground parking, and 78 residential units.",
        "units": 77,
        "postal": "M6J",
        "address": "856 DUNDAS ST W",
        "geo": {
          "lat": 43.651525,
          "lng": -79.4105027
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2013-08-12",
        "issued": "2015-03-09",
        "desc": "Proposal to construct a new 7 sty condo with 24 residential units, ground floor commercial and stacked parking, and 1 basement level containing storage, mechanical, and amenity space.  See active Demo permit 13 219136.",
        "units": 23,
        "postal": "M5T",
        "address": "202 BATHURST ST",
        "geo": {
          "lat": 43.6478942,
          "lng": -79.4044728
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2013-08-28",
        "issued": "2016-12-28",
        "desc": "Construct 35 storey residential tower 363 units, 3 level parking garage - Tower A",
        "units": 363,
        "postal": "",
        "address": "255 VILLAGE GREEN SQ",
        "geo": {
          "lat": 43.7798187,
          "lng": -79.28286250000001
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2013-08-29",
        "issued": "2015-07-24",
        "desc": "To construct a 14-storey plus mechanical penthouse apartment building containing 156 suites, underground parking including a commercial parking garage235931.44 x 0.60 =141558.86",
        "units": 156,
        "postal": "M4S",
        "address": "68 MERTON ST",
        "geo": {
          "lat": 43.6970463,
          "lng": -79.3941536
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2013-09-03",
        "issued": "2019-05-09",
        "desc": "Proposal to construct a new mixed use building comprised of two residential towers 58 storeys and 34 storeys in height connected by 3 levels of below grade parking.  Proposal will contain 1089 dwelling units (1024 condo + 65 rental replacement units). See related 13-148633 SA.",
        "units": 1089,
        "postal": "M4P",
        "address": "2281 YONGE ST",
        "geo": {
          "lat": 43.7072491,
          "lng": -79.3982236
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2013-09-18",
        "issued": "2019-02-05",
        "desc": "Proposal to construct a new 60 storey mixed use building (plus a mechanical penthouse and an elevator mechanical room), comprising of 694 dwelling units to the rear of the heritage building.  A proposed podium is 9-storey's containing the lobby to be located within the heritage building, above grade parking (floors 3 to 8), amenity uses (floors 9 and 10) and retail uses at grade and level 2 in the area currently used as private open space adjacent the heritage building on the north side.  There are 131 above grade parking spaces proposed.  One below grade level is proposed to include mechanical and service areas and bicycle parking. The application proposes to retain the front portion of the existing heritage building (Bank Building) on the premises.",
        "units": 697,
        "postal": "M5B",
        "address": "197 YONGE ST",
        "geo": {
          "lat": 43.65343590000001,
          "lng": -79.3791875
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2013-09-19",
        "issued": "2016-01-05",
        "desc": "11 storey residential building and a 4 storey podium containing 207 dwelling units, a retail unit on P1 level and three levels of underground parking - South Tower - Flaire Condominiums. See permit No. 13-238466 for 3 levels under ground parking",
        "units": 296,
        "postal": "",
        "address": "99 THE DONWAY   W",
        "geo": {
          "lat": 43.73388910000001,
          "lng": -79.3467757
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2013-09-23",
        "issued": "2017-07-04",
        "desc": "Proposal to construct a 17 sty condo with 433 residential units, ground floor commercial, and 4 levels of below grade parking including commercial parking garage at P1.  Portion of lot to be conveyed for publicly owned park and the extension of Brown's lane, both of which would be accomplished through stata conveyances.Included is an above grade LDA registered on title and attached to the permit record respecting the easterly face of the building as projected to Adelaide Place. \"MUSEE CONDO'S\".",
        "units": 433,
        "postal": "M5V",
        "address": "525 ADELAIDE ST W",
        "geo": {
          "lat": 43.6452261,
          "lng": -79.40218279999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2013-09-26",
        "issued": "2016-03-24",
        "desc": "Proposal to construct a new 17 sty condo with 171 residential units, ground floor commercial, and 3 levels of below grade parking.  \"Fabrik\".",
        "units": 171,
        "postal": "M5V",
        "address": "431 RICHMOND ST W",
        "geo": {
          "lat": 43.6476853,
          "lng": -79.39673259999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2013-10-25",
        "issued": "2022-05-27",
        "desc": "Proposal to construct a 27 sty condo (including 11 townhouse condo units) with a total of 240 residential units inclusive of the townhouse units and 3 levels of below grade parking.",
        "units": 240,
        "postal": "",
        "address": "101 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6863386,
          "lng": -79.39875190000001
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2013-11-04",
        "issued": "2016-08-05",
        "desc": "To construct a 7 unit  townhouse BLOCK 100 in conjunction with 6 other townhouse Blocks and an underground parking garage.See 13-206655 fro U/GGarage which has the only paper reference set of plans.Refer to 13-120359 SA and 10-126796 WET 06 OZ",
        "units": 7,
        "postal": "M8W",
        "address": "636 EVANS AVE",
        "geo": {
          "lat": 43.6103913,
          "lng": -79.5513204
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2013-11-05",
        "issued": "2015-08-14",
        "desc": "To construct a new 20 storey condo building containing 434 residential dwelling units, three below grade parking levels, and retail and office uses on the ground floor.",
        "units": 439,
        "postal": "M6J",
        "address": "11 PEEL AVE",
        "geo": {
          "lat": 43.64379640000001,
          "lng": -79.4284926
        },
        "ward": "Davenport"
      },
      {
        "start": "2013-11-05",
        "issued": "2015-10-07",
        "desc": "To construct a new seven storey condo building containing 128 dwelling units, and three levels of below grade parking.",
        "units": 137,
        "postal": "M6J",
        "address": "20 GLADSTONE AVE",
        "geo": {
          "lat": 43.64349180000001,
          "lng": -79.42763029999999
        },
        "ward": "Davenport"
      },
      {
        "start": "2013-11-07",
        "issued": "2016-10-27",
        "desc": "New 9 storey condo with retail on the ground level and 3 storey of under ground parking with 4 unit detached town homes on the side of condo for Dream Residences @ Yorkdale.",
        "units": 83,
        "postal": "",
        "address": "16 MCADAM AVE",
        "geo": {
          "lat": 43.7229155,
          "lng": -79.4571149
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2013-11-19",
        "issued": "2017-06-22",
        "desc": "Proposal to construct a 40 sty condo with commercial at-grade, 313 condo units, on existing below grade parking garage.  Note - See active BLD permit for revised below grade parking alterations 11 332063-03 BLD.",
        "units": 313,
        "postal": "",
        "address": "188 CUMBERLAND ST",
        "geo": {
          "lat": 43.6697824,
          "lng": -79.3942951
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2013-11-21",
        "issued": "2014-01-30",
        "desc": "Proposal to reconstruct and make interior alterations to three storey mixed use building with ground floor commercial and 6 dwelling units on 2nd & 3rd floors due to fire damage.  See Emergency Order 13 204472.",
        "units": 6,
        "postal": "M4M",
        "address": "359 BROADVIEW AVE",
        "geo": {
          "lat": 43.6653364,
          "lng": -79.3524013
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2013-11-22",
        "issued": "2017-12-19",
        "desc": "Proposal to construct a new a new 9 storey building complete with 85 residential dwellings units (8136.6m2) and office space (1796.1m2) on the ground, 2nd and 3rd floors. There will be a total of 93 vehicular parking spaces located below grade.",
        "units": 86,
        "postal": "M6H",
        "address": "138 ST HELEN'S AVE",
        "geo": {
          "lat": 43.6538102,
          "lng": -79.4424367
        },
        "ward": "Davenport"
      },
      {
        "start": "2013-11-25",
        "issued": "2016-09-23",
        "desc": "Proposal to construct a new mixed use  building of 46,838 sqaure metres for commercial and residential purposes.  The redevelopment includes the retention of the existing building at the corner of Dupont Street and Lansdowne Avenue for commercial purposes, and the construction of 576 residential dwelling units.  Most of the dwelling units are contained in two towers of 23-storeys and 27-storeys.  There will be 2 levels of below grade parking and a total of 730 parking spaces. ",
        "units": 576,
        "postal": "",
        "address": "830 LANSDOWNE AVE",
        "geo": {
          "lat": 43.6668502,
          "lng": -79.4469307
        },
        "ward": "Davenport"
      },
      {
        "start": "2013-12-03",
        "issued": "2015-10-13",
        "desc": "Proposal for a new 12 storey mixed use building with 79 residential units (13350.12m2) above 396.06m2 of retail space. There will be 5 levels of below grade parking. Proposal also includes HVAC and PLB.",
        "units": 70,
        "postal": "M5R",
        "address": "181 DAVENPORT RD",
        "geo": {
          "lat": 43.6749459,
          "lng": -79.39383040000001
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2013-12-06",
        "issued": "2014-04-09",
        "desc": "Proposed addition (303.60 m2)  and interior alterations (1059 m2) to existing 2 storey emergency housing and drop in/employment centre (alterations to the basement, ground, and 2nd floors) - \"YMCA\"",
        "units": 19,
        "postal": "M5T",
        "address": "7 VANAULEY ST",
        "geo": {
          "lat": 43.6488388,
          "lng": -79.3982395
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2013-12-16",
        "issued": "2014-03-26",
        "desc": "To complete interior alterations to suite 423 of the existing condo building (TSCC 1978 Registered in 2008) for 5 live/work units.  see zzc 13 108704See CofA Decision A0318/13TEY",
        "units": 5,
        "postal": "M6K",
        "address": "43 HANNA AVE",
        "geo": {
          "lat": 43.6389042,
          "lng": -79.4195025
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2013-12-18",
        "issued": "2015-12-22",
        "desc": "Proposal for alterations to existing warehouse to create 50 beds for youth, transitional housing along with associated support uses including kitchen, counselling, support offices, other training and resources rooms; and new print shop/commerce school and training. A cool roof is being provided in lieu of a green. Proposal includes HVAC and PLB. ",
        "units": 10,
        "postal": "M5V",
        "address": "60 BRANT ST",
        "geo": {
          "lat": 43.6473148,
          "lng": -79.39880769999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2013-12-20",
        "issued": "2018-05-04",
        "desc": "Proposal to construct a new 11 storey mixed use building containing partial GF/2nd/3rd commercial areas (415 sq/m), 43 residential suites, and  three levels of underground parking with 49 parking spaces.",
        "units": 42,
        "postal": "M5R",
        "address": "124 PEARS AVE",
        "geo": {
          "lat": 43.6756479,
          "lng": -79.3977152
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2013-12-24",
        "issued": "2017-03-23",
        "desc": "Proposal to construct a 12 unit townhouse building (Block BB9)see related 12-255414 OZ & 12-247275 SA Planning Files",
        "units": 12,
        "postal": "M9C",
        "address": "2 HOLIDAY DR",
        "geo": {
          "lat": 43.6500557,
          "lng": -79.5671996
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2013-12-27",
        "issued": null,
        "desc": "Proposal to construct a 27 storey apartment building (242 units) with commercial space on ground floor ",
        "units": 242,
        "postal": "M8Y",
        "address": "327 ROYAL YORK RD",
        "geo": {
          "lat": 43.6164121,
          "lng": -79.49804189999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2013-12-30",
        "issued": "2020-04-17",
        "desc": "Proposal to construct a new 28 storey condo, including 6 three-storey townhomes on south side, with a total of 259 residential units, and 5 levels of below grade parking. Deer Park Condo.",
        "units": 259,
        "postal": "M4V",
        "address": "129 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6863521,
          "lng": -79.4001911
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2014-01-28",
        "issued": "2016-12-16",
        "desc": "BLOCK 2: Proposal to construct four (4) storey stacked townhouse block with 36 units.                                  By-law 1723-2013 applies to this site",
        "units": 36,
        "postal": "M8W",
        "address": "3600 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.5943324,
          "lng": -79.5350962
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2014-02-03",
        "issued": "2016-10-26",
        "desc": "Proposal to construct a 13 sty condo with 363 residential units, 4 levels of below grade parking including 1 level of commercial parking, and ground floor commercial.",
        "units": 363,
        "postal": "",
        "address": "15 MERCHANTS' WHARF",
        "geo": {
          "lat": 43.6452143,
          "lng": -79.3643082
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2014-03-07",
        "issued": "2015-12-14",
        "desc": "Proposal to construct a 10 sty addition on top of existing 33 sty building, 8 sty addition at north side for rental apartments, 8 sty addition at south side for condos, and interior alterations to all floors to convert from hotel/rental building (118 units) to condo's including ground floor retail.  New Total Residential Units = 769.  Existing below parking garage to remain.  See active interior demo permit 14 120033 BLD, and permit for exterior cladding removal 14 126031 BLD.",
        "units": 769,
        "postal": "M5S",
        "address": "955 BAY ST",
        "geo": {
          "lat": 43.6647727,
          "lng": -79.3869867
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2014-03-10",
        "issued": "2018-06-14",
        "desc": "To construct a new 5 storey condo building containing 45 residential units.",
        "units": 86,
        "postal": "M5V",
        "address": "90 NIAGARA ST",
        "geo": {
          "lat": 43.6417684,
          "lng": -79.4038314
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2014-03-13",
        "issued": "2015-05-28",
        "desc": "Proposal to construct a new 11-storey mixed use condominium building containing 95 residential units with retail uses on the ground floor. Scope of work includes 2 floors below grade underground parking garage.",
        "units": 95,
        "postal": "M5T",
        "address": "270 SPADINA AVE",
        "geo": {
          "lat": 43.65237279999999,
          "lng": -79.39821020000001
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2014-03-14",
        "issued": "2016-10-19",
        "desc": "To construct a new 15 storey condo building containing 249 residential units.",
        "units": 249,
        "postal": "",
        "address": "70 IANNUZZI ST",
        "geo": {
          "lat": 43.6377271,
          "lng": -79.4017676
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2014-04-14",
        "issued": "2016-01-06",
        "desc": "Proposal to construct a 10 sty condo with 143 residential units and 3 levels of below grade parking.",
        "units": 143,
        "postal": "M6R",
        "address": "383 SORAUREN AVE",
        "geo": {
          "lat": 43.650384,
          "lng": -79.4448579
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2014-04-24",
        "issued": "2017-11-24",
        "desc": "Construct a new 5 storey Retirement Home & Assisted Living Facility Block I",
        "units": 128,
        "postal": "M2R",
        "address": "555 FINCH AVE W",
        "geo": {
          "lat": 43.7719953,
          "lng": -79.4473053
        },
        "ward": "York Centre"
      },
      {
        "start": "2014-04-24",
        "issued": "2016-09-14",
        "desc": "Phase 1 - 17 storey residential condominium building with 186  units Buidling B with underground parking garage",
        "units": 264,
        "postal": "M2J",
        "address": "3-5 ALLENBURY GDNS",
        "geo": {
          "lat": 43.7805504,
          "lng": -79.34301060000001
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2014-05-21",
        "issued": "2016-05-17",
        "desc": "Proposal to construct an 8-storey mixed-use building containing commercial uses at grade with 83 dwelling units above plus an additional 13 multi floor townhouse type units. There will be 2 levels of below grade parking containing  105 parking spaces and a total of 79 bicycle spaces will be provided on site. ",
        "units": 97,
        "postal": "M4M",
        "address": "1230 DUNDAS ST E",
        "geo": {
          "lat": 43.6652656,
          "lng": -79.34036859999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2014-06-15",
        "issued": "2015-12-22",
        "desc": "Construct a 8 storey apartment building with 79 residential units and 1 level below grade amenity and common areas connecting to an existing building by an underground walkway.",
        "units": 79,
        "postal": "M4P",
        "address": "88 ERSKINE AVE",
        "geo": {
          "lat": 43.712337,
          "lng": -79.396133
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2018-01-11",
        "issued": "2018-08-02",
        "desc": "Revision to add 5 additional dwelling units (Suites 511 & 512 as per bylaw & Suites 2812, 3612, and 6512 as per COA) and reduce parking spaces.  See COA.",
        "units": 5,
        "postal": "M4Y",
        "address": "460 YONGE ST",
        "geo": {
          "lat": 43.6618211,
          "lng": -79.3835376
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2014-07-28",
        "issued": "2015-06-22",
        "desc": "Proposal to construct a 4 sty residential building containing 6 dwelling units.",
        "units": 6,
        "postal": "M6G",
        "address": "354 HARBORD ST",
        "geo": {
          "lat": 43.6594036,
          "lng": -79.4210926
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2014-08-08",
        "issued": "2016-04-14",
        "desc": "To construct a new 10 storey mixed use building containing 122 residential suites and retail on the ground floor. Two levels of below grade parking for Residents, including a commecial parking garage with 8 parking spaces. Previously 829, 833 and 835 St Clair Ave W.",
        "units": 117,
        "postal": "M6C",
        "address": "829 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6802749,
          "lng": -79.4314586
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2014-08-08",
        "issued": "2018-12-06",
        "desc": "Proposal to convert the 3rd, 4th, and 5th floors from medical office to residential units (26 residential units in total), alter front facade to accommodate recessed balconies, construct rear Third Floor deck/amenity space, and for interior alterations to the basement to convert from medical office to retail (Group E).",
        "units": 26,
        "postal": "M5T",
        "address": "302 SPADINA AVE",
        "geo": {
          "lat": 43.6533296,
          "lng": -79.39859799999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2014-08-14",
        "issued": "2016-06-01",
        "desc": "To construct a new six storey mixed use building containing 48 residential units, and retail on the ground floor.",
        "units": 48,
        "postal": "M4M",
        "address": "1075 QUEEN ST E",
        "geo": {
          "lat": 43.66167249999999,
          "lng": -79.3364711
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2014-08-15",
        "issued": "2017-02-13",
        "desc": "To construct a new 25 storey condo building with 254 residential dwelling units, and retail uses on grade.  There will also be five floors of below grade parking provided. See PB folder 14-265922",
        "units": 254,
        "postal": "",
        "address": "60 COLBORNE ST",
        "geo": {
          "lat": 43.6493024,
          "lng": -79.374567
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2014-09-04",
        "issued": "2017-03-17",
        "desc": "To construct a new 8 storey mixed use building with groundfloor commercial, and 128 Residential units and includes an underground parking with 2 levels",
        "units": 128,
        "postal": "M6L",
        "address": "2522 KEELE ST",
        "geo": {
          "lat": 43.715099,
          "lng": -79.4797923
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2014-09-29",
        "issued": "2015-11-19",
        "desc": "Proposal for a 2 floor addition to existing 2 storey mixed use building. Commercial use on the ground and 2nd floors and 12 residential units on the 3rd and 4th floors.",
        "units": 12,
        "postal": "M6H",
        "address": "455 DOVERCOURT RD",
        "geo": {
          "lat": 43.6543502,
          "lng": -79.4263258
        },
        "ward": "Davenport"
      },
      {
        "start": "2014-10-15",
        "issued": "2018-02-27",
        "desc": "To construct a new mixed use building containing 452 residential units and two retail units complete with commercial parking garage further to zoning by law 1029-2014 and COA A0436/16TEY. See 13 128786 STE SA & 13 128791 STE OZ",
        "units": 452,
        "postal": "M4P",
        "address": "183 ROEHAMPTON AVE",
        "geo": {
          "lat": 43.70896159999999,
          "lng": -79.3930381
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2014-10-22",
        "issued": "2017-06-07",
        "desc": "Adaptive reuse of exisiting heritage building for commerical use new 27 storey apartment building behind with 4 levels parking.",
        "units": 238,
        "postal": "M4P",
        "address": "2384 YONGE ST",
        "geo": {
          "lat": 43.7097293,
          "lng": -79.40050280000001
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2014-10-28",
        "issued": "2015-03-17",
        "desc": "To  construct a second floor addition which will contain new dormitories for the existing \"Great Lakes College\". A total of 18 new dormitories will be created as a result of this proposal.REVISED DEC/14 TO REFLECT ZZC",
        "units": 18,
        "postal": "M6P",
        "address": "323 KEELE ST",
        "geo": {
          "lat": 43.6642042,
          "lng": -79.46357669999999
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2014-11-03",
        "issued": "2018-06-19",
        "desc": "Proposal to construct a 56 storey condo with 585 residential units, ground floor commercial spaces, 4 levels of underground parking, and conserve the existing buildings in accordance with the approved Conservation Plan.  836-850 YONGE ST & 1-9A YORKVILLE AVE.",
        "units": 584,
        "postal": "M4W",
        "address": "836 YONGE ST",
        "geo": {
          "lat": 43.6714218,
          "lng": -79.3876621
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2014-11-04",
        "issued": "2018-07-10",
        "desc": "To construct a 23 storey building with 338 dwelling units, retail at ground level and 4 levels of underground parking levels",
        "units": 341,
        "postal": "M2J",
        "address": "2205 SHEPPARD AVE E",
        "geo": {
          "lat": 43.7741807,
          "lng": -79.3295249
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2014-11-06",
        "issued": "2019-11-22",
        "desc": "To construct a new 16 storey Mixed use apartment Building with 281 Residential units, ground floor retail and underground garage                                                                                                                                                                                                                                                                                                                                                           Subject to By-law 1137-2010",
        "units": 281,
        "postal": "M8V",
        "address": "2143 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.6263156,
          "lng": -79.4791881
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2014-11-12",
        "issued": "2018-04-10",
        "desc": "13 storey apartment building containing 245 residential dwelling units and four levels of underground parking - Colours of Emerald City - BIYU - Phase 1, Block B1",
        "units": 246,
        "postal": "",
        "address": "125 GEORGE HENRY BLVD",
        "geo": {
          "lat": 43.7735085,
          "lng": -79.34639140000002
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2014-11-18",
        "issued": "2016-12-21",
        "desc": "Construct 35 storey new condominium (The Beacon) with retail on ground floor and commerical on 2nd and 3rd floors (374 dwelling units)",
        "units": 374,
        "postal": "M2N",
        "address": "5200 YONGE ST",
        "geo": {
          "lat": 43.7706307,
          "lng": -79.413716
        },
        "ward": "Willowdale"
      },
      {
        "start": "2014-11-18",
        "issued": "2017-11-28",
        "desc": "Proposal to construct a 56-storey condominium with 621 residential units, (4 of which are condo townhouses adajancent to the tower) and 10 storeys of office on the northern portion, the ground floor will be commercial  with 3 levels of underground parking, \"CASA III\", note: see two active shoring permits 14-232376 and 14-251344",
        "units": 619,
        "postal": "M4Y",
        "address": "50-60 CHARLES ST E",
        "geo": {
          "lat": 43.6695712,
          "lng": -79.38381969999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2014-11-24",
        "issued": "2018-12-17",
        "desc": "Proposal to construct  a new 60 storey mixed use building containing 739 dwelling units, 5,650 square metres of non-residential uses including retail uses at grade and office uses in the second and third floors.  There are 134 commercial parking spaces and 471 residential parking spaces proposed below grade and 774 bicycle parking spaces. The proposal also includes an expanded park space from Wellesley Street to Breadalbane Street.  The site is subject to site specific by-laws 1063-2014 and 1064-2014.  See also 14 227846 STE.",
        "units": 740,
        "postal": "",
        "address": "11 WELLESLEY ST W",
        "geo": {
          "lat": 43.6645669,
          "lng": -79.38534320000001
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2014-11-26",
        "issued": "2017-05-02",
        "desc": "Proposal to construct a 28 storey mixed-use condominium containing 332 residential units (5 stacked townhouses adajacent to the tower), with retail on the ground floor and 6 levels of above grade parking",
        "units": 333,
        "postal": "M5A",
        "address": "210 EASTERN AVE",
        "geo": {
          "lat": 43.6553122,
          "lng": -79.35404919999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2014-11-26",
        "issued": "2017-11-24",
        "desc": "Proposal to construct a 44 storey condo with 552 residential units, 9 storey podium, 5 levels of below grade parking, and commercial at ground floor.  See also 11 294755 STE, 13 227411 ZPR, and the OMB decision.",
        "units": 552,
        "postal": "",
        "address": "12 BONNYCASTLE ST",
        "geo": {
          "lat": 43.6460368,
          "lng": -79.3649192
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2014-12-05",
        "issued": "2017-06-16",
        "desc": "7 storey apartment building containing a total of 69 dwelling units of which 13 are two storey dwelling units at grade, green roof, outdoor rooftop amenity area and three levels of underground parking - Upper House Condominium",
        "units": 67,
        "postal": "M4G",
        "address": "2 LAIRD DR",
        "geo": {
          "lat": 43.7035728,
          "lng": -79.3609508
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2014-12-05",
        "issued": "2021-11-03",
        "desc": "Proposal to construct a new 8 storey apartment building with 61 rental residential units, commercial at grade, and 3 levels of below grade parking. 547-555 COLLEGE ST.",
        "units": 61,
        "postal": "M6G",
        "address": "547 COLLEGE ST",
        "geo": {
          "lat": 43.6553119,
          "lng": -79.4117241
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2014-12-09",
        "issued": null,
        "desc": "Proposal to construct 2 condo towers (35 storey & 29 storey), 746 dwelling units, 4 levels of shared underground parking, and commercial at grade.",
        "units": 746,
        "postal": "M6K",
        "address": "30 ORDNANCE ST",
        "geo": {
          "lat": 43.6394836,
          "lng": -79.4092524
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2014-12-09",
        "issued": "2017-09-28",
        "desc": "5-19 storey rental apartment building containing 188 dwelling units and one level of underground parking - Emerald City Developments IV Inc - Building D2",
        "units": 188,
        "postal": "M2J",
        "address": "125 PARKWAY FOREST DR",
        "geo": {
          "lat": 43.7754292,
          "lng": -79.3422478
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2014-12-10",
        "issued": "2015-01-30",
        "desc": "One storey addition to the existing apartment building to create two additional dwelling units as suites 102 & 103 and convert the existing storage areas on the ground floor into four dwelling units, suites 100, 101, 104 & 105",
        "units": 6,
        "postal": "M2J",
        "address": "2775 DON MILLS RD",
        "geo": {
          "lat": 43.7797181,
          "lng": -79.3479189
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2014-12-10",
        "issued": "2019-05-16",
        "desc": "Proposal to construct two residential building towers (66 and 49 storey) on 6 storey podium with one storey commercial component on south and five storey on north side. Proposal will include construction of underground parking garage.",
        "units": 1282,
        "postal": "M8V",
        "address": "2183 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.62343140000001,
          "lng": -79.4798392
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2014-12-11",
        "issued": "2020-01-29",
        "desc": "To construct a new 15 storey apartment building (Market Building)",
        "units": 308,
        "postal": "M6A",
        "address": "1 LEILA LANE",
        "geo": {
          "lat": 43.7241089,
          "lng": -79.4454013
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2014-12-15",
        "issued": "2016-08-08",
        "desc": "Proposal for 4-storey addition at rear containing 5 residential units to existing mixed used building.",
        "units": 6,
        "postal": "M6P",
        "address": "2945 DUNDAS ST W",
        "geo": {
          "lat": 43.6652761,
          "lng": -79.46733429999999
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2014-12-18",
        "issued": "2017-10-04",
        "desc": "Proposal to construct a 13 storey residential condo with 159 units and 1 level of underground parking.  See also 11 218221 STE and 14 229457 MV.",
        "units": 159,
        "postal": "",
        "address": "200 SACKVILLE ST",
        "geo": {
          "lat": 43.6590971,
          "lng": -79.3629177
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2014-12-19",
        "issued": "2019-10-11",
        "desc": "New 7 Storey Condo Mixed use Residential/Retail Building with 2 level of underground parking.",
        "units": 153,
        "postal": "M5M",
        "address": "1700 AVENUE RD",
        "geo": {
          "lat": 43.7275496,
          "lng": -79.4181435
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2014-12-19",
        "issued": "2019-07-23",
        "desc": "Proposal to construct a 32 storey condominum building containing 459 residential units with 4 levels of underground parking - Block 4A, \"Fortune at Fort York\"",
        "units": 53,
        "postal": "",
        "address": "65 GRAND MAGAZINE ST",
        "geo": {
          "lat": 43.6368983,
          "lng": -79.40234869999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2014-12-19",
        "issued": "2018-02-13",
        "desc": "Proposal to construct a 34-storey mixed-use building with 443 residential units, 3 levels of below grade parking, and commercial on ground floor.",
        "units": 442,
        "postal": "M4P",
        "address": "161 EGLINTON AVE E",
        "geo": {
          "lat": 43.7076906,
          "lng": -79.39238
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2014-12-19",
        "issued": "2018-05-23",
        "desc": "Proposal to construct 8 storey/35 dwelling units apartment building with 3 levels of underground parking.NOTE: DEMOLITION CREDIT APPLIED TO DEVELOPMENT AT 2114 BLOOR PERMIT OFF SITE PER OMB BYLAW FOR EDC, DC AND PARK LEVIES. Available roof area is 427.82m2 )requires 128.28m2proposes 262.19m2 61 percent.",
        "units": 35,
        "postal": "M8X",
        "address": "2800 BLOOR ST W",
        "geo": {
          "lat": 43.6500509,
          "lng": -79.5004084
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2014-12-19",
        "issued": "2020-06-01",
        "desc": "Revised proposal as of June 2019 to construct a 27  storey condo with 340 residential units, commercial on ground floor, and 5 levels of below grade parking.",
        "units": 340,
        "postal": "M5V",
        "address": "324 RICHMOND ST W",
        "geo": {
          "lat": 43.64887909999999,
          "lng": -79.39228419999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2020-06-01",
        "issued": "2020-10-30",
        "desc": "Revision - 01 -  to add 7 dwelling units to floors 41-47Proposal to construct a 48 storey condo with 366 residential units, commercial at grade, and 6 levels of below grade parking.",
        "units": 7,
        "postal": "",
        "address": "283 ADELAIDE ST W",
        "geo": {
          "lat": 43.64770739999999,
          "lng": -79.389967
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2014-12-23",
        "issued": "2017-12-11",
        "desc": "Proposal to construct two 9 storey TCHC rental apartment buildings with, 155 residential units and 1 level of below grade parking.  Convenience address - 581 Dundas St E (Regent Park Block 24 South). See 15 233012 MV and 14 133926 SA.",
        "units": 155,
        "postal": "",
        "address": "50 REGENT PARK BLVD",
        "geo": {
          "lat": 43.6594753,
          "lng": -79.3617177
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2014-12-29",
        "issued": null,
        "desc": "Proposed mixed use 30 storey building containing 289 residential units, retail space, restaurant on the ground floor, amenities on the second floor and medical offices on the third floor. To be constructed in conjunction with the East Tower 14-268100 NB.  Permit for the underground parking garage and SHO for entire site is under permit application 14-268055 00 NB",
        "units": 303,
        "postal": "M1T",
        "address": "3260 SHEPPARD AVE E",
        "geo": {
          "lat": 43.778953,
          "lng": -79.3110835
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2014-12-30",
        "issued": null,
        "desc": "Proposed construction of a 3 storey mixed use building with 39 residential units, ground floor commercial space and below grade parking structure.",
        "units": 39,
        "postal": "",
        "address": "363 OLD KINGSTON RD",
        "geo": {
          "lat": 43.78323,
          "lng": -79.1703
        },
        "ward": "Scarborough-Rouge Park"
      },
      {
        "start": "2015-02-06",
        "issued": "2015-02-18",
        "desc": "Proposal to construct second suite in the existing semi detached dwelling   ",
        "units": 5,
        "postal": "",
        "address": "265 COOK RD",
        "geo": {
          "lat": 43.7676378,
          "lng": -79.49774029999999
        },
        "ward": "Humber River-Black Creek"
      },
      {
        "start": "2015-02-23",
        "issued": null,
        "desc": "Proposal for a 2nd and 3rd  floor addition to existing 1 storey industrial building. Scope of work includes converting to a residential building with 16 residential units and underground parking garage with 2 parking lifts.",
        "units": 15,
        "postal": "M6H",
        "address": "52 BARTLETT AVE",
        "geo": {
          "lat": 43.6620715,
          "lng": -79.4337887
        },
        "ward": "Davenport"
      },
      {
        "start": "2015-02-24",
        "issued": null,
        "desc": "Proposal to construct a new 3 storey mixed use building with retail on the ground floor and 17 residential units on the 2nd and 3rd floors.",
        "units": 17,
        "postal": "M6H",
        "address": "989 COLLEGE ST",
        "geo": {
          "lat": 43.65304390000001,
          "lng": -79.4279057
        },
        "ward": "Davenport"
      },
      {
        "start": "2015-03-03",
        "issued": "2016-06-16",
        "desc": "To alter the existing converted two-storey building containing three dwelling units by: constructing a front two-storey addition with a rear two-storey addition and a full third floor addition, a roof deck and to convert the building into 10 residential dwelling units.",
        "units": 7,
        "postal": "M6C",
        "address": "230 VAUGHAN RD",
        "geo": {
          "lat": 43.6877618,
          "lng": -79.42445839999999
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2015-03-14",
        "issued": null,
        "desc": "Roof alterations to the front of the building + interior alterations to convert an existing detached single-family dwelling to a building containing 6 dwelling units. ",
        "units": 5,
        "postal": "M6H",
        "address": "88 ASHBURNHAM RD",
        "geo": {
          "lat": 43.6733885,
          "lng": -79.444917
        },
        "ward": "Davenport"
      },
      {
        "start": "2015-04-16",
        "issued": "2017-01-31",
        "desc": "Interior alterations to existing 2 dwelling units on second floor. New proposal for 5 Units instead of the previous 2 Units",
        "units": 5,
        "postal": "M1L",
        "address": "3266 DANFORTH AVE",
        "geo": {
          "lat": 43.6930959,
          "lng": -79.2810324
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2015-05-04",
        "issued": "2016-12-09",
        "desc": "Proposal for a 50 storey apartment building with retail at grade and 4 levels of underground parking, portion of the existing heritage building will be maintained and renovated",
        "units": 515,
        "postal": "M4X",
        "address": "592 SHERBOURNE ST",
        "geo": {
          "lat": 43.6711305,
          "lng": -79.3769136
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2015-05-08",
        "issued": "2018-09-10",
        "desc": "Proposal to construct a residential building with 2 towers on a 6-storey podium: total 37 storeys plus 2-storey mechanical penthouse, 6 levels of below grade parking, and 948 residential units (including 32 rental units).  95 & 99 Broadway Ave and 197 Redpath Ave.",
        "units": 948,
        "postal": "M4P",
        "address": "95 BROADWAY AVE",
        "geo": {
          "lat": 43.7104841,
          "lng": -79.3934743
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2015-05-12",
        "issued": "2022-03-11",
        "desc": "Proposal to convert an existing Place of Worship into condominium apartments. ",
        "units": 14,
        "postal": "M6H",
        "address": "1183 DUFFERIN ST",
        "geo": {
          "lat": 43.6649308,
          "lng": -79.437116
        },
        "ward": "Davenport"
      },
      {
        "start": "2015-05-19",
        "issued": "2018-01-24",
        "desc": "Proposal to construct a 35 storey condo with 337 residential units, commercial at grade, and 3 levels of below grade parking.",
        "units": 337,
        "postal": "M4Y",
        "address": "40 WELLESLEY ST E",
        "geo": {
          "lat": 43.6655659,
          "lng": -79.38301419999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2015-05-19",
        "issued": "2016-12-19",
        "desc": "Proposal for make interior alterations to merge rear ground floor commercial units into 1 unit and interior alterations to the 2nd, 3rd, and 4th floors to create 12 dwelling units",
        "units": 12,
        "postal": "M6K",
        "address": "1496 QUEEN ST W",
        "geo": {
          "lat": 43.6406164,
          "lng": -79.4377974
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2015-06-05",
        "issued": "2016-06-22",
        "desc": "Proposal to construct an 13 storey condo building with 164 residential units and 3 levels of below grade parking.  213-223 ST CLAIR AVE W",
        "units": 164,
        "postal": "M4V",
        "address": "223 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6856798,
          "lng": -79.4046851
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2015-06-30",
        "issued": "2017-05-01",
        "desc": "Proposal to construct a new 44-storey mixed use building with 6 levels of underground parking, ground floor commercial retail space and 595 residential units. ",
        "units": 594,
        "postal": "",
        "address": "43 GERRARD ST W",
        "geo": {
          "lat": 43.658532,
          "lng": -79.38425339999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2015-07-15",
        "issued": "2018-10-04",
        "desc": "Proposal to construct a 58 storey condo with 605 residential units, commercial at grade, live/work & office on 2nd floor, and 3 levels of underground parking.",
        "units": 605,
        "postal": "M4S",
        "address": "2221 YONGE ST",
        "geo": {
          "lat": 43.7060298,
          "lng": -79.3979567
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2015-09-24",
        "issued": "2018-07-20",
        "desc": "Proposal to construct 45 storey residential condo with 430 units and 4 levels of undeground garage.RESIDENTIAL UNITS ONLY NO COMMERCIALGREEN ROOF TOTAL AVAIL ROOF- 2804m2required 60 percent 1682m2proposes 1904m2 (more than required)",
        "units": 430,
        "postal": "",
        "address": "7 MABELLE AVE",
        "geo": {
          "lat": 43.6464334,
          "lng": -79.5255231
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2015-09-25",
        "issued": "2018-07-17",
        "desc": "24 storey apartment building with ground floor retail containing 263 dwelling units, four levels of underground parking and a green roof -  Building B2 - Fifth on the Park",
        "units": 264,
        "postal": "M2J",
        "address": "32-50 FOREST MANOR RD",
        "geo": {
          "lat": 43.7716467,
          "lng": -79.3446635
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2015-09-29",
        "issued": "2020-12-07",
        "desc": "Proposal to construct a new 7 storey above grade and 4 storey below grade mixed use building. YMCA will occupy the ground and basement floors. There will be a total of 91 residential suites above grade and the lowest 3 levels will consists of underground parking.",
        "units": 91,
        "postal": "M4E",
        "address": "907 KINGSTON RD",
        "geo": {
          "lat": 43.6800918,
          "lng": -79.289817
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2015-09-30",
        "issued": "2015-11-13",
        "desc": "Proposal for interior alterations to existing hostel/Municipal Shelter; increase dwelling rooms from 77 to 84. Add office on the main floor, west.",
        "units": 7,
        "postal": "",
        "address": "53 STRACHAN AVE",
        "geo": {
          "lat": 43.6406354,
          "lng": -79.4111058
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2015-10-01",
        "issued": "2018-04-27",
        "desc": "Proposal to construct a six storey mixed use building with a commercial ground floor, two levels of underground parking and a total of 32 residential units",
        "units": 32,
        "postal": "M4L",
        "address": "1878 QUEEN ST E",
        "geo": {
          "lat": 43.6687461,
          "lng": -79.3063121
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2015-10-15",
        "issued": null,
        "desc": "Proposal for interior alterations to convert existing storage area into (6) residential units ",
        "units": 6,
        "postal": "M1K",
        "address": "1155 MIDLAND AVE",
        "geo": {
          "lat": 43.7457137,
          "lng": -79.26189719999999
        },
        "ward": "Scarborough Centre"
      },
      {
        "start": "2015-10-22",
        "issued": "2016-09-14",
        "desc": "Construct a residential development of 2 retail (shell) units on ground floor",
        "units": 12,
        "postal": "M6B",
        "address": "1100 BRIAR HILL AVE",
        "geo": {
          "lat": 43.70312089999999,
          "lng": -79.4509187
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2015-10-27",
        "issued": null,
        "desc": "Proposal for multiple projects to an existing 3 storey mixed use building.  Scope of work includes a 4th floor addition, a 4 storey rear addition and interior alterations.   Also proposed is the conversion from four dwelling units to nine.  The existing building also contains a commercial unit on the ground floor (laundry mat).  See also 14 243726 ZPR and 14 250531 MV.",
        "units": 5,
        "postal": "M6H",
        "address": "863 COLLEGE ST",
        "geo": {
          "lat": 43.6540166,
          "lng": -79.42363519999999
        },
        "ward": "Davenport"
      },
      {
        "start": "2015-11-03",
        "issued": "2018-05-28",
        "desc": "(Phase 1) Proposal for a mixed use building comprised of one 20 storey tower (Tower 2) and one 18 storey tower.(Tower 1) and 3 levels of underground parking including commercial parking. Total 690 residential units. \"Minto\". (Refer to 33-45 for Phase 2).See also 14 190942 ZPR and 15 203308 STE.",
        "units": 690,
        "postal": "M5V",
        "address": "578 FRONT ST W",
        "geo": {
          "lat": 43.6415137,
          "lng": -79.40070899999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2015-11-04",
        "issued": "2017-07-17",
        "desc": "Proposal to construct a 29 storey & 10 storey midrise above a 2 storey podium rental TCHC apartment with 276 units, 1 level of below grade parking, and commercial at grade.  Regent Park, Block 27.  Convenience address - 110 River St.",
        "units": 276,
        "postal": "M5A",
        "address": "110 RIVER ST",
        "geo": {
          "lat": 43.660631,
          "lng": -79.3582588
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2015-11-12",
        "issued": "2018-12-17",
        "desc": "Revised number of floors - 24 number of units Proposal to construct a 21 storey condo with 289 residential units, commercial on groud floor & 2nd floor, 4 levels of below grade parking garage, and retail heritage portions of building (see active BLD 15 241758).  93-95 BERKELEY ST & 112-124 PARLIAMENT STREET.",
        "units": 330,
        "postal": "M5A",
        "address": "93 BERKELEY ST",
        "geo": {
          "lat": 43.6535153,
          "lng": -79.3648525
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2015-12-01",
        "issued": "2021-09-17",
        "desc": "Proposal to construct a 6 storey building containing 47 residential units, 2 levels of below grade parking, and commercial at grade.  \"Heartwood\".  (43 to 47 units)",
        "units": 47,
        "postal": "",
        "address": "1884 QUEEN ST E",
        "geo": {
          "lat": 43.6689401,
          "lng": -79.30605640000002
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2015-12-17",
        "issued": "2018-01-18",
        "desc": "Construct a 12 storey mixed use building with containing 234 dweliing units, 240 square metres of retail space and 2 levels of underground parking",
        "units": 234,
        "postal": "M2K",
        "address": "15 KENASTON GDNS",
        "geo": {
          "lat": 43.7662633,
          "lng": -79.38564509999999
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2015-12-21",
        "issued": "2018-12-11",
        "desc": "Proposal to construct 2 residenital towers (26 storey & 52 storey), 832 units, 4 levels of above grade parking, and ground floor commercial.  Teahouse condos.",
        "units": 832,
        "postal": "M4Y",
        "address": "501 YONGE ST",
        "geo": {
          "lat": 43.663194,
          "lng": -79.3836384
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2015-12-22",
        "issued": "2016-05-05",
        "desc": "Proposal to construct a ground floor front vestibule addition at Residents entrance, and a new canopy, Convert existing office space on second floor to place of assembly, and convert existing office space on the Third, Fourth and Fifth floors to create 30 new residential dwelling units. Existing 140 units. Proposed 170 units. Window replacement on all elevations, Convenience address is 7 Walmer Rd.",
        "units": 10,
        "postal": "M5S",
        "address": "360 BLOOR ST W",
        "geo": {
          "lat": 43.6667432,
          "lng": -79.4051282
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2015-12-31",
        "issued": null,
        "desc": "REVISED Scope of work as per Re-submission received at June_24, 2020:  To alter the existing two-storey mixed-use building by converting the Second Floor residential use from Two (2) Dwelling Units to Three (3) Dwelling Units.  Existing Retail use is remaining at Ground & Basement Floors. ",
        "units": 6,
        "postal": "M5T",
        "address": "606-608 DUNDAS ST W",
        "geo": {
          "lat": 43.6523858,
          "lng": -79.40149459999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2016-01-11",
        "issued": "2017-11-15",
        "desc": "Applicant propose a 3 storey addition above the existing 3 storey building.",
        "units": 17,
        "postal": "M4W",
        "address": "1027 YONGE ST",
        "geo": {
          "lat": 43.6776415,
          "lng": -79.3894565
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2016-03-29",
        "issued": null,
        "desc": "Proposal to maintain/legalize construction as-built, remove rear 3rd floor addition built without a permit and construct new 3rd floor side addition, 3rd floor deck and basement underpinning in existing mixed use building.",
        "units": 8,
        "postal": "M5T",
        "address": "149 AUGUSTA AVE",
        "geo": {
          "lat": 43.6525966,
          "lng": -79.4010723
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2016-04-20",
        "issued": "2018-05-11",
        "desc": "Proposal to construct a 9-storey multi-unit residential condominium and rental replacement building and loading premises at grade, and 3 levels of underground parking.Site plan folder number is 15 262952",
        "units": 62,
        "postal": "",
        "address": "2114 BLOOR ST W",
        "geo": {
          "lat": 43.6522823,
          "lng": -79.4722726
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2016-05-17",
        "issued": "2017-04-13",
        "desc": "Proposal to construct a 4 storey + mezzanine with 1 level of below grade apartment building consisting of 14 units (including 1 live/work). 1000-1002 BATHURST STREET",
        "units": 14,
        "postal": "M5R",
        "address": "1000 BATHURST ST",
        "geo": {
          "lat": 43.6704928,
          "lng": -79.41360929999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2016-05-31",
        "issued": "2018-12-07",
        "desc": "Proposed 28 storey mixed use building with a 13 storey podium, Ground & 2nd floor commercial, 624 residential units (including 2 Guest Suites), and 3 levels of below grade parking which includes a commercial parking garage.  2131 YONGE ST & 32 HILLSDALE AVE E.  Note:  See active stand alone shoring permit.",
        "units": 624,
        "postal": "M4S",
        "address": "2131 YONGE ST",
        "geo": {
          "lat": 43.703611,
          "lng": -79.397477
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2016-06-01",
        "issued": "2020-05-05",
        "desc": "Building D. Application to construct a 26-storey, 300 unit apartment building with 3 sub level of under ground parking",
        "units": 310,
        "postal": "M2J",
        "address": "2135 SHEPPARD AVE E",
        "geo": {
          "lat": 43.77489320000001,
          "lng": -79.3318116
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2016-06-07",
        "issued": "2018-07-26",
        "desc": "Proposal to construct a 19-storey apartment building containing 161 dwelling units complete with 4 levels of underground parking containing 162 parking spaces.",
        "units": 161,
        "postal": "M4V",
        "address": "609 AVENUE RD",
        "geo": {
          "lat": 43.6896603,
          "lng": -79.4023357
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2016-06-10",
        "issued": "2020-04-15",
        "desc": "Proposal to construct a new 28 storey mixed use building consiting of 179 residential units and commercial space at grade.  See also 15 247190 STE.",
        "units": 179,
        "postal": "M4Y",
        "address": "81 WELLESLEY ST E",
        "geo": {
          "lat": 43.6655469,
          "lng": -79.3802128
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2016-07-07",
        "issued": "2018-05-11",
        "desc": "Phase 2: Proposal to construct 18 storey condo with 501 residential units, ground floor commercial, and 3 levels of below grade parking.  PHASE 2 - 39 NIAGARA ST.  NOTE:  See active Phase 1 - 15 246701 BLD and combined Site Plan - 12 203308 under 578 Front St West.",
        "units": 501,
        "postal": "M5V",
        "address": "33-45 NIAGARA ST",
        "geo": {
          "lat": 43.6420644,
          "lng": -79.4005746
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2016-07-19",
        "issued": "2019-02-08",
        "desc": "CONSTRUCTION OF A 29 STOREY MIXED USE WITH 1 BSMT. RETAIL AND 3 LVLS. OF U/G PARKING ",
        "units": 378,
        "postal": "M4P",
        "address": "2360 YONGE ST",
        "geo": {
          "lat": 43.7086393,
          "lng": -79.3989817
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2016-08-03",
        "issued": "2019-08-14",
        "desc": "Proposal to construct a new 39 storey condominium and townhouse development with 3 levels of below grade parking and 573 suites.  151 - 177  Roehampton Avenue & 140 - 144  Redpath Avenue.",
        "units": 573,
        "postal": "M4P",
        "address": "151 ROEHAMPTON AVE",
        "geo": {
          "lat": 43.7087149,
          "lng": -79.39395809999999
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2016-08-05",
        "issued": "2021-01-26",
        "desc": "Proposal to construct a new mixed use building with a 44 storey residential condominium with 4 storey  podium, 2 levels of commercial space and 4 levels of underground parking.",
        "units": 524,
        "postal": "M4Y",
        "address": "593 YONGE ST",
        "geo": {
          "lat": 43.6662037,
          "lng": -79.3849018
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2016-08-17",
        "issued": "2016-10-14",
        "desc": "To alter the existing three-storey detached house containing three dwelling units by adding a new residential dwelling unit on both the ground and second floors, for a total of Five Dwelling Units in the building. (Additional 2 new dwelling units are proposed).",
        "units": 5,
        "postal": "M5R",
        "address": "137 MADISON AVE",
        "geo": {
          "lat": 43.6723765,
          "lng": -79.40455510000001
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2016-09-23",
        "issued": "2020-10-30",
        "desc": "Proposed construction of a new (5) storey (14) unit apartment building.",
        "units": 14,
        "postal": "M1E",
        "address": "61 ORCHARD PARK DR",
        "geo": {
          "lat": 43.7751374,
          "lng": -79.1804473
        },
        "ward": "Scarborough-Rouge Park"
      },
      {
        "start": "2016-09-29",
        "issued": "2018-09-24",
        "desc": "Proposal to construct a 35 storey condo with 421 units, ground floor commercial, and 4 levels of below grade parking.  PIER 27 - BUILDING G.  Note:  See active excavation/soil remediation permit 16 170857 BLD.",
        "units": 421,
        "postal": "",
        "address": "15 QUEENS QUAY   E",
        "geo": {
          "lat": 43.6419562,
          "lng": -79.3735822
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2016-10-18",
        "issued": "2018-09-11",
        "desc": "Proposal to construct a new 11 storey TCHC rental building with 158 units and 1 level of below grade parking.  150 RIVER STREET - BLOCK 17N (Regent Park Phase 3).",
        "units": 158,
        "postal": "M5A",
        "address": "150 RIVER ST",
        "geo": {
          "lat": 43.6619859,
          "lng": -79.358832
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2016-10-26",
        "issued": "2018-12-19",
        "desc": "Proposal to construct a new 6 storey condo with 59 residential untis, commercial on ground floor, and 1 level of below grade parking.  897-899 QUEEN ST E",
        "units": 59,
        "postal": "M4M",
        "address": "897 QUEEN ST E",
        "geo": {
          "lat": 43.6604677,
          "lng": -79.3421211
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2016-11-09",
        "issued": "2018-06-22",
        "desc": "Proposal to construct a 2 storey residential addition over the existing 30 storey building, 32 storey residential west addition with 274 new rental units, new partial slabs with in existing parking garage, reclad existing building and interior alterations to portions of the existing building.  See active interior and demo permits 16-212871 BLD 00 BA",
        "units": 274,
        "postal": "M5G",
        "address": "700 BAY ST",
        "geo": {
          "lat": 43.6581383,
          "lng": -79.385296
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2016-11-10",
        "issued": "2018-09-07",
        "desc": "construct 35 storey residential building 364 units, daycare on main floor, 3 level underground parking garage, 2 level above grade parking ",
        "units": 366,
        "postal": "M1S",
        "address": "275 VILLAGE GREEN SQ",
        "geo": {
          "lat": 43.77935799999999,
          "lng": -79.2830046
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2016-11-21",
        "issued": "2019-10-31",
        "desc": "Proposal to construct a 52 storey condo with 476 residential units, 8 storey podium hotel including restaurant, 6 levels of below grade parking, and ground floor commercial.  Also see related Alternative Solution 16 253897 ALT for standpipe system.",
        "units": 476,
        "postal": "M4W",
        "address": "387 BLOOR ST E",
        "geo": {
          "lat": 43.6720484,
          "lng": -79.3776829
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2016-11-22",
        "issued": "2019-04-01",
        "desc": "Proposal to construct a new 15 storey residential tower, 5 townhouse units in rear courtyard, with 255 residential units, and 3 levels of below grade parking.  Block 13. (Part of Phase 1)",
        "units": 174,
        "postal": "M5T",
        "address": "571 DUNDAS ST W",
        "geo": {
          "lat": 43.6522762,
          "lng": -79.40044549999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2016-11-23",
        "issued": "2021-05-13",
        "desc": "PHASE 2 - PHASE 2 - Block 8 - Proposal to construct 2 condo towers (41 storey & 37 storey) containing 886 residential units and ground floor retail.  See active permit for PHASE 1 for below grade parking - 15 269710 BLD.",
        "units": 886,
        "postal": "",
        "address": "500 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.6372206,
          "lng": -79.3988179
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2016-12-06",
        "issued": "2020-03-03",
        "desc": "Proposal to construct a 7 storey mixed use building containing 142 residential units with commercial at grade.  A total of 151 parking spaces will be provided in 2 levels underground parking.",
        "units": 142,
        "postal": "M4B",
        "address": "1401 O'CONNOR DR",
        "geo": {
          "lat": 43.712827,
          "lng": -79.3066702
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2016-12-19",
        "issued": "2019-03-01",
        "desc": "Proposal to construct a 27 sty condo with ground floor commercial, 3 levels of below grade parking, and 303 residential units.  Phase 2.  Liberty Central By The Lake.",
        "units": 303,
        "postal": "",
        "address": "51 EAST LIBERTY ST",
        "geo": {
          "lat": 43.6385683,
          "lng": -79.41219
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2020-10-08",
        "issued": null,
        "desc": "REV - 01 for revised stair A separation at exit level and adding two units #307 & #308 at third storey. Proposal to construct a 13 storey + penthouse condo with 156 residential units, 3 levels of below grade parking, and ground floor commercial.  River City West Don Lands Phase 4 - Block 5.Shoring issued separately under soil remediation permit # 17-183631",
        "units": 14,
        "postal": "",
        "address": "170 EASTERN AVE",
        "geo": {
          "lat": 43.6549712,
          "lng": -79.3550123
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2016-12-28",
        "issued": "2018-07-25",
        "desc": "6/8 storey residential apartment building containing 195 dwelling units, ground and second floor retail (shell), two levels of underground parking and a greenroof",
        "units": 195,
        "postal": "M2K",
        "address": "621 SHEPPARD AVE E",
        "geo": {
          "lat": 43.7679669,
          "lng": -79.381305
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2016-12-28",
        "issued": "2018-10-31",
        "desc": "264 UNIT, 25 STOREY RESIDENTIAL APARTMENT TOWER A. See alternative solution AS18-108720",
        "units": 264,
        "postal": "M6P",
        "address": "52-66 HIGH PARK AVE",
        "geo": {
          "lat": 43.6553473,
          "lng": -79.4664482
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2016-12-28",
        "issued": "2018-10-30",
        "desc": "264 residential rental units, 25 storey Tower B. See alternative solution AS18-108720",
        "units": 264,
        "postal": "M6P",
        "address": "51-65 QUEBEC AVE",
        "geo": {
          "lat": 43.6542576,
          "lng": -79.4670789
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2016-12-29",
        "issued": "2022-03-18",
        "desc": "CONSTRUCT A 24 STOREY RESIDENTIAL CONDOMINIUM APARTMENT BUILDING (BUILDING 'D') ABOVE A THREE-LEVEL UNDERGROUND GARAGE WITH SHARED RAMP. (U/G PERMIT 16-271750 NB) (Related permit for 12 storey rental building (E) on same site is 16-271760 BLD 00 NB) ",
        "units": 315,
        "postal": "M3A",
        "address": "1213 YORK MILLS RD",
        "geo": {
          "lat": 43.7592559,
          "lng": -79.3322353
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2017-01-06",
        "issued": "2020-01-10",
        "desc": "Proposal to construct a new 6 storey condominium with 1 level of underground parking and 26 residential units.",
        "units": 25,
        "postal": "M6J",
        "address": "45 DOVERCOURT RD",
        "geo": {
          "lat": 43.6418835,
          "lng": -79.42154239999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2017-01-18",
        "issued": "2017-03-09",
        "desc": "alterations to interior layout, existing double rooms to be divided into single rooms, no change to building foot print or gfa",
        "units": 22,
        "postal": "M6K",
        "address": "30 MAYNARD AVE",
        "geo": {
          "lat": 43.6380861,
          "lng": -79.43802579999999
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2017-01-20",
        "issued": "2019-06-25",
        "desc": "Proposal to construct a mixed-use building (Regent Park, Block 26) comprising of two levels of underground parking ,one 27-storey tower, 343 residential units + 1 guest suite, a 6-storey podium (with 7 retail units), and a two-storey residential element.",
        "units": 345,
        "postal": "",
        "address": "20 TUBMAN AVE",
        "geo": {
          "lat": 43.6605911,
          "lng": -79.35934569999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-01-24",
        "issued": "2020-03-13",
        "desc": "Proposal to construct 2 residential rental towers (25 & 34 storeys) with 579 units, 5 storey podium, commercial on floors 1-3 inclusive, and 4 levels of below grade parking.  See active stand alone shoring 16 251400 BLD.  11 & 25 ORDNANCE ST- Please refer to permit 20-167530 FSU for sprinkler shop drawing.",
        "units": 579,
        "postal": "M6K",
        "address": "11 ORDNANCE ST",
        "geo": {
          "lat": 43.6390547,
          "lng": -79.4095148
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2017-02-02",
        "issued": "2019-02-01",
        "desc": "Proposal to construct a new 14 storey mixed use building with 189 residential units, 143m2 of at grade retail space and 2 levels of underground parking.  See also 15 265526 STE.",
        "units": 189,
        "postal": "",
        "address": "40 MC CAUL ST",
        "geo": {
          "lat": 43.6515546,
          "lng": -79.39051510000002
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2017-02-10",
        "issued": "2018-11-06",
        "desc": "Proposal to construct a new 35 storey building containing 392 dwelling units and 3 level underground garage on previous vacant land. PHASE 2 ONLY - RESIDENTIAL NO RETAIL OR COMMERCIAL",
        "units": 392,
        "postal": "",
        "address": "9 MABELLE AVE",
        "geo": {
          "lat": 43.64613,
          "lng": -79.5260433
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2017-03-31",
        "issued": "2020-04-30",
        "desc": "Proposal to construct a new 6 storey residential condo and one level of underground parking",
        "units": 72,
        "postal": "M6N",
        "address": "1771 ST CLAIR AVE W",
        "geo": {
          "lat": 43.67377219999999,
          "lng": -79.4608945
        },
        "ward": "Davenport"
      },
      {
        "start": "2017-04-20",
        "issued": "2020-12-29",
        "desc": "Proposal for a 14 storey mixed use building with retail and a food hall at grade, a YMCA on the second and third storeys, and residential above.  The project includes 4 levels of underground parking and is to include 284 market-rate residential units and 15 affordable units. In addition the retention of the facade of the existing building on site as required by the Heritage Easement Agreement applicable to the lands.",
        "units": 288,
        "postal": "M5V",
        "address": "505 RICHMOND ST W",
        "geo": {
          "lat": 43.6471408,
          "lng": -79.3995025
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2017-05-09",
        "issued": "2021-08-04",
        "desc": "Proposal to construct a 10 storey condo with 135 residential units, commercial at grade, and 3 levels of below grade parking. ",
        "units": 135,
        "postal": "M4C",
        "address": "2359 DANFORTH AVE",
        "geo": {
          "lat": 43.68694720000001,
          "lng": -79.3061291
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2017-05-09",
        "issued": "2021-07-30",
        "desc": "Proposal to construct a 12 storey residential building with ground floor retail and 2.5 storey underground parking garage",
        "units": 116,
        "postal": "M6C",
        "address": "900 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6804767,
          "lng": -79.43349239999999
        },
        "ward": "Davenport"
      },
      {
        "start": "2017-05-10",
        "issued": "2021-07-05",
        "desc": "Revised Proposal Sep 15, 2020- Proposal to construct a 56-storey residential condominium building with 5 levels of underground parking (inclusive of 1 ramp level to grade) (12 additional dwelling units and two additional storeys) as approved by the Committee of Adjustment  - A0598/19EYProposal to construct a 54 storey residential building plus 2 storey of mechanical penthouses  with five levels of underground parking (inclusive of 1 ramp level to grade)",
        "units": 504,
        "postal": "M8V",
        "address": "2165 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.625052,
          "lng": -79.47988749999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2017-05-11",
        "issued": "2020-02-26",
        "desc": "Proposal to construct 8 storey residential condo building with 170 residential units, commercial at grade and 2 levels of underground parking.  see also 16 230027 SA, 17157901 DM, 17157940 DM",
        "units": 170,
        "postal": "M4C",
        "address": "2301 DANFORTH AVE",
        "geo": {
          "lat": 43.6866288,
          "lng": -79.3076195
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2017-05-16",
        "issued": "2020-05-22",
        "desc": "Proposal to construct a new 36 storey condo with 360 residential units, commercial at grade, and 4 levels of below grade parking.  Note - See active stand alone soil remediation permit - 17 115666 BLD.",
        "units": 352,
        "postal": "",
        "address": "159 WELLESLEY ST E",
        "geo": {
          "lat": 43.6668307,
          "lng": -79.3747765
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-05-31",
        "issued": "2020-07-15",
        "desc": "PERMIT 2 - Proposal to construct a new 13 storey condo with commercial at grade & mezzanine and 128 residential units.  SOUTH-EAST TOWER.  77-79 EAST DON ROADWAY & 677 QUEEN ST E.  NOTE:  See active below grade permit 17 132098 BLD",
        "units": 128,
        "postal": "M4M",
        "address": "79 EAST DON ROADWAY",
        "geo": {
          "lat": 43.6573688,
          "lng": -79.35223719999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2017-06-01",
        "issued": "2020-08-18",
        "desc": "Construct a new 17 storey residential building with 499 units (not TCHC)",
        "units": 499,
        "postal": "M2J",
        "address": "1 ADRA VILLAWAY",
        "geo": {
          "lat": 43.7757208,
          "lng": -79.3651867
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2017-06-16",
        "issued": "2019-01-28",
        "desc": "Construct 30 storey condo tower above with 371 units and a 6 level underground parking garage",
        "units": 371,
        "postal": "M2N",
        "address": "75 CANTERBURY PL",
        "geo": {
          "lat": 43.7742159,
          "lng": -79.4151359
        },
        "ward": "Willowdale"
      },
      {
        "start": "2017-06-16",
        "issued": "2018-07-30",
        "desc": "NEW 2 MID-RISE 9 STOREY TOWERS ON A 5 STOREY PODIUM RESIDENTIAL APARTMENT BUILDING GEARED TO SENIORS AND A LONG TERM CARE FACILITY TOGETHER WITH A DAY CARE",
        "units": 269,
        "postal": "",
        "address": "4650 EGLINTON AVE W",
        "geo": {
          "lat": 43.7446878,
          "lng": -79.2120621
        },
        "ward": "Scarborough-Guildwood"
      },
      {
        "start": "2017-06-21",
        "issued": null,
        "desc": "Proposal for a 5-storey mixed use building with commercial space at the ground and basement levels and 12 rental dwelling units at the second, third, and fourth levels.",
        "units": 12,
        "postal": "M6H",
        "address": "918 BLOOR ST W",
        "geo": {
          "lat": 43.6619434,
          "lng": -79.4267071
        },
        "ward": "Davenport"
      },
      {
        "start": "2017-06-26",
        "issued": "2020-09-23",
        "desc": "Part Permit - Proposal to construct a 25 storey tower with an 8 storey podium complete with four  levels of underground parking.",
        "units": 295,
        "postal": "M9B",
        "address": "5415 DUNDAS ST W",
        "geo": {
          "lat": 43.6339362,
          "lng": -79.5413698
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2017-06-28",
        "issued": "2021-06-28",
        "desc": "Proposal to construct a new 38-storey condo with 451 dwelling units, commercial at grade and 4 levels of below grade parking.  Proposal includes 26 Rental Replacement Dwelling Units",
        "units": 451,
        "postal": "M4Y",
        "address": "480 YONGE ST",
        "geo": {
          "lat": 43.6625423,
          "lng": -79.38374019999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-06-28",
        "issued": "2020-06-01",
        "desc": "Proposal to construct two 26 storey condo towers on a common 9-10 storey podium,  482 residential units, commercial at grade, and 3 levels of below grade parking.  154 & 158 Front St E.  NOTE:  See active Stand Alone shoring/soil remediation 16 252254 BLD.",
        "units": 482,
        "postal": "M5A",
        "address": "154 FRONT ST E",
        "geo": {
          "lat": 43.6503683,
          "lng": -79.3686919
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-07-07",
        "issued": "2019-12-16",
        "desc": "Proposal to construct a 12-storey mixed use building with 174 dwelling units, retail and daycare on the ground floor and four levels of underground parking. Pending address is 118 Merchants' Wharf.",
        "units": 174,
        "postal": "M5A",
        "address": "261 QUEENS QUAY   E",
        "geo": {
          "lat": 43.6451982,
          "lng": -79.36382569999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2017-07-20",
        "issued": "2021-03-12",
        "desc": "Proposal to construct a 51 storey condo with 364 residential units, commercial on ground & 2nd floors, and 4 levels of below grade parking.  826-834 YONGE ST AND 2-8 CUMBERLAND ST.",
        "units": 399,
        "postal": "M4W",
        "address": "834 YONGE ST",
        "geo": {
          "lat": 43.6714035,
          "lng": -79.3875662
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2017-08-01",
        "issued": "2020-05-01",
        "desc": "Proposal to construct a new 52 unit stacked townhouse block #1 on top of a 2 story parkade. Parkade covered under permit 17 209443 BLD 00 NB.",
        "units": 52,
        "postal": "M8X",
        "address": "4208 DUNDAS ST W",
        "geo": {
          "lat": 43.66131,
          "lng": -79.5119512
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2017-08-01",
        "issued": "2020-05-07",
        "desc": "Proposal to construct a 21 Storey condominium with 2 storey parkade. ",
        "units": 196,
        "postal": "",
        "address": "20 BRIN DR",
        "geo": {
          "lat": 43.6613872,
          "lng": -79.5118402
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2017-08-02",
        "issued": "2019-12-20",
        "desc": "Proposed 31 storey residential building with 297 units, 2 levels of underground parking and 3 levels of above ground parking.",
        "units": 297,
        "postal": "",
        "address": "225 VILLAGE GREEN SQ",
        "geo": {
          "lat": 43.7796916,
          "lng": -79.2820457
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2017-08-21",
        "issued": "2020-09-04",
        "desc": "Proposal to construct a 27 storey mixed use builing containing 242 residential units and 211 square metres of commercial space at grade, 3 levels of below grade parking and storage. Two blocks of back-to-back townhouses will come in under separate permits.",
        "units": 281,
        "postal": "",
        "address": "181 BEDFORD RD",
        "geo": {
          "lat": 43.6748268,
          "lng": -79.3997517
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2017-08-22",
        "issued": "2020-12-22",
        "desc": "Proposal to construct a 24 storey residential apartment building (including an 8 storey podium), 2 levels of below grade parking, 361 residential units, and commercial at grade.  See active stand alone excavation and shoring perit for soil remediation.",
        "units": 361,
        "postal": "M6P",
        "address": "2376 DUNDAS ST W",
        "geo": {
          "lat": 43.6579605,
          "lng": -79.4518418
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2017-08-22",
        "issued": "2018-08-31",
        "desc": "Proposal for a 18 storey, mixed use building containing 264 residential units with at-grade commercial uses and 3 level underground garage.",
        "units": 264,
        "postal": "M1T",
        "address": "3105 SHEPPARD AVE E",
        "geo": {
          "lat": 43.77610139999999,
          "lng": -79.31719509999999
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2017-08-24",
        "issued": "2022-02-09",
        "desc": "LEAD PERMIT 4 storey residential rental building containing 35 dwelling units above one level of below grade parking - Building C1",
        "units": 35,
        "postal": "M2N",
        "address": "120 SHEPPARD AVE E",
        "geo": {
          "lat": 43.763421,
          "lng": -79.4036995
        },
        "ward": "Willowdale"
      },
      {
        "start": "2017-09-01",
        "issued": "2020-09-11",
        "desc": "Mixed-use development consisting of two residential towers at 46 and 38 storeys in height connected by a four-storey podium with retail uses at-grade (including Building 3A). The development proposes 760 residential units and 468 parking spaces in four level underground parking garage. See SPA 17-120977",
        "units": 760,
        "postal": "",
        "address": "100 HOWARD ST",
        "geo": {
          "lat": 43.67151399999999,
          "lng": -79.37192619999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-09-05",
        "issued": "2019-03-06",
        "desc": "Proposal to construct a new 12 storey condo with 187 residential units, 2 levels of below grade parking, and commercial at grade.  NOTE:  See active stand alone excavation and shoring for soil remediation 17 183425 BLD.",
        "units": 187,
        "postal": "",
        "address": "460 FRONT ST E",
        "geo": {
          "lat": 43.6534633,
          "lng": -79.3557223
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-09-07",
        "issued": "2020-10-08",
        "desc": "Construct a 36 storey apartment with 342 units, with 20 stacked townhouses with common corridor thats intergrated with the East Tower, with a  shared underground garage 17-228465) and (shared podium - review with the West Tower)  and a canopy for the outdoor amenity spaceSEE LEAD PERMIT 17 228864 BLD (west tower)",
        "units": 362,
        "postal": "M2K",
        "address": "1001 SHEPPARD AVE E",
        "geo": {
          "lat": 43.7688038,
          "lng": -79.3746385
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2017-09-18",
        "issued": "2018-04-04",
        "desc": "Proposal for interior renovation/construction to permit the 19 existing \"rooming house\" units to be re-partitioned and updated. The commercial use will be maintained on the ground and basement floors.",
        "units": 17,
        "postal": "M8V",
        "address": "1 BLUE GOOSE ST",
        "geo": {
          "lat": 43.6167463,
          "lng": -79.4957414
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2017-09-19",
        "issued": "2019-10-15",
        "desc": "Phase 2.1-  Construct a 10 storey replacement building for the TCHC (75 units)",
        "units": 75,
        "postal": "M2J",
        "address": "11-21 ALLENBURY GDNS",
        "geo": {
          "lat": 43.7806741,
          "lng": -79.3427294
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2017-09-21",
        "issued": "2021-09-30",
        "desc": "32 storey residential building containing 425 dwelling units with ground floor retail (1,696.22sqm), residential amenity and common areas on the ground and 8th floor and a green roof above a 5 level parking garage - Don Mills - Rodeo Drive - Tower B2  See also 17 236652 (Building D)",
        "units": 423,
        "postal": "M3C",
        "address": "49 THE DONWAY   W",
        "geo": {
          "lat": 43.7319222,
          "lng": -79.3443554
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2017-09-21",
        "issued": "2018-05-11",
        "desc": "Proposal to construct a 2 storey addition plus roof accesses above the existing non-residential building which will contain 11 residential units, thereby converting the building to a four-storey mixed-use building. Interior alterations at ground floor for new accessory uses to residential portion. New ground floor entrance at front of building serving the residential portion.",
        "units": 11,
        "postal": "M4M",
        "address": "772 QUEEN ST E",
        "geo": {
          "lat": 43.6595744,
          "lng": -79.3476318
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2017-09-22",
        "issued": "2021-01-07",
        "desc": "Proposal to construct new 25 storey (plus 2 rooftop mechanical levels)  mixed used building with 273 residential units, retail at grade, and 4 storeys of underground parking.",
        "units": 274,
        "postal": "M5A",
        "address": "53 ONTARIO ST",
        "geo": {
          "lat": 43.6534121,
          "lng": -79.3662221
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-10-02",
        "issued": "2018-03-29",
        "desc": "Proposal for interior alterations to create 6 new dwellign rooms - in existing rooming house at 149-151 Tyndall Ave. 15 dwelling rooms in total at 149 TYNDALL AVE ",
        "units": 6,
        "postal": "M6K",
        "address": "149 TYNDALL AVE",
        "geo": {
          "lat": 43.6381616,
          "lng": -79.4285651
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2017-10-02",
        "issued": "2018-03-29",
        "desc": "Proposal for interior alterations to create 5 new dwelling rooms -  in existing rooming house at 149-151 Tyndall Ave. 12 dwelling rooms at 151 TYNDALL AVE ",
        "units": 5,
        "postal": "M6K",
        "address": "151 TYNDALL AVE",
        "geo": {
          "lat": 43.6382419,
          "lng": -79.42853219999999
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2017-10-16",
        "issued": null,
        "desc": "Proposal to construct a second floor addition above existing building at 1104 Dovercourt rd proposed openings between 1104 and 1106 Dovercourt rd in order to convert the two buildings into one building containing a total of 6 dwelling units and a small office.",
        "units": 5,
        "postal": "M6H",
        "address": "1104 DOVERCOURT RD",
        "geo": {
          "lat": 43.6711061,
          "lng": -79.433577
        },
        "ward": "Davenport"
      },
      {
        "start": "2017-10-18",
        "issued": "2019-05-30",
        "desc": "Proposal to construct a 6-storey mixed-use building with 89 residential units with retail at grade. A total of 55 parking spaces are proposed in an underground parking garage.",
        "units": 89,
        "postal": "M4L",
        "address": "1630 QUEEN ST E",
        "geo": {
          "lat": 43.6666713,
          "lng": -79.3157392
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2017-10-20",
        "issued": "2021-10-14",
        "desc": "Proposal to to construct a 19 and 22-storey mixed-use building consisting of a 5-storey podium and 2 towers, with retail uses on the first 2 storeys and residential uses above - 520 dwelling units in total, 3 levels of underground parking and 15 existing rental units are proposed to be replaced within the new building.",
        "units": 522,
        "postal": "M5A",
        "address": "48 POWER ST",
        "geo": {
          "lat": 43.6543291,
          "lng": -79.3631582
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-10-20",
        "issued": "2019-06-13",
        "desc": "Proposal to construct a 10 storey condo with 70 residential units, 3 levels of below grade parking, and commercial at grade,  NOTE: See stand alone excavation and shoring for soil remediation permit 17 149470 BLD for reference.  143-151 AVENUE RD",
        "units": 70,
        "postal": "M5R",
        "address": "143 AVENUE RD",
        "geo": {
          "lat": 43.6742178,
          "lng": -79.3960309
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2017-10-24",
        "issued": null,
        "desc": "Proposal for interior alterations to existing 3 storey building. Scope of work includes converting space from commercial to residential on the top 2 floors, and the creation of 5 residential units. Ground floor excluded from scope of work - to remain retail. ",
        "units": 5,
        "postal": "M4E",
        "address": "2120 QUEEN ST E",
        "geo": {
          "lat": 43.6713522,
          "lng": -79.29470440000001
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2017-10-30",
        "issued": "2020-08-06",
        "desc": "Construct  8 storey tower with 171dwelling units for Tower B(underground parking to be shared with 36R Tippett Rd file #17-255291)",
        "units": 171,
        "postal": "",
        "address": "36 TIPPETT RD",
        "geo": {
          "lat": 43.73368,
          "lng": -79.44749
        },
        "ward": "York Centre"
      },
      {
        "start": "2017-10-30",
        "issued": "2020-07-21",
        "desc": "Construct  14 storey tower with 291dwelling units for Tower A (underground parking to be shared with 36R Tippett Rd file #17-255291)",
        "units": 291,
        "postal": "",
        "address": "36 R TIPPETT RD",
        "geo": {
          "lat": 43.7336615,
          "lng": -79.44889220000002
        },
        "ward": "York Centre"
      },
      {
        "start": "2017-11-02",
        "issued": "2019-09-12",
        "desc": "Proposal to construct a 9 storey + mechanical penthouse condo building containing 36 residential units and 3 levels of below grade parking.  ",
        "units": 37,
        "postal": "M4V",
        "address": "281 AVENUE RD",
        "geo": {
          "lat": 43.67886650000001,
          "lng": -79.3980043
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2017-11-07",
        "issued": "2020-02-07",
        "desc": "Proposal to construct a 29 storey condo with 321 residential units and 1 guest suite, 3 levels of below grade parking, and ground floor retail.  60 SHUTER ST & 189 CHURCH ST.  See active standalone shoring/soil remediation 17 210600 BLD.",
        "units": 322,
        "postal": "M5B",
        "address": "60 SHUTER ST",
        "geo": {
          "lat": 43.6550653,
          "lng": -79.37632560000002
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-11-13",
        "issued": "2018-07-27",
        "desc": "Proposal to construct a 3 storey, 22 unit residential building. Existing 6 storey residential building on site to remain. (Site Specific By-Laws 1079 - 2017 & 1080 - 2017). ",
        "units": 22,
        "postal": "M5T",
        "address": "25 LEONARD AVE",
        "geo": {
          "lat": 43.6537925,
          "lng": -79.4041495
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2017-11-15",
        "issued": "2020-10-23",
        "desc": "Proposal to construct a 30-storey mixed-use building which contains 560 residential units as well as a retail space on the ground floor, mezzanine, second floor and concourse level, office space on the third floor and 4-levels of below-grade parking.",
        "units": 560,
        "postal": "M5G",
        "address": "20 EDWARD ST",
        "geo": {
          "lat": 43.65696699999999,
          "lng": -79.382122
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2017-11-17",
        "issued": "2020-10-29",
        "desc": "Proposal to construct a 5-storey condo with 20 residential units and 2 levels of below grade parking.",
        "units": 20,
        "postal": "M4V",
        "address": "200 RUSSELL HILL RD",
        "geo": {
          "lat": 43.6821093,
          "lng": -79.40661229999999
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2017-11-20",
        "issued": "2022-06-30",
        "desc": "Proposal to construct a 33 storey condo building containing 268 residential units and 3 levels of below grade parking.  59-71 MUTUAL ST.",
        "units": 268,
        "postal": "M5B",
        "address": "59 MUTUAL ST",
        "geo": {
          "lat": 43.6556611,
          "lng": -79.3749007
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-11-23",
        "issued": "2021-12-09",
        "desc": "Proposal to construct a new 9 storey mixed use building with 18 residential units, office use, and 3 levels of underground parking.  See also 15 257797 SA.",
        "units": 18,
        "postal": "M5R",
        "address": "128 HAZELTON AVE",
        "geo": {
          "lat": 43.6748486,
          "lng": -79.3948624
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2017-11-30",
        "issued": null,
        "desc": "Proposal to construct 6 four storey residential stacked townhouse blocks (total 224 residential units) on 1 level of below grade shared parking garage.  71-75 CURLEW DR.",
        "units": 222,
        "postal": "M3A",
        "address": "71 CURLEW DR",
        "geo": {
          "lat": 43.74312,
          "lng": -79.31562
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2017-11-30",
        "issued": "2020-04-08",
        "desc": "Proposal to construct 52-storey condo with 602 residential units, 6 levels of below grade parking, and ground floor commercial.  215 CHURCH ST, 223-229 CHURCH ST & 117 DUNDAS ST E.",
        "units": 604,
        "postal": "M5B",
        "address": "215 CHURCH ST",
        "geo": {
          "lat": 43.6560897,
          "lng": -79.3766332
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-11-30",
        "issued": "2020-10-30",
        "desc": "Proposal for a 37 storey residential condominium building with 3 levels of underground parking, and 351 residential units.",
        "units": 351,
        "postal": "M4P",
        "address": "91 BROADWAY AVE",
        "geo": {
          "lat": 43.7103771,
          "lng": -79.3939141
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2017-11-30",
        "issued": "2020-08-10",
        "desc": "Proposal for new 29 storey condo with commercial at grade, 1531 residential units, and 1 level of below grade parking.",
        "units": 1531,
        "postal": "M5A",
        "address": "177 FRONT ST E",
        "geo": {
          "lat": 43.6503898,
          "lng": -79.3674633
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-12-01",
        "issued": "2021-07-15",
        "desc": "Revised Proposal Sep 15, 2020- Proposal to construct a residential condominium building with 5 levels of underground parking, with 174 dwelling units (12 additional dwelling units) as amended by COA - A0598/19EY.Original proposal -Construct a 17-storey mixed use condominium building with 5 levels of underground parking.",
        "units": 174,
        "postal": "",
        "address": "65 ANNIE CRAIG DR",
        "geo": {
          "lat": 43.6245342,
          "lng": -79.4785747
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2017-12-01",
        "issued": "2018-10-26",
        "desc": "Construction of a 14 storey apartment building with 177 residential units situated on top of a parking garage (which is also partially below a commercial/residential building, see building B). The roof of the parking, outside of the bulding footprint, consists of a vehicular drop-off court with covered canopy, loading, landscaped garden and patios.",
        "units": 177,
        "postal": "",
        "address": "1028 MCNICOLL AVE",
        "geo": {
          "lat": 43.80468,
          "lng": -79.33485999999999
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2017-12-06",
        "issued": "2020-02-04",
        "desc": "Proposal for a 31-storey mixed-use building containing ground floor retail, a daycare on the second floor, 538 residential units, and 6 levels of below grade parking. See related stand alone shoring application 17-248611.",
        "units": 538,
        "postal": "",
        "address": "19 WESTERN BATTERY RD",
        "geo": {
          "lat": 43.6395729,
          "lng": -79.4113234
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2017-12-07",
        "issued": "2022-08-24",
        "desc": "EAST BLOCK - Proposal to construct 5 residential rental towers (Building 2 - 24 storey, Building 3A - 25 storey, Building 3B - 26 storey, Building 4 - 14 storey, & Building 5 -17), 781 residential units (including 85 affordable units), commercial on levels P1, ground floor, & level 2, 5 levels of underground parking, and interior alterations to existing heritage buildings.  571-581 BLOOR ST W, 742-782 BATHURST ST (EXCLUDING 756 & 758 BATHURST), 26-34 LENNOX ST, 601-603 MARKHAM ST.",
        "units": 737,
        "postal": "",
        "address": "571 BLOOR ST W",
        "geo": {
          "lat": 43.6648647,
          "lng": -79.41148419999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2017-12-07",
        "issued": "2018-09-05",
        "desc": "Proposal for interior alterations to convert existing residential building at rear to 15-unit, 3-storey residential care facility. Scope also includes exterior fire escape stairs. Convenience address is 63 A Spencer Ave.",
        "units": 15,
        "postal": "M6K",
        "address": "63 SPENCER AVE",
        "geo": {
          "lat": 43.6364879,
          "lng": -79.4297082
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2017-12-11",
        "issued": "2021-07-05",
        "desc": "Proposal to construct a mixed-used building consisting of two 45-storey towers connected by a nine-storey base building podium, hotel space with 36 suites, residential space comprising 658 dwelling units, commercial at grade and five levels of underground parking.",
        "units": 658,
        "postal": "M5V",
        "address": "15 MERCER ST",
        "geo": {
          "lat": 43.64556959999999,
          "lng": -79.39015359999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2017-12-12",
        "issued": "2021-08-25",
        "desc": "Proposal to redevelop the site with a 58-storey mixed-use development including an nine-storey podium containing retail and office uses with 462 residential units in the tower portion. A total of 132 parking spaces and 523 bicycle parking spaces are located in 3 levels of below grade parking garage. The existing heritage building will be conserved.",
        "units": 462,
        "postal": "M5H",
        "address": "19 DUNCAN ST",
        "geo": {
          "lat": 43.6491709,
          "lng": -79.388916
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2017-12-15",
        "issued": null,
        "desc": "Construct a mixed-use building (Building A/B) 13 and 10 storeys over 2-levels of underground parking & construct a 2nd mixed use building (Building C) over 2-levels of underground parking containing a total of 408 dwelling units, retail & a small business incubation centre (1,350.0 m2) for the City of TorontoStandalone shoring permit # 17 256588",
        "units": 357,
        "postal": "M6K",
        "address": "440 DUFFERIN ST",
        "geo": {
          "lat": 43.643834,
          "lng": -79.4293531
        },
        "ward": "Davenport"
      },
      {
        "start": "2017-12-20",
        "issued": "2020-07-21",
        "desc": "Proposal to construct a 29 storey condo with 308 residential units, ground floor commercial, and 3 levels of below grade parking.",
        "units": 308,
        "postal": "",
        "address": "75 THE ESPLANADE",
        "geo": {
          "lat": 43.6469251,
          "lng": -79.3733192
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2017-12-20",
        "issued": "2020-08-31",
        "desc": "Proposal to construct 2 blocks of residential buildings with 24 units. See also 17 266912 NB for related development. Part 9 ,Townhouse blocks:as per  Emad: ",
        "units": 24,
        "postal": "",
        "address": "55 NICHOLAS AVE",
        "geo": {
          "lat": 43.6602526,
          "lng": -79.35821760000002
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-12-20",
        "issued": "2019-05-31",
        "desc": "Proposal to construct 2 new residential condo towers (34 storey & 27 storey) with 545 residential units and 3 levels of below grade parking on the property containing 2 existing rental apartment towers that will remain.  50 DUNFIELD AVE & 25 HOLLY ST.",
        "units": 549,
        "postal": "M4S",
        "address": "44 DUNFIELD AVE",
        "geo": {
          "lat": 43.7055993,
          "lng": -79.3951989
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2017-12-21",
        "issued": "2020-08-18",
        "desc": "proposal to construct a 10 storey condo with 74 residential units, ground & 2nd floor commercial, and 3 levels of below grade parking.",
        "units": 74,
        "postal": "M6J",
        "address": "41 DOVERCOURT RD",
        "geo": {
          "lat": 43.6415765,
          "lng": -79.42146799999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2017-12-22",
        "issued": "2020-06-26",
        "desc": "Construction of 44-storey mixed-use condominium with 397 residential units and four levels of underground parking.",
        "units": 397,
        "postal": "",
        "address": "5 MABELLE AVE",
        "geo": {
          "lat": 43.6466642,
          "lng": -79.5255121
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2017-12-22",
        "issued": "2020-06-18",
        "desc": "Proposal to construct 5 storey condo + 1 storey mechanical, with 26 residential rental units and ground floor artist studios.",
        "units": 26,
        "postal": "M5A",
        "address": "41 RIVER ST",
        "geo": {
          "lat": 43.6586818,
          "lng": -79.35687779999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2017-12-22",
        "issued": "2021-04-12",
        "desc": "Proposal for a new 36-storey mixed-use building with retail on the first and second floors, office uses on the 3rd and 4th floors, and residential use on the fifth floor and above, with 4 levels of below grade parking. See SPA 16-249867",
        "units": 286,
        "postal": "M5V",
        "address": "57 SPADINA AVE",
        "geo": {
          "lat": 43.6448914,
          "lng": -79.3945469
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2017-12-28",
        "issued": null,
        "desc": "Construction of a new seven storey mixed use building containing 131 rental dwelling units and ground floor retail above a two level below grade parking facility. See BA 19-102757 for related stand alone shoring ",
        "units": 131,
        "postal": "",
        "address": "3385 DUNDAS ST W",
        "geo": {
          "lat": 43.6653504,
          "lng": -79.4845158
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2018-01-08",
        "issued": "2020-02-26",
        "desc": "Proposal to demolish existing 1 storey building and construct a 9 storey mixed use building with 92 residential units, 2 levels of underground parking, and commercial (Shell) at grade.",
        "units": 92,
        "postal": "M4J",
        "address": "1177 DANFORTH AVE",
        "geo": {
          "lat": 43.6810386,
          "lng": -79.33286939999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2018-01-12",
        "issued": "2020-01-07",
        "desc": "Demolition of existing vacant building and construction of a new 9 storey residential condominium with retail at ground levelPartial occupancy of par of P3 - 4th Floor 21139902AOPartial Occupancy part of Floor 5-Floor 6- 21152741AOPartial Occupancy part of the 6th Floor  21161876AO",
        "units": 188,
        "postal": "",
        "address": "2799 KINGSTON RD",
        "geo": {
          "lat": 43.7202424,
          "lng": -79.2375017
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2018-02-07",
        "issued": "2020-01-27",
        "desc": "Proposed construction of a new 8 storey condominium building with 2.5 levels of underground parking.",
        "units": 99,
        "postal": "M1M",
        "address": "3655 KINGSTON RD",
        "geo": {
          "lat": 43.7428938,
          "lng": -79.2121362
        },
        "ward": "Scarborough-Guildwood"
      },
      {
        "start": "2018-02-09",
        "issued": "2022-07-26",
        "desc": "Proposal to construct a 42-storey mixed use building with 340 residential units, 3 storey's of retail, and 3 levels of below grade parking that includes 1 level of Car-Share spaces (at P3).",
        "units": 341,
        "postal": "",
        "address": "357 KING ST W",
        "geo": {
          "lat": 43.6457959,
          "lng": -79.3925275
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-02-15",
        "issued": "2020-05-07",
        "desc": "Proposal to construct a new 10 storey residential building with retail at gradeSee ALT 18-247014",
        "units": 196,
        "postal": "M9B",
        "address": "2 GIBBS RD",
        "geo": {
          "lat": 43.6385067,
          "lng": -79.5580811
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2018-03-01",
        "issued": "2019-09-26",
        "desc": "Proposed new 18-storey residential condominium, 234 suites with 3 levels of underground garage.",
        "units": 234,
        "postal": "",
        "address": "3220 SHEPPARD AVE E",
        "geo": {
          "lat": 43.7780472,
          "lng": -79.3124902
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2018-03-05",
        "issued": "2021-01-04",
        "desc": "Proposal to construct a new 9 storey residential building with 210 rental units, ground floor commercial, and 2 levels of below grade parking.  See active BLD for shoring/soil remediation purposes - 17 256659 BLD.",
        "units": 210,
        "postal": "M6G",
        "address": "740 DUPONT ST",
        "geo": {
          "lat": 43.6713676,
          "lng": -79.42339989999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2018-03-05",
        "issued": "2022-03-30",
        "desc": "Proposed construction of a new 14-storey purpose-built rental apartment building with 236 dwelling units, commercial at grade, two levels of underground parking. Shoring system will be provided on all 4 sides of the property. ",
        "units": 236,
        "postal": "M6P",
        "address": "299 CAMPBELL AVE",
        "geo": {
          "lat": 43.6656182,
          "lng": -79.4497559
        },
        "ward": "Davenport"
      },
      {
        "start": "2018-03-06",
        "issued": "2019-05-23",
        "desc": "Structural Demolition and Construction for the South Tower, the North Tower and the Connection in between. See related permit 17-246705 BA.",
        "units": 65,
        "postal": "M5R",
        "address": "4 AVENUE RD",
        "geo": {
          "lat": 43.6692689,
          "lng": -79.3950356
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2018-03-07",
        "issued": "2019-07-30",
        "desc": "Proposal to construct a 16 storey residential building with two levels of underground parking.",
        "units": 259,
        "postal": "M9B",
        "address": "41-53 WARRENDER AVE",
        "geo": {
          "lat": 43.6760095,
          "lng": -79.55353889999999
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2018-03-09",
        "issued": "2021-01-15",
        "desc": "Proposal to construct an 8-storey mixed-use building on Roncesvalles Avenue and 4-storey townhouse complex on Howard Park Avenue. 93 residential units are proposed with retail at grade, and 2 1/2 levels below-grade parking.",
        "units": 93,
        "postal": "M6R",
        "address": "422 RONCESVALLES AVE",
        "geo": {
          "lat": 43.6518267,
          "lng": -79.45141819999999
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2018-04-04",
        "issued": "2021-02-05",
        "desc": "Proposal to construct a 9 storey mixed use building with 216 residential units, retail shell at grade, and 2 levels of underground parking.",
        "units": 216,
        "postal": "M5R",
        "address": "275 ALBANY AVE",
        "geo": {
          "lat": 43.6735015,
          "lng": -79.41325929999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2018-04-09",
        "issued": "2020-10-20",
        "desc": "Proposal to construct a 15 storey condo with 2 levels of below grade parking, 475 residential units, and ground floor commercial.",
        "units": 475,
        "postal": "M5V",
        "address": "543 RICHMOND ST W",
        "geo": {
          "lat": 43.6466334,
          "lng": -79.40169190000002
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-04-18",
        "issued": "2019-10-17",
        "desc": "Proposal to construct a new 12 storey condominium with 40 dwelling units and 2 levels of below grade parking (1 Forest Hill Rd)",
        "units": 40,
        "postal": "M4V",
        "address": "200 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6867578,
          "lng": -79.4025561
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2018-04-27",
        "issued": "2020-09-16",
        "desc": "Proposal to construct a new 65 storey condo with 596 residential units, 6 levels of below grade parking, and commercial at grade.  1-7 YONGE ST.  See stand alone shoring 17 220841 BLD.",
        "units": 596,
        "postal": "",
        "address": "7 YONGE ST",
        "geo": {
          "lat": 43.7140491,
          "lng": -79.399701
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2018-05-04",
        "issued": "2020-10-16",
        "desc": "Proposed 12  storey and 112 unit residential apartment building at 2, 4 and 6 Teagarden Court",
        "units": 112,
        "postal": "M2N",
        "address": "2 TEAGARDEN CRT",
        "geo": {
          "lat": 43.768361,
          "lng": -79.38885719999999
        },
        "ward": "Willowdale"
      },
      {
        "start": "2018-05-08",
        "issued": "2021-03-31",
        "desc": "Proposal to construct a 15 storey mixed use building with ground floor retail and 166 residential rental units. one LL and 1 level u/g parking",
        "units": 166,
        "postal": "M5S",
        "address": "484 SPADINA AVE",
        "geo": {
          "lat": 43.6583349,
          "lng": -79.4004685
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2018-05-10",
        "issued": "2019-03-07",
        "desc": "Proposal for interior alterations to 2nd and 3rd floors of an existing 3-storey mixed-use (restaurant, retail store & dwelling units/rooms) building. Scope also includes front facade re-cladding.Proposed Uses on Second Floor:  14 - Bachelor/One Bedroom Dwelling UnitsProposed Uses on Third Floor: 10 - Bachelor/One Bedroom Dwelling Units",
        "units": 14,
        "postal": "M6J",
        "address": "1305 DUNDAS ST W",
        "geo": {
          "lat": 43.6491829,
          "lng": -79.42585489999999
        },
        "ward": "Davenport"
      },
      {
        "start": "2018-05-22",
        "issued": "2021-04-12",
        "desc": "Proposed construction of a 28-storey mixed use building with 281 dwelling units and a total GFA of 32,484.82 sq. m (329,664 sq. ft) as per Site Plan Application and 3 level of underground parking  (No. 14-266871 STE 19 SA).",
        "units": 281,
        "postal": "M6K",
        "address": "171 EAST LIBERTY ST",
        "geo": {
          "lat": 43.6382469,
          "lng": -79.4181376
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-05-23",
        "issued": "2020-11-18",
        "desc": "Proposal to construct 2 condo towers (65 storey and 70 storey) on 6 storey and 11 storey commercial/residential podium, 1650 residential units, and 4 levels of below grade parking.  BLOCK 2.  Note:  See active stand alone shoring 17 262938 BLD and caisson wall 18 139772 BLD files.",
        "units": 1670,
        "postal": "M5E",
        "address": "55 LAKE SHORE BLVD E",
        "geo": {
          "lat": 43.6439797,
          "lng": -79.3727785
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-05-28",
        "issued": "2021-01-22",
        "desc": "To construct a 7 storey apartment building with 35 units, a 3 storey underground parking garage including mechanical space, terrace and greenroof  ",
        "units": 35,
        "postal": "M5M",
        "address": "1580 AVENUE RD",
        "geo": {
          "lat": 43.7242374,
          "lng": -79.4167473
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2018-06-05",
        "issued": "2020-09-04",
        "desc": "Proposal to construct a new 5 storey addition with 35 residential units and a community centre (1117 Gerrard St E) to an existing apartment building.  Proposal includes interior alterations to the existing portion of the building (1119 Gerrard St E).  See also 17 232251 DEM, 15 256718 SA..",
        "units": 36,
        "postal": "M4M",
        "address": "1117 GERRARD ST E",
        "geo": {
          "lat": 43.6694592,
          "lng": -79.3334193
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2018-06-07",
        "issued": null,
        "desc": "Four storey apartment building (stacked and back to back condominium townhomes) containing 38 dwelling units with one level of underground parking - Building ALEAD",
        "units": 38,
        "postal": "M1R",
        "address": "1648 VICTORIA PARK AVE",
        "geo": {
          "lat": 43.7312971,
          "lng": -79.30595579999999
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2018-06-25",
        "issued": "2021-04-15",
        "desc": "Proposal to construct a 46-storey residential building including a 4-storey base building at 39 and 41 Roehampton Avenue and 50 Eglinton Avenue East. The proposed building includes 440 residential units and four levels of underground parking containing 102 parking spaces.",
        "units": 440,
        "postal": "M4P",
        "address": "39 ROEHAMPTON AVE",
        "geo": {
          "lat": 43.7080171,
          "lng": -79.3972821
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2018-06-27",
        "issued": "2018-10-31",
        "desc": "Proposed new townhouse development to include 10 street facing townhouse units above a portion of the existing underground parking facility.",
        "units": 10,
        "postal": "M4V",
        "address": "23 LASCELLES BLVD",
        "geo": {
          "lat": 43.6954921,
          "lng": -79.3985117
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2019-10-24",
        "issued": "2021-12-01",
        "desc": "Revision 02 - revision to change the second and third floors to a rooming house with new rear exterior stairsRevision 01- revise existing building length as per as built, interior layout change for 2nd and 3rd storey and structural change for rear deckProposal for 2nd and 3rd storey addition at rear of the existing building (2nd and 3rd floor form part of a single dwelling unit), one rear third floor balcony, and interior alteration to bsmt, grnd flr, 2nd and 3rd floor of existing building.",
        "units": 8,
        "postal": "M4X",
        "address": "600 PARLIAMENT ST",
        "geo": {
          "lat": 43.6685572,
          "lng": -79.3699963
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2018-07-11",
        "issued": null,
        "desc": "Proposal to construct a mixed use building consisting of 2 residential towers (59 storey & 69 storey), 1373 residential units, 6 levels of below grade parking, above grade parking, and commercial space on ground & 2nd floors.  See active standalone shoring - 18 165147 BLD.",
        "units": 867,
        "postal": "M5V",
        "address": "23 SPADINA AVE",
        "geo": {
          "lat": 43.641029,
          "lng": -79.3927485
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-07-12",
        "issued": "2020-06-02",
        "desc": "Proposal to construct a 7 storey mixed use building with a commercial at grade and residential above (total of 146 units) with 2 levels of underground parking.",
        "units": 146,
        "postal": "M4S",
        "address": "703 SOUDAN AVE",
        "geo": {
          "lat": 43.7084237,
          "lng": -79.3767159
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2018-07-20",
        "issued": "2019-07-08",
        "desc": "Proposed conversion of existing second floor assembly use (co-op/daycare) to six residential units of existing ten storey apartment building (ref. 18 118430 ZPR 00 ZR).",
        "units": 5,
        "postal": "M1P",
        "address": "4 ANTRIM CRES",
        "geo": {
          "lat": 43.7717309,
          "lng": -79.284357
        },
        "ward": "Scarborough Centre"
      },
      {
        "start": "2018-07-25",
        "issued": null,
        "desc": "Proposal to construct an 11-storey mixed-use building with retail at grade, office uses on floors 2-5, 29 live-work units on floors 6-10 and an assembly space on floor 11 with 2 levels of below grade parking.PB # 18-206952",
        "units": 29,
        "postal": "M5A",
        "address": "187 PARLIAMENT ST",
        "geo": {
          "lat": 43.6561883,
          "lng": -79.3645002
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2018-07-27",
        "issued": "2019-08-12",
        "desc": "7 storey residential condo building with 2 levels of underground parking garage.  Leaside Manor.",
        "units": 38,
        "postal": "M4G",
        "address": "3 SOUTHVALE DR",
        "geo": {
          "lat": 43.7020873,
          "lng": -79.3613815
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2018-07-27",
        "issued": null,
        "desc": "Proposal to construct an 18-storey mixed-use with shell commercial and residential condo.  Shell commercial is on levels 02-04 and 13 residential suites on levels 05-18.  There are 3 below-grade levels with M/E, storage, and a small residential common area.  It will be new construction with the 2-storey's of heritage facade facing Mercer St to be preserved and reconstructed.",
        "units": 13,
        "postal": "M5V",
        "address": "24 MERCER ST",
        "geo": {
          "lat": 43.6458342,
          "lng": -79.3907425
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-07-30",
        "issued": "2021-01-15",
        "desc": "Proposal to construct 38 storey mixed use building consisting of two residential towers (condos), 9 storey podium containing parking, and ground floor retail. ",
        "units": 724,
        "postal": "M6S",
        "address": "1926 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.635745,
          "lng": -79.4674632
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2018-07-31",
        "issued": "2020-07-24",
        "desc": "Proposed construction of a new 25-storey multiple-use apartment building with four levels of below grade parking.Standalone Shoring Permit # 18 165352",
        "units": 440,
        "postal": "",
        "address": "39 EAST LIBERTY ST",
        "geo": {
          "lat": 43.6389371,
          "lng": -79.4110592
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-08-02",
        "issued": "2021-03-30",
        "desc": "Proposal to construct a 39-storey residential rental building on existing 7-storey podium with 592 residential units and indoor/outdoor amenity spaces. The site contains 7 levels of below grade parking and storage.  BUILDING F - The Well.",
        "units": 592,
        "postal": "M5V",
        "address": "450 FRONT ST W",
        "geo": {
          "lat": 43.6424197,
          "lng": -79.39662129999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-08-02",
        "issued": "2021-05-18",
        "desc": "Proposal to construct a 32 storey condo on existing 7 storey podium (see active 17 198524 BLD) with 401 residential units and indoor/outdoor amenity spaces.  BUILDING E - The Well.  NEW ADDRESS - 470 FRONT ST W.",
        "units": 401,
        "postal": "",
        "address": "470 FRONT ST W",
        "geo": {
          "lat": 43.64221430000001,
          "lng": -79.3972107
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-08-02",
        "issued": "2021-06-14",
        "desc": "Proposal to construct a 18 storey condo on existing 7 storey podium (see active 17 198524 BLD) with 258 residential units and indoor/outdoor amenity spaces.  BUILDING D - The Well.  NEW ADDRESS - 480 FRONT ST W.",
        "units": 258,
        "postal": "",
        "address": "480 FRONT ST W",
        "geo": {
          "lat": 43.6418645,
          "lng": -79.397139
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-08-02",
        "issued": null,
        "desc": "Proposal to construct a new 56 storey residential building with 602 residential units (Building B) complete with 7 levels of underground parking.  The underground parking facility serves all of Building B and future Building C (- 2143 Lake Shore Boulevard West)",
        "units": 602,
        "postal": "",
        "address": "38 ANNIE CRAIG DR",
        "geo": {
          "lat": 43.62598999999999,
          "lng": -79.47863
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2018-08-09",
        "issued": "2019-10-31",
        "desc": "Proposal to construct  Townhouses (12 Dwelling Units)",
        "units": 12,
        "postal": "M8Z",
        "address": "1124 ISLINGTON AVE",
        "geo": {
          "lat": 43.63835830000001,
          "lng": -79.5210213
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2018-08-10",
        "issued": "2020-12-03",
        "desc": "Proposal to construct a 9 storey mixed use building with 116 units, 2 levels of underground parking and retail at grade.",
        "units": 116,
        "postal": "M6C",
        "address": "836 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6807376,
          "lng": -79.4317913
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2018-08-22",
        "issued": "2020-02-05",
        "desc": "Proposal to construct a 20 storey residential rental building with 177 units and 4 levels of below grade parking.",
        "units": 177,
        "postal": "M4V",
        "address": "620 AVENUE RD",
        "geo": {
          "lat": 43.6902419,
          "lng": -79.4033742
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2018-08-24",
        "issued": "2020-10-10",
        "desc": "Proposal to construct 8 storey residential condominimum with 2 levels of underground parking and retail at ground floor.",
        "units": 167,
        "postal": "M8Z",
        "address": "784 THE QUEENSWAY",
        "geo": {
          "lat": 43.6261924,
          "lng": -79.5055064
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2018-08-27",
        "issued": "2021-07-09",
        "desc": "Proposed construction of a new 9-storey, 30 unit residential condominium with 1 retail space at grade and 3 levels of below grade parking.",
        "units": 30,
        "postal": "M5R",
        "address": "346 DAVENPORT RD",
        "geo": {
          "lat": 43.6752924,
          "lng": -79.4013484
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2018-08-31",
        "issued": "2020-02-19",
        "desc": "21 Storey, 216 Suite Residential Building with 3 Levels of Underground Parking Residential condo construction including site works, excavation and shoring, underground parking, foundation, base building, plumbing, hvac, sprinkler, electrical and common area and suite finishes.",
        "units": 216,
        "postal": "",
        "address": "1461 LAWRENCE AVE W",
        "geo": {
          "lat": 43.70751,
          "lng": -79.4798
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2018-09-11",
        "issued": "2019-05-16",
        "desc": "Proposed two level parking + 12 storey affordable rental building on existing surface parking areaof an existing affordable building site",
        "units": 186,
        "postal": "M1V",
        "address": "25 THUNDER GRV",
        "geo": {
          "lat": 43.8088703,
          "lng": -79.2652164
        },
        "ward": "Scarborough North"
      },
      {
        "start": "2018-09-11",
        "issued": "2021-10-29",
        "desc": "To construct a 22 storey condominium residential/commercial building (Building A, Phase 1) with 296 residential units, commercial at grade and 3 levels of below grade parking.",
        "units": 303,
        "postal": "M4G",
        "address": "939 EGLINTON AVE E",
        "geo": {
          "lat": 43.7135214,
          "lng": -79.3603722
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2018-09-11",
        "issued": "2020-10-29",
        "desc": "Proposal to construct 3 level below grade parking garage,  6 storey commercial/residential podium with parking,  31 storey residential tower (west) and 34 storey residential tower (east).",
        "units": 644,
        "postal": "M1P",
        "address": "2031 KENNEDY RD",
        "geo": {
          "lat": 43.77714,
          "lng": -79.28462999999999
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2018-09-13",
        "issued": "2020-04-28",
        "desc": "Proposal to construct a 6 storey midrise building with 58 Units - Building A.",
        "units": 58,
        "postal": "",
        "address": "160 CANON JACKSON DR",
        "geo": {
          "lat": 43.69759579999999,
          "lng": -79.47517839999999
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2018-09-13",
        "issued": "2020-04-28",
        "desc": "Proposal to construct a 4 storey midrise building with 45 Units - Building D.",
        "units": 45,
        "postal": "",
        "address": "130 CANON JACKSON DR",
        "geo": {
          "lat": 43.6979262,
          "lng": -79.473948
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2018-09-14",
        "issued": "2020-02-18",
        "desc": "Proposal to construct a 4 storey midrise building with 45 Units - Building E.",
        "units": 45,
        "postal": "",
        "address": "120 CANON JACKSON DR",
        "geo": {
          "lat": 43.69798,
          "lng": -79.4734299
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2018-09-17",
        "issued": null,
        "desc": "Proposal to construct a new 10 storey (excluding Mezzanine) mixed use building with 20 rental dwelling units and non-residential uses on the ground floor, second storey, mezzanine, eighth storey and ninth storey.",
        "units": 20,
        "postal": "M4S",
        "address": "1982 YONGE ST",
        "geo": {
          "lat": 43.7000256,
          "lng": -79.3972452
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2018-09-19",
        "issued": "2019-08-29",
        "desc": "Proposal to construct a 4 storey condo townhouse block (Block A) above a 1 storey parking garage. Parking garage and amenity building covered under permit 18 228194 BLD 00 NB.",
        "units": 35,
        "postal": "M9B",
        "address": "400 THE EAST MALL",
        "geo": {
          "lat": 43.6465478,
          "lng": -79.5605635
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2018-09-20",
        "issued": "2021-08-06",
        "desc": "Proposal to construct a residential tower 47 storey condominium containing 426 residential units with a 3 level podium and amenity component; including 7 levels of underground parking.Standalone shoring permit Application# 18 160944",
        "units": 426,
        "postal": "M5V",
        "address": "40 WIDMER ST",
        "geo": {
          "lat": 43.6479957,
          "lng": -79.3917973
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-09-28",
        "issued": null,
        "desc": "Construct a 36 storey tower with 561 units, a 4 storey underground parking garage and a 7 storey  podium with retail and office spacesLEAD",
        "units": 562,
        "postal": "M2M",
        "address": "5799-5915 YONGE ST",
        "geo": {
          "lat": 43.784921,
          "lng": -79.4164589
        },
        "ward": "Willowdale"
      },
      {
        "start": "2018-10-22",
        "issued": "2020-03-24",
        "desc": "Proposal for a second floor addition for (4) residential units and interior alterations to existing second floor to convert vacant space to (3) residential units (Total of 7 Dwelling units).",
        "units": 7,
        "postal": "M6H",
        "address": "1377 DUFFERIN ST",
        "geo": {
          "lat": 43.670102,
          "lng": -79.4394511
        },
        "ward": "Davenport"
      },
      {
        "start": "2018-10-23",
        "issued": "2021-01-28",
        "desc": "Part Permit - Proposal to construct a 6 storey, 81-unit residential condominium with ground floor commercial and an two levels of underground parking.",
        "units": 81,
        "postal": "M8W",
        "address": "408 BROWNS LINE",
        "geo": {
          "lat": 43.60133,
          "lng": -79.54553
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2018-11-15",
        "issued": "2021-07-28",
        "desc": "Proposal to construct a new 4 storey apartment building with 41 dwelling units and 1 level of below grade parking.",
        "units": 41,
        "postal": "M4M",
        "address": "485 LOGAN AVE",
        "geo": {
          "lat": 43.66672519999999,
          "lng": -79.34457549999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2018-11-15",
        "issued": "2019-12-06",
        "desc": "Proposal to construct a 12 storey & 9 storey residential condominium on a common podium consisting of 400 suites with 2 levels of underground parking including retail at grade. (See stand alone shoring 18-182995 BLD 00 BA)",
        "units": 401,
        "postal": "M5A",
        "address": "475 FRONT ST E",
        "geo": {
          "lat": 43.6528783,
          "lng": -79.3551974
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2018-11-28",
        "issued": null,
        "desc": "Proposal to construct a mixed-use residential and commercial building consisting of (1) 42 Storey and (1) 64 storey residential towers above a commercial podium containing both above grade residential parking and retail on top of a 6 level below grade commercial parking garage. Related to 16 155457 STE",
        "units": 1079,
        "postal": "M4W",
        "address": "50 CUMBERLAND ST",
        "geo": {
          "lat": 43.6711143,
          "lng": -79.389133
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2018-12-07",
        "issued": "2021-10-15",
        "desc": "Proposal to construct a 48 storey mixed use condominium/hotel building with a 3 storey podium and 4 levels of below grade parking.  (See 8 Widmer St 18-265872 BLD 00 NB for related 49 storey condominium tower)",
        "units": 216,
        "postal": "",
        "address": "30 WIDMER ST",
        "geo": {
          "lat": 43.6474932,
          "lng": -79.3916713
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-12-07",
        "issued": "2021-10-21",
        "desc": "Proposal to construct new 49 storey apartment building with 424 residential units and 4 storey below grade parking garage. See 30 Widmer permit #18-265869 for 48 storey residential (hotel/apartments) building.",
        "units": 424,
        "postal": "",
        "address": "8 WIDMER ST",
        "geo": {
          "lat": 43.64676070000001,
          "lng": -79.39179580000001
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-12-07",
        "issued": null,
        "desc": "Proposal to construct a 12 storey condo with 164 residential units, commercial at grade, and 1 level of below grade parking. 170 Spadina Avenue & 1-7 Cameron Street",
        "units": 162,
        "postal": "M5T",
        "address": "170 SPADINA AVE",
        "geo": {
          "lat": 43.6491267,
          "lng": -79.396908
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-12-17",
        "issued": "2020-06-22",
        "desc": "Proposal to construct a 38 storey residential rental apartment building addition with 2 levels of underground parking. Lot comprised of 89 and 101 Roehampton Ave.AS FOR STANDPIPE 19 143403",
        "units": 256,
        "postal": "M4P",
        "address": "101 ROEHAMPTON AVE",
        "geo": {
          "lat": 43.7083802,
          "lng": -79.395344
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2018-12-19",
        "issued": "2021-07-05",
        "desc": "Proposal to construct a 498-unit condominium in two buildings (12-storey and 29-storey) connected by a podium. The buildings include 3-level underground parking garage (18,985 sq. m.), common area (2,398 sq. m.), and mechanical space (1,692 sq. m.)",
        "units": 498,
        "postal": "",
        "address": "251 MANITOBA ST",
        "geo": {
          "lat": 43.62386,
          "lng": -79.48895
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2018-12-19",
        "issued": null,
        "desc": "Proposal to construct a 47 storey Mixed Use Building(Res/Non Res) with 5 levels of below grade parking. REF: 18-173136 PB folder",
        "units": 383,
        "postal": "M4Y",
        "address": "628 CHURCH ST",
        "geo": {
          "lat": 43.6695619,
          "lng": -79.38291799999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2018-12-20",
        "issued": "2022-04-27",
        "desc": "Proposal to construct a new 49 storey mixed use building with 338 dwelling units (including 10 rental units), commercial retail at grade and 4 levels of underground parking. (321-333 King St W)",
        "units": 338,
        "postal": "M5V",
        "address": "327 KING ST W",
        "geo": {
          "lat": 43.6460845,
          "lng": -79.3910992
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-12-20",
        "issued": "2021-11-16",
        "desc": "Proposal to construct a new 21 storey rental apartment building with 180 dwelling units and 4 levels of underground parking. ",
        "units": 180,
        "postal": "M4S",
        "address": "71 REDPATH AVE",
        "geo": {
          "lat": 43.706028,
          "lng": -79.39185839999999
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2018-12-20",
        "issued": null,
        "desc": "Proposal to construct  BUILDING 'B' - 2 new residential towers one 12 storey and one 14 storey with a 5 storey podium. Total of 287 dwelling units and 4 level of below grade parking. related to 17 271399 STE",
        "units": 287,
        "postal": "M5V",
        "address": "89 NIAGARA ST",
        "geo": {
          "lat": 43.6415371,
          "lng": -79.4031371
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2018-12-21",
        "issued": "2021-03-04",
        "desc": "Proposed 24 storey building with 286 suites, retail/commercial units, and 2 levels of underground parking. PHASE 2, see 18-271792 Building E",
        "units": 286,
        "postal": "M9B",
        "address": "5365 DUNDAS ST W",
        "geo": {
          "lat": 43.63535,
          "lng": -79.54036
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2018-12-27",
        "issued": "2021-09-09",
        "desc": "To Construct a new 9 storey residential rental apartment building with 2 level below grade parking garage. Building A",
        "units": 80,
        "postal": "M9A",
        "address": "289 THE KINGSWAY",
        "geo": {
          "lat": 43.6631727,
          "lng": -79.51963889999999
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2018-12-31",
        "issued": "2021-08-12",
        "desc": "Residential Tower (Building B) - construct a new 31-storey residential building.",
        "units": 309,
        "postal": "M2N",
        "address": "5250-5254 YONGE ST",
        "geo": {
          "lat": 43.7718002,
          "lng": -79.4138546
        },
        "ward": "Willowdale"
      },
      {
        "start": "2018-07-04",
        "issued": "2021-09-01",
        "desc": "Proposal to construct a new 8 storey mixed use building plus mechanical penthouse and 2 levels of below grade parking. New building includes ground floor retail and 68 residential units.  See also 17 187476 SA.",
        "units": 68,
        "postal": "M6G",
        "address": "597 BLOOR ST W",
        "geo": {
          "lat": 43.6646001,
          "lng": -79.4129217
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2019-01-11",
        "issued": "2021-06-28",
        "desc": "Submission 3 for BUILDING C: One of four site plan applications for the residential portion of the redevelopment of the former Globe and Mail lands (aka \"The Well\").  These residential site plan applications are related to the non-residential \"Master\" site plan application (file no. 16 269540 STE 20 SA).  This application refers to Building \"C\", a 14-storey residential building with 99 units.",
        "units": 99,
        "postal": "M5V",
        "address": "455 WELLINGTON ST W",
        "geo": {
          "lat": 43.6435087,
          "lng": -79.39656389999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-01-11",
        "issued": "2021-03-25",
        "desc": "As part of a master plan, this proposal relates to th construction of a 14-storey residential tower above a two storey podium for a total of 16 storeys with 171 residential units. The site contains 6 levels of below grade parking and storage. All dwelling units will be offered as rental. The 2-storey commercial podium was issued under Building G (17 198524 STR 00 CP).",
        "units": 171,
        "postal": "M5V",
        "address": "425 WELLINGTON ST W",
        "geo": {
          "lat": 43.6434647,
          "lng": -79.39610019999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-01-11",
        "issued": "2021-03-25",
        "desc": "As part of a master plan, this proposal relates to th construction of a 14-storey residential tower above a two storey podium for a total of 16 storeys with 160 residential units. The site contains 6 levels of below grade parking and storage. All dwelling units will be offered as rental. The 2-storey commercial podium was issued under Building G (17 198524 STR 00 CP).",
        "units": 160,
        "postal": "M5V",
        "address": "435 WELLINGTON ST W",
        "geo": {
          "lat": 43.6433803,
          "lng": -79.3962264
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-01-18",
        "issued": "2022-08-04",
        "desc": "Proposal to construct an 86 storey mixed use apartment building with 4 levels of below grade commercial parking and one level of below grade commercial space.",
        "units": 416,
        "postal": "M4W",
        "address": "1 BLOOR ST W",
        "geo": {
          "lat": 43.6699145,
          "lng": -79.3870395
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2019-01-25",
        "issued": null,
        "desc": "Proposal to construct three mixed use buildings (39, 35, and 17 storeys) with a total of 899 dwelling units and 4 levels of underground parking. ",
        "units": 899,
        "postal": "M5T",
        "address": "234 SIMCOE ST",
        "geo": {
          "lat": 43.6534062,
          "lng": -79.3893471
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-02-25",
        "issued": "2020-08-05",
        "desc": "Proposal to replace the demolished rear addition with a new four storey, 30 room, rear addition for the purpose of post secondary  religious education use.place of worship and post secondary residence for a U of T affiliate . ",
        "units": 30,
        "postal": "M5R",
        "address": "226 ST GEORGE ST",
        "geo": {
          "lat": 43.6717299,
          "lng": -79.4018746
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2019-03-08",
        "issued": "2020-06-08",
        "desc": "Proposed construction of a 7 storey apartment building containing 68 residential units with two levels of underground parking and commercial space on the ground floor. ",
        "units": 68,
        "postal": "M4E",
        "address": "650 KINGSTON RD",
        "geo": {
          "lat": 43.6789476,
          "lng": -79.2986888
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2019-03-26",
        "issued": null,
        "desc": "Proposal to construct a seven-storey Holiday Inn Hotel. ",
        "units": 105,
        "postal": "M9W",
        "address": "407 REXDALE BLVD",
        "geo": {
          "lat": 43.7155786,
          "lng": -79.59137729999999
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2019-04-01",
        "issued": "2021-10-27",
        "desc": "Proposed eight storey condominium with two levels of underground parking. Ground floor retail components. Existing heritage facade to remain. ",
        "units": 285,
        "postal": "M4M",
        "address": "462 EASTERN AVE",
        "geo": {
          "lat": 43.6577504,
          "lng": -79.342389
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2019-04-03",
        "issued": null,
        "desc": "Proposal to construct 19 new stacked townhouses with one level of underground parking",
        "units": 19,
        "postal": "M8V",
        "address": "2686 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.6029782,
          "lng": -79.49547199999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2019-04-08",
        "issued": "2019-08-19",
        "desc": "Proposal for multiple projects to an existing 2 storey multi use building.  Scope of work includes a 3rd floor addition, a 3 storey rear addition, and interior alterations. See also 15 104035 ZZC, 15 117018 MV and Final and Binding A0161/15TEY.",
        "units": 6,
        "postal": "M4K",
        "address": "1030 PAPE AVE",
        "geo": {
          "lat": 43.6894802,
          "lng": -79.34907489999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2020-08-07",
        "issued": null,
        "desc": "Revision 01. Remove five dwelling units from the existing 11 dwelling unit house, resulting in six dwelling units. ",
        "units": 6,
        "postal": "M5S",
        "address": "36 BRUNSWICK AVE",
        "geo": {
          "lat": 43.65844269999999,
          "lng": -79.4048619
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2019-04-11",
        "issued": "2020-10-05",
        "desc": "New 13 storey residential buildings with 363 units; 3 storey underground parking garage and retail space at grade PB of $600,000 required first above grade permit.",
        "units": 363,
        "postal": "M3M",
        "address": "3100 KEELE ST",
        "geo": {
          "lat": 43.7399397,
          "lng": -79.4858325
        },
        "ward": "York Centre"
      },
      {
        "start": "2019-04-12",
        "issued": "2021-04-07",
        "desc": "19 139643 Construct a new 11 storey condominium with 250 units and a 2 level underground parking garage that will serve  50 and 70 George Butchart Dr",
        "units": 252,
        "postal": "",
        "address": "2995 KEELE ST",
        "geo": {
          "lat": 43.7360329,
          "lng": -79.4837691
        },
        "ward": "York Centre"
      },
      {
        "start": "2019-04-15",
        "issued": "2020-05-08",
        "desc": "Construction of 28 stacked townhouses with 1 level of underground parking (19-140886 BLD)This application is for block 1 (20 units). See also Alternative Soludtion folder 19-141074 ALT.",
        "units": 20,
        "postal": "M8W",
        "address": "68 LONG BRANCH AVE",
        "geo": {
          "lat": 43.59366800000001,
          "lng": -79.53415369999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2019-04-18",
        "issued": null,
        "desc": "Proposal for a new 34-storey mixed use rental apartment building containing 232 rental units with retail uses at grade and 2 levels below grade parking. Address includes 6 and 8 Gloucester Street.",
        "units": 232,
        "postal": "M4Y",
        "address": "6 GLOUCESTER ST",
        "geo": {
          "lat": 43.6667896,
          "lng": -79.3848388
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2019-04-30",
        "issued": "2022-02-23",
        "desc": "Proposed 14 storey mixed-use condominium (Building D) containing 144 residential units, retail and an underground parking garage. ",
        "units": 144,
        "postal": "M1G",
        "address": "1-2 MEADOWGLEN PL",
        "geo": {
          "lat": 43.7747812,
          "lng": -79.22963109999999
        },
        "ward": "Scarborough-Guildwood"
      },
      {
        "start": "2019-04-30",
        "issued": "2020-08-07",
        "desc": "Proposed construction of back-to-back stacked residential condominium complex (51 units)  with 1 level of underground parking garage.",
        "units": 51,
        "postal": "M1N",
        "address": "35 BIRCHCLIFF AVE",
        "geo": {
          "lat": 43.69143649999999,
          "lng": -79.26451639999999
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2019-05-03",
        "issued": "2022-03-28",
        "desc": "Construct a 9 storey residential building (88 dwelling units) with 4 levels of underground garage and retail along Yonge St",
        "units": 90,
        "postal": "M4N",
        "address": "2781 YONGE ST",
        "geo": {
          "lat": 43.7186725,
          "lng": -79.40056229999999
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2019-05-08",
        "issued": "2020-09-18",
        "desc": "Construct a 32 storey residential tower with 358 units and 3 levels of underground parking",
        "units": 358,
        "postal": "M2N",
        "address": "15 HOLMES AVE",
        "geo": {
          "lat": 43.77770109999999,
          "lng": -79.41423139999999
        },
        "ward": "Willowdale"
      },
      {
        "start": "2019-05-13",
        "issued": "2020-11-18",
        "desc": "Propose a new 12 storey residential building with 2 levels underground parking",
        "units": 92,
        "postal": "M4P",
        "address": "492 EGLINTON AVE E",
        "geo": {
          "lat": 43.71008140000001,
          "lng": -79.3831223
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2019-05-15",
        "issued": "2021-02-22",
        "desc": "Proposal to construct a new 6 storey mixed use building, 58 residential condo with commercial unit at grade complete with a  parking stacker. ",
        "units": 58,
        "postal": "",
        "address": "794 GERRARD ST E",
        "geo": {
          "lat": 43.66734049999999,
          "lng": -79.34505899999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2019-05-21",
        "issued": "2021-04-08",
        "desc": "14 storey residential building A with 340 units and a shared 3 level underground parking garage. Proposal for site includees two residential buildings with a shared U/G parking garage. Building A includes the entire u/g garage.  Building B 19-157198 00 NB has 177 units above the the shared underground garage which has 354 parking stalls. This application is for Building A and the entire U/G parking garage.",
        "units": 340,
        "postal": "",
        "address": "30 TIPPETT RD",
        "geo": {
          "lat": 43.73299,
          "lng": -79.44824
        },
        "ward": "York Centre"
      },
      {
        "start": "2019-05-22",
        "issued": null,
        "desc": "Proposal for interior alterations to legalize and maintain two dwelling units and 4 dwelling rooms inside an existing 2½-storey detached dwelling.  See also 18 195179 ZZC, 18 244187 MV and Final and Binding A0978/18TEY.",
        "units": 6,
        "postal": "M6H",
        "address": "981 DOVERCOURT RD",
        "geo": {
          "lat": 43.6668819,
          "lng": -79.4313019
        },
        "ward": "Davenport"
      },
      {
        "start": "2019-05-24",
        "issued": "2021-08-11",
        "desc": "To construct 27 storey tower (304 ) units, include 3 level of underground parking garage and shared podium on 5th floor (1,577 m2)- Tower B LEAD PERMIT See also 19 158862 Tower C",
        "units": 306,
        "postal": "",
        "address": "1095 LESLIE ST",
        "geo": {
          "lat": 43.7198972,
          "lng": -79.3496515
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2019-06-05",
        "issued": null,
        "desc": "Proposal to construct a new 14 storey mixed use building with 3 levels of underground parking, 297 dwelling units, and retail at grade.",
        "units": 307,
        "postal": "M6K",
        "address": "1221 KING ST W",
        "geo": {
          "lat": 43.6386112,
          "lng": -79.4276199
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2019-06-14",
        "issued": null,
        "desc": "Proposal for interior alterations, a 3 storey rear addition, a 3rd floor rear addition and convert existing SFD to a 7 unit dwelling. See also 17 244558 ZZC and 18 201802 TLAB. ",
        "units": 7,
        "postal": "M5R",
        "address": "394 BRUNSWICK AVE",
        "geo": {
          "lat": 43.6692664,
          "lng": -79.4090865
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2019-06-18",
        "issued": "2019-12-24",
        "desc": "Proposed interior alterations of existing mixed use building by creating 13 residential units and 2 commercial units The exist building is 6 residential units and 8 commercial units.",
        "units": 7,
        "postal": "M6S",
        "address": "3635 DUNDAS ST W",
        "geo": {
          "lat": 43.66556,
          "lng": -79.4949005
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2019-06-18",
        "issued": null,
        "desc": "Proposal to construct 3 new buildings - Building \"B2' which consists of 182 dwelling units, 14 storey's, and retail at grade. Building \"C+G\" consists of one 49 storey and 15 storey combined building with 591 dwelling units and retail at grade, and Building \"F\" which consists of 374 dwelling units, 39 storey's and retail at grade. Scope of work includes 4 levels of below grade parking.",
        "units": 1147,
        "postal": "M5A",
        "address": "215 LAKE SHORE BLVD E",
        "geo": {
          "lat": 43.6458131,
          "lng": -79.366801
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-06-21",
        "issued": null,
        "desc": "This Application to be cancelled (E.O.)This Application is replaced with Applications: # 20 143410 B01-B21 00NH ( stack townhouses) and# 20 143403 BA ( underground garage) .This Application to be cancelled (E.O.)Construction of new 3-level multi-unit residential building with 21units on site occupied by existing residential highrise. Partial renovation of existing P1 level for new mechanical room. ",
        "units": 21,
        "postal": "M1P",
        "address": "41 ANTRIM CRES",
        "geo": {
          "lat": 43.771884,
          "lng": -79.2879112
        },
        "ward": "Scarborough Centre"
      },
      {
        "start": "2019-06-21",
        "issued": null,
        "desc": "Proposal to increase the number of residential units in the three-storey single family dwelling to seven units by constructing a rear third storey addition with rear deck; and to reconstruct the south side stairs and front first and second storey decks. Scope of work includes 5 new decks.",
        "units": 6,
        "postal": "M6R",
        "address": "66 TRILLER AVE",
        "geo": {
          "lat": 43.6403106,
          "lng": -79.4445071
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2019-06-25",
        "issued": "2022-07-07",
        "desc": "Proposed construction of a new 9-storey mixed-use building: 14748 square metres res. GFA, 664 square metres non-res GFA, 154 dwelling units and 2 levels of below grade parking",
        "units": 150,
        "postal": "M6P",
        "address": "2720 DUNDAS ST W",
        "geo": {
          "lat": 43.6650311,
          "lng": -79.45970919999999
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2019-07-02",
        "issued": null,
        "desc": "Proposal to construct a new 22-storey condominium development with 233 units, with 147 of the units for affordable ownership, with four levels of below grade parking",
        "units": 233,
        "postal": "M9N",
        "address": "10 WILBY CRES",
        "geo": {
          "lat": 43.6975378,
          "lng": -79.5113945
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2019-07-10",
        "issued": null,
        "desc": "Proposal to construct a new 11 storey mixed use building on the south side of the property, with retail on the ground floor, 118 rental residential units above and 101 residential underground parking spaces. The proposal retains the existing 25 storey apartment building. See also 16 198194 STE and 18 216699 STE.",
        "units": 118,
        "postal": "M5S",
        "address": "666 SPADINA AVE",
        "geo": {
          "lat": 43.6639718,
          "lng": -79.4029958
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2019-07-15",
        "issued": "2021-09-29",
        "desc": "Proposal to construct a 15 storey residental condominium building, retail at grade and 3 levels below grade parking.",
        "units": 125,
        "postal": "M5V",
        "address": "520 RICHMOND ST W",
        "geo": {
          "lat": 43.64742469999999,
          "lng": -79.39950429999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-07-17",
        "issued": "2022-05-13",
        "desc": "Construct a 13 storey rental apartment consisting of 150 units and 2 1/2 level underground parking garage",
        "units": 150,
        "postal": "M6B",
        "address": "2525 BATHURST ST",
        "geo": {
          "lat": 43.7059937,
          "lng": -79.4261248
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2019-07-23",
        "issued": null,
        "desc": "Proposal to construct a mixed use building with an overall height of 6-storeys. A total of 16 residential units are proposed on the second through sixth storeys, retail/commercial space is proposed on the ground floor and one level of below grade parking.",
        "units": 16,
        "postal": "M4M",
        "address": "1001 QUEEN ST E",
        "geo": {
          "lat": 43.66129840000001,
          "lng": -79.3379202
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2019-07-23",
        "issued": "2020-03-03",
        "desc": "Interior alterations, and construct 2nd storey addition at front, 3rd storey addition at rear.  Scope of work includes additional retail at the ground floor and the addition of 7 new rental residentail dwelling units for use as a mixed use building with one retail suite and 8 dwelling units",
        "units": 7,
        "postal": "M6P",
        "address": "3039 DUNDAS ST W",
        "geo": {
          "lat": 43.6653804,
          "lng": -79.4708308
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2019-07-23",
        "issued": "2021-09-28",
        "desc": "Proposal to construct a 36-storey 'North Tower' consisting of 504 Units and 33-storey 'South Tower' consisting of 420 Units together with Day Care Facility and 2 Levels of below grade parking.",
        "units": 923,
        "postal": "M4P",
        "address": "117 BROADWAY AVE",
        "geo": {
          "lat": 43.71035699999999,
          "lng": -79.3925946
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2019-07-24",
        "issued": "2021-07-09",
        "desc": "Proposal to construct a new 8-storey Mixed Use-Res/Non Res Building containing 112 units and 1 level of below grade parking.Residential DEmo parmit # 19 217330 ",
        "units": 112,
        "postal": "M6H",
        "address": "871 COLLEGE ST",
        "geo": {
          "lat": 43.6538327,
          "lng": -79.4240837
        },
        "ward": "Davenport"
      },
      {
        "start": "2019-07-30",
        "issued": null,
        "desc": "Proposal to construct a new 35 storey and a new 7 storey rental apartment buildings with a total of 484 residential units and 2 levels of underground parking.",
        "units": 484,
        "postal": "M4C",
        "address": "90 EASTDALE AVE",
        "geo": {
          "lat": 43.6948898,
          "lng": -79.3013929
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2019-07-30",
        "issued": "2021-04-09",
        "desc": "Proposal to construct a new 50-storey apartment  building containing 541 condominium apartments, 100 rental-replacement apartments, interior and exterior amenity spaces, underground parking, service/utility rooms, loading facilities, and elevators.",
        "units": 641,
        "postal": "M4Y",
        "address": "55 CHARLES ST E",
        "geo": {
          "lat": 43.6688239,
          "lng": -79.3835574
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2019-08-06",
        "issued": null,
        "desc": "Proposed Interior Alterations to basement and ground floor to create 18 additional apartment suites and recreational/amenity spaces to existing apartment building.   ",
        "units": 18,
        "postal": "M1J",
        "address": "15 COUGAR CRT",
        "geo": {
          "lat": 43.744985,
          "lng": -79.2174926
        },
        "ward": "Scarborough-Guildwood"
      },
      {
        "start": "2019-08-07",
        "issued": "2021-11-24",
        "desc": "New 12 storey residential mixed use condo with 190 units and 3 levels of underground parking.",
        "units": 190,
        "postal": "M1N",
        "address": "2201 KINGSTON RD",
        "geo": {
          "lat": 43.7031214,
          "lng": -79.25279479999999
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2019-08-08",
        "issued": "2021-06-24",
        "desc": "PHASE II Proposal to construct a new mixed use building with a 7 storey and 15 storey tower.  Proposed building has ground floor retail, 212 residential suites and 4 levels of underground parking.See also 14-176212 STE OZ.",
        "units": 212,
        "postal": "M4M",
        "address": "677 QUEEN ST E",
        "geo": {
          "lat": 43.6583102,
          "lng": -79.35086559999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2019-08-08",
        "issued": null,
        "desc": "Proposal to construct a new 16 storey mixed use building with 4 lower levels of commercial/retail and 3 levels of below grade parking/loading.",
        "units": 439,
        "postal": "M5V",
        "address": "539 KING ST W",
        "geo": {
          "lat": 43.6445053,
          "lng": -79.39859799999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-08-13",
        "issued": null,
        "desc": "Proposal to construct a 15 storey residential apartment building with 112 rental dwelling units and two levels of underground parking.",
        "units": 112,
        "postal": "M5A",
        "address": "307 SHERBOURNE ST",
        "geo": {
          "lat": 43.6610447,
          "lng": -79.371768
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2019-08-19",
        "issued": "2022-07-20",
        "desc": "Construct 4 Blocks of stacked 4-storey townhouses: Units 1-38, Block AAssociated permitsBlock A, 38 units (19208255)Block B, 38 Units (19-208296)Block C, 37 Units (19-208308)Block D, 29 Units (19-208315)With One Level of Underground Parking (19-208329)",
        "units": 38,
        "postal": "M1W",
        "address": "3453 VICTORIA PARK AVE",
        "geo": {
          "lat": 43.7987437,
          "lng": -79.333221
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2019-08-21",
        "issued": "2020-10-09",
        "desc": "Proposed interior alterations to second floor offices to convert to residential apartment units as well as interior alterations for a new penthouse apartment in the exisitng mixed use building ",
        "units": 13,
        "postal": "M9N",
        "address": "1906-1930 WESTON RD",
        "geo": {
          "lat": 43.70024739999999,
          "lng": -79.5170023
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2019-08-23",
        "issued": null,
        "desc": "Contruct a eight storey mixed-use building with 141 rental dwelling units, 2 levels of u/g parking garage and commercial space on the ground floor.",
        "units": 141,
        "postal": "M6E",
        "address": "2270 EGLINTON AVE W",
        "geo": {
          "lat": 43.69305,
          "lng": -79.46330999999999
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2019-08-23",
        "issued": null,
        "desc": "Proposal to construct a new 15 storey mixed use building with ground floor retail, 122 dwelling units and 3 levels of underground parking. See also 16 270617 STE SA and 18192283 DEMSoil remediation and shoring approved by permit 19 102799",
        "units": 122,
        "postal": "M6J",
        "address": "1181 QUEEN ST W",
        "geo": {
          "lat": 43.6423998,
          "lng": -79.4264841
        },
        "ward": "Davenport"
      },
      {
        "start": "2019-08-30",
        "issued": "2020-02-10",
        "desc": "Proposal to construct a rear three storey addition and interior alterations to existing three storey commercial/residential building. ",
        "units": 5,
        "postal": "M6P",
        "address": "3333 DUNDAS ST W",
        "geo": {
          "lat": 43.66545139999999,
          "lng": -79.4812508
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2019-08-30",
        "issued": "2021-01-13",
        "desc": "Proposal to construct a new 32 storey residential condo with 234 unit and 3 levels below grade parking.",
        "units": 234,
        "postal": "M5B",
        "address": "79 SHUTER ST",
        "geo": {
          "lat": 43.6550066,
          "lng": -79.3747352
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2019-09-04",
        "issued": null,
        "desc": "construct 121 stacked townhouses in 7 blocks, BLOCK A",
        "units": 20,
        "postal": "M1N",
        "address": "168 CLONMORE DR",
        "geo": {
          "lat": 43.69021619999999,
          "lng": -79.2772013
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2019-09-06",
        "issued": "2022-08-30",
        "desc": "Proposal to construct a new mixed-use building consisting of three towers (two - 16 storey towers (  Tower A & B) + one 26 storey ( Tower C) and podiums with a shared one level below grade garage. A total of 770 rental housing units are proposed, with 231 units for affordable rental housing. ( BLOCK # 8)",
        "units": 770,
        "postal": "M5A",
        "address": "391 CHERRY ST",
        "geo": {
          "lat": 43.6511565,
          "lng": -79.35691849999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-09-10",
        "issued": "2022-05-06",
        "desc": "Proposal to construct a new 10 storey mixed use building with 242 residential units, 2 levels of underground parking, and 2 commercial units located at grade. ",
        "units": 242,
        "postal": "M6N",
        "address": "2306 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6704772,
          "lng": -79.47821569999999
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2019-09-16",
        "issued": "2020-03-16",
        "desc": "Proposal to convert A detached .sfd-dwelling from 1 unit to 5 units.",
        "units": 5,
        "postal": "M4M",
        "address": "56 JONES AVE",
        "geo": {
          "lat": 43.6640025,
          "lng": -79.3336506
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2019-09-18",
        "issued": "2021-12-14",
        "desc": "Proposed construction of a new 10-storey residential condominium with 5 levels of underground parking. ",
        "units": 134,
        "postal": "",
        "address": "25 NEIGHBOURHOOD LANE",
        "geo": {
          "lat": 43.6382199,
          "lng": -79.48935999999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2019-09-20",
        "issued": "2021-05-25",
        "desc": "Proposal to construct a 10-storey mixed use residential building containing 56 units, retail at grade and 4 levels of below grade parking.",
        "units": 56,
        "postal": "M4S",
        "address": "2114 YONGE ST",
        "geo": {
          "lat": 43.7029672,
          "lng": -79.3979073
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2019-09-20",
        "issued": "2021-06-04",
        "desc": "Construct a 6 storey midrise building with 67 units on top of an underground parking garage.  BUILDING M",
        "units": 67,
        "postal": "",
        "address": "125 CANON JACKSON DR",
        "geo": {
          "lat": 43.69739999999999,
          "lng": -79.47322
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2019-09-22",
        "issued": "2021-08-20",
        "desc": "Construct a 4 storey midrise building with 49 units on top of an underground parking garage. Building J",
        "units": 49,
        "postal": "",
        "address": "85 CANON JACKSON DR",
        "geo": {
          "lat": 43.6975292,
          "lng": -79.47268179999999
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2019-09-22",
        "issued": "2021-06-04",
        "desc": "Construct a 6 storey midrise building with 76 units on top of and underground parking garage. Building N",
        "units": 76,
        "postal": "",
        "address": "135 CANON JACKSON DR",
        "geo": {
          "lat": 43.69706190000001,
          "lng": -79.4738162
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2019-09-22",
        "issued": "2021-05-20",
        "desc": "Construct a 6 storey midrise building with 88 units on top of and underground garage. Building R",
        "units": 88,
        "postal": "",
        "address": "165 CANON JACKSON DR",
        "geo": {
          "lat": 43.69704000000001,
          "lng": -79.47503
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2019-09-23",
        "issued": "2021-10-15",
        "desc": "Proposal to construct a 7 storey apartment building with 103 dwelling units and 2 levels of above grade parking. Standalone shoring permit # 19 146206",
        "units": 103,
        "postal": "M6K",
        "address": "57 BROCK AVE",
        "geo": {
          "lat": 43.64378689999999,
          "lng": -79.4329254
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2019-09-27",
        "issued": "2021-01-05",
        "desc": "Construction of a 16 storey residential building consisting of 265 units and two storeys of below grade parking.",
        "units": 265,
        "postal": "M3H",
        "address": "4 TIPPETT RD",
        "geo": {
          "lat": 43.73242459999999,
          "lng": -79.44701270000002
        },
        "ward": "York Centre"
      },
      {
        "start": "2019-09-27",
        "issued": "2021-09-07",
        "desc": "construct new 7 storey mixed use building, at grade stacked parking. 32 DWELLING UNITS",
        "units": 32,
        "postal": "M1N",
        "address": "1316 KINGSTON RD",
        "geo": {
          "lat": 43.6850055,
          "lng": -79.2753515
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2019-10-08",
        "issued": null,
        "desc": "Proposed construction of new 12-storey building with 186 residential units, 2 levels of retail use (Ground Floor and Level B1) and 4 levels of below-grade parking (includes 2442-2454 Bloor Street West & 1-9 Riverview Gardens).See 22-110431 ALT 00 AS",
        "units": 186,
        "postal": "M6S",
        "address": "2450 BLOOR ST W",
        "geo": {
          "lat": 43.6489817,
          "lng": -79.4857241
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2019-10-10",
        "issued": null,
        "desc": "Proposal to construct a new 6 storey mixed use building with a retail ground floor, 33 residential units and 2 levels of underground parking.",
        "units": 33,
        "postal": "M4K",
        "address": "796 BROADVIEW AVE",
        "geo": {
          "lat": 43.6774507,
          "lng": -79.358908
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2019-10-11",
        "issued": null,
        "desc": "Proposal to construct a 47 Storey mixed-use building with a 4 level underground parking garage, 696 residential units, and retail space at levels 1 & 2.",
        "units": 695,
        "postal": "M5V",
        "address": "102 PETER ST",
        "geo": {
          "lat": 43.6476242,
          "lng": -79.39316869999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-10-17",
        "issued": "2021-02-16",
        "desc": "Proposal to construct a new 18-storey mixed-use building containing a total of 419 square metres of retail/commercial space on the ground and basement levels and 125 residential units above, and a below grade parking garage. See also 16 155587 SA.",
        "units": 125,
        "postal": "M5V",
        "address": "452 RICHMOND ST W",
        "geo": {
          "lat": 43.6479745,
          "lng": -79.3974325
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-10-22",
        "issued": "2020-10-28",
        "desc": "Proposal to construct a 4 storey wood frame apartment building with 18 dwelling units and parking at grade.",
        "units": 18,
        "postal": "M4L",
        "address": "45 CONNAUGHT AVE",
        "geo": {
          "lat": 43.6645913,
          "lng": -79.32195
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2019-10-28",
        "issued": "2022-02-09",
        "desc": "Proposal to construct a new 4 storey residential apartment building complete with two levels of underground parking and rooftop terrace. The proposal involves the retention and conversion existing designated heritage building (church and school building) for its use as part of the new residential apartment building",
        "units": 69,
        "postal": "M6P",
        "address": "248 HIGH PARK AVE",
        "geo": {
          "lat": 43.6621483,
          "lng": -79.46929709999999
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2019-11-05",
        "issued": "2021-06-04",
        "desc": "Proposal to construct a 33 storey multiple use building with hotel use on floors 1 - 15(240 Suites) and 179  Rental residential dwelling units on floors 16-32, and 4 levels of below grade parking.",
        "units": 179,
        "postal": "M5B",
        "address": "203 JARVIS ST",
        "geo": {
          "lat": 43.6556873,
          "lng": -79.3738742
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2019-11-07",
        "issued": "2022-06-29",
        "desc": "8 storey (plus mechanical penthouse) mixed use building containing 27 Purpose Built Rental Dwelling Units, retail at grade, green roof and one level of basement.",
        "units": 27,
        "postal": "M6E",
        "address": "1924 EGLINTON AVE W",
        "geo": {
          "lat": 43.6953644,
          "lng": -79.4526125
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2019-11-15",
        "issued": null,
        "desc": "Proposal to construct 2, 39 storey residential towers with a daycare at grade and 4 levels of below grade parking.",
        "units": 778,
        "postal": "M4P",
        "address": "65 BROADWAY AVE",
        "geo": {
          "lat": 43.7097709,
          "lng": -79.3951682
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2019-11-19",
        "issued": "2021-05-07",
        "desc": "Proposal to construct a new 22 storey mixed use rental building with 340 dwelling units and retail at grade. Convenience address is 370 Queens Quay W. Scope of work includes a 21 storey addition with interior alterations to 350 Queens Quay W, ground and 2nd floor retail additions to 350 + 390 Queens Quay W and proposed at 396 Queens Quay W is an addition to floors 3-5 in the parking garage.",
        "units": 340,
        "postal": "M5V",
        "address": "350 QUEENS QUAY   W",
        "geo": {
          "lat": 43.638649,
          "lng": -79.389096
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-11-27",
        "issued": null,
        "desc": "Construction of two mixed use buildings with a shared u/g parking garage. Building A, 12 storey - 429 units and shared u/g parking has 415 stalls for both buildings. Building B under separate permit 19-254476 BLD 00 NB",
        "units": 429,
        "postal": "M3H",
        "address": "470 WILSON AVE",
        "geo": {
          "lat": 43.7355829,
          "lng": -79.44451509999999
        },
        "ward": "York Centre"
      },
      {
        "start": "2019-12-02",
        "issued": null,
        "desc": "Proposal to demolish the existing 10 storey mixed use building and construct a new 62 storey mixed use building with 669 dwelling units and 4 levels of underground parking.",
        "units": 670,
        "postal": "M4W",
        "address": "11 YORKVILLE AVE",
        "geo": {
          "lat": 43.6714886,
          "lng": -79.3882113
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2019-12-04",
        "issued": "2020-10-22",
        "desc": "Proposal to demolish existing 2 storey multi unit dwelling and replace with 3 storey multi unit 7 unit residential dwelling ",
        "units": 8,
        "postal": "M5N",
        "address": "1202 AVENUE RD",
        "geo": {
          "lat": 43.7122509,
          "lng": -79.4120416
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2019-12-05",
        "issued": "2021-11-15",
        "desc": "Proposed construction of 28-storey residential condominium with 212 units and three levels of underground parking (Building C). ",
        "units": 212,
        "postal": "",
        "address": "10 EVA RD",
        "geo": {
          "lat": 43.64136,
          "lng": -79.56277
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2019-12-06",
        "issued": null,
        "desc": "12 storey residential building containing 132 dwelling units and 1 level of underground parking - North Tower",
        "units": 132,
        "postal": "M3C",
        "address": "25 ST DENNIS DR",
        "geo": {
          "lat": 43.7171911,
          "lng": -79.3329522
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2019-12-10",
        "issued": null,
        "desc": "Proposal to construct a 27 storey mixed use building with residential above and office and retail at grade with 2 levels of below grade parking.",
        "units": 371,
        "postal": "M4C",
        "address": "276 MAIN ST",
        "geo": {
          "lat": 43.6871769,
          "lng": -79.3019858
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2019-12-11",
        "issued": "2022-02-17",
        "desc": "Proposal for the construction of a new eleven storey 153 residential units mixed-use condominium building with two levels of underground garage., PB # 19 189079",
        "units": 153,
        "postal": "",
        "address": "1808 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6745752,
          "lng": -79.4626978
        },
        "ward": "Davenport"
      },
      {
        "start": "2019-12-12",
        "issued": null,
        "desc": "Proposal to construct a new 17-storey mixed use building with 390 residential dwelling units, ground floor retail and 2 levels of below grade parking. See also 19 240440 SA.",
        "units": 390,
        "postal": "M6C",
        "address": "875 EGLINTON AVE W",
        "geo": {
          "lat": 43.70046,
          "lng": -79.4260613
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2019-12-13",
        "issued": null,
        "desc": "Proposal to construct a new 35 storey mixed use building with 304 dwelling units, office and retail space and 5 levels of underground parking. See also 17 1862503 SA",
        "units": 304,
        "postal": "M4S",
        "address": "2161 YONGE ST",
        "geo": {
          "lat": 43.7046424,
          "lng": -79.3975411
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2019-12-13",
        "issued": "2022-04-22",
        "desc": "New construction of a 4-storey residential condominium building located at 5,7, and 9 Dale Avenue. The building consists of one below grade level containing vehicular parking for the residents and visitors alongside with an amenity space, garbage collection rooms and loading area. The ground floor contains single-storey residential suits, residential lobby, mail room and bicycle storage. The 2nd through 4th floors contain single-storey residential suites.",
        "units": 26,
        "postal": "M4W",
        "address": "5 DALE AVE",
        "geo": {
          "lat": 43.67378799999999,
          "lng": -79.3732653
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2019-12-16",
        "issued": null,
        "desc": "Proposal to construct a 6 storey concrete condo with 76 residential units, 1 level of below grade parking, and commercial at grade.",
        "units": 76,
        "postal": "M4L",
        "address": "1285 QUEEN ST E",
        "geo": {
          "lat": 43.6633936,
          "lng": -79.3283852
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2019-12-17",
        "issued": "2021-10-04",
        "desc": "Proposal to construct a 37 storey  condominium residential tower  with 580 units including  4 levels of  parking",
        "units": 580,
        "postal": "M5A",
        "address": "5 DEFRIES ST",
        "geo": {
          "lat": 43.66058330000001,
          "lng": -79.356371
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2019-12-17",
        "issued": null,
        "desc": "Proposal to construct 2 mixed use towers (28 & 29 storeys) with retail at grade, 543  rental residential dwelling units, and 4 levels of underground parking.( Phase 2A)    PB folder # 18-209049",
        "units": 542,
        "postal": "",
        "address": "88 QUEEN ST E",
        "geo": {
          "lat": 43.6542619,
          "lng": -79.37489
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2019-12-18",
        "issued": null,
        "desc": "Proposal for a 51 storey mixed use building with retail at grade, 532 residential dwelling units, 29 rental replacement units, and 1 levels of underground parking.PB # 18-268207",
        "units": 532,
        "postal": "M4X",
        "address": "591 SHERBOURNE ST",
        "geo": {
          "lat": 43.67087919999999,
          "lng": -79.3760118
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2019-12-18",
        "issued": null,
        "desc": "Proposed 50 storey mixed use building with 5 levels of underground parking. Residential tower on office podium, with retail and ancillary uses on the ground floor.",
        "units": 498,
        "postal": "",
        "address": "0 SHEPPARD AVE W",
        "geo": {
          "lat": 43.7474687,
          "lng": -79.4826496
        },
        "ward": "York Centre"
      },
      {
        "start": "2019-12-19",
        "issued": null,
        "desc": "Proposal to construct a 47 storey mixed use building with retail at grade, 543 residential dwelling units, and 4 levels of below grade parking.",
        "units": 543,
        "postal": "M5V",
        "address": "99 BLUE JAYS WAY",
        "geo": {
          "lat": 43.6453305,
          "lng": -79.391561
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-12-19",
        "issued": null,
        "desc": "Proposal to construct a new 14-storey mixed use building with 116 residential units, retail at grade, rooftop amenity terrace and 3 levels of underground parking.",
        "units": 116,
        "postal": "M5V",
        "address": "502 ADELAIDE ST W",
        "geo": {
          "lat": 43.645957,
          "lng": -79.4004394
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2019-12-20",
        "issued": null,
        "desc": "Proposed 5 storey addition (353 & 355 College Street) to existing 4 storey hostel at 357 College Street. Demo existing buildings at 353 and 355 College St.The project will add 33 rooms to the existing hostel for a total of 59 Rooms, a ground floor lobby, winter garden and ancillary café directly accessible from the street, an additional warming kitchen, lounge area and a rear exterior patio garden at the basement level, and a private 4th floor lounge and green roof terrace for hostel guests. See also 18 111118 SA and 18 124159 MV.",
        "units": 30,
        "postal": "M5T",
        "address": "357 COLLEGE ST",
        "geo": {
          "lat": 43.6569988,
          "lng": -79.40360059999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2019-12-20",
        "issued": "2022-04-28",
        "desc": "Construction of a 8 storey, 114 unit residentail apartment building, with 2 levels of underground parking and a mechanical penthouse above.  The proposal includes the provision of 12 rental replacement dwelling units on the lot in accordance with Chapter 667 of the TMC. ",
        "units": 114,
        "postal": "M8X",
        "address": "4125 DUNDAS ST W",
        "geo": {
          "lat": 43.6617465,
          "lng": -79.5073005
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2019-12-20",
        "issued": null,
        "desc": "Proposal to construct a 10 storey addition over existing 3 storey heritage building consisting of 443 dwelling units, construct a 5 storey office building and interior alterations to existing 3 storey heritage building. Scope includes 1 level of underground parking. Purpose built-rental building.",
        "units": 443,
        "postal": "M5A",
        "address": "425 CHERRY ST",
        "geo": {
          "lat": 43.6517738,
          "lng": -79.3577492
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2019-12-23",
        "issued": "2021-05-20",
        "desc": "Proposal to construct a 4-storey residential building containing 27 dwelling units. The proposed development provides 1 level of underground parking.",
        "units": 27,
        "postal": "M4V",
        "address": "26 BIRCH AVE",
        "geo": {
          "lat": 43.6813371,
          "lng": -79.39294679999999
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2019-12-24",
        "issued": null,
        "desc": "Proposal to construct a 85-storey mixed-use development containing residential and non-residential units including office, retail and institutional uses.Stand alone soil remediation permit",
        "units": 1103,
        "postal": "M5B",
        "address": "363 YONGE ST",
        "geo": {
          "lat": 43.6582526,
          "lng": -79.3815566
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2019-12-24",
        "issued": "2022-08-16",
        "desc": "Proposed construction of a new 12 storey mixed use condominium building complete with 269 dwelling units and commercial retail at grade atop a 2 level below grade parking facility.",
        "units": 269,
        "postal": "",
        "address": "1779 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6736092,
          "lng": -79.46244569999999
        },
        "ward": "Davenport"
      },
      {
        "start": "2019-12-24",
        "issued": "2021-06-15",
        "desc": "Proposal for a new two storey addition to an existing four storey apartment building with 25 units, bringing the total number of units to 39. ",
        "units": 14,
        "postal": "M8Y",
        "address": "301 PARK LAWN RD",
        "geo": {
          "lat": 43.6350618,
          "lng": -79.4924024
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2020-01-03",
        "issued": null,
        "desc": "Proposed new building, 10 storey apartment building, 3 level parkade, main floor commercial space.",
        "units": 70,
        "postal": "M1E",
        "address": "4111 LAWRENCE AVE E",
        "geo": {
          "lat": 43.766336,
          "lng": -79.19456450000001
        },
        "ward": "Scarborough-Guildwood"
      },
      {
        "start": "2020-01-07",
        "issued": "2022-06-22",
        "desc": "PROPOSED: CONSTRUCT A THREE STOREY REAR ADDITION AND A 1 STOREY ADDITION OVER EXISTING TWO STOREY BUILDING INCLUDING HEATING, PLUMBING AND ELECTRICAL.",
        "units": 8,
        "postal": "M1L",
        "address": "3268 DANFORTH AVE",
        "geo": {
          "lat": 43.6930298,
          "lng": -79.2809704
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2020-01-17",
        "issued": null,
        "desc": "Proposal to construct a 39 storey mixed use building with 6 storey podium, 4 levels of underground parking, and 425 dwelling units.",
        "units": 425,
        "postal": "M6K",
        "address": "45 STRACHAN AVE",
        "geo": {
          "lat": 43.63943949999999,
          "lng": -79.4107411
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2020-02-07",
        "issued": null,
        "desc": "Proposal to construct a 48 storey mixed use building consisting of 419 residential units, retail space at grade, rooftop amenity terrace and 6 levels of below grade parking.PB # 19-146774arch 1-53mech 54-115electrical 116-159sprinkler 160-196",
        "units": 419,
        "postal": "M9N",
        "address": "89 CHURCH ST",
        "geo": {
          "lat": 43.7058231,
          "lng": -79.5181616
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2020-02-21",
        "issued": "2020-10-28",
        "desc": "Proposal to construct a 3 storey 6 unit townhouse complex with common underground parking and rooftop decks. See also 18 130962 SA. Address includes 536 and 538 Brunswick Ave.",
        "units": 6,
        "postal": "M5R",
        "address": "536 BRUNSWICK AVE",
        "geo": {
          "lat": 43.6737099,
          "lng": -79.4106292
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2020-03-06",
        "issued": null,
        "desc": "Construct residential stacked townhouse block A 42 units",
        "units": 42,
        "postal": "M1J",
        "address": "2787 EGLINTON AVE E",
        "geo": {
          "lat": 43.7366542,
          "lng": -79.2455555
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2020-05-08",
        "issued": null,
        "desc": "Proposal to construct a 42-storey mixed use building consisting of 147 residential units, 4 levels of below grade parking and ground floor commercial/retail space.",
        "units": 147,
        "postal": "M5R",
        "address": "50 SCOLLARD ST",
        "geo": {
          "lat": 43.6724179,
          "lng": -79.3899557
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2020-05-19",
        "issued": "2022-08-30",
        "desc": "Proposal to construct 16 four-storey townhouse units, in two blocks of 8 units, with parking provided above  grade and accessed through a common element driveway from Winona Drive. (BLOCK A - TH 1 to TH 8)",
        "units": 8,
        "postal": "M6C",
        "address": "464 WINONA DR",
        "geo": {
          "lat": 43.6892689,
          "lng": -79.4357217
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2020-06-01",
        "issued": null,
        "desc": "Proposal to construct a 6 storey mixed-use building with 47 dwelling units, retail at grade, and 1 level of below grade parking.",
        "units": 47,
        "postal": "M4M",
        "address": "1151 QUEEN ST E",
        "geo": {
          "lat": 43.6621443,
          "lng": -79.3338705
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2020-06-04",
        "issued": "2022-08-19",
        "desc": "Proposal to construct a 4 storey stacked townhouse development with 52 residential units, 3 commercial units at grade, a 1 storey detached amenity building and 1 level of below grade parking. ",
        "units": 52,
        "postal": "M4B",
        "address": "1455 O'CONNOR DR",
        "geo": {
          "lat": 43.7133569,
          "lng": -79.30637709999999
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2020-06-09",
        "issued": "2021-03-09",
        "desc": "Proposal to construct a five-storey seniors residential building containing 104 residential units and commercial use(s) on the ground floor.",
        "units": 104,
        "postal": "M6M",
        "address": "2 BUTTONWOOD AVE",
        "geo": {
          "lat": 43.6904476,
          "lng": -79.5031662
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2020-06-12",
        "issued": null,
        "desc": "Proposal to construct 24 three-storey townhouse units.  Refer to folder 20-182002 for underground parking.  ",
        "units": 24,
        "postal": "M6A",
        "address": "3311 BATHURST ST",
        "geo": {
          "lat": 43.7246979,
          "lng": -79.43052209999999
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2020-06-17",
        "issued": "2021-10-29",
        "desc": "Proposal to construct 25 new stacked townhouses.  Refer to folder (20-181829 BLD) 1 level of underground parking.",
        "units": 25,
        "postal": "M2R",
        "address": "286 FINCH AVE W",
        "geo": {
          "lat": 43.7747354,
          "lng": -79.4400288
        },
        "ward": "Willowdale"
      },
      {
        "start": "2020-06-23",
        "issued": "2021-10-29",
        "desc": "Proposal to construct a new 3.5 storey 16 unit stacked townhouse complex - Block B",
        "units": 16,
        "postal": "",
        "address": "10 ED CLARK GDNS",
        "geo": {
          "lat": 43.653226,
          "lng": -79.3831843
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2020-06-23",
        "issued": "2021-10-29",
        "desc": "Proposal to construct a new 3.5 storey 16 unit stacked townhouse complex - Block C",
        "units": 16,
        "postal": "",
        "address": "20 ED CLARK GDNS",
        "geo": {
          "lat": 43.653226,
          "lng": -79.3831843
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2020-06-23",
        "issued": "2021-10-29",
        "desc": "Proposal to construct a new 3.5 storey 16 unit stacked townhouse complex - Block D",
        "units": 16,
        "postal": "",
        "address": "30 ED CLARK GDNS",
        "geo": {
          "lat": 43.653226,
          "lng": -79.3831843
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2020-06-23",
        "issued": "2021-10-29",
        "desc": "Proposal to construct a new 3 storey 28 unit stacked townhouse complex - Block E",
        "units": 28,
        "postal": "",
        "address": "40 ED CLARK GDNS",
        "geo": {
          "lat": 43.653226,
          "lng": -79.3831843
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2020-06-30",
        "issued": null,
        "desc": "Proposed construction of 9 storey building with 173 residential units, with 3 storeys below grade",
        "units": 173,
        "postal": "M5M",
        "address": "250 LAWRENCE AVE W",
        "geo": {
          "lat": 43.7229268,
          "lng": -79.4139016
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2020-07-08",
        "issued": "2022-08-04",
        "desc": "Proposal to construct a new 15 storey high rise 126 unit  affordable housing apartment with 2 levels of parking below grade. Indoor and outdoor amenity spaces provided on the ground floor and rooftop. ",
        "units": 126,
        "postal": "M9N",
        "address": "2346 WESTON RD",
        "geo": {
          "lat": 43.7058364,
          "lng": -79.5311849
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2020-07-20",
        "issued": null,
        "desc": "Proposal to construct a 16-storey and a 12-storey Mixed Use/Res w Non Res Building with retail at grade and 2-level below grade parking garage. ",
        "units": 412,
        "postal": "M4G",
        "address": "660 EGLINTON AVE E",
        "geo": {
          "lat": 43.7117869,
          "lng": -79.3755499
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2020-07-23",
        "issued": "2021-10-29",
        "desc": "Proposal to construct a new 35 storey residential condominium building (plus 2 stories of mechanical penthouse) complete with 459 dwelling units at top a 5 level below grade parking facility. ",
        "units": 459,
        "postal": "M8Z",
        "address": "30 ZORRA ST",
        "geo": {
          "lat": 43.6199346,
          "lng": -79.52178990000002
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2020-07-24",
        "issued": null,
        "desc": "Tower B consists of 5 levels of underground parking and a 24-storey tower above, inclusive of an 11-storey podium, containing 441 dwelling units of which 150 will be 'affordable' dwelling units",
        "units": 441,
        "postal": "M6H",
        "address": "1245 DUPONT ST",
        "geo": {
          "lat": 43.6676544,
          "lng": -79.4420834
        },
        "ward": "Davenport"
      },
      {
        "start": "2020-07-27",
        "issued": null,
        "desc": "Proposal to construct a new 18-storey building with 170 residential units, retail on the ground floor and 3 levels of underground parking. See also 19 152422 ZPR and 16 260568 MV.",
        "units": 170,
        "postal": "M1T",
        "address": "2933 SHEPPARD AVE E",
        "geo": {
          "lat": 43.77543430000001,
          "lng": -79.3212927
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2020-08-07",
        "issued": null,
        "desc": "Proposal to construct a 38-storey residential building with 336 rental units of which  attached to an existing 10-storey residential building, proposal will have 2 levels of below grade parking.",
        "units": 336,
        "postal": "M4P",
        "address": "75 BROADWAY AVE",
        "geo": {
          "lat": 43.7100018,
          "lng": -79.3944643
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2020-08-10",
        "issued": null,
        "desc": "Proposal to construct a 3-storey affordable housing apartment building comprised of 2234 square metres of residential gross floor area and 44 dwelling units with associated shared amenities including administrative offices, laundry, kitchen, dining and lounge area.",
        "units": 44,
        "postal": "M6J",
        "address": "150 HARRISON ST",
        "geo": {
          "lat": 43.6504707,
          "lng": -79.42458169999999
        },
        "ward": "Davenport"
      },
      {
        "start": "2020-08-10",
        "issued": null,
        "desc": "Proposal to construct a new 53 storey mixed use building with 501 residential units, 5 levels of underground parking, retail shell on the ground floor and restoration of the existing heritage dwelling.See also 19 130379 SA. ( BLOCK 1)",
        "units": 501,
        "postal": "M4X",
        "address": "611 SHERBOURNE ST",
        "geo": {
          "lat": 43.6716342,
          "lng": -79.3762878
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2020-08-18",
        "issued": null,
        "desc": "Proposal to construct a new 6 storey residential apartment building with two underground levels.",
        "units": 16,
        "postal": "M4V",
        "address": "77 CLARENDON AVE",
        "geo": {
          "lat": 43.6823935,
          "lng": -79.4060082
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2020-08-19",
        "issued": "2021-11-22",
        "desc": "Proposal to construct 20 new three storey stacked townhome units(Affordable housing)",
        "units": 20,
        "postal": "",
        "address": "51 ED CLARK GDNS",
        "geo": {
          "lat": 43.653226,
          "lng": -79.3831843
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2020-08-20",
        "issued": null,
        "desc": "Proposal  to construct an 8-storey mixed use building consisting of 99 residential units with a residential gross floor area of 11,487.98m2, commercial gross floor area of 164.07m2 at grade and 85 parking spaces in 2 levels of underground garage..",
        "units": 99,
        "postal": "M6E",
        "address": "2433 DUFFERIN ST",
        "geo": {
          "lat": 43.6990931,
          "lng": -79.4509255
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2020-08-25",
        "issued": null,
        "desc": "32 storey residential apartment building containing 308 dwelling units, a 39 storey residential apartment building containing 379 dwelling units, three levels of underground parking, amenity areas, and a 3 level podium connecting the two towers - Crosstown Block 12 - Phase 1 towers 1 and 2",
        "units": 693,
        "postal": "M3C",
        "address": "1150 EGLINTON AVE E",
        "geo": {
          "lat": 43.7201272,
          "lng": -79.3448835
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2020-08-27",
        "issued": null,
        "desc": "Proposal to construct 20 stacked townhouse units in Block 1 atop a one level common underground (parking garage) building in related building permit 20 183634. See also Alternative Solution folder 20-215469 ALT.",
        "units": 20,
        "postal": "M8V",
        "address": "225 BIRMINGHAM ST",
        "geo": {
          "lat": 43.6013082,
          "lng": -79.51207819999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2020-08-27",
        "issued": "2022-03-18",
        "desc": "Proposal to construct a 3 storey addition to an existing nursing home. See also 18 261089 ZZC , 19 107595 MV and 19 173835 SA.",
        "units": 20,
        "postal": "M3H",
        "address": "103 OVERBROOK PL",
        "geo": {
          "lat": 43.7632361,
          "lng": -79.4541534
        },
        "ward": "York Centre"
      },
      {
        "start": "2020-09-01",
        "issued": null,
        "desc": "Proposal to construct a new 39 storey mixed-use building with 484 residential units, 4 levels of below grade parking, a mechanical penthouse, and ofice and retail uses in podium. See also 19 265558 SA.Address includes 191-201 Church St.",
        "units": 484,
        "postal": "M5B",
        "address": "191 CHURCH ST",
        "geo": {
          "lat": 43.6554235,
          "lng": -79.3764077
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2020-09-09",
        "issued": "2022-06-06",
        "desc": "Proposal to construct a new 3 storey apartment building with 8 units.See also 16 150498 ZZC, 17 268378 SA, and 18 265905 MV.",
        "units": 8,
        "postal": "M6H",
        "address": "1103 DUFFERIN ST",
        "geo": {
          "lat": 43.6625436,
          "lng": -79.43624989999999
        },
        "ward": "Davenport"
      },
      {
        "start": "2020-09-15",
        "issued": "2020-10-29",
        "desc": "Proposed new condo townhouse building with 8 units620-1, 620-2, 620-3, 620-4, 622-1, 622-2, 622-3,622-4 Rexdale Boulevard - Building 1A- Units 1-4, 7-10.",
        "units": 8,
        "postal": "",
        "address": "622 REXDALE BLVD",
        "geo": {
          "lat": 43.7209999,
          "lng": -79.6114599
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2020-09-16",
        "issued": "2020-10-29",
        "desc": "Proposal to construct a new condo townhouse building containing 10 units 626, 628, 630 Rexdale Boulevard - Building 2, Units 13-22.",
        "units": 10,
        "postal": "",
        "address": "626 REXDALE BLVD",
        "geo": {
          "lat": 43.72098,
          "lng": -79.61178
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2020-09-16",
        "issued": "2020-10-29",
        "desc": "Proposal to construct a new condo townhouse building 8 units12-1, 12-2, 12-3, 12-4, 14-1, 14-2, 14-3, 14-4 Humberwood Boulevard - Building 3B - Units 25-28, 36-39",
        "units": 8,
        "postal": "",
        "address": "12 HUMBERWOOD BLVD",
        "geo": {
          "lat": 43.7212,
          "lng": -79.61251
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2020-09-16",
        "issued": "2020-10-29",
        "desc": "Proposal to construct a new condo townhouse building with 10 units16-1, 16-2, 16-3, 16-4, 18-1, 18-2, 18-3, 18-4, 20-1, 20-2 Humberwood - Building 3C - Units 29-33, 40-44",
        "units": 10,
        "postal": "",
        "address": "16 HUMBERWOOD BLVD",
        "geo": {
          "lat": 43.72139000000001,
          "lng": -79.61255
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2020-09-16",
        "issued": "2020-10-29",
        "desc": "Proposal to construct a new condo townhouse building with 8 units22-1, 22-2, 22-3, 22-4, 24-1, 24-2, 24-3, 24-4 Humberwood Drive - Building 4A- Units 45-48 and 53-56",
        "units": 8,
        "postal": "",
        "address": "22 HUMBERWOOD BLVD",
        "geo": {
          "lat": 43.72168,
          "lng": -79.61260999999999
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2020-09-16",
        "issued": "2020-10-29",
        "desc": "Proposal to construct a new condo townhouse building with 8 units26-1, 26-2, 26-3, 26-4, 28-1, 28-2, 28-3, 28-4 Humberwood Drive - Building 4B - Units 49-52 and 57-60",
        "units": 8,
        "postal": "",
        "address": "26 HUMBERWOOD BLVD",
        "geo": {
          "lat": 43.72188,
          "lng": -79.61264
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2020-09-16",
        "issued": "2020-10-29",
        "desc": "Proposal to construct a new condo townhouse building with 8 units30-1, 30-2, 30-3, 30-4, 30-5, 30-6, 30-7, 30-8  Woodstream Drive - Building 5A - Units 61-64 and 68-71",
        "units": 8,
        "postal": "",
        "address": "30 WOODSTREAM DR",
        "geo": {
          "lat": 43.7217,
          "lng": -79.6120399
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2020-09-16",
        "issued": "2020-10-30",
        "desc": "Proposal to construct a new condo townhouse building with 8 untis20-9, 20-10, 20-11, 20-12, 20-13, 20-14, 20-15, 20-16  Woodstream Drive - Building 6A - Units 75-78 and 83-86",
        "units": 8,
        "postal": "",
        "address": "20 WOODSTREAM DR",
        "geo": {
          "lat": 43.72136,
          "lng": -79.61189999999999
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2020-09-24",
        "issued": null,
        "desc": "Construct interior alterations to convert a 2 unit house to a 10 unit apartment building and a new second floor deck",
        "units": 10,
        "postal": "M5A",
        "address": "213 CARLTON ST",
        "geo": {
          "lat": 43.6637155,
          "lng": -79.3695075
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2020-09-30",
        "issued": null,
        "desc": "15-storey Apartment Building with Mercantile Uses at Ground Level, Including 4 Level of Underground Parking and 202 Residential Units",
        "units": 202,
        "postal": "M3H",
        "address": "1050 SHEPPARD AVE W",
        "geo": {
          "lat": 43.7509193,
          "lng": -79.46250380000001
        },
        "ward": "York Centre"
      },
      {
        "start": "2020-09-30",
        "issued": null,
        "desc": "Creating 2nd exit from each floor to comply with fire code regulations in an Existing SFD Townhouse, to be converted a Rooming House with 7 Units. ",
        "units": 7,
        "postal": "M5B",
        "address": "51 A MUTUAL ST",
        "geo": {
          "lat": 43.65540499999999,
          "lng": -79.374926
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2020-10-01",
        "issued": null,
        "desc": "Proposal to construct a 36 storey rental replacement building consisting of 412 Units together with 2 Levels of U/G Parking and shoring. Includes undergound parking and shoring for 110 Broadway Ave (2020 202777 BLD 00 NB).",
        "units": 412,
        "postal": "M4P",
        "address": "100 BROADWAY AVE",
        "geo": {
          "lat": 43.7108649,
          "lng": -79.3936075
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2020-10-05",
        "issued": null,
        "desc": "Propossed construction of 21 Storey North Tower consisting of 295 Units  See permit 2020 201517 BLD 00 NB for 100 Broadway Ave for underground parking and shoring.",
        "units": 751,
        "postal": "M4P",
        "address": "110 BROADWAY AVE",
        "geo": {
          "lat": 43.7112191,
          "lng": -79.3932339
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2020-10-06",
        "issued": "2022-09-13",
        "desc": "Proposal to construct a new mixed use building with four 3 storey townhouse units, a 4 storey mixed use building with ground floor commercial and 2 residential units above and common underground parking.See also 18 131032 SA.",
        "units": 6,
        "postal": "M8W",
        "address": "200 BROWNS LINE",
        "geo": {
          "lat": 43.5974019,
          "lng": -79.54363529999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2020-10-08",
        "issued": null,
        "desc": "Construct 12 storey building containing 194 dwelling units, commercial at grade, 4 level underground parking garage",
        "units": 194,
        "postal": "M1N",
        "address": "1496 KINGSTON RD",
        "geo": {
          "lat": 43.6889694,
          "lng": -79.2695157
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2020-10-29",
        "issued": null,
        "desc": "Proposal to construct a new 11 storey mixed use building with 187 residential units, ground floor retail and 2 levels of below grade parking. See also BA18- 263150 stand alone shoring SA, 20 208250 WNP, 20 211651 SWO.",
        "units": 187,
        "postal": "M8Z",
        "address": "859 THE QUEENSWAY",
        "geo": {
          "lat": 43.6242803,
          "lng": -79.51058979999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2020-11-09",
        "issued": "2022-06-16",
        "desc": "Proposal to construct a new 10 storey mixed-use building with 142 residential units, 3.5 levels of underground parking and 3 commercial units at grade. ",
        "units": 142,
        "postal": "M8Z",
        "address": "1197 THE QUEENSWAY",
        "geo": {
          "lat": 43.6215929,
          "lng": -79.5226094
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2020-11-09",
        "issued": null,
        "desc": "Alteration / addition  to existing residential building, convert storage space into dwelling units. ",
        "units": 5,
        "postal": "M4Y",
        "address": "16 ST JOSEPH ST",
        "geo": {
          "lat": 43.6660361,
          "lng": -79.3861553
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2020-11-18",
        "issued": null,
        "desc": "Proposal to construct a 34-storey mixed-use building inclusive of a 10-storey podium and 2 levels of below grade parking.  The proposal will include 489 residential units and 216 m² of non-residential gross floor area.",
        "units": 489,
        "postal": "M5B",
        "address": "308 JARVIS ST",
        "geo": {
          "lat": 43.6616957,
          "lng": -79.376775
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2020-11-18",
        "issued": "2022-05-04",
        "desc": "Proposal for interior alterations to convert existing 3 storey rooming house to an apartment building with 16 self contained units. See also 20 174458 ZZC.",
        "units": 16,
        "postal": "M5A",
        "address": "180 SHERBOURNE ST",
        "geo": {
          "lat": 43.65632979999999,
          "lng": -79.370367
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2020-11-27",
        "issued": null,
        "desc": "Proposed addition to convert existing 5 unit dwelling to 13 units dwelling with new walkout stairs, accessible ramp, and bicycle locker",
        "units": 13,
        "postal": "M6K",
        "address": "196 DUNN AVE",
        "geo": {
          "lat": 43.6385865,
          "lng": -79.43392790000001
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2020-12-01",
        "issued": null,
        "desc": "Proposed new construction of 8 storey mixed use building with 57 dwelling units of which 13 are rental units, retail at grade and 3 levels of below grade parking.",
        "units": 57,
        "postal": "M4G",
        "address": "1414 BAYVIEW AVE",
        "geo": {
          "lat": 43.70149319999999,
          "lng": -79.3737404
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2020-12-01",
        "issued": "2022-01-27",
        "desc": "Construct a new 6 storey apartment building with 23 rental units and 31 market units, 2 levels of underground parking garage (Phase 1 of  2)",
        "units": 54,
        "postal": "M5P",
        "address": "2000 BATHURST ST",
        "geo": {
          "lat": 43.6996249,
          "lng": -79.42527369999999
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2020-12-10",
        "issued": null,
        "desc": "Proposal to construct a 20 storey residential building with 3 levels of below grade parking.",
        "units": 33,
        "postal": "M5R",
        "address": "89 AVENUE RD",
        "geo": {
          "lat": 43.6723394,
          "lng": -79.39532659999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2020-12-21",
        "issued": null,
        "desc": "Proposal to construct a new 10 storey residential condominium building with 3 levels of underground parking with 234 dwelling units further to by zoning law 430-2016 and 431-2016, as amended by COA - A0198/20EYK- Building B.",
        "units": 234,
        "postal": "",
        "address": "15 NEIGHBOURHOOD LANE",
        "geo": {
          "lat": 43.63861910000001,
          "lng": -79.4883603
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2020-12-22",
        "issued": null,
        "desc": "Proposal to construct a 49 storey building containing 612 residential units, 2 commercial levels, and 3 levels of below grade parking. ",
        "units": 612,
        "postal": "M5V",
        "address": "400 KING ST W",
        "geo": {
          "lat": 43.6460397,
          "lng": -79.39297979999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2020-12-23",
        "issued": null,
        "desc": "Proposal to construct a 17-storey mixed-use building comprised of retail at grade, 3 levels of office space, 14 levels of purpose built residential rental units and 3 levels of below grade parking.PLEASE REFER TO PERMIT 20-233390 ALT FOR STANDPIPE IN EXIT.",
        "units": 307,
        "postal": "M5V",
        "address": "64 BATHURST ST",
        "geo": {
          "lat": 43.6426881,
          "lng": -79.4024024
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2020-12-23",
        "issued": null,
        "desc": "Construct a 45 storey residential tower and podium with retail at grade and 4 level underground parking garage",
        "units": 497,
        "postal": "M5C",
        "address": "120 CHURCH ST",
        "geo": {
          "lat": 43.6521506,
          "lng": -79.3754775
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2020-12-24",
        "issued": null,
        "desc": "Construct 20 storey  residential building with 100 affordable units, 125 market rental and 2 level underground parking garageSee 21 - 123137 BLD 00 BA for  underpinning of 7 RICHGROVE DR ",
        "units": 225,
        "postal": "",
        "address": "610 MARTIN GROVE RD",
        "geo": {
          "lat": 43.6754,
          "lng": -79.56452
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2020-12-24",
        "issued": "2022-08-08",
        "desc": "Proposal for a mixed use development. Current 10 storey office building to be redeveloped into mixed-use 9 storey non-residential podium, 4 storey residential podium on commercial office and 39 storey residential podium for a total of 52 storey development complete with 4 storey of below grade parking basement. Existing heritage facades of 481 University and 210 Dundas St. W to be retained in redevelopment. (20 172223 & 20 172230)",
        "units": 709,
        "postal": "M5G",
        "address": "481 UNIVERSITY AVE",
        "geo": {
          "lat": 43.6552395,
          "lng": -79.38790759999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2020-12-30",
        "issued": "2021-05-04",
        "desc": "Proposal for 2nd and 3rd floor rear additions and 4th storey addition in the existing mixed use building. ",
        "units": 12,
        "postal": "M6G",
        "address": "690 COLLEGE ST",
        "geo": {
          "lat": 43.6554206,
          "lng": -79.4177711
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-01-05",
        "issued": null,
        "desc": "Proposal to demolish the existing buildings and construct a new 9 storey residential building with 2 levels of underground garage and amenity spaces. (20 113186 STE 12 SA)",
        "units": 89,
        "postal": "M4V",
        "address": "202 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6864943,
          "lng": -79.403504
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2021-01-14",
        "issued": null,
        "desc": "Proposal to demolish existing residential building and construct a new 3-storey mixed use building containing an eating establishment and 10 dwelling units. (18 259214 ZZC 00 ZR)",
        "units": 10,
        "postal": "M6P",
        "address": "48 ANNETTE ST",
        "geo": {
          "lat": 43.663875,
          "lng": -79.46134049999999
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2021-01-21",
        "issued": null,
        "desc": "add new dectectors throughout proposed 8 unit apartment building",
        "units": 7,
        "postal": "M6M",
        "address": "1283 JANE ST",
        "geo": {
          "lat": 43.6917583,
          "lng": -79.50072399999999
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2021-02-01",
        "issued": null,
        "desc": "Proposal to construct a 27-storey rental residential tower containing 233 rental units and 2 storey below grade parking garage containing 135 parking spaces. The existing 26-storey residential building, containing 202 rental units, will be maintained on the easterly portion of the subject site.",
        "units": 233,
        "postal": "M4S",
        "address": "265 BALLIOL ST",
        "geo": {
          "lat": 43.6987365,
          "lng": -79.387776
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2021-02-08",
        "issued": null,
        "desc": "Proposal to construct a 12 Storey Condominium with 2 levels underground parking and Ground Floor Retail. PB # 19- 146972",
        "units": 379,
        "postal": "M5A",
        "address": "32 EASTERN AVE",
        "geo": {
          "lat": 43.6535228,
          "lng": -79.3598428
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-02-16",
        "issued": null,
        "desc": "Proposal for a 55-storey mixed-use building with 600 dwelling units, retail at the ground level, and 5 levels of parking spaces. The building at 586 Yonge Street will be retained as part of the new development, as well as portions of 10-16 Wellesley Street West and 5 & 7 St. Nicholas Street. (21 118625; 21 117722)",
        "units": 600,
        "postal": "M4Y",
        "address": "10 WELLESLEY ST W",
        "geo": {
          "lat": 43.6649038,
          "lng": -79.3852474
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-03-24",
        "issued": null,
        "desc": "Construct 2 residential apartment buildings, 5 storey podium, 3 storey underground parking garage",
        "units": 303,
        "postal": "M1W",
        "address": "3050 PHARMACY AVE",
        "geo": {
          "lat": 43.7956074,
          "lng": -79.3274119
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2021-03-26",
        "issued": null,
        "desc": "Proposal to demolish the existing one storey building and construct a new 8 storey residential building with 107 units and 2 levels of underground garage.(21 113374 DEM 00 DM; 18 165464 STE 14 SA)",
        "units": 109,
        "postal": "M6P",
        "address": "2639 DUNDAS ST W",
        "geo": {
          "lat": 43.663778,
          "lng": -79.45814
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2021-03-26",
        "issued": "2021-09-17",
        "desc": "PROPOSED: CONSTRUCTION OF 3 STOREY MIXED USE (16 RESIDENTIAL UNITS & 1 COMMERCIAL UNIT ) BUILDING DIVIDED BY FIREWALL INTO TWO PART 9 BUILDINGS",
        "units": 16,
        "postal": "M1M",
        "address": "3688 ST CLAIR AVE E",
        "geo": {
          "lat": 43.7194847,
          "lng": -79.2488813
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2021-04-07",
        "issued": null,
        "desc": "Proposal for a 3-storey apartment building with 59 bachelor units (supportive housing) and staff offices, kitchen, dining, lounge, and laundry rooms at 175 Cummer Avenue. This is part of Phase 2 of the City of Toronto's Modular Housing Initiative.",
        "units": 60,
        "postal": "M2M",
        "address": "175 CUMMER AVE",
        "geo": {
          "lat": 43.7879521,
          "lng": -79.4085808
        },
        "ward": "Willowdale"
      },
      {
        "start": "2021-04-08",
        "issued": "2021-07-27",
        "desc": "Make alterations & additions for a proposed apartment building containing 5 dwelling units. Scope of work includes a 3 storey rear addition (entry vestiblue/stairs), a new 4th floor addition, interior alterations, rear 2nd, 3rd and 4th floor balconies.",
        "units": 5,
        "postal": "M6S",
        "address": "238 JANE ST",
        "geo": {
          "lat": 43.6549776,
          "lng": -79.48695830000001
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2021-04-14",
        "issued": null,
        "desc": "Proposal to construct a 31 storey residential condo building with 2 levels of below grade parking.",
        "units": 263,
        "postal": "M4T",
        "address": "44 JACKES AVE",
        "geo": {
          "lat": 43.6857627,
          "lng": -79.3911212
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2021-04-20",
        "issued": null,
        "desc": "New construction of a three-storey stacked townhouse building with 10 residential unitspartly Within TTC development Zone",
        "units": 10,
        "postal": "",
        "address": "54 SUSSEX AVE",
        "geo": {
          "lat": 43.6647323,
          "lng": -79.4034458
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-04-21",
        "issued": null,
        "desc": "Construction of proposed 8-story condominium with 3 levels of underground parking and townhouse units on the south-end of the property. ",
        "units": 30,
        "postal": "M4L",
        "address": "507 KINGSTON RD",
        "geo": {
          "lat": 43.6774302,
          "lng": -79.30221379999999
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2021-04-22",
        "issued": null,
        "desc": "Proposal to construct two 25-storey residential towers with a shared podium connection and 4 levels of below grade parking.",
        "units": 567,
        "postal": "M9A",
        "address": "4000 EGLINTON AVE W",
        "geo": {
          "lat": 43.6835184,
          "lng": -79.5236346
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2021-04-28",
        "issued": "2022-04-04",
        "desc": "Proposal for a new 3 storey Modular apartment building comprising 59 suites with associated shared amenities including administrative offices, laundry, kitchen, dining, and lounge.(21 130074 STE 19 SA)",
        "units": 59,
        "postal": "",
        "address": "20 BRACEBRIDGE AVE",
        "geo": {
          "lat": 43.6983376,
          "lng": -79.31689109999999
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2021-04-29",
        "issued": null,
        "desc": "Proposal for a 10-storey mixed-use building with retail at-grade with two levels of below-grade parking. ",
        "units": 76,
        "postal": "M6C",
        "address": "861 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6799307,
          "lng": -79.4326351
        },
        "ward": "Davenport"
      },
      {
        "start": "2021-04-30",
        "issued": null,
        "desc": "Proposal to demolish the existing rear one storey building, interior alterations including creating new dwelling units, basement underpinning, stairs, corridors and mechanical room. New rear private yard, roof deck and walkout to basement dwelling units. New parking sports and bicycle parking within rear yard. ",
        "units": 8,
        "postal": "M6N",
        "address": "1928 DAVENPORT RD",
        "geo": {
          "lat": 43.6705261,
          "lng": -79.455637
        },
        "ward": "Davenport"
      },
      {
        "start": "2021-05-03",
        "issued": null,
        "desc": "construct  PHASE 1 Building B 180 residential units with at grade retail",
        "units": 180,
        "postal": "M1T",
        "address": "3445 SHEPPARD AVE E",
        "geo": {
          "lat": 43.778783,
          "lng": -79.3057792
        },
        "ward": "Scarborough-Agincourt"
      },
      {
        "start": "2021-05-07",
        "issued": null,
        "desc": "Proposal for the construction of a nine-storey mixed use condominium with 210 residential units, 3 commercial units and 2 levels of underground (Block 5).",
        "units": 210,
        "postal": "M9A",
        "address": "270 THE KINGSWAY",
        "geo": {
          "lat": 43.6615135,
          "lng": -79.51976959999999
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2021-05-07",
        "issued": "2021-11-09",
        "desc": "Proposal to convert existing auxiliary space in to 6 new apartment units and fitness centre within the existing building.",
        "units": 5,
        "postal": "M9B",
        "address": "580 THE EAST MALL",
        "geo": {
          "lat": 43.6536534,
          "lng": -79.5643199
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2021-05-12",
        "issued": null,
        "desc": "Construct a new 29 storey building with 248 units including townhouse units, podium, 3 level underground parking garage, retail, and daycare,- Phase 1",
        "units": 230,
        "postal": "M6A",
        "address": "3450 DUFFERIN ST",
        "geo": {
          "lat": 43.7260588,
          "lng": -79.4590499
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2021-05-14",
        "issued": null,
        "desc": "Proposal to demolish the existing one storey retail building and construct a new 9 storey above grade apartment building with 155 units, 1 storey of below grade garage, and retail on the ground floor. (21 150220 DEM 00 DM; 16 265042 STE 30 SA)",
        "units": 155,
        "postal": "M6G",
        "address": "500 DUPONT ST",
        "geo": {
          "lat": 43.6733329,
          "lng": -79.4159243
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-06-05",
        "issued": null,
        "desc": "Proposal to construct a new 14-storey mixed use building containing 146 residential units, retail uses at grade and 3 levels of underground parking. See also 21 166164 DEM and 20 218454 SA.",
        "units": 146,
        "postal": "M4P",
        "address": "2490-2504 YONGE ST",
        "geo": {
          "lat": 43.71193359999999,
          "lng": -79.39965169999999
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2021-06-20",
        "issued": null,
        "desc": "Proposal for a new 25 Storey mixed use Condominium with 3 level underground Garage. ALT SOL 21 182819 ALT 00 AS",
        "units": 202,
        "postal": "M4W",
        "address": "771 YONGE ST",
        "geo": {
          "lat": 43.6711442,
          "lng": -79.3869318
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-06-21",
        "issued": null,
        "desc": "construct new 5 storey mixed use building, commercial at grade, 7 apartment units above",
        "units": 7,
        "postal": "M5R",
        "address": "1079 BATHURST ST",
        "geo": {
          "lat": 43.672594,
          "lng": -79.4140094
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-06-24",
        "issued": null,
        "desc": "Proposal to construct  2 - 13 storey residential building with one level of underground parking (Blocks 3-4)for Affordable Housing.",
        "units": 787,
        "postal": "M5A",
        "address": "373 FRONT ST E",
        "geo": {
          "lat": 43.6519884,
          "lng": -79.35894329999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-06-27",
        "issued": null,
        "desc": "Construct a new 11 and 15 storey building with 250 residential units, 2 levels of underground parking garage, parking and retail space on ground floor at 1350 Ellesmere Rd and 1560 Brimley Rd. ",
        "units": 250,
        "postal": "M1P",
        "address": "1560 BRIMLEY RD",
        "geo": {
          "lat": 43.7705368,
          "lng": -79.2618063
        },
        "ward": "Scarborough Centre"
      },
      {
        "start": "2021-07-05",
        "issued": null,
        "desc": "Proposal to construct a new 46-storey residential apartment building with 595 dwelling units and 4 levels of underground parking. PB#20-229435",
        "units": 595,
        "postal": "M5B",
        "address": "319 JARVIS ST",
        "geo": {
          "lat": 43.6598415,
          "lng": -79.3752592
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-07-07",
        "issued": null,
        "desc": "Proposed Change of Use to convert second and third floor clasrooms of synagogue \"Yeshiva Gedolah of Toronto\" to boy's dorimtory",
        "units": 10,
        "postal": "M6A",
        "address": "567 LAWRENCE AVE W",
        "geo": {
          "lat": 43.717685,
          "lng": -79.435536
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2021-07-07",
        "issued": null,
        "desc": "9 storey mixed use building containing 119 residential dwelling units, 23 hotel units, three ground floor retail units and three levels of underground parking",
        "units": 119,
        "postal": "M6B",
        "address": "2788 BATHURST ST",
        "geo": {
          "lat": 43.7119524,
          "lng": -79.42832179999999
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2021-07-07",
        "issued": null,
        "desc": "Proposal to construct a 21-storey mixed-use building with residential and non-residential uses. ",
        "units": 120,
        "postal": "",
        "address": "5 SCRIVENER SQ",
        "geo": {
          "lat": 43.6808073,
          "lng": -79.3899476
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-07-12",
        "issued": null,
        "desc": "Proposal to construct a new 32-storey building with 407 residential units, and 3 levels of below grade parking. See also 19 216670 SA and the LPAT decision of July 20, 2018 (tentatively approved).New address will 5858 Yonge St.",
        "units": 409,
        "postal": "M2M",
        "address": "5840 YONGE ST",
        "geo": {
          "lat": 43.7853716,
          "lng": -79.4177711
        },
        "ward": "Willowdale"
      },
      {
        "start": "2021-07-13",
        "issued": null,
        "desc": "Proposed interior alterations and rear addition on first and second floors, new third floor. Proposed six  dwelling units converting an existing single unit town house dwelling to mixed-use building with commercial on the ground floor.",
        "units": 6,
        "postal": "M5T",
        "address": "658 DUNDAS ST W",
        "geo": {
          "lat": 43.651989,
          "lng": -79.40320729999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-07-15",
        "issued": null,
        "desc": "Construct a mixed use 10 storey building with 158 residential units, retail use on ground floor, self storage and 3 levels of underground parking",
        "units": 158,
        "postal": "M3K",
        "address": "3621 DUFFERIN ST",
        "geo": {
          "lat": 43.73089,
          "lng": -79.4571
        },
        "ward": "York Centre"
      },
      {
        "start": "2021-07-16",
        "issued": null,
        "desc": "Proposal to construct a 9 storey mixed use condominium development with 185 residential units and 3 levels of underground parking garage",
        "units": 185,
        "postal": "M2N",
        "address": "181 SHEPPARD AVE E",
        "geo": {
          "lat": 43.7635005,
          "lng": -79.4000727
        },
        "ward": "Willowdale"
      },
      {
        "start": "2021-07-19",
        "issued": "2021-08-20",
        "desc": "Proposal for interior alterations to existing senior residential building, a total of 244 dwelling units proposed, existing was 188 dwelling units.(no changes to existing commercial spaces)",
        "units": 56,
        "postal": "M4W",
        "address": "877 YONGE ST",
        "geo": {
          "lat": 43.6742077,
          "lng": -79.3881541
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-07-21",
        "issued": null,
        "desc": "Proposal for a permanent Modular Housing; 6 floor residential building comprising 57 suites with associated shared amenities including administrative offices, laundry, kitchen and dining lounge. ",
        "units": 57,
        "postal": "M1P",
        "address": "7 GLAMORGAN AVE",
        "geo": {
          "lat": 43.7676969,
          "lng": -79.2844162
        },
        "ward": "Scarborough Centre"
      },
      {
        "start": "2021-07-29",
        "issued": "2022-09-15",
        "desc": "Proposal to construct a nine storey, 25 unit, residential condo apartment building with three levels of underground parking.",
        "units": 25,
        "postal": "M5P",
        "address": "2010-2012 BATHURST ST",
        "geo": {
          "lat": 43.7002812,
          "lng": -79.4255431
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2021-08-05",
        "issued": null,
        "desc": "Tower D, 10-storey mixed-use building (with 2-storey wings) containing 123 residential rental units, retail (1,170 m²), office (2,495 m²), community agency space (465 m²), and assisted-living units on floors 5 and 6",
        "units": 130,
        "postal": "M9B",
        "address": "300-304 THE EAST MALL",
        "geo": {
          "lat": 43.63718910000001,
          "lng": -79.557622
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2021-08-05",
        "issued": null,
        "desc": "Construct a 8 storey concrete condo with 115 residential units, 1 levels of below grade parking, and commercial at grade",
        "units": 115,
        "postal": "M6J",
        "address": "1200 DUNDAS ST W",
        "geo": {
          "lat": 43.6497727,
          "lng": -79.4224818
        },
        "ward": "Davenport"
      },
      {
        "start": "2021-08-05",
        "issued": null,
        "desc": "Proposal to construct a 34 storey mixed use residential high-rise building consisting of 369 Units together with 3 Levels of U/G Parking with commercial retail at grade on Community Space on Level 2. ",
        "units": 369,
        "postal": "M5C",
        "address": "90 QUEEN ST E",
        "geo": {
          "lat": 43.6536973,
          "lng": -79.3742065
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-08-05",
        "issued": null,
        "desc": "Proposal for interior alterations, new dwelling units, underpinning, exterior alterations. See related CofA approval A0329/20TEY, and Zoning Certificate 19-252876 ZZC",
        "units": 14,
        "postal": "M6G",
        "address": "260-262 CHRISTIE ST",
        "geo": {
          "lat": 43.6708766,
          "lng": -79.42147899999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-08-12",
        "issued": null,
        "desc": "Proposal to construct a 4 storey residential Condominium building containing 36 units and parking on ground floor.",
        "units": 36,
        "postal": "M4P",
        "address": "200 KEEWATIN AVE",
        "geo": {
          "lat": 43.7137767,
          "lng": -79.3935783
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2021-08-18",
        "issued": "2021-12-17",
        "desc": "Proposed underpinning, interior alterations &maintain secondary suite in basement.",
        "units": 6,
        "postal": "M6J",
        "address": "288 OSSINGTON AVE",
        "geo": {
          "lat": 43.650562,
          "lng": -79.4214765
        },
        "ward": "Davenport"
      },
      {
        "start": "2021-08-19",
        "issued": null,
        "desc": "Proposed interior alterations to second floor of existing mixed use building.",
        "units": 6,
        "postal": "M9N",
        "address": "1935 WESTON RD",
        "geo": {
          "lat": 43.70067419999999,
          "lng": -79.5174197
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2021-08-19",
        "issued": null,
        "desc": "10 storey residential apartment building containing 218 dwelling units, ground floor retail (361.48sqm), rooftop terrace, outdoor amenity areas, greenroof and two levels of underground parking - The Dylan",
        "units": 219,
        "postal": "M6B",
        "address": "831 GLENCAIRN AVE",
        "geo": {
          "lat": 43.7087464,
          "lng": -79.4439077
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2021-08-24",
        "issued": null,
        "desc": "Construct a new nine (9) storey mixed use residential building with 200 units, retail on the ground floor and two (2) levels of underground parking garage",
        "units": 200,
        "postal": "M8Y",
        "address": "689 THE QUEENSWAY",
        "geo": {
          "lat": 43.6267181,
          "lng": -79.4998549
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2021-08-25",
        "issued": null,
        "desc": "Proposal for a new 4 storey Apartment building comprising 51 dwelling units with associated shared amenities including administrative offices, laundry, kitchen, dining, and lounge. ",
        "units": 51,
        "postal": "M6K",
        "address": "130 DUNN AVE",
        "geo": {
          "lat": 43.6348034,
          "lng": -79.4327094
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2021-09-07",
        "issued": null,
        "desc": "Proposal for a new 41-storey, plus mezzanine levels mixed use building consisting of 428 residential units,retail gross floor area  and 4-level underground garage. (19 228251 STE 10 SA)",
        "units": 428,
        "postal": "M5A",
        "address": "31 PARLIAMENT ST",
        "geo": {
          "lat": 43.6488295,
          "lng": -79.3613192
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2021-09-10",
        "issued": null,
        "desc": "Addition and interior alteration to a 3-storey existing mixed-use building. The ground floor is commercial space and upper floors are residential units for rental - 7 total units , one on basement level, 3 units on the 2nd and 3rd floors.",
        "units": 7,
        "postal": "M6K",
        "address": "1472 QUEEN ST W",
        "geo": {
          "lat": 43.6406911,
          "lng": -79.43700609999999
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2021-09-10",
        "issued": null,
        "desc": "Proposal for a mixed-use building consisting of a 17-storey condominium tower, and a 16-storey rental building atop an 8-storey shared podium. The building will have a non-residential gross floor 1527.6 sqm and a total of 632 residential dwelling units of which, 82 will be affordable rental units.(21 152485 STE 14 SA)",
        "units": 632,
        "postal": "M4L",
        "address": "1555 QUEEN ST E",
        "geo": {
          "lat": 43.6654687,
          "lng": -79.3185237
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2021-09-13",
        "issued": null,
        "desc": "Construct 6 storey mixed use building, retail space at grade 24 residential units",
        "units": 24,
        "postal": "M1N",
        "address": "2217 KINGSTON RD",
        "geo": {
          "lat": 43.70373,
          "lng": -79.2526
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2021-09-27",
        "issued": null,
        "desc": "Proposal to construct a new 44 storey mixed use building with 371 residential units, 3 levels of non residential uses and 4 levels of below grade parking. The proposal includes the retention of the facade of 1496-1500 Yonge Street and a parkland dedication at the rear of 30 and 40 St. Clair Avenue West. See also 21 122895 STE 12 SA.",
        "units": 371,
        "postal": "M4V",
        "address": "1 DELISLE AVE",
        "geo": {
          "lat": 43.6889549,
          "lng": -79.3947602
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2021-10-04",
        "issued": null,
        "desc": "Proposal to construct a new 6-storey mixed-use building with 2 commercial spaces on the ground floor and 39 rental residential units above. The application is also subject to a Site Plan Control Application (File No.: 20 228791 ESC 20 SA) which is currently under review.",
        "units": 39,
        "postal": "M1N",
        "address": "2380 KINGSTON RD",
        "geo": {
          "lat": 43.7078275,
          "lng": -79.2506271
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2021-10-08",
        "issued": "2022-05-18",
        "desc": "Proposal to construct a new 3 storey, 12 rental unit residential building with basements - Building # 2 See also BUILDING # 3, 21-231443 BLD 00 NB,  BUILDING # 4, 21-231517 BLD 00 NB",
        "units": 12,
        "postal": "M9C",
        "address": "70 DIXFIELD DR",
        "geo": {
          "lat": 43.65602459999999,
          "lng": -79.57242529999999
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2021-10-13",
        "issued": null,
        "desc": "Proposal to demolish the existing building and construct a new 9 storey apartment building with 4 levels of underground parking garage.",
        "units": 19,
        "postal": "M5R",
        "address": "321 DAVENPORT RD",
        "geo": {
          "lat": 43.674524,
          "lng": -79.40107549999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-10-13",
        "issued": null,
        "desc": "32 Storey residential development with 219 units and 1 retail unit at grade. There are also 4 levels underground parking and a mechanical penthouse. ",
        "units": 219,
        "postal": "M5A",
        "address": "284 KING ST E",
        "geo": {
          "lat": 43.6521242,
          "lng": -79.36526959999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-10-13",
        "issued": null,
        "desc": "Proposal for 20 Storey residential development with 309 units and 2 retail units at grade with 3 levels underground parking and a mechanical penthouse. ",
        "units": 309,
        "postal": "",
        "address": "193 MC CAUL ST",
        "geo": {
          "lat": 43.6567515,
          "lng": -79.3921081
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-10-14",
        "issued": null,
        "desc": "Proposal to construct  mixed-use apartment building with two towers, 32 and 46 storeys high with 3 levels of underground parking garages and commercial spaces on the ground level and connected by 11storey podium. The existing buildings on the site would be demolished. (19 127591 STE 13 SA)",
        "units": 770,
        "postal": "",
        "address": "27 GROSVENOR ST",
        "geo": {
          "lat": 43.6626157,
          "lng": -79.3851645
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-10-14",
        "issued": null,
        "desc": "Proposal for a new 5 floor residential building comprising 64 suites with associated shared amenities including administrative offices, laundry, kitchen, dining and lounge. ",
        "units": 64,
        "postal": "M1E",
        "address": "4626 KINGSTON RD",
        "geo": {
          "lat": 43.7751248,
          "lng": -79.180182
        },
        "ward": "Scarborough-Rouge Park"
      },
      {
        "start": "2021-10-15",
        "issued": null,
        "desc": "Proposal to demolish existing underground garage and construct a new 22 storey purpose built rental building with 249 units and 4 levels of underground parking.",
        "units": 249,
        "postal": "M9C",
        "address": "555 THE WEST MALL",
        "geo": {
          "lat": 43.6524643,
          "lng": -79.5704374
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2021-10-20",
        "issued": null,
        "desc": "Proposal to construct a new 10 storey mixed use condominium, with 2 blocks of stacked townhouses, and 2 levels of underground parking garage.This application covers the 10 storey tower, and the 2 levels of underground parking garage only. See also 20 213954 NNY 17 SA.",
        "units": 238,
        "postal": "M2K",
        "address": "625 SHEPPARD AVE E",
        "geo": {
          "lat": 43.7681968,
          "lng": -79.38068799999999
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2021-10-22",
        "issued": null,
        "desc": "Proposal to construct a new 29 Storey mixed-use building, containing 346 units with 3 levels of underground garage.",
        "units": 346,
        "postal": "M5T",
        "address": "292 DUNDAS ST W",
        "geo": {
          "lat": 43.654512,
          "lng": -79.3911237
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-11-01",
        "issued": "2022-05-18",
        "desc": "Addition of seven dwelling units to the existing single family dwelling - renovation includes a third storey front addition, second and third floor rear addition and three storey rear addition, interior alterations, balconies, walkout basements",
        "units": 7,
        "postal": "M6P",
        "address": "67 OAKMOUNT RD",
        "geo": {
          "lat": 43.6574582,
          "lng": -79.46337609999999
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2021-11-02",
        "issued": null,
        "desc": "Proposal for the construction of a 29 storey tower containing 20,055 square metres of residential space and 6,509 square metres of non-residential space. Application is in conjunction with Facade Retention permit 21 115462 BLD 00 BA (300 BLOOR ST W).",
        "units": 284,
        "postal": "M5S",
        "address": "300 BLOOR ST W",
        "geo": {
          "lat": 43.6674477,
          "lng": -79.4021163
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-11-03",
        "issued": null,
        "desc": "Proposal to construct a 23 storey mixed use development with 259 dwelling units, retail on grade and 3 levels of underground garage",
        "units": 259,
        "postal": "M9B",
        "address": "5509 DUNDAS ST W",
        "geo": {
          "lat": 43.6316599,
          "lng": -79.54508
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2021-11-05",
        "issued": null,
        "desc": "Proposal to construct 40 storey residential building connected on 6 levels of podium and 5 levels of underground parking - building 2A",
        "units": 471,
        "postal": "",
        "address": "65 THOMAS RILEY RD",
        "geo": {
          "lat": 43.63312,
          "lng": -79.54126
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2021-11-05",
        "issued": null,
        "desc": "17 storey residential apartment building containing 131 dwelling units and four levels of underground parking",
        "units": 131,
        "postal": "M5M",
        "address": "228 WILSON AVE",
        "geo": {
          "lat": 43.7388296,
          "lng": -79.42753499999999
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2021-11-08",
        "issued": null,
        "desc": "Proposal to construct new 11 storey residential condominium with 3 level underground parking",
        "units": 101,
        "postal": "M1E",
        "address": "4569 KINGSTON RD",
        "geo": {
          "lat": 43.77282599999999,
          "lng": -79.18436969999999
        },
        "ward": "Scarborough-Rouge Park"
      },
      {
        "start": "2021-11-09",
        "issued": null,
        "desc": "Proposal for a new 34 Storey, mixed use condominium building with retail on Ground floor and a 4 level underground parking garage",
        "units": 430,
        "postal": "M5A",
        "address": "111 RIVER ST",
        "geo": {
          "lat": 43.66069239999999,
          "lng": -79.3576848
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-11-17",
        "issued": null,
        "desc": "Construct new tower A, 26 stories with 4 level parking garage below grade",
        "units": 324,
        "postal": "M6S",
        "address": "34 SOUTHPORT ST",
        "geo": {
          "lat": 43.63854449999999,
          "lng": -79.47315700000001
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2021-11-17",
        "issued": null,
        "desc": "Proposal to construct a new 19 storey mixed use residential with 2 levels of underground parking. - (XO2 Condo)",
        "units": 410,
        "postal": "M6K",
        "address": "1182 KING ST W",
        "geo": {
          "lat": 43.63921,
          "lng": -79.42677429999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2021-11-18",
        "issued": null,
        "desc": "Construct 20 storey residential condominium North Tower 257 units, 3 storey parking garage below shared with South Tower.  ",
        "units": 257,
        "postal": "",
        "address": "15 CORDOVA AVE",
        "geo": {
          "lat": 43.64843,
          "lng": -79.52721
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2021-11-18",
        "issued": null,
        "desc": "Construct a 14 storey residential buildingm with 422 units with 4 level underground parking garageprior to the issuance of the first above grade building permit, a financial contribution in the amount of $400,000 shall be submitted to secure for public art and $800,000 to be used for improvements to the local park and the pedestrian realm between the subject site and the Sheppard West subway station, to be determined by the Chief Planner and Executive Director, City Planning, in consultation with the local Councillor; ",
        "units": 422,
        "postal": "M3K",
        "address": "1100 SHEPPARD AVE W",
        "geo": {
          "lat": 43.7511702,
          "lng": -79.466084
        },
        "ward": "York Centre"
      },
      {
        "start": "2021-11-19",
        "issued": null,
        "desc": "A mixed use building with two towers on a shared podium. 34 and 40 storey building containing 856 dwelling units, a community centre, daycare, retail and amenity areas and three levels of underground parking, including bicycle storage  -  Tower C & D - Newtonbrook - Phase 2",
        "units": 857,
        "postal": "M2M",
        "address": "5799 YONGE ST",
        "geo": {
          "lat": 43.784921,
          "lng": -79.4164589
        },
        "ward": "Willowdale"
      },
      {
        "start": "2021-11-22",
        "issued": null,
        "desc": "Proposal to construct a new mixed use building with 44 storeys, retail/office floors 2-5, 331 residential units, and 4 levels of below grade parking.Uses considered: Retail, Office, Dwelling units in a mixed-use building",
        "units": 432,
        "postal": "M5H",
        "address": "263 ADELAIDE ST W",
        "geo": {
          "lat": 43.6477037,
          "lng": -79.3895818
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2021-11-23",
        "issued": null,
        "desc": "Proposal to demolish the existing 3 storey commercial building to construct a new 30 storey mixed use building with 65 residential suites, 3 floors of retail and 5 levels of underground parking garage.",
        "units": 65,
        "postal": "M5R",
        "address": "45 AVENUE RD",
        "geo": {
          "lat": 43.6707628,
          "lng": -79.39480329999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-11-23",
        "issued": null,
        "desc": "Construct a four storey stacked townhouses (18 units) - Block E - Market",
        "units": 18,
        "postal": "M6A",
        "address": "1-87 BREDONHILL CRT",
        "geo": {
          "lat": 43.653226,
          "lng": -79.3831843
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2021-11-29",
        "issued": null,
        "desc": "Proposal to construct a new mixed use building with 13 storey of residential uses (9 storey of office uses, retail at grade), and 3 levels of underground garage.",
        "units": 118,
        "postal": "M5R",
        "address": "316 DUPONT ST",
        "geo": {
          "lat": 43.6747431,
          "lng": -79.40880070000001
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-12-01",
        "issued": null,
        "desc": "Proposed to construct 2 levels of below ground parking,16 storey building with a mechanical pen house with a total GFA of 19577 Sq.M. Retail Unit on Ground and 2nd floor with Artist Studio on 2nd floor and 254 residential units. Please read permit 22-149746 ALT for standpipe hose valve in exit.Standpipe valve in exit related to permit 22-149746 ALT",
        "units": 254,
        "postal": "M6R",
        "address": "181 STERLING RD",
        "geo": {
          "lat": 43.6547892,
          "lng": -79.4447539
        },
        "ward": "Davenport"
      },
      {
        "start": "2021-12-01",
        "issued": null,
        "desc": "Proposal to construct 15 storey rental apartment building with 242 residential units, 1 level underground parking",
        "units": 242,
        "postal": "M1H",
        "address": "1744 ELLESMERE RD",
        "geo": {
          "lat": 43.7735182,
          "lng": -79.2470091
        },
        "ward": "Scarborough-Guildwood"
      },
      {
        "start": "2021-12-01",
        "issued": null,
        "desc": "Proposal to construct a new 21 storey mixed use building with commercial at grade, residential above and 4 levels of underground garage.",
        "units": 463,
        "postal": "M5A",
        "address": "162 QUEENS QUAY   E",
        "geo": {
          "lat": 43.6447338,
          "lng": -79.367818
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2021-12-02",
        "issued": null,
        "desc": "New construction of 12 storey mixed use condominium with 173 residential units, and 2 levels of underground parking",
        "units": 173,
        "postal": "M6C",
        "address": "908 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6802402,
          "lng": -79.4339727
        },
        "ward": "Davenport"
      },
      {
        "start": "2021-12-02",
        "issued": null,
        "desc": "Construct a new ten (10) storey apartment buiding with 134 units, retail space and two (2) levels of underground parking ",
        "units": 134,
        "postal": "M3H",
        "address": "700 SHEPPARD AVE W",
        "geo": {
          "lat": 43.7545266,
          "lng": -79.44441359999999
        },
        "ward": "York Centre"
      },
      {
        "start": "2021-12-06",
        "issued": null,
        "desc": "Construt a new four (4) storey stacked townhouse with 14 units - Block A",
        "units": 14,
        "postal": "M6A",
        "address": "585 LAWRENCE AVE W",
        "geo": {
          "lat": 43.7174522,
          "lng": -79.4367863
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2021-12-06",
        "issued": null,
        "desc": "Construt a new four (4) storey stacked townhouse with 11 units with roof decks- Block B",
        "units": 11,
        "postal": "M6A",
        "address": "579 LAWRENCE AVE W",
        "geo": {
          "lat": 43.7175512,
          "lng": -79.4362587
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2021-12-06",
        "issued": null,
        "desc": "Proposal to construct a new 32-storey rental building with a 9-storey podium on the eastern portion of the site, fronting onto Jane Street and Chalkfarm Drive; with 4 levels of underground parking.",
        "units": 506,
        "postal": "M3L",
        "address": "170 CHALKFARM DR",
        "geo": {
          "lat": 43.724332,
          "lng": -79.51341049999999
        },
        "ward": "Humber River-Black Creek"
      },
      {
        "start": "2021-12-07",
        "issued": null,
        "desc": "Proposal to construct a new 52 storey mixed-use building with 4 levels of below grade parking. ",
        "units": 697,
        "postal": "M5B",
        "address": "250 CHURCH ST",
        "geo": {
          "lat": 43.6560455,
          "lng": -79.37721049999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-12-08",
        "issued": null,
        "desc": "Proposed 7 storey mixed-use building with commercial on ground and 2 levels of underground  garage; including a renovation to a re-located existing 2 storey heritage building on site.",
        "units": 26,
        "postal": "M5R",
        "address": "10 PRINCE ARTHUR AVE",
        "geo": {
          "lat": 43.6699771,
          "lng": -79.39567330000001
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-12-10",
        "issued": null,
        "desc": "Proposal to construct a new 10-storey mixed-use building with 18 residential units, a 2 storey retail unit and 3 levels of below grade parking. See also 21 229987 STE 11 SA.",
        "units": 18,
        "postal": "M5R",
        "address": "183 AVENUE RD",
        "geo": {
          "lat": 43.6752188,
          "lng": -79.3965419
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-12-10",
        "issued": null,
        "desc": "Construct 27 storey residential condonimum, 2 level underground parking garage, BLOCK C PHASE 1",
        "units": 306,
        "postal": "M1H",
        "address": "1221 MARKHAM RD",
        "geo": {
          "lat": 43.7787315,
          "lng": -79.23168559999999
        },
        "ward": "Scarborough-Guildwood"
      },
      {
        "start": "2021-12-10",
        "issued": null,
        "desc": "Proposed 14 storey retirement residential development with at grade retail and 2 levels of underground parking",
        "units": 150,
        "postal": "M8X",
        "address": "3411 BLOOR ST W",
        "geo": {
          "lat": 43.6442147,
          "lng": -79.52462009999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2022-07-07",
        "issued": null,
        "desc": "Rev 01- Add 5 new appartmentsProposed interior alteration, closing exterior windows and new rear balconies. ",
        "units": 5,
        "postal": "M8V",
        "address": "2709 LAKE SHORE BLVD W",
        "geo": {
          "lat": 43.6022616,
          "lng": -79.49681679999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2021-12-13",
        "issued": null,
        "desc": "Proosal to construct a new 9 storey mixed use building with 184 residential units, ground floor retail and below grade parking. See also 20 185654 NNY 08 SA.Address includes 1886-1920 Eglinton Ave W.",
        "units": 184,
        "postal": "M6E",
        "address": "1886 EGLINTON AVE W",
        "geo": {
          "lat": 43.6956462,
          "lng": -79.45188139999999
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2021-12-14",
        "issued": null,
        "desc": "Proposal for a 13 storey mixed-use residential building with 168 residential units and 4 levels of Underground Parking Garage. ",
        "units": 168,
        "postal": "M1E",
        "address": "4694 KINGSTON RD",
        "geo": {
          "lat": 43.7777648,
          "lng": -79.17279789999999
        },
        "ward": "Scarborough-Rouge Park"
      },
      {
        "start": "2021-12-14",
        "issued": null,
        "desc": "Proposal to construct a new 32 storey mixed used building with 540 residential units, retail space at grade, and 3 levels of underground parking. See also 19 240782 STE 10 SA.",
        "units": 540,
        "postal": "M5A",
        "address": "33 PARLIAMENT ST",
        "geo": {
          "lat": 43.6491115,
          "lng": -79.3614714
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2021-12-15",
        "issued": null,
        "desc": "Proposal to retain the facade of the existing building and  construct a new 40 storey mixed-use building with 486 residential units; retail at grade and 4 levels of underground parking garage.",
        "units": 486,
        "postal": "M5A",
        "address": "250 KING ST E",
        "geo": {
          "lat": 43.6516443,
          "lng": -79.3672536
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-12-15",
        "issued": null,
        "desc": "Proposed to construct a 23 storey mixed-use building with 100 residential suites and retail at grade and a 5 level underground Garage. ",
        "units": 100,
        "postal": "M5R",
        "address": "306 DAVENPORT RD",
        "geo": {
          "lat": 43.67450849999999,
          "lng": -79.4000325
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-12-15",
        "issued": null,
        "desc": "Construction of a 27 storey mixed use building with 390 affordable rental residential units, long term care and daycare space, and 2 levels of below grade parking garage",
        "units": 468,
        "postal": "M3C",
        "address": "844 DON MILLS RD",
        "geo": {
          "lat": 43.7226755,
          "lng": -79.341275
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2021-12-15",
        "issued": null,
        "desc": "Proposal to construct a new 17-storey senior's residence with retail at-grade and two levels of underground parking.(20 161832 STE 12 SA / 21 229209 BLD 00 BA)",
        "units": 239,
        "postal": "M4T",
        "address": "1365 YONGE ST",
        "geo": {
          "lat": 43.6865066,
          "lng": -79.3932489
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2021-12-15",
        "issued": null,
        "desc": "Proposal to construct a new 39 storey mixed used building, with 3 levels of underground parking garage, 2 levels of office/retail and 484 dwelling units. Included is the retention of heritage facades of 33 SHERBOURNE AND 176-178 STREET EAST. (180 FRON ST. E. Pending address). See also 21 224585 DEM, 21-237066-BA, 21-237094-BA and 19 215419 STE 13 SA.",
        "units": 484,
        "postal": "M5A",
        "address": "33 SHERBOURNE ST",
        "geo": {
          "lat": 43.6508398,
          "lng": -79.3677373
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-12-16",
        "issued": "2022-04-12",
        "desc": "Rear addition and interior alterations to allow existing dwelling to be coverted from a 3 unit to a 8 unit ",
        "units": 5,
        "postal": "M5R",
        "address": "47 MADISON AVE",
        "geo": {
          "lat": 43.6694406,
          "lng": -79.4034136
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-12-16",
        "issued": null,
        "desc": "Construct an 8-storey mixed-use building with 120 residential units, office uses, retail on street level and two level underground parking garage",
        "units": 120,
        "postal": "M6P",
        "address": "2946 DUNDAS ST W",
        "geo": {
          "lat": 43.66557299999999,
          "lng": -79.46765599999999
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2021-12-17",
        "issued": null,
        "desc": "Construct 9 storey mixed use condominium, 330 residential units, commercial at grade, 2 level underground parking garage",
        "units": 329,
        "postal": "M6G",
        "address": "840 DUPONT ST",
        "geo": {
          "lat": 43.670973,
          "lng": -79.4275759
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-12-20",
        "issued": null,
        "desc": "Proposal to construct one 25 storey Tower (South Tower) and one 10 storey mid-rise tower (North Tower) on a shared podium with retail at grade, 631 units (327 Units in South Tower) and 2 levels U/G parking. This permit include U/G parking and South Tower. (Refer to #21-250319 BLD for North Tower)",
        "units": 327,
        "postal": "M5A",
        "address": "365 PARLIAMENT ST",
        "geo": {
          "lat": 43.6611226,
          "lng": -79.36622349999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-12-20",
        "issued": null,
        "desc": "Construct 8 storey residential building with basement, 17 units",
        "units": 17,
        "postal": "M5S",
        "address": "15 GLEN MORRIS ST",
        "geo": {
          "lat": 43.6638856,
          "lng": -79.40147859999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-12-20",
        "issued": null,
        "desc": "37 storey mixed use building containing commercial uses on the ground floor, 322 dwelling units, two level mechanical penthouse, indoor and outdoor amenity areas and three levels of underground parking.  ",
        "units": 322,
        "postal": "M4S",
        "address": "30 MERTON ST",
        "geo": {
          "lat": 43.6967383,
          "lng": -79.3950593
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2021-12-21",
        "issued": null,
        "desc": "Proposal to construct a new 9 storey mixed-use building with 55 residential units, retail space at grade, a mechanical penthouse and two levels of below-grade parking. See also 21 250371 DEM and 18 263069 WET 17 SA.",
        "units": 55,
        "postal": "M6E",
        "address": "1474 ST CLAIR AVE W",
        "geo": {
          "lat": 43.6760878,
          "lng": -79.4533326
        },
        "ward": "Davenport"
      },
      {
        "start": "2021-12-21",
        "issued": null,
        "desc": "10 storey residential dwelling containing 215 dwelling units with two levels of underground parking",
        "units": 215,
        "postal": "M1K",
        "address": "599 KENNEDY RD",
        "geo": {
          "lat": 43.72451,
          "lng": -79.26423
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2021-12-21",
        "issued": null,
        "desc": "Construct new 8 storey residential building containing six dwelling units.",
        "units": 6,
        "postal": "M5R",
        "address": "350 DAVENPORT RD",
        "geo": {
          "lat": 43.6753748,
          "lng": -79.4015063
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2021-12-21",
        "issued": null,
        "desc": "Proposal to construct a new 16 storey residential building containing 129 dwelling units, with heritage retention of 3 townhome facades, and 1 level of underground parking. See also 19 232218 STE 10 SA.. ",
        "units": 129,
        "postal": "M5V",
        "address": "135 PORTLAND ST",
        "geo": {
          "lat": 43.6464477,
          "lng": -79.40074849999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2021-12-21",
        "issued": null,
        "desc": "Construct a new 4 storey condominium with 28 units, one level of underground parking garage",
        "units": 28,
        "postal": "M6B",
        "address": "722 MARLEE AVE",
        "geo": {
          "lat": 43.711262,
          "lng": -79.4450152
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "start": "2021-12-21",
        "issued": null,
        "desc": "Proposal for 2 mixed-use rental apartment development, 24 storeys (Tower B) and 33 storeys (Tower C) consisting of 801 units with a shared two-level underground Parking Garage and Parkland Component. This permit is for U/G parking Garage and Towner B. REFER:21-250634 FOR Tower C",
        "units": 437,
        "postal": "",
        "address": "285 QUEEN ST E",
        "geo": {
          "lat": 43.6547616,
          "lng": -79.36730039999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2021-12-22",
        "issued": null,
        "desc": "Proposal to construct a 12 storey mixed use building with 3 levels of underground parking.",
        "units": 190,
        "postal": "M3N",
        "address": "2839 JANE ST",
        "geo": {
          "lat": 43.7512882,
          "lng": -79.5154647
        },
        "ward": "Humber River-Black Creek"
      },
      {
        "start": "2021-12-22",
        "issued": null,
        "desc": "Proposal for a mixed use residential building containing 341 unit with retail at grade.",
        "units": 341,
        "postal": "M8Z",
        "address": "1007 THE QUEENSWAY",
        "geo": {
          "lat": 43.6230109,
          "lng": -79.5161273
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2021-12-22",
        "issued": null,
        "desc": "Proposal for a mixed use residential building containing 203 units with retail at grade - BUILDING 2.",
        "units": 203,
        "postal": "M8Z",
        "address": "1037 THE QUEENSWAY",
        "geo": {
          "lat": 43.6227999,
          "lng": -79.51700149999999
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2021-12-22",
        "issued": null,
        "desc": "Construct new mixed use building, 57 residential units,8 stories retail at grade, 2 level underground parking garage",
        "units": 57,
        "postal": "M1N",
        "address": "1161 KINGSTON RD",
        "geo": {
          "lat": 43.681776,
          "lng": -79.2798645
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2021-12-23",
        "issued": null,
        "desc": "Construct 8 storey residential building Building A, 263 UNITS",
        "units": 263,
        "postal": "M1C",
        "address": "1625 MILITARY TRL",
        "geo": {
          "lat": 43.7817089,
          "lng": -79.1729304
        },
        "ward": "Scarborough-Rouge Park"
      },
      {
        "start": "2021-12-30",
        "issued": null,
        "desc": "Construct 8  storey mixed use building, 40 residential units, retail at grade, 2 level underground parking garage",
        "units": 40,
        "postal": "M1N",
        "address": "2448-2450 KINGSTON RD",
        "geo": {
          "lat": 43.7096719,
          "lng": -79.2495327
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2021-12-30",
        "issued": null,
        "desc": "MODEL NAME \"1910\" ELEVATION \"O\" Construct new 2 storey detached house lots 37-44",
        "units": 8,
        "postal": "M1C",
        "address": "7 FRANKLIN AVE",
        "geo": {
          "lat": 43.7856066,
          "lng": -79.165325
        },
        "ward": "Scarborough-Rouge Park"
      },
      {
        "start": "2022-01-05",
        "issued": null,
        "desc": "Proposal for construction of a new 6 storey mid-rise condominium includes 2 levels of underground parking and one commercial street level unit. ",
        "units": 29,
        "postal": "M4L",
        "address": "1249 QUEEN ST E",
        "geo": {
          "lat": 43.6632985,
          "lng": -79.3292158
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2022-01-06",
        "issued": "2022-07-18",
        "desc": "Proposal for 4 storey addition to existing Retirement Home. ",
        "units": 26,
        "postal": "M2R",
        "address": "1 KENTON DR",
        "geo": {
          "lat": 43.7779859,
          "lng": -79.44346809999999
        },
        "ward": "Willowdale"
      },
      {
        "start": "2022-01-13",
        "issued": null,
        "desc": "Legalize existing apartment building back to 10 units, side yard basement walkout and structural upgrades.(subject to Deferral program but unable to update correctly waiting for direction)",
        "units": 9,
        "postal": "M4J",
        "address": "118 DONLANDS AVE",
        "geo": {
          "lat": 43.6842505,
          "lng": -79.3391517
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2022-01-14",
        "issued": null,
        "desc": "Proposed Legalization of 5 exist'g units that were built by previous owner.",
        "units": 5,
        "postal": "M9V",
        "address": "2757 KIPLING AVE",
        "geo": {
          "lat": 43.7547613,
          "lng": -79.5866377
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2022-01-27",
        "issued": null,
        "desc": "Proposal to construct a new 12 storey mixed use buildng with 78 residential units, commercial at grade and 1 level of underground parking. See also 20 173536 STE 12 SA.",
        "units": 83,
        "postal": "M4S",
        "address": "2100 YONGE ST",
        "geo": {
          "lat": 43.70260690000001,
          "lng": -79.3978317
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2022-02-11",
        "issued": "2022-08-23",
        "desc": "RE-PURPOSING OF BASEMENT SUITES B11, B12, B14, B15 & B17 TO BECOME RESIDENTIAL SUITES B11, B12, B14, B15, B17 & B18. - (Additional new 5 dwelling units)",
        "units": 5,
        "postal": "M6M",
        "address": "2701 EGLINTON AVE W",
        "geo": {
          "lat": 43.6892866,
          "lng": -79.47746339999999
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2022-02-22",
        "issued": "2022-03-16",
        "desc": "AFFORDABLE HOUSING IN COLLABORATION WITH CITY OF TORONTO; CONVERSION OF EXISTING HOUSE TO 9 APARTMENTS TO BE OPERATED BY NA ME RES, AN INDIGINOUS MEN'S SHELTER ORGANIZATION. NEW FLOORS, WALLS, HVAC AND PLUMBING TO DEMISE INTERIOR, REMOVAL OF EXISTING GARAGE TO ALLOW CREATION OF BASEMENT APARTMENT; NEW DORMER ON NON-STREET FACING SIDE TO ALLOW LIGHT. ",
        "units": 10,
        "postal": "M5A",
        "address": "218 CARLTON ST",
        "geo": {
          "lat": 43.66421589999999,
          "lng": -79.369765
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2022-02-23",
        "issued": "2022-06-22",
        "desc": "To alter the existing two-storey mixed use building by constructing a full third and fourth storey addition, a rear four storey addition, a rear integral garage, and a rooftop terrace & Underpinning of the basement. (30.5M)Area of work is 596.2 m2  & the Underpinning is 30.5 mUses: eating establishment on ground floor, and add 4 dwelling units for a total of 5 dwelling units",
        "units": 5,
        "postal": "M4J",
        "address": "1475 DANFORTH AVE",
        "geo": {
          "lat": 43.6827042,
          "lng": -79.32587199999999
        },
        "ward": "Toronto-Danforth"
      },
      {
        "start": "2022-03-23",
        "issued": null,
        "desc": "Proposal to construct a new 34 storey mixed use building with 331 dwelling units, retail at grade and 2nd Floor, and 4 levels of underground parking garage. See also 16 270618 ESC 38 SA.",
        "units": 331,
        "postal": "M1H",
        "address": "1021-1035 MARKHAM RD",
        "geo": {
          "lat": 43.7739612,
          "lng": -79.23022499999999
        },
        "ward": "Scarborough-Guildwood"
      },
      {
        "start": "2022-03-23",
        "issued": null,
        "desc": "Ground floor renovation converting former server room into residential units.",
        "units": 9,
        "postal": "M5T",
        "address": "200 ELM ST",
        "geo": {
          "lat": 43.6561141,
          "lng": -79.39129009999999
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2022-04-05",
        "issued": null,
        "desc": "Proposal for interior alterations to the ground floor including converting the parking garage area to 8 residential units. See also 18 180697 ZZC.",
        "units": 8,
        "postal": "M3A",
        "address": "67 PARKWOODS VILLAGE DR",
        "geo": {
          "lat": 43.7604231,
          "lng": -79.3211611
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2022-04-05",
        "issued": null,
        "desc": "Proposal for interior alterations to the ground floor including converting the parking garage area to 6 residential units. See also 18 180639 ZZC.",
        "units": 6,
        "postal": "M3A",
        "address": "70 PARKWOODS VILLAGE DR",
        "geo": {
          "lat": 43.7598362,
          "lng": -79.32283869999999
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2022-04-05",
        "issued": null,
        "desc": "12 storey mixed use building containing 375 dwelling units, amenity areas, ground floor retail and  two levels of underground parking - This mixed use development is at the corner of Victoria Park Avenue and Musgrave Street - Block 1 ",
        "units": 375,
        "postal": "M1N",
        "address": "2510 GERRARD ST E",
        "geo": {
          "lat": 43.68793,
          "lng": -79.28286
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2022-04-06",
        "issued": null,
        "desc": "Proposal to construct a 8 storey mixed use building with 103 residential units, ground floor retail, and 2 levels of underground parking. ",
        "units": 103,
        "postal": "M8Z",
        "address": "880 THE QUEENSWAY",
        "geo": {
          "lat": 43.6247025,
          "lng": -79.5109552
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "start": "2022-04-22",
        "issued": null,
        "desc": "12 storey residential apartment building containing 174 dwelling units and two levels of underground parking",
        "units": 174,
        "postal": "M2K",
        "address": "699 SHEPPARD AVE E",
        "geo": {
          "lat": 43.7683969,
          "lng": -79.3778391
        },
        "ward": "Don Valley North"
      },
      {
        "start": "2022-04-27",
        "issued": null,
        "desc": "To construct a 14 storey mixed-use building with 227 rental units, retail at grade and two levels of underground parking",
        "units": 227,
        "postal": "M6K",
        "address": "1071 KING ST W",
        "geo": {
          "lat": 43.6407976,
          "lng": -79.41695709999999
        },
        "ward": "Spadina-Fort York"
      },
      {
        "start": "2022-04-28",
        "issued": null,
        "desc": "Proposal to construct a new 11 storey building with 2 mid-rise towers, 422 residential units and 3 levels of below grade parking. See also 18 178880 ESC 44 SA.",
        "units": 422,
        "postal": "M1B",
        "address": "7437 KINGSTON RD",
        "geo": {
          "lat": 43.80059,
          "lng": -79.14272
        },
        "ward": "Scarborough-Rouge Park"
      },
      {
        "start": "2022-05-03",
        "issued": null,
        "desc": "Construct 3 levels of underground parking, 6-storey podium containing ground floor retail units, daycare, 2nd floor office and a 38-storey tower with a total of 424 dwelling units;",
        "units": 424,
        "postal": "M4C",
        "address": "10 DAWES RD",
        "geo": {
          "lat": 43.687842,
          "lng": -79.2972309
        },
        "ward": "Beaches-East York"
      },
      {
        "start": "2022-05-06",
        "issued": "2022-09-14",
        "desc": "Conversion of existing garages and lockers to residential suite in basement and ground floor, including amenities and site improvements. (9 new units)",
        "units": 9,
        "postal": "M1K",
        "address": "806 KENNEDY RD",
        "geo": {
          "lat": 43.7335815,
          "lng": -79.26906989999999
        },
        "ward": "Scarborough Centre"
      },
      {
        "start": "2022-05-11",
        "issued": null,
        "desc": "To permit the conversion of the existing 6 unit residential building for the addition of 5dwelling units. The development will result in a total of 11 dwelling units.",
        "units": 5,
        "postal": "M1K",
        "address": "80 FALMOUTH AVE",
        "geo": {
          "lat": 43.73473360000001,
          "lng": -79.25319809999999
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2022-05-13",
        "issued": null,
        "desc": "Proposal to convert existing ground floor storage space in to five bachelor units in the existing apartment building. ",
        "units": 5,
        "postal": "M3C",
        "address": "31-35 ST DENNIS DR",
        "geo": {
          "lat": 43.7184173,
          "lng": -79.3297718
        },
        "ward": "Don Valley East"
      },
      {
        "start": "2022-05-16",
        "issued": null,
        "desc": "To construct a 28 storey residential building for 320 units with 3 level underground parking garage ",
        "units": 320,
        "postal": "M6C",
        "address": "65 RAGLAN AVE",
        "geo": {
          "lat": 43.6851406,
          "lng": -79.4202159
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2022-05-19",
        "issued": null,
        "desc": "Proposal to alter the existing two-storey mixed-use building (containing a ground floor commercial unit and four residential dwelling units) by constructing a third floor addition, a fourth floor addition, a rear four-storey addition, and a rooftop terrace. Also, to add five residential dwelling units for a total of nine units. See also 21 117228 ZZC and 21 193312 MV.",
        "units": 9,
        "postal": "M6K",
        "address": "1596 DUNDAS ST W",
        "geo": {
          "lat": 43.65002459999999,
          "lng": -79.4348959
        },
        "ward": "Davenport"
      },
      {
        "start": "2022-05-19",
        "issued": null,
        "desc": "Proposal to construct a new 9 storey building with 234 residential rental units with 3 levels of underground parking. ",
        "units": 234,
        "postal": "M9C",
        "address": "240 MARKLAND DR",
        "geo": {
          "lat": 43.6290762,
          "lng": -79.57873699999999
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2022-05-19",
        "issued": null,
        "desc": "BUILDING A - Proposal to construct a new 21 storey mixed use building with 282 residential units and 3 levels of below grade parking (at the northeast corner of Lawrence Ave E and Birchmount Rd).See also 16 242481 SA.",
        "units": 282,
        "postal": "M1P",
        "address": "2180 LAWRENCE AVE E",
        "geo": {
          "lat": 43.74818519999999,
          "lng": -79.28448829999999
        },
        "ward": "Scarborough Centre"
      },
      {
        "start": "2022-05-26",
        "issued": null,
        "desc": "Proposed to construct 49 Storey mixed use building, with 7 level of hotels and 5 levels of below grade parking. ",
        "units": 572,
        "postal": "M5B",
        "address": "225 JARVIS ST",
        "geo": {
          "lat": 43.6564507,
          "lng": -79.37374799999999
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2022-05-30",
        "issued": null,
        "desc": "Proposal to construct a new 39 storey mixed use building with 516 residential dwelling units, ground floor retail and 4 levels below grade parking. See also 21 191888 STE 13 SA.",
        "units": 516,
        "postal": "M5A",
        "address": "125 GEORGE ST",
        "geo": {
          "lat": 43.6527047,
          "lng": -79.3712465
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2022-06-01",
        "issued": null,
        "desc": "Proposal to construct a new 3 storey Townhouse Block with 8 units with integral garages and a total GFA of 1,205.73 sm. See also 22 154931 DEM, 22 154937 DEM and 18 250662 NNY 23 SA.",
        "units": 8,
        "postal": "M2N",
        "address": "241 FINCH AVE E",
        "geo": {
          "lat": 43.7833024,
          "lng": -79.3981944
        },
        "ward": "Willowdale"
      },
      {
        "start": "2022-06-06",
        "issued": null,
        "desc": "Proposal to construct a 19 storey infill rental apartment building with 4 levels of underground parking. ",
        "units": 191,
        "postal": "M9C",
        "address": "340 MILL RD",
        "geo": {
          "lat": 43.6398155,
          "lng": -79.5855831
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2022-06-08",
        "issued": null,
        "desc": "Proposal to convert a 2-storey existing detached single family residential building to a house with a principal unit and 5 secondary units.",
        "units": 5,
        "postal": "M6R",
        "address": "5 SORAUREN AVE",
        "geo": {
          "lat": 43.64027249999999,
          "lng": -79.4408746
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2022-06-08",
        "issued": null,
        "desc": "9 storey mixed use building containing 206 dwelling units, retail at grade and two levels of underground parking",
        "units": 206,
        "postal": "",
        "address": "743 WARDEN AVE",
        "geo": {
          "lat": 43.7175149,
          "lng": -79.28279100000002
        },
        "ward": "Scarborough Southwest"
      },
      {
        "start": "2022-06-24",
        "issued": null,
        "desc": "Interior alteration and upper addition to convert existing commercial to a 7 unit residential building in the form of a stacked townhouse.",
        "units": 7,
        "postal": "M5S",
        "address": "225 BRUNSWICK AVE",
        "geo": {
          "lat": 43.66404929999999,
          "lng": -79.406404
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2022-06-27",
        "issued": null,
        "desc": "Construct a 45 storey mixed use building including a 9 storey North Block Podium and a  2 level underground parking garage",
        "units": 407,
        "postal": "",
        "address": "0 BOROUGH DR",
        "geo": {
          "lat": 43.7721474,
          "lng": -79.2567534
        },
        "ward": "Scarborough Centre"
      },
      {
        "start": "2022-06-29",
        "issued": null,
        "desc": "Proposal to construct a new 57 storey mixed use building with 445 residential units, ground floor retail and 4 levels underground parking. See also 22 164002 DEM and 21 152905 STE 13 SA.",
        "units": 445,
        "postal": "M5C",
        "address": "60 QUEEN ST E",
        "geo": {
          "lat": 43.6533475,
          "lng": -79.37561590000001
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2022-07-07",
        "issued": null,
        "desc": "Proposal for interior alterations to convert the existing storage space into 6 new dwelling units, a new fitness room and multipurpose room on Level P1 of an existing apartment building.",
        "units": 6,
        "postal": "M9V",
        "address": "46 PANORAMA CRT",
        "geo": {
          "lat": 43.74824940000001,
          "lng": -79.5785263
        },
        "ward": "Etobicoke North"
      },
      {
        "start": "2022-07-11",
        "issued": null,
        "desc": "Proposed 12-storey residentiral condominium. 172 units, sprinklered.",
        "units": 172,
        "postal": "",
        "address": "50 DEAN PARK RD",
        "geo": {
          "lat": 43.8031099,
          "lng": -79.17052
        },
        "ward": "Scarborough-Rouge Park"
      },
      {
        "start": "2022-07-19",
        "issued": null,
        "desc": "Construct 22-storey residential building with 181 residential units and 31 rental replacement units for a total of 211 dwelling units and 2 levels of underground parking. ",
        "units": 211,
        "postal": "M4P",
        "address": "109 ERSKINE AVE",
        "geo": {
          "lat": 43.7116569,
          "lng": -79.3947293
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2022-07-22",
        "issued": null,
        "desc": "Proposal to construct a block of 6 compact townhouses on the surface parking area at the back of the existing lot. See also 21 143775 SA.",
        "units": 6,
        "postal": "M5R",
        "address": "661 HURON ST",
        "geo": {
          "lat": 43.6747707,
          "lng": -79.4042826
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2022-07-28",
        "issued": null,
        "desc": "10 Storey mixed-use building with 2 levels of below grade parking and a total of 216 residential units are proposed, previously proposed ground floor retail space has been replaced by 12 live-work units fronting Bayview Avenue. ",
        "units": 196,
        "postal": "M4G",
        "address": "1710 BAYVIEW AVE",
        "geo": {
          "lat": 43.7091868,
          "lng": -79.3767711
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2022-07-29",
        "issued": null,
        "desc": "Proposal to construct one new 11 storey residential tower with commercial space on the first two floors and two levels of underground parking garage. (Block A)",
        "units": 100,
        "postal": "M6H",
        "address": "1141 BLOOR ST W",
        "geo": {
          "lat": 43.6592019,
          "lng": -79.4369978
        },
        "ward": "Davenport"
      },
      {
        "start": "2022-08-03",
        "issued": null,
        "desc": "Proposal for interior alterations to convert locker/storage area in the basement of an existing apartment building to 6 new residential units. See also 22 154707 ZAP.",
        "units": 6,
        "postal": "M9B",
        "address": "535 THE EAST MALL",
        "geo": {
          "lat": 43.65230469999999,
          "lng": -79.5626685
        },
        "ward": "Etobicoke Centre"
      },
      {
        "start": "2022-08-17",
        "issued": null,
        "desc": "Construction of a new 40-storey building (41st partial storey) with 502 residential units, and a 2-storey below grade parking garage",
        "units": 502,
        "postal": "M4Y",
        "address": "20 MAITLAND ST",
        "geo": {
          "lat": 43.6642369,
          "lng": -79.3829477
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2022-08-18",
        "issued": null,
        "desc": "Proposed construction of new 3-storey (28-units) residential condominium with 2-storey below grade (1-storey residential and 1-storey parking garage)",
        "units": 28,
        "postal": "M4P",
        "address": "413 ROEHAMPTON AVE",
        "geo": {
          "lat": 43.7104839,
          "lng": -79.38555740000001
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2022-09-01",
        "issued": null,
        "desc": "Proposal to construct a three-storey apartment building containing 12-dwelling units, and a rear ancillary building for bicycle parking and waste storage. (20 214642 STE 11 MV; 18 271787 STE 11 SA) ) ",
        "units": 12,
        "postal": "M5T",
        "address": "43 BELLEVUE AVE",
        "geo": {
          "lat": 43.6544616,
          "lng": -79.4032067
        },
        "ward": "University-Rosedale"
      },
      {
        "start": "2022-09-07",
        "issued": null,
        "desc": "Proposal to construct a two-tower rental development; one 17 and one 8 storey tower with a shared four storey podium and no underground garage. ",
        "units": 332,
        "postal": "M6N",
        "address": "386-394 SYMINGTON AVE",
        "geo": {
          "lat": 43.6678066,
          "lng": -79.452837
        },
        "ward": "Davenport"
      },
      {
        "start": "2022-09-07",
        "issued": null,
        "desc": "Proposal to construct 13 storey residential condominium with four levels of below grade parking",
        "units": 174,
        "postal": "M6P",
        "address": "1660 BLOOR ST W",
        "geo": {
          "lat": 43.6555257,
          "lng": -79.45738940000001
        },
        "ward": "Parkdale-High Park"
      },
      {
        "start": "2022-09-09",
        "issued": null,
        "desc": "Proposal to convert single family dwelling to 6 units",
        "units": 5,
        "postal": "M6M",
        "address": "351 BLACKTHORN AVE",
        "geo": {
          "lat": 43.684232,
          "lng": -79.4622059
        },
        "ward": "York South-Weston"
      },
      {
        "start": "2022-09-09",
        "issued": null,
        "desc": "Proposal to construct 18 & 19 storey Residential buildings containing 419 units with 2 levels of underground parking garage (63-91 Montclair Ave- WEST tower)",
        "units": 294,
        "postal": "M5P",
        "address": "63 MONTCLAIR AVE",
        "geo": {
          "lat": 43.6873179,
          "lng": -79.4135228
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "start": "2022-09-12",
        "issued": null,
        "desc": "To construct a new 8 storey mixed use building with 132 residential unites and commercial units at grade with a 2 level of underground parking structure",
        "units": 132,
        "postal": "M4G",
        "address": "126 LAIRD DR",
        "geo": {
          "lat": 43.70710529999999,
          "lng": -79.36253889999999
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2022-09-12",
        "issued": null,
        "desc": "Proposal to construct a new 8 storey mixed use building with 109 residential units, commercial at grade and 2 levels of undeground parking - PHASE 2See also 20 181299 NNY 15 SA.",
        "units": 109,
        "postal": "M4G",
        "address": "134 LAIRD DR",
        "geo": {
          "lat": 43.7079203,
          "lng": -79.36301569999999
        },
        "ward": "Don Valley West"
      },
      {
        "start": "2022-09-13",
        "issued": null,
        "desc": "Proposal to construct a 34 Storey residential condominium with 4.5 levels of underground parking, retail on grade, and  various amenity spaces. ",
        "units": 388,
        "postal": "M5A",
        "address": "83 RIVER ST",
        "geo": {
          "lat": 43.6599042,
          "lng": -79.35739
        },
        "ward": "Toronto Centre"
      },
      {
        "start": "2022-09-16",
        "issued": null,
        "desc": "Proposal for interior alteration to accomodate x units, basement walk out, converting garage into a laundry room, new fire alram system.",
        "units": 5,
        "postal": "M9A",
        "address": "1425 ISLINGTON AVE",
        "geo": {
          "lat": 43.657689,
          "lng": -79.5287487
        },
        "ward": "Etobicoke Centre"
      }
    ];

    const hScale = function (n) {
      if (n < 10) {
        return 80
      }
      if (n < 100) {
        return 120
      }
      if (n < 200) {
        return 180
      }
      return 300
    };


    const makeBox = function (point) {
      let [a, b] = point;
      let size = 0.0009;
      return [[[a, b], [a - size, b], [a, b - size], [a + size, b - size]]]
    };

    const colors$1 = {
      "Spadina-Fort York": "#cc7066",
      "Toronto Centre": "#2D85A8",
      "University-Rosedale": "#C4ABAB",
      "Etobicoke-Lakeshore": "#735873",
      "Toronto-St. Paul's": "#8BA3A2",
      "Davenport": "#6accb2",
      "Parkdale-High Park": "#2D85A8",
      "Toronto-Danforth": "#e6b3bc",
      "Willowdale": "#6D5685",
      "Eglinton-Lawrence": "#cc8a66",
      "Don Valley North": "#d8b3e6",
      "Etobicoke Centre": "#6699cc",
      "Beaches-East York": "#735873",
      "York South-Weston": "#d8b3e6",
      "York Centre": "#cc6966",
      "Don Valley West": "#cc8a66",
      "Scarborough Southwest": "#9c896c",
      "Don Valley East": "#838B91",
      "Scarborough-Agincourt": "#2D85A8",
      "Etobicoke North": "#978BA3",
      "Scarborough-Rouge Park": "#7f9c6c",
      "Scarborough Centre": "#914045",
      "Scarborough-Guildwood": "#C4ABAB",
      "Humber River-Black Creek": "#AB5850",
      "Scarborough North": "#C4ABAB",
    };

    const addDots = function (map) {

      // Add a data source containing GeoJSON data.
      map.addSource('buildings', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pipeline.map(o => {
            return {
              type: 'Feature',
              "properties": {
                "height": hScale(o.units),
                "base_height": 0,
                "color": colors$1[o.ward] || "lightgrey"
              },
              geometry: {
                type: 'Polygon',
                coordinates: makeBox([o.geo.lng, o.geo.lat]),
              }
            }
          })

        },
      });


      map.addLayer({
        'id': 'dots',
        'type': 'fill-extrusion',
        'source': 'buildings',
        'paint': {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base_height'],
          'fill-extrusion-opacity': 0.9
        }
      });

    };

    var wards = {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [180, 90],
            [-180, 90],
            [-180, -90],
            [180, -90],
            [180, 90],
          ],
          [
            [
              -79.6392649324429,
              43.7498707479426
            ],
            [
              -79.6376119524667,
              43.7483009597757
            ],
            [
              -79.63690857296922,
              43.747136895347
            ],
            [
              -79.6366395622805,
              43.7464841526325
            ],
            [
              -79.6356625935042,
              43.7446205357672
            ],
            [
              -79.6341306133891,
              43.7420748204539
            ],
            [
              -79.6314880673702,
              43.737534615727
            ],
            [
              -79.631346766638,
              43.7370297285756
            ],
            [
              -79.6303547109175,
              43.7354695478806
            ],
            [
              -79.629260372833,
              43.7346389423447
            ],
            [
              -79.62897049812102,
              43.7338072233035
            ],
            [
              -79.6281816698101,
              43.7335293065926
            ],
            [
              -79.6278393000436,
              43.7332549005057
            ],
            [
              -79.6269454871014,
              43.7314240112182
            ],
            [
              -79.6266396192809,
              43.730060627669
            ],
            [
              -79.626322420991,
              43.7290342707815
            ],
            [
              -79.625430905688,
              43.7273479616418
            ],
            [
              -79.6203399873422,
              43.7183793008029
            ],
            [
              -79.6191476713094,
              43.7162516271379
            ],
            [
              -79.6155643082986,
              43.710166754135
            ],
            [
              -79.6132234260489,
              43.706271070269
            ],
            [
              -79.6097445928854,
              43.7007699305929
            ],
            [
              -79.6072497398261,
              43.696924267763
            ],
            [
              -79.6058845771872,
              43.6946798539543
            ],
            [
              -79.6043923941018,
              43.6920170238349
            ],
            [
              -79.602993747828,
              43.6892661010413
            ],
            [
              -79.60219054037671,
              43.6877974496568
            ],
            [
              -79.6014616540281,
              43.68668618606821
            ],
            [
              -79.6001496835619,
              43.6851074430882
            ],
            [
              -79.5999540271655,
              43.6837251306252
            ],
            [
              -79.5947473748081,
              43.6750176692098
            ],
            [
              -79.5945516762254,
              43.6742113487651
            ],
            [
              -79.5910867990462,
              43.6685878284164
            ],
            [
              -79.5904868648261,
              43.6675094771409
            ],
            [
              -79.5899612422856,
              43.6668231442077
            ],
            [
              -79.5887784056154,
              43.6646223420356
            ],
            [
              -79.5956806091768,
              43.6582880278361
            ],
            [
              -79.5984101019578,
              43.65583422897281
            ],
            [
              -79.608734677802,
              43.6464513180578
            ],
            [
              -79.6081656116201,
              43.6458212761433
            ],
            [
              -79.607683357736,
              43.6449385261636
            ],
            [
              -79.6071596410596,
              43.6446959453156
            ],
            [
              -79.6056082023461,
              43.6448328057016
            ],
            [
              -79.6050051852386,
              43.6444739545067
            ],
            [
              -79.6039720753034,
              43.6445050263854
            ],
            [
              -79.6033406409018,
              43.6447127744638
            ],
            [
              -79.6024811609222,
              43.6445252665423
            ],
            [
              -79.6019893568293,
              43.6441258475055
            ],
            [
              -79.5992188918142,
              43.6436891537729
            ],
            [
              -79.5983773398603,
              43.6431003092407
            ],
            [
              -79.5967290709474,
              43.6430387152024
            ],
            [
              -79.5956284959256,
              43.6432061755429
            ],
            [
              -79.5950506036744,
              43.6434676972857
            ],
            [
              -79.5935085048134,
              43.6444051206666
            ],
            [
              -79.5924526407722,
              43.6447165267285
            ],
            [
              -79.5918098438861,
              43.6446045276568
            ],
            [
              -79.5903776118865,
              43.6440025861263
            ],
            [
              -79.5893067737029,
              43.6431483064118
            ],
            [
              -79.5887020135614,
              43.64282473685691
            ],
            [
              -79.5880797675962,
              43.6419475930762
            ],
            [
              -79.5882173137965,
              43.6414569121051
            ],
            [
              -79.5873801791213,
              43.6406474402513
            ],
            [
              -79.5869372782967,
              43.6394911099755
            ],
            [
              -79.5862870447055,
              43.6385014689571
            ],
            [
              -79.5856163453577,
              43.6377998835857
            ],
            [
              -79.5852630927809,
              43.6369585274457
            ],
            [
              -79.5860533928455,
              43.6354457118936
            ],
            [
              -79.5859899383431,
              43.6349416820917
            ],
            [
              -79.5855064722142,
              43.6343119567329
            ],
            [
              -79.58583355421,
              43.6336410903025
            ],
            [
              -79.58534645248521,
              43.6329033501915
            ],
            [
              -79.5850553371865,
              43.6316433726355
            ],
            [
              -79.5851410858316,
              43.6312157427427
            ],
            [
              -79.58600336342471,
              43.6297381578499
            ],
            [
              -79.58599786607452,
              43.6294112673719
            ],
            [
              -79.5855901572194,
              43.62891926008731
            ],
            [
              -79.5837396969582,
              43.6282913519993
            ],
            [
              -79.582414847427,
              43.6279503067416
            ],
            [
              -79.5817813100068,
              43.6279597811136
            ],
            [
              -79.5805881674285,
              43.6276096009698
            ],
            [
              -79.5797062832202,
              43.626921621341204
            ],
            [
              -79.5767534560018,
              43.6261405743158
            ],
            [
              -79.5755805807942,
              43.6255562647788
            ],
            [
              -79.5745086881419,
              43.6255299732179
            ],
            [
              -79.5736925627655,
              43.6259760985179
            ],
            [
              -79.5724605976547,
              43.6261524223163
            ],
            [
              -79.5705696868422,
              43.6267927045286
            ],
            [
              -79.5697949910604,
              43.626982200484
            ],
            [
              -79.5685857329421,
              43.6267443953196
            ],
            [
              -79.5677018983598,
              43.6273210206248
            ],
            [
              -79.5674377512439,
              43.6280052829175
            ],
            [
              -79.5668617232265,
              43.62821715408
            ],
            [
              -79.56479212432691,
              43.6281598367137
            ],
            [
              -79.5639025479781,
              43.6277803164769
            ],
            [
              -79.5637603220542,
              43.6270261958096
            ],
            [
              -79.5634614752462,
              43.6264420183159
            ],
            [
              -79.5636018205713,
              43.6248884696888
            ],
            [
              -79.5642615589661,
              43.6243885139429
            ],
            [
              -79.56508580734442,
              43.6245815867887
            ],
            [
              -79.5656115130545,
              43.6240411931447
            ],
            [
              -79.5659037860801,
              43.6225242524724
            ],
            [
              -79.565548658927,
              43.6217773129728
            ],
            [
              -79.5656528881072,
              43.621480206749304
            ],
            [
              -79.56681892169,
              43.6208674174729
            ],
            [
              -79.5669262082913,
              43.6205523054381
            ],
            [
              -79.5667450548659,
              43.6199313051479
            ],
            [
              -79.5668236421643,
              43.6188645741524
            ],
            [
              -79.5665102195911,
              43.6179511046525
            ],
            [
              -79.5669686541703,
              43.6172892241817
            ],
            [
              -79.5678508018179,
              43.6167801241472
            ],
            [
              -79.567825714082,
              43.6161860366704
            ],
            [
              -79.56833903819171,
              43.6145024481026
            ],
            [
              -79.5682941833462,
              43.6142234309512
            ],
            [
              -79.5677121756653,
              43.613778197935
            ],
            [
              -79.566536385265,
              43.6134323426664
            ],
            [
              -79.5648626840304,
              43.61338380571771
            ],
            [
              -79.56408674817682,
              43.6129836801434
            ],
            [
              -79.5639484204595,
              43.6125336865783
            ],
            [
              -79.5642159914611,
              43.6122409814071
            ],
            [
              -79.5652828794248,
              43.6117569557945
            ],
            [
              -79.5661453524044,
              43.6110696604886
            ],
            [
              -79.5671692674104,
              43.6106647375411
            ],
            [
              -79.5673336638491,
              43.61022279692801
            ],
            [
              -79.5672737183703,
              43.609601715893
            ],
            [
              -79.5669969783086,
              43.6089537577337
            ],
            [
              -79.5666447684118,
              43.6086794290846
            ],
            [
              -79.5655466432163,
              43.6086406827223
            ],
            [
              -79.5648040920637,
              43.6083834852034
            ],
            [
              -79.564638166016,
              43.6078029870406
            ],
            [
              -79.5648729052982,
              43.6072177522052
            ],
            [
              -79.5642265695321,
              43.606988598695
            ],
            [
              -79.5626406853583,
              43.6067194807543
            ],
            [
              -79.5618664264614,
              43.6060445700384
            ],
            [
              -79.5604576364042,
              43.6054597355961
            ],
            [
              -79.5592627567759,
              43.6047545319023
            ],
            [
              -79.5583362720758,
              43.6037693333931
            ],
            [
              -79.557604584038,
              43.6032611143235
            ],
            [
              -79.556311083331,
              43.6025686391816
            ],
            [
              -79.5561497252577,
              43.602213161786
            ],
            [
              -79.5562518632238,
              43.6014129197549
            ],
            [
              -79.5560091974546,
              43.6008900012885
            ],
            [
              -79.5558334280694,
              43.5999854335394
            ],
            [
              -79.5553831446087,
              43.5994230714867
            ],
            [
              -79.5542917798842,
              43.5991175909585
            ],
            [
              -79.5536707799422,
              43.5984742990324
            ],
            [
              -79.5534845101654,
              43.5979027856554
            ],
            [
              -79.5539542240828,
              43.5963318397424
            ],
            [
              -79.5537118815292,
              43.5957648896993
            ],
            [
              -79.5529669840787,
              43.5954187085046
            ],
            [
              -79.5521061449384,
              43.5953021032687
            ],
            [
              -79.5512303175155,
              43.5953250117125
            ],
            [
              -79.549114722288,
              43.5951603855203
            ],
            [
              -79.5487324653008,
              43.594853545692
            ],
            [
              -79.5486576890478,
              43.5942144656307
            ],
            [
              -79.548768294082,
              43.59362481450031
            ],
            [
              -79.5494240961002,
              43.5924408779659
            ],
            [
              -79.5495707057377,
              43.5918827513988
            ],
            [
              -79.5495470658683,
              43.5906173371568
            ],
            [
              -79.54934886276011,
              43.5903382157258
            ],
            [
              -79.5484764600024,
              43.5901729801785
            ],
            [
              -79.5464074329289,
              43.5889304044527
            ],
            [
              -79.54815794509442,
              43.5869967340056
            ],
            [
              -79.54465152682852,
              43.58527706857001
            ],
            [
              -79.5438825698345,
              43.581392216061
            ],
            [
              -79.5434064053223,
              43.5809960000775
            ],
            [
              -79.5425650170297,
              43.5830372195517
            ],
            [
              -79.54210586640882,
              43.5837845203418
            ],
            [
              -79.5411039789549,
              43.5846379898581
            ],
            [
              -79.5410157581715,
              43.5848875511511
            ],
            [
              -79.5398920097531,
              43.58615266343731
            ],
            [
              -79.5393586545046,
              43.586602894411
            ],
            [
              -79.5371092462848,
              43.5880287129564
            ],
            [
              -79.5360085916359,
              43.5881747175384
            ],
            [
              -79.5354230427398,
              43.5881208917072
            ],
            [
              -79.5340024505072,
              43.5877891691677
            ],
            [
              -79.5334857440994,
              43.5881079823591
            ],
            [
              -79.5311094772172,
              43.5885722378178
            ],
            [
              -79.5306714009165,
              43.58787023334071
            ],
            [
              -79.5298304960457,
              43.5878929684965
            ],
            [
              -79.5292451471249,
              43.5882351752002
            ],
            [
              -79.5285280778936,
              43.5891040061567
            ],
            [
              -79.5278366612732,
              43.589464234909904
            ],
            [
              -79.5272325728757,
              43.5896129134491
            ],
            [
              -79.5247766194712,
              43.589748493937
            ],
            [
              -79.5233343268125,
              43.5899963374761
            ],
            [
              -79.5198377456312,
              43.5902130236246
            ],
            [
              -79.5185660076543,
              43.590720325244
            ],
            [
              -79.5182041995343,
              43.5903888148006
            ],
            [
              -79.51723476128,
              43.5905599747153
            ],
            [
              -79.516534537025,
              43.5900875016782
            ],
            [
              -79.516101561441,
              43.58911087834791
            ],
            [
              -79.5154795123504,
              43.5889083864448
            ],
            [
              -79.5149144736353,
              43.5889695454502
            ],
            [
              -79.5150475687576,
              43.58938699763101
            ],
            [
              -79.5156531162795,
              43.5894095729945
            ],
            [
              -79.5154212599593,
              43.59012729067971
            ],
            [
              -79.5129876125491,
              43.5906657541034
            ],
            [
              -79.5116151750561,
              43.5902876875998
            ],
            [
              -79.5110805397432,
              43.5890911229466
            ],
            [
              -79.5113068049194,
              43.5886160758217
            ],
            [
              -79.51214707824631,
              43.5883240093003
            ],
            [
              -79.5122007595088,
              43.5879435658913
            ],
            [
              -79.5130750124087,
              43.5877090712265
            ],
            [
              -79.5135334464753,
              43.587996947584
            ],
            [
              -79.5146622959979,
              43.58762876567971
            ],
            [
              -79.515273547157,
              43.5879947750398
            ],
            [
              -79.5168604202132,
              43.5884237416198
            ],
            [
              -79.5170477301782,
              43.5882644330193
            ],
            [
              -79.51577282522,
              43.5879107776353
            ],
            [
              -79.5145804082462,
              43.587189486860304
            ],
            [
              -79.51402912409,
              43.58706316632
            ],
            [
              -79.5131598505388,
              43.587072469178
            ],
            [
              -79.5119128325824,
              43.5872891450687
            ],
            [
              -79.5108792435453,
              43.5873319780318
            ],
            [
              -79.5096212582243,
              43.5871957096828
            ],
            [
              -79.5094521610791,
              43.587674268449206
            ],
            [
              -79.5100664343323,
              43.5877838447984
            ],
            [
              -79.5104656429694,
              43.5883291984007
            ],
            [
              -79.5103599311645,
              43.5891745440194
            ],
            [
              -79.5097395072875,
              43.5900268745452
            ],
            [
              -79.5087256590782,
              43.5902364563197
            ],
            [
              -79.5088468461555,
              43.5905425955309
            ],
            [
              -79.5101004172621,
              43.5907585265913
            ],
            [
              -79.51087196119582,
              43.5910429198153
            ],
            [
              -79.510826905925,
              43.5917284658691
            ],
            [
              -79.5103272015756,
              43.5923689025076
            ],
            [
              -79.5096688229825,
              43.5923755581491
            ],
            [
              -79.5097652046148,
              43.5927856291368
            ],
            [
              -79.5104381863805,
              43.59290566704891
            ],
            [
              -79.5107632170852,
              43.593422509272
            ],
            [
              -79.5105821639297,
              43.593710959672
            ],
            [
              -79.5096814281954,
              43.5937515460261
            ],
            [
              -79.5089313842543,
              43.5939136151914
            ],
            [
              -79.5086294765832,
              43.5937426018136
            ],
            [
              -79.5070608517855,
              43.5941611598845
            ],
            [
              -79.5064117613319,
              43.594116145872
            ],
            [
              -79.50618565779261,
              43.593481538048
            ],
            [
              -79.5056588957176,
              43.5935175261328
            ],
            [
              -79.5048601053817,
              43.5942466713799
            ],
            [
              -79.5037318530215,
              43.59421967342
            ],
            [
              -79.5023203057964,
              43.5944852445522
            ],
            [
              -79.50091801392442,
              43.5949938462963
            ],
            [
              -79.5003889094817,
              43.5953989235066
            ],
            [
              -79.5003067995439,
              43.5962495875548
            ],
            [
              -79.4995620170387,
              43.5975323291697
            ],
            [
              -79.4993077114119,
              43.5977528723087
            ],
            [
              -79.4983628322392,
              43.5980544110654
            ],
            [
              -79.4978630860199,
              43.5985134674422
            ],
            [
              -79.4981858575097,
              43.5995036316971
            ],
            [
              -79.4979152216045,
              43.6002102312135
            ],
            [
              -79.4965374598498,
              43.6015513852776
            ],
            [
              -79.4959517611735,
              43.6019519390388
            ],
            [
              -79.4949332644359,
              43.6021994469743
            ],
            [
              -79.4930689710267,
              43.602010363967
            ],
            [
              -79.4925054345067,
              43.602270469958704
            ],
            [
              -79.49249828832681,
              43.6026617619587
            ],
            [
              -79.490578482485,
              43.6044630501114
            ],
            [
              -79.49018976789182,
              43.60496258797401
            ],
            [
              -79.4894642485688,
              43.6055296136714
            ],
            [
              -79.4891195918666,
              43.6063757069523
            ],
            [
              -79.48854313015131,
              43.60674921000451
            ],
            [
              -79.4879937241854,
              43.6073927558542
            ],
            [
              -79.4875631079146,
              43.6082073301078
            ],
            [
              -79.4872986877083,
              43.6083288203128
            ],
            [
              -79.4869733623084,
              43.6093346751686
            ],
            [
              -79.4865353265029,
              43.6096874983154
            ],
            [
              -79.4867313746737,
              43.6107351250586
            ],
            [
              -79.4867841608109,
              43.6118139877396
            ],
            [
              -79.4865465352973,
              43.6126444131778
            ],
            [
              -79.4870275385939,
              43.6129517142637
            ],
            [
              -79.4866899607179,
              43.613597905401
            ],
            [
              -79.486292323828,
              43.6135970302837
            ],
            [
              -79.4859390348412,
              43.6139885401081
            ],
            [
              -79.4859710009734,
              43.6143515982493
            ],
            [
              -79.4853304134571,
              43.615653257797
            ],
            [
              -79.4852061294625,
              43.6163843727636
            ],
            [
              -79.484393670375,
              43.6176339130496
            ],
            [
              -79.4831384924993,
              43.6183959564152
            ],
            [
              -79.4825333170356,
              43.6184367589685
            ],
            [
              -79.48163157209521,
              43.6187682656442
            ],
            [
              -79.4812219812268,
              43.6185309218941
            ],
            [
              -79.48117556019942,
              43.6180404903283
            ],
            [
              -79.4805613706696,
              43.6183779495012
            ],
            [
              -79.4788469134069,
              43.6170904430837
            ],
            [
              -79.4800606043648,
              43.6161680072105
            ],
            [
              -79.4804264719501,
              43.6161905739762
            ],
            [
              -79.4805478134712,
              43.6156955078209
            ],
            [
              -79.480127790018,
              43.6154614077585
            ],
            [
              -79.4804236293261,
              43.6141067364567
            ],
            [
              -79.48083867736901,
              43.6140257940074
            ],
            [
              -79.4819316079954,
              43.6140979743158
            ],
            [
              -79.4827009116227,
              43.6139585713238
            ],
            [
              -79.4833244239834,
              43.6147372776504
            ],
            [
              -79.483733495977,
              43.6138011890763
            ],
            [
              -79.4841443856268,
              43.6133016770204
            ],
            [
              -79.4840298511392,
              43.6130631234453
            ],
            [
              -79.48278920914481,
              43.6123923555549
            ],
            [
              -79.4826194525805,
              43.6130584260118
            ],
            [
              -79.4817908648738,
              43.6133688460293
            ],
            [
              -79.4805759954989,
              43.6133596446509
            ],
            [
              -79.4802911344381,
              43.613062558036304
            ],
            [
              -79.4799568917259,
              43.6122883867298
            ],
            [
              -79.4794366911265,
              43.6119192360507
            ],
            [
              -79.4789294773904,
              43.61209017070931
            ],
            [
              -79.47890577155731,
              43.6123917139604
            ],
            [
              -79.4792779949225,
              43.6130308829145
            ],
            [
              -79.4787410525527,
              43.6140749489895
            ],
            [
              -79.4782786596454,
              43.6144394195138
            ],
            [
              -79.477284559584,
              43.6141916963094
            ],
            [
              -79.476923628569,
              43.6144481734461
            ],
            [
              -79.4775485269116,
              43.6151110542487
            ],
            [
              -79.4770364979578,
              43.6160653727134
            ],
            [
              -79.475913311093,
              43.6173802572409
            ],
            [
              -79.4751941451358,
              43.6179875188022
            ],
            [
              -79.4758246195644,
              43.6181981969005
            ],
            [
              -79.47673252890291,
              43.6174602784472
            ],
            [
              -79.4772739662552,
              43.6173516322854
            ],
            [
              -79.4783375106112,
              43.6179184867138
            ],
            [
              -79.4788402378225,
              43.6186026881856
            ],
            [
              -79.4783243469938,
              43.6191066705576
            ],
            [
              -79.47767719475041,
              43.6184134373562
            ],
            [
              -79.4772710761206,
              43.6183143418037
            ],
            [
              -79.476665052906,
              43.6185527661236
            ],
            [
              -79.4764794765642,
              43.6188992824292
            ],
            [
              -79.4771293145005,
              43.619610516707205
            ],
            [
              -79.4778335616752,
              43.6197141716407
            ],
            [
              -79.4789826282242,
              43.6201554577273
            ],
            [
              -79.4803951138219,
              43.6210724571131
            ],
            [
              -79.4801326928148,
              43.6213796838514
            ],
            [
              -79.479532747521,
              43.6210666530891
            ],
            [
              -79.4795060937371,
              43.621691967066
            ],
            [
              -79.4785578180926,
              43.62150108933441
            ],
            [
              -79.4775433188162,
              43.6215819162148
            ],
            [
              -79.4770495245067,
              43.62080769711171
            ],
            [
              -79.477235594227,
              43.6204083238237
            ],
            [
              -79.4770579072371,
              43.6201055889248
            ],
            [
              -79.4756173597159,
              43.6196417361709
            ],
            [
              -79.4753078843803,
              43.6189260576172
            ],
            [
              -79.4748971667281,
              43.6187144440079
            ],
            [
              -79.4744046405644,
              43.6188538746739
            ],
            [
              -79.4743452600239,
              43.6192499234386
            ],
            [
              -79.4748211257673,
              43.6201771654399
            ],
            [
              -79.4743903558926,
              43.6208071863513
            ],
            [
              -79.47323832965381,
              43.6220581540569
            ],
            [
              -79.4727774689504,
              43.6223325971224
            ],
            [
              -79.4704673922664,
              43.6225616225438
            ],
            [
              -79.4696160244636,
              43.6223768886308
            ],
            [
              -79.4692024123316,
              43.6225613157647
            ],
            [
              -79.4692274031704,
              43.6229528836083
            ],
            [
              -79.469910070545,
              43.6237181846699
            ],
            [
              -79.470211195857,
              43.6248524402474
            ],
            [
              -79.4706678931338,
              43.6253296326039
            ],
            [
              -79.471978775172,
              43.624965368681
            ],
            [
              -79.4715585106733,
              43.6243351667612
            ],
            [
              -79.4723979428326,
              43.6234892136242
            ],
            [
              -79.4733850701713,
              43.6232163000954
            ],
            [
              -79.4740613981299,
              43.6225724950573
            ],
            [
              -79.4745702381531,
              43.6226948214551
            ],
            [
              -79.4753764892578,
              43.6232044774592
            ],
            [
              -79.4765716976684,
              43.6235535330515
            ],
            [
              -79.4768534994517,
              43.6238961838694
            ],
            [
              -79.4763525341305,
              43.6247315285095
            ],
            [
              -79.4766462157641,
              43.6247740034865
            ],
            [
              -79.4762354429252,
              43.6257533702761
            ],
            [
              -79.4760708222685,
              43.6264711885564
            ],
            [
              -79.475590344088,
              43.6272488798116
            ],
            [
              -79.4753671380535,
              43.6280197926058
            ],
            [
              -79.474770036563,
              43.6288378622763
            ],
            [
              -79.4736409214633,
              43.6296477060247
            ],
            [
              -79.4726066947335,
              43.6296827843502
            ],
            [
              -79.4723741756082,
              43.6304187363299
            ],
            [
              -79.4719454208419,
              43.63068709844941
            ],
            [
              -79.470858635823,
              43.6306866825575
            ],
            [
              -79.4708363113973,
              43.6309800412363
            ],
            [
              -79.4714479256399,
              43.6314425070986
            ],
            [
              -79.4712285274822,
              43.631699270778
            ],
            [
              -79.4709151922421,
              43.6320034384896
            ],
            [
              -79.4702971696033,
              43.6322199430431
            ],
            [
              -79.46923703913801,
              43.6327774967905
            ],
            [
              -79.4687671452691,
              43.6331671205093
            ],
            [
              -79.4683897431303,
              43.63375397028351
            ],
            [
              -79.4678325804732,
              43.63413440251771
            ],
            [
              -79.4667097757013,
              43.6344797343111
            ],
            [
              -79.46580611485271,
              43.6346411414858
            ],
            [
              -79.465035851797,
              43.6352289600194
            ],
            [
              -79.4639120891753,
              43.6357057922048
            ],
            [
              -79.4630385469775,
              43.6357808366919
            ],
            [
              -79.4626133410201,
              43.635673960007004
            ],
            [
              -79.46185896606012,
              43.63629056664911
            ],
            [
              -79.461256378142,
              43.6363616729731
            ],
            [
              -79.4601892925035,
              43.6367608147296
            ],
            [
              -79.4586645794401,
              43.6367922915052
            ],
            [
              -79.4578993565609,
              43.63717593921311
            ],
            [
              -79.4563743615098,
              43.6372041448388
            ],
            [
              -79.4552313714824,
              43.6374782990929
            ],
            [
              -79.4538319182158,
              43.6372954915035
            ],
            [
              -79.4525925455566,
              43.6367268170047
            ],
            [
              -79.451043120729,
              43.6364932711799
            ],
            [
              -79.4497550217066,
              43.6365200764964
            ],
            [
              -79.4492370909813,
              43.636179073312604
            ],
            [
              -79.4476412898037,
              43.6365328910426
            ],
            [
              -79.446747870465,
              43.6363161301119
            ],
            [
              -79.4439132452861,
              43.6351538660021
            ],
            [
              -79.4432248569311,
              43.6347150777054
            ],
            [
              -79.4420043856851,
              43.6349480600135
            ],
            [
              -79.4411410113958,
              43.6348739964159
            ],
            [
              -79.4399953173539,
              43.634228424473704
            ],
            [
              -79.4400062461706,
              43.6339065406156
            ],
            [
              -79.4392908053542,
              43.6335700781164
            ],
            [
              -79.4393578345295,
              43.6332300232549
            ],
            [
              -79.436942579939,
              43.63216607555271
            ],
            [
              -79.4358422282108,
              43.6318114566401
            ],
            [
              -79.4350802334675,
              43.6313995908885
            ],
            [
              -79.4334849415635,
              43.630825366193
            ],
            [
              -79.4317202805512,
              43.6304330083023
            ],
            [
              -79.4294813569131,
              43.63002360698861
            ],
            [
              -79.4277754764607,
              43.629793474517
            ],
            [
              -79.4259640354286,
              43.6296573398357
            ],
            [
              -79.4201395041337,
              43.6301301961376
            ],
            [
              -79.4186976838766,
              43.6294982451583
            ],
            [
              -79.4184275974182,
              43.6294961894685
            ],
            [
              -79.4180323723606,
              43.6282277722599
            ],
            [
              -79.4190334795977,
              43.6278714002904
            ],
            [
              -79.4193506552455,
              43.6281461670748
            ],
            [
              -79.4193953456288,
              43.629190378439205
            ],
            [
              -79.4200504987752,
              43.6292538212564
            ],
            [
              -79.4224664079757,
              43.6290618383046
            ],
            [
              -79.4220533021724,
              43.6283909714469
            ],
            [
              -79.4225440272579,
              43.6277341850621
            ],
            [
              -79.4223859998322,
              43.6274595442783
            ],
            [
              -79.4213771433781,
              43.6275354027725
            ],
            [
              -79.4204594105194,
              43.6272287474188
            ],
            [
              -79.4200139206804,
              43.626755881206
            ],
            [
              -79.4194588284729,
              43.626890530451
            ],
            [
              -79.4186349803506,
              43.626750452393
            ],
            [
              -79.418375914036,
              43.6270293200526
            ],
            [
              -79.4177541694152,
              43.6269118832685
            ],
            [
              -79.4178333463407,
              43.62734400728931
            ],
            [
              -79.4173341771496,
              43.6279242645219
            ],
            [
              -79.4161950598646,
              43.6281035080669
            ],
            [
              -79.4156326609556,
              43.6276440321861
            ],
            [
              -79.4154553603797,
              43.6270588013799
            ],
            [
              -79.414366294601,
              43.6271750539529
            ],
            [
              -79.4133136232645,
              43.6270212728243
            ],
            [
              -79.4128085627911,
              43.6273539674408
            ],
            [
              -79.4114602776154,
              43.6272989587752
            ],
            [
              -79.4110469976734,
              43.6273751678244
            ],
            [
              -79.4103768397526,
              43.62779774605941
            ],
            [
              -79.4100302394061,
              43.6283285921811
            ],
            [
              -79.4102388923475,
              43.6291389177556
            ],
            [
              -79.4098760763184,
              43.6293861886458
            ],
            [
              -79.4091521369427,
              43.6295161538464
            ],
            [
              -79.4094608196914,
              43.6310160397365
            ],
            [
              -79.4096320817863,
              43.6312249535134
            ],
            [
              -79.4087925320673,
              43.6317001632942
            ],
            [
              -79.4086244122116,
              43.6330664039131
            ],
            [
              -79.4066484102976,
              43.6328512944726
            ],
            [
              -79.405063443553,
              43.6331162682793
            ],
            [
              -79.4029433249194,
              43.6314673777376
            ],
            [
              -79.4028763695927,
              43.63118895286261
            ],
            [
              -79.4023342669007,
              43.6310362774904
            ],
            [
              -79.3988630444965,
              43.6328769598804
            ],
            [
              -79.3982779902794,
              43.6329550589135
            ],
            [
              -79.3978540749822,
              43.6326778792284
            ],
            [
              -79.3987655310305,
              43.6315514189895
            ],
            [
              -79.4027981706151,
              43.6293444560756
            ],
            [
              -79.4048993790719,
              43.6278384356606
            ],
            [
              -79.4042866474789,
              43.6264410874429
            ],
            [
              -79.4033497559452,
              43.6266561887355
            ],
            [
              -79.4013600684978,
              43.6253943833933
            ],
            [
              -79.3998895928315,
              43.6243334782285
            ],
            [
              -79.39851387283642,
              43.6231843343451
            ],
            [
              -79.39801516213322,
              43.622575566645
            ],
            [
              -79.3954961465048,
              43.620734898536
            ],
            [
              -79.3944706554178,
              43.6198606668943
            ],
            [
              -79.3934340167476,
              43.6187066156912
            ],
            [
              -79.3919193737047,
              43.6166509814803
            ],
            [
              -79.3916147358676,
              43.6161071066609
            ],
            [
              -79.3916141534939,
              43.6150586392325
            ],
            [
              -79.3908515610217,
              43.6145075760718
            ],
            [
              -79.389936811102,
              43.6136556870088
            ],
            [
              -79.3896112361239,
              43.6130417193599
            ],
            [
              -79.3897639442667,
              43.6123008518077
            ],
            [
              -79.3889590268805,
              43.6119761026854
            ],
            [
              -79.38806906395442,
              43.6121157919911
            ],
            [
              -79.3868070259763,
              43.6120972936603
            ],
            [
              -79.3848970206598,
              43.6119634617379
            ],
            [
              -79.3840152878856,
              43.6120124384553
            ],
            [
              -79.3830329528703,
              43.6122109000988
            ],
            [
              -79.3820636578514,
              43.6122566396451
            ],
            [
              -79.3808736700349,
              43.6131050498703
            ],
            [
              -79.379761088599,
              43.6137006071719
            ],
            [
              -79.3789937626234,
              43.6137748243764
            ],
            [
              -79.3779639030311,
              43.6140551409907
            ],
            [
              -79.3770757960337,
              43.6144726023888
            ],
            [
              -79.3760824816177,
              43.614436550507
            ],
            [
              -79.3737147004097,
              43.6158463626319
            ],
            [
              -79.3723353141221,
              43.6164702668372
            ],
            [
              -79.3719448395172,
              43.6163381484364
            ],
            [
              -79.3711697556205,
              43.6171475398339
            ],
            [
              -79.370493424694,
              43.6175982595047
            ],
            [
              -79.3675863513867,
              43.6189035094274
            ],
            [
              -79.3664531220754,
              43.619338102491
            ],
            [
              -79.3633207811359,
              43.6215892619876
            ],
            [
              -79.3620852358659,
              43.6223973914765
            ],
            [
              -79.3589299040671,
              43.6246295617448
            ],
            [
              -79.3578217925513,
              43.6254492066633
            ],
            [
              -79.3567762519894,
              43.6264102860815
            ],
            [
              -79.3559408320384,
              43.6273138227813
            ],
            [
              -79.355175771946,
              43.6284244744651
            ],
            [
              -79.3544121352382,
              43.6297705810501
            ],
            [
              -79.3532673362382,
              43.6298764319882
            ],
            [
              -79.3509907301687,
              43.6298154912369
            ],
            [
              -79.3497604744627,
              43.6296396320818
            ],
            [
              -79.3495339685719,
              43.6309062440365
            ],
            [
              -79.3493872836886,
              43.6310230779534
            ],
            [
              -79.3525152582638,
              43.6337126393982
            ],
            [
              -79.349647800299,
              43.6333942966004
            ],
            [
              -79.3470841780091,
              43.6332016059977
            ],
            [
              -79.3470266114685,
              43.6341693850197
            ],
            [
              -79.3465624133464,
              43.6347238333161
            ],
            [
              -79.3455101015291,
              43.6349925025937
            ],
            [
              -79.3450633225912,
              43.63554141440561
            ],
            [
              -79.3442017217549,
              43.6362101083082
            ],
            [
              -79.3432444747351,
              43.6372351101977
            ],
            [
              -79.3424166310304,
              43.6377223779156
            ],
            [
              -79.3416016259929,
              43.6380022656124
            ],
            [
              -79.3415816912667,
              43.6384052207194
            ],
            [
              -79.3406485042618,
              43.6391130522775
            ],
            [
              -79.3392089114386,
              43.6393790615108
            ],
            [
              -79.3374115608223,
              43.6393995538672
            ],
            [
              -79.336505510174,
              43.6392087826524
            ],
            [
              -79.3363890654187,
              43.6394146125684
            ],
            [
              -79.337354787119,
              43.6400687074356
            ],
            [
              -79.3373730147543,
              43.6403415200555
            ],
            [
              -79.333860426318,
              43.6435590865656
            ],
            [
              -79.33353244923,
              43.6439501870299
            ],
            [
              -79.3323361884113,
              43.6449565830771
            ],
            [
              -79.3309579742482,
              43.64588161319891
            ],
            [
              -79.3304531607182,
              43.6465874098193
            ],
            [
              -79.3288741482392,
              43.6474135336154
            ],
            [
              -79.3282119453724,
              43.6476351891416
            ],
            [
              -79.3272952018116,
              43.6472410063068
            ],
            [
              -79.3273884135604,
              43.6470481038289
            ],
            [
              -79.325800593322,
              43.6468412022612
            ],
            [
              -79.3255964955847,
              43.6465671955592
            ],
            [
              -79.3253599461881,
              43.6456348059853
            ],
            [
              -79.3268227780294,
              43.6439759009155
            ],
            [
              -79.3272959249159,
              43.6439988770911
            ],
            [
              -79.3282398347998,
              43.6443511545787
            ],
            [
              -79.3271611845698,
              43.6432783028154
            ],
            [
              -79.3272042501182,
              43.642493799409
            ],
            [
              -79.3275973881499,
              43.642165851905
            ],
            [
              -79.3274119591344,
              43.6417681795085
            ],
            [
              -79.3276805151202,
              43.641191974666
            ],
            [
              -79.3286629356806,
              43.6408621917629
            ],
            [
              -79.3285605537321,
              43.6406277324881
            ],
            [
              -79.3289066198997,
              43.6401129762354
            ],
            [
              -79.3298737653115,
              43.6398028100017
            ],
            [
              -79.3297294630232,
              43.6394541698845
            ],
            [
              -79.33008223325331,
              43.6389602851425
            ],
            [
              -79.3308597316998,
              43.6388019607439
            ],
            [
              -79.3302970005994,
              43.6382686592393
            ],
            [
              -79.330233889721,
              43.637885790901606
            ],
            [
              -79.3294780297447,
              43.6370577451663
            ],
            [
              -79.3289181820838,
              43.6372611410133
            ],
            [
              -79.3285871381835,
              43.6376724402304
            ],
            [
              -79.32886084202092,
              43.6381104703536
            ],
            [
              -79.3277269283793,
              43.6392155316113
            ],
            [
              -79.32679021250141,
              43.6403573179261
            ],
            [
              -79.3262423382625,
              43.640284466486506
            ],
            [
              -79.3250550957606,
              43.639904588982006
            ],
            [
              -79.3247525300767,
              43.6401966792577
            ],
            [
              -79.3262970315575,
              43.6407976459734
            ],
            [
              -79.3253275311595,
              43.6422724659406
            ],
            [
              -79.3244607095134,
              43.6442470560163
            ],
            [
              -79.3245811308147,
              43.644395772453706
            ],
            [
              -79.3243223243259,
              43.6452055431525
            ],
            [
              -79.3216831921554,
              43.6448233544955
            ],
            [
              -79.3217441104305,
              43.6437477409237
            ],
            [
              -79.3219464505958,
              43.6433024704398
            ],
            [
              -79.3223589772359,
              43.6414622506756
            ],
            [
              -79.32262350268411,
              43.6412061132798
            ],
            [
              -79.3225997070174,
              43.6404724283468
            ],
            [
              -79.3229948908432,
              43.6389787674924
            ],
            [
              -79.3229740717941,
              43.638281110475106
            ],
            [
              -79.3234019327958,
              43.637530130094206
            ],
            [
              -79.3244682208688,
              43.6364560893693
            ],
            [
              -79.3253276037919,
              43.6358810742333
            ],
            [
              -79.3261823206466,
              43.6355776802128
            ],
            [
              -79.326323065381,
              43.6350039209308
            ],
            [
              -79.3269562490307,
              43.6348853697679
            ],
            [
              -79.3275071433981,
              43.634505110735
            ],
            [
              -79.3281023198986,
              43.634352425617
            ],
            [
              -79.3290936972304,
              43.6336251058755
            ],
            [
              -79.3289487962915,
              43.6334418639751
            ],
            [
              -79.3277084452712,
              43.6342933326779
            ],
            [
              -79.3266108316821,
              43.6346015638297
            ],
            [
              -79.32622049962201,
              43.6345731838626
            ],
            [
              -79.3256244057232,
              43.6342178106398
            ],
            [
              -79.32572562674021,
              43.6333667399743
            ],
            [
              -79.3263739077301,
              43.6327122274393
            ],
            [
              -79.3266052796253,
              43.6318730101644
            ],
            [
              -79.3275561126911,
              43.6317170141175
            ],
            [
              -79.3290061322984,
              43.6320892212866
            ],
            [
              -79.3292035037432,
              43.6324072923387
            ],
            [
              -79.3285844273131,
              43.6331847786892
            ],
            [
              -79.3293831957036,
              43.6332937382186
            ],
            [
              -79.32998140526901,
              43.632854920726
            ],
            [
              -79.3305626008862,
              43.6327786147339
            ],
            [
              -79.3314437798015,
              43.6322759386911
            ],
            [
              -79.3333007585769,
              43.6315762652688
            ],
            [
              -79.3345596251782,
              43.6316058543014
            ],
            [
              -79.3348951673093,
              43.6308778389293
            ],
            [
              -79.335422797924,
              43.6306304314071
            ],
            [
              -79.3359628745652,
              43.6300701059279
            ],
            [
              -79.3363385204461,
              43.6299209061776
            ],
            [
              -79.3364513008172,
              43.6293322054981
            ],
            [
              -79.3358917740454,
              43.6294025866631
            ],
            [
              -79.3349830614324,
              43.62972053095
            ],
            [
              -79.33451354032,
              43.6294591539171
            ],
            [
              -79.3337222407961,
              43.6296587547558
            ],
            [
              -79.3339052281057,
              43.6301842609777
            ],
            [
              -79.3336950714572,
              43.6305146755562
            ],
            [
              -79.3327926120402,
              43.6306945751394
            ],
            [
              -79.3319513698197,
              43.630486282617
            ],
            [
              -79.3313482329035,
              43.6312604231127
            ],
            [
              -79.3300345457354,
              43.6312851846316
            ],
            [
              -79.328908422377,
              43.6309421090871
            ],
            [
              -79.3286560486503,
              43.6306714463554
            ],
            [
              -79.3287876166359,
              43.6301661433687
            ],
            [
              -79.3292435504106,
              43.6295645871849
            ],
            [
              -79.329974945967,
              43.62832787773531
            ],
            [
              -79.3306515132317,
              43.6281467477685
            ],
            [
              -79.3308492022729,
              43.6278065446872
            ],
            [
              -79.331517807986,
              43.6272695906285
            ],
            [
              -79.3315805914334,
              43.6266014824787
            ],
            [
              -79.3309897529194,
              43.6261253097238
            ],
            [
              -79.3313555774849,
              43.6258147256557
            ],
            [
              -79.3322265420183,
              43.6260853200143
            ],
            [
              -79.3339710921172,
              43.6257502605408
            ],
            [
              -79.3344371973938,
              43.6251408937228
            ],
            [
              -79.3348707911519,
              43.6252512569088
            ],
            [
              -79.3354287838893,
              43.6256886293848
            ],
            [
              -79.3357581060723,
              43.62634620504651
            ],
            [
              -79.3349060993867,
              43.6270831013439
            ],
            [
              -79.3349891919605,
              43.6274297750582
            ],
            [
              -79.3359035117825,
              43.6275706037818
            ],
            [
              -79.3368915575573,
              43.627513508705
            ],
            [
              -79.3373229209847,
              43.6278201707963
            ],
            [
              -79.3374999134038,
              43.6283956116437
            ],
            [
              -79.3373629281092,
              43.6288106601461
            ],
            [
              -79.3376888162201,
              43.62907764556711
            ],
            [
              -79.3381812243305,
              43.6288909076188
            ],
            [
              -79.3392322358007,
              43.6294078372707
            ],
            [
              -79.3393981480706,
              43.6291825585783
            ],
            [
              -79.3383835507847,
              43.6277392313817
            ],
            [
              -79.3373110383427,
              43.6259221463885
            ],
            [
              -79.3370274086909,
              43.6248351385179
            ],
            [
              -79.33740015611652,
              43.6238587112745
            ],
            [
              -79.3380326139952,
              43.6231649438888
            ],
            [
              -79.337374918295,
              43.6229153284272
            ],
            [
              -79.3384873399966,
              43.6221595363892
            ],
            [
              -79.3390115107339,
              43.6222319809261
            ],
            [
              -79.339161426569,
              43.6225573316491
            ],
            [
              -79.3388571840937,
              43.6229741182391
            ],
            [
              -79.3396097117367,
              43.623033730633
            ],
            [
              -79.3405277108482,
              43.6237678370521
            ],
            [
              -79.3412178868486,
              43.6236716456115
            ],
            [
              -79.3416777456026,
              43.6233687741226
            ],
            [
              -79.3423796091585,
              43.6232310953807
            ],
            [
              -79.3432344269939,
              43.6233447162971
            ],
            [
              -79.3428347489434,
              43.622828810212
            ],
            [
              -79.3422360369061,
              43.6228607776569
            ],
            [
              -79.3411391989793,
              43.6224452301851
            ],
            [
              -79.3411221698346,
              43.6220703970569
            ],
            [
              -79.3405803443428,
              43.6216497542414
            ],
            [
              -79.34005997228611,
              43.621487002106
            ],
            [
              -79.3396461178413,
              43.6208653343598
            ],
            [
              -79.3400475101268,
              43.6201772980604
            ],
            [
              -79.3412294740746,
              43.6194993304094
            ],
            [
              -79.3421277413767,
              43.6193610525774
            ],
            [
              -79.3427135566293,
              43.6195148840088
            ],
            [
              -79.3429773710666,
              43.6212232366563
            ],
            [
              -79.3434597076405,
              43.6222033680206
            ],
            [
              -79.3442721646349,
              43.622291683246
            ],
            [
              -79.3450538310093,
              43.6217728242428
            ],
            [
              -79.3439426490108,
              43.6211306287514
            ],
            [
              -79.3433797330289,
              43.6203484108326
            ],
            [
              -79.3434448195243,
              43.6197229111562
            ],
            [
              -79.3437323105789,
              43.6192253105727
            ],
            [
              -79.3446723472034,
              43.6184277705781
            ],
            [
              -79.3447671714516,
              43.6180265894926
            ],
            [
              -79.3443590291302,
              43.6177169441079
            ],
            [
              -79.34376564219,
              43.6167266004795
            ],
            [
              -79.3436935427512,
              43.6153315168002
            ],
            [
              -79.3441227420691,
              43.6132564751468
            ],
            [
              -79.343429071726,
              43.6127320857254
            ],
            [
              -79.3429669117922,
              43.6128207459115
            ],
            [
              -79.3420597776082,
              43.6144584023877
            ],
            [
              -79.3416197885125,
              43.614869194396
            ],
            [
              -79.3409495584595,
              43.615131060224805
            ],
            [
              -79.3396758250552,
              43.6168383704989
            ],
            [
              -79.3382264009126,
              43.6183248200218
            ],
            [
              -79.3370970425623,
              43.6191421195379
            ],
            [
              -79.3360743029468,
              43.6194281535854
            ],
            [
              -79.3348525977942,
              43.619440122388
            ],
            [
              -79.3345505589243,
              43.6198750837693
            ],
            [
              -79.3338918170561,
              43.6201362404961
            ],
            [
              -79.33242558036092,
              43.6204180140228
            ],
            [
              -79.330670153293,
              43.6203319303372
            ],
            [
              -79.3295189280927,
              43.6200946255365
            ],
            [
              -79.3279672674898,
              43.6194542903096
            ],
            [
              -79.3277216958384,
              43.6189111715703
            ],
            [
              -79.3272018033815,
              43.6188435874672
            ],
            [
              -79.3267084030688,
              43.6195651226399
            ],
            [
              -79.3267901812287,
              43.6201079954423
            ],
            [
              -79.3286572105745,
              43.6213233614034
            ],
            [
              -79.3286438619714,
              43.6216737660909
            ],
            [
              -79.327696960954,
              43.6219194404004
            ],
            [
              -79.3260338305603,
              43.6220832045753
            ],
            [
              -79.3254776888541,
              43.6219833414719
            ],
            [
              -79.3248263847073,
              43.6215817828322
            ],
            [
              -79.3248845929051,
              43.6209637995216
            ],
            [
              -79.3251555283279,
              43.6204875717626
            ],
            [
              -79.32505447721822,
              43.6194217945645
            ],
            [
              -79.3256483110724,
              43.6185180601771
            ],
            [
              -79.326311035938,
              43.6181190823327
            ],
            [
              -79.3270326894333,
              43.6179798084781
            ],
            [
              -79.3270670662252,
              43.6174714697997
            ],
            [
              -79.3253126127107,
              43.6177917910103
            ],
            [
              -79.3240545214764,
              43.6172695080947
            ],
            [
              -79.323493651046,
              43.6176334887123
            ],
            [
              -79.3241095668156,
              43.6181331431487
            ],
            [
              -79.3242560946832,
              43.6188759847886
            ],
            [
              -79.32406183249601,
              43.6208469942152
            ],
            [
              -79.3238452630205,
              43.6216605497696
            ],
            [
              -79.3233650781778,
              43.6221422751132
            ],
            [
              -79.3229393481247,
              43.6222846308309
            ],
            [
              -79.3219490895433,
              43.622251182839
            ],
            [
              -79.3219019480852,
              43.6226061337563
            ],
            [
              -79.3227405919017,
              43.6227682022517
            ],
            [
              -79.3231239600726,
              43.6230743486529
            ],
            [
              -79.323142770218,
              43.6239913235329
            ],
            [
              -79.3228161494472,
              43.6253171380315
            ],
            [
              -79.3224278525611,
              43.625658156627
            ],
            [
              -79.3215053519029,
              43.6257773117178
            ],
            [
              -79.3215690469099,
              43.6260654468798
            ],
            [
              -79.3224631054949,
              43.6262142007181
            ],
            [
              -79.3227014639448,
              43.6266968654887
            ],
            [
              -79.3223448369289,
              43.6288197769054
            ],
            [
              -79.3221133863664,
              43.6291275436735
            ],
            [
              -79.3212923609862,
              43.629213351637404
            ],
            [
              -79.3211901692596,
              43.629474439253
            ],
            [
              -79.3222039203049,
              43.6297004161018
            ],
            [
              -79.3223687653645,
              43.6300992359756
            ],
            [
              -79.3220489671936,
              43.6322289084507
            ],
            [
              -79.3218906755739,
              43.632744450442
            ],
            [
              -79.32103201620451,
              43.6330713449826
            ],
            [
              -79.3209205517072,
              43.6333391146934
            ],
            [
              -79.3225139696581,
              43.6339809771004
            ],
            [
              -79.3231122208066,
              43.6344600039072
            ],
            [
              -79.323165395345,
              43.6347744685149
            ],
            [
              -79.3229520746722,
              43.6357011637811
            ],
            [
              -79.3225102260676,
              43.6368867256745
            ],
            [
              -79.3222208280521,
              43.6373418988465
            ],
            [
              -79.3216050527881,
              43.6377686671214
            ],
            [
              -79.3215976272539,
              43.6381126972335
            ],
            [
              -79.3220625820318,
              43.6389130863044
            ],
            [
              -79.3212028251463,
              43.6411021395654
            ],
            [
              -79.320639405571,
              43.6417759098873
            ],
            [
              -79.3206756597364,
              43.6420177976387
            ],
            [
              -79.3212711067565,
              43.6423900817498
            ],
            [
              -79.3212964716725,
              43.6426853123828
            ],
            [
              -79.320839606245,
              43.6442033354516
            ],
            [
              -79.320339646479,
              43.6455413512477
            ],
            [
              -79.3197755047527,
              43.6461078193635
            ],
            [
              -79.3200655682834,
              43.646965800353
            ],
            [
              -79.3199439657915,
              43.6479573701408
            ],
            [
              -79.3202153526598,
              43.6484144814066
            ],
            [
              -79.3201012518389,
              43.6493886272717
            ],
            [
              -79.3194559512369,
              43.6515973985517
            ],
            [
              -79.3184046310085,
              43.6534644417559
            ],
            [
              -79.3180075086009,
              43.6543276971172
            ],
            [
              -79.3168264262113,
              43.6555670881108
            ],
            [
              -79.3160044572589,
              43.6560932201891
            ],
            [
              -79.3162342823022,
              43.6567165192687
            ],
            [
              -79.3167487602611,
              43.6572980671659
            ],
            [
              -79.3161575581473,
              43.657604450929306
            ],
            [
              -79.3147496175453,
              43.6573730126593
            ],
            [
              -79.3137163164044,
              43.657574646924
            ],
            [
              -79.313140220612,
              43.6580733264547
            ],
            [
              -79.3143403817163,
              43.6589071053675
            ],
            [
              -79.3150725852838,
              43.6592514234951
            ],
            [
              -79.3160473514316,
              43.6598869969395
            ],
            [
              -79.3170668599223,
              43.660788029205605
            ],
            [
              -79.3171125851442,
              43.6614746167282
            ],
            [
              -79.31492459201341,
              43.6619658989816
            ],
            [
              -79.3143494490133,
              43.6616218712527
            ],
            [
              -79.3133580721576,
              43.6616502853797
            ],
            [
              -79.3134037824506,
              43.6613234042779
            ],
            [
              -79.3140373147152,
              43.6611938001789
            ],
            [
              -79.3144081473905,
              43.6609288542471
            ],
            [
              -79.3137607184837,
              43.66028872395
            ],
            [
              -79.3120473255335,
              43.6588006888104
            ],
            [
              -79.3117004323373,
              43.6583410312789
            ],
            [
              -79.3116734890907,
              43.6577783757148
            ],
            [
              -79.31224663489711,
              43.6572347009674
            ],
            [
              -79.3122942741038,
              43.6567351863564
            ],
            [
              -79.31163893109742,
              43.65692314571721
            ],
            [
              -79.310749157919,
              43.656615621267
            ],
            [
              -79.3102510331795,
              43.6569478544251
            ],
            [
              -79.3111506606932,
              43.6572013999277
            ],
            [
              -79.3109232998452,
              43.6579346699279
            ],
            [
              -79.3103437822735,
              43.6583972972809
            ],
            [
              -79.3096047636415,
              43.6580675016472
            ],
            [
              -79.3093884361852,
              43.6582336660505
            ],
            [
              -79.3074986246002,
              43.6576699764051
            ],
            [
              -79.3068792134407,
              43.6572265964301
            ],
            [
              -79.3080547442865,
              43.6565668331769
            ],
            [
              -79.3083106182017,
              43.6561668735074
            ],
            [
              -79.3087711887572,
              43.655910719364
            ],
            [
              -79.3101547842852,
              43.6561424069216
            ],
            [
              -79.3111601574029,
              43.6559235930909
            ],
            [
              -79.3112061972937,
              43.6554741056861
            ],
            [
              -79.3106497664956,
              43.655163025812
            ],
            [
              -79.3102261206473,
              43.655422039284
            ],
            [
              -79.309373247872,
              43.655227910316604
            ],
            [
              -79.3086244205861,
              43.6541631674021
            ],
            [
              -79.3083466729951,
              43.6543574283464
            ],
            [
              -79.3084207136149,
              43.6549763684066
            ],
            [
              -79.3077734061727,
              43.65612201782161
            ],
            [
              -79.3068913289673,
              43.6565835425571
            ],
            [
              -79.3063726870391,
              43.6566194537607
            ],
            [
              -79.3053898323881,
              43.6564403501635
            ],
            [
              -79.3049931280337,
              43.6568923429502
            ],
            [
              -79.3059708993322,
              43.6579281985779
            ],
            [
              -79.3060823506709,
              43.6586586669192
            ],
            [
              -79.3056113669519,
              43.6593385847156
            ],
            [
              -79.3052743512793,
              43.659400786505
            ],
            [
              -79.304969302645,
              43.6598599201066
            ],
            [
              -79.30567435398771,
              43.6603832257453
            ],
            [
              -79.3064212627985,
              43.6605940802713
            ],
            [
              -79.3058705212477,
              43.6618427125667
            ],
            [
              -79.3050061241604,
              43.6630172663929
            ],
            [
              -79.3036583928023,
              43.6641909392827
            ],
            [
              -79.3033770878132,
              43.6645480698745
            ],
            [
              -79.3025934914075,
              43.6649113364858
            ],
            [
              -79.3020554771812,
              43.6647561142237
            ],
            [
              -79.3013537699531,
              43.6651755924116
            ],
            [
              -79.3003510293517,
              43.6653508657601
            ],
            [
              -79.2993210596661,
              43.6656656572019
            ],
            [
              -79.2989888488072,
              43.6654719228742
            ],
            [
              -79.2984027628952,
              43.665521280248306
            ],
            [
              -79.2980490060315,
              43.6652607332821
            ],
            [
              -79.2969575800859,
              43.6653380026416
            ],
            [
              -79.2953699332512,
              43.6658742975545
            ],
            [
              -79.295181410626,
              43.6662454179649
            ],
            [
              -79.2946824740646,
              43.66620697834621
            ],
            [
              -79.2939167924878,
              43.6670315358287
            ],
            [
              -79.2935318954764,
              43.6672889364751
            ],
            [
              -79.2926978432563,
              43.6673146560126
            ],
            [
              -79.2921687835972,
              43.6677566958728
            ],
            [
              -79.2914880858933,
              43.6679337906321
            ],
            [
              -79.2905528874031,
              43.668412625966
            ],
            [
              -79.2896730876894,
              43.6685799655325
            ],
            [
              -79.2886115523924,
              43.6686282888689
            ],
            [
              -79.2881716444771,
              43.6690534714367
            ],
            [
              -79.2876092412067,
              43.669203569187
            ],
            [
              -79.2866974939212,
              43.6691773789124
            ],
            [
              -79.2860788883203,
              43.669431851661706
            ],
            [
              -79.2855857345591,
              43.6698323419322
            ],
            [
              -79.2847794518772,
              43.6697973598083
            ],
            [
              -79.2843099224017,
              43.6701423508359
            ],
            [
              -79.2833861833085,
              43.6702782344229
            ],
            [
              -79.2827944266321,
              43.6701298498383
            ],
            [
              -79.2823521914744,
              43.6705738092375
            ],
            [
              -79.2819018015782,
              43.6707269274971
            ],
            [
              -79.2813315635504,
              43.6705808087341
            ],
            [
              -79.28070184540331,
              43.6710162207121
            ],
            [
              -79.2800829207476,
              43.6710165258938
            ],
            [
              -79.2790326884178,
              43.6716713902779
            ],
            [
              -79.2783673489722,
              43.6721849419467
            ],
            [
              -79.277736779687,
              43.6719770292296
            ],
            [
              -79.2772253727435,
              43.6730773455934
            ],
            [
              -79.2768743689386,
              43.6732982015381
            ],
            [
              -79.2765828285787,
              43.673926410401
            ],
            [
              -79.275936004389,
              43.6742576891572
            ],
            [
              -79.2754231238176,
              43.675220318951006
            ],
            [
              -79.2750895276526,
              43.6752545881911
            ],
            [
              -79.2748271124203,
              43.6759002672058
            ],
            [
              -79.2742395239942,
              43.6762320399677
            ],
            [
              -79.27368174108601,
              43.6771220763203
            ],
            [
              -79.2733463176988,
              43.67720709526011
            ],
            [
              -79.2729630737473,
              43.678133425139706
            ],
            [
              -79.2723765744213,
              43.6787197744965
            ],
            [
              -79.2719184322216,
              43.6786407568938
            ],
            [
              -79.2716549468055,
              43.6793169945539
            ],
            [
              -79.2711738887046,
              43.6798919635064
            ],
            [
              -79.2708275794281,
              43.6797592385031
            ],
            [
              -79.2702087429242,
              43.6808015451016
            ],
            [
              -79.2697702418272,
              43.6807366364458
            ],
            [
              -79.2693778371504,
              43.681621925304206
            ],
            [
              -79.2685504278292,
              43.6824528559559
            ],
            [
              -79.2682440421166,
              43.6826147807872
            ],
            [
              -79.2678775344273,
              43.6832661817672
            ],
            [
              -79.26763033458512,
              43.6832730695944
            ],
            [
              -79.2672783408323,
              43.6838827140223
            ],
            [
              -79.2668916641966,
              43.6839434050454
            ],
            [
              -79.2663817142999,
              43.6846131411621
            ],
            [
              -79.2651436545504,
              43.6857087811143
            ],
            [
              -79.2637804438524,
              43.6866460230398
            ],
            [
              -79.2625639368904,
              43.6879374664211
            ],
            [
              -79.2620550161904,
              43.6886021981687
            ],
            [
              -79.2599685400992,
              43.6905939542028
            ],
            [
              -79.259419368202,
              43.69126686155441
            ],
            [
              -79.2592999695776,
              43.6916920202849
            ],
            [
              -79.2588228615959,
              43.6919854378929
            ],
            [
              -79.258604821581,
              43.6925440838517
            ],
            [
              -79.2581211338551,
              43.6928886749276
            ],
            [
              -79.25777119808261,
              43.6934298205664
            ],
            [
              -79.2571514439349,
              43.6936369664234
            ],
            [
              -79.2568492298656,
              43.6941294325608
            ],
            [
              -79.2562977238506,
              43.6942715225871
            ],
            [
              -79.2556045511247,
              43.6950622999596
            ],
            [
              -79.2536658173093,
              43.6959717689206
            ],
            [
              -79.2532064760929,
              43.696286156130405
            ],
            [
              -79.2514649362995,
              43.6968324152827
            ],
            [
              -79.2501885424498,
              43.697499688447
            ],
            [
              -79.2497607572183,
              43.697853007217
            ],
            [
              -79.2489184187519,
              43.6982035872622
            ],
            [
              -79.2474091994212,
              43.6986809486216
            ],
            [
              -79.2458431913976,
              43.6993738074164
            ],
            [
              -79.2438675477254,
              43.70039069165221
            ],
            [
              -79.2438237560246,
              43.701033617778
            ],
            [
              -79.2431494328894,
              43.7019064165019
            ],
            [
              -79.2415934376891,
              43.7028166649316
            ],
            [
              -79.2403652746763,
              43.7031610339992
            ],
            [
              -79.2396296597699,
              43.703141916283
            ],
            [
              -79.238947450691,
              43.7029503433953
            ],
            [
              -79.2385567450343,
              43.7025786159401
            ],
            [
              -79.2379859058928,
              43.7029642106385
            ],
            [
              -79.2380591317073,
              43.7032810972744
            ],
            [
              -79.2394306322993,
              43.7036690543769
            ],
            [
              -79.2391886995232,
              43.7040293276196
            ],
            [
              -79.2383543552214,
              43.70434214131671
            ],
            [
              -79.2385762620681,
              43.7046428864531
            ],
            [
              -79.2372508630341,
              43.7050534198831
            ],
            [
              -79.2366571183617,
              43.7046070486998
            ],
            [
              -79.2367476475572,
              43.7041868348444
            ],
            [
              -79.2374803593094,
              43.7036029872142
            ],
            [
              -79.23763830804242,
              43.7031588849955
            ],
            [
              -79.2383096661971,
              43.7025329721654
            ],
            [
              -79.2389845302212,
              43.7025199241333
            ],
            [
              -79.2392137618889,
              43.7023179186708
            ],
            [
              -79.2387616224072,
              43.7018938353002
            ],
            [
              -79.2382582743235,
              43.7021852522722
            ],
            [
              -79.237524561409,
              43.7023217484045
            ],
            [
              -79.2370559112226,
              43.7020841718054
            ],
            [
              -79.2365989684985,
              43.7014659743048
            ],
            [
              -79.2361213243246,
              43.7011993800035
            ],
            [
              -79.23548040289822,
              43.7014251628441
            ],
            [
              -79.2354178988886,
              43.7017264169048
            ],
            [
              -79.2360361289254,
              43.7020497678534
            ],
            [
              -79.2364809892974,
              43.702536809123
            ],
            [
              -79.23658590278,
              43.7031041311986
            ],
            [
              -79.236398016243,
              43.7035942944523
            ],
            [
              -79.2357783535717,
              43.7044886163378
            ],
            [
              -79.2352646117323,
              43.7048385762301
            ],
            [
              -79.2338740231448,
              43.705447487496905
            ],
            [
              -79.23357352663251,
              43.7058206192036
            ],
            [
              -79.2341916814278,
              43.7061991395019
            ],
            [
              -79.2339779131128,
              43.7065756963234
            ],
            [
              -79.2331435834388,
              43.706929868694
            ],
            [
              -79.2326302386579,
              43.7066100692212
            ],
            [
              -79.233106007531,
              43.7058652459833
            ],
            [
              -79.2327778628238,
              43.7053269415117
            ],
            [
              -79.2319385051203,
              43.7048932662665
            ],
            [
              -79.2316121149443,
              43.7052667731859
            ],
            [
              -79.2309613128693,
              43.7053467857582
            ],
            [
              -79.2299186635153,
              43.7051044880967
            ],
            [
              -79.2291761661368,
              43.7046831010819
            ],
            [
              -79.2288860201636,
              43.7048573619655
            ],
            [
              -79.2292381123894,
              43.7055692338432
            ],
            [
              -79.2284041518341,
              43.7069543327764
            ],
            [
              -79.2276662151726,
              43.70713168422
            ],
            [
              -79.2285458165975,
              43.7074381723365
            ],
            [
              -79.2286605312773,
              43.707080581348
            ],
            [
              -79.2295126378256,
              43.7059665067166
            ],
            [
              -79.2298167983503,
              43.7058745850074
            ],
            [
              -79.231815726899,
              43.7067002890781
            ],
            [
              -79.2334367253041,
              43.7075882482497
            ],
            [
              -79.2333335094792,
              43.7083475072957
            ],
            [
              -79.2329848062642,
              43.709040717759
            ],
            [
              -79.2330236649682,
              43.70933261149501
            ],
            [
              -79.2324802498064,
              43.7098881411032
            ],
            [
              -79.23159025846782,
              43.7104458881916
            ],
            [
              -79.2307366482462,
              43.7105541730142
            ],
            [
              -79.2301210490156,
              43.7102011229214
            ],
            [
              -79.2303296415025,
              43.7098885063195
            ],
            [
              -79.231161258645,
              43.7096349644245
            ],
            [
              -79.2315132927795,
              43.7093129705442
            ],
            [
              -79.23187018171471,
              43.7085190236522
            ],
            [
              -79.2312685159308,
              43.7085082493984
            ],
            [
              -79.2308970561053,
              43.7087769363587
            ],
            [
              -79.2298975291968,
              43.7084849181494
            ],
            [
              -79.2294967869999,
              43.7080372377045
            ],
            [
              -79.229087717921,
              43.708795021526
            ],
            [
              -79.2296212029743,
              43.7092718754672
            ],
            [
              -79.2290349328724,
              43.7096486662582
            ],
            [
              -79.2280451925072,
              43.709263005949005
            ],
            [
              -79.2278262603562,
              43.7096482249849
            ],
            [
              -79.2283003925114,
              43.7099682587046
            ],
            [
              -79.2280338074239,
              43.7104636482679
            ],
            [
              -79.2280383588309,
              43.7110652313791
            ],
            [
              -79.2273055874746,
              43.7112031491213
            ],
            [
              -79.2273609942899,
              43.7116383301918
            ],
            [
              -79.2282523103048,
              43.7117777128969
            ],
            [
              -79.2292293437909,
              43.7116573713639
            ],
            [
              -79.2291511763762,
              43.7105060239473
            ],
            [
              -79.2300120911705,
              43.7103438866652
            ],
            [
              -79.2305888645206,
              43.7112535378107
            ],
            [
              -79.2300407954183,
              43.7121099117476
            ],
            [
              -79.2294353013807,
              43.7125532503045
            ],
            [
              -79.2285540658278,
              43.7126737491041
            ],
            [
              -79.2266685807812,
              43.712401675552
            ],
            [
              -79.2264245414699,
              43.7120928886303
            ],
            [
              -79.2263131191092,
              43.7111929279925
            ],
            [
              -79.2267467793267,
              43.7097425120928
            ],
            [
              -79.2271043214111,
              43.7088792089762
            ],
            [
              -79.2280506363214,
              43.7083828212832
            ],
            [
              -79.2278658336818,
              43.7080955021391
            ],
            [
              -79.2268654008752,
              43.7081180224545
            ],
            [
              -79.2264319823894,
              43.7079279683949
            ],
            [
              -79.2258355402836,
              43.707973210923
            ],
            [
              -79.2263664850494,
              43.708488410409
            ],
            [
              -79.2264912862027,
              43.70886852645191
            ],
            [
              -79.2256819630582,
              43.7106228773931
            ],
            [
              -79.2250191447283,
              43.7110612754119
            ],
            [
              -79.22578360424131,
              43.7116980607939
            ],
            [
              -79.2255914815673,
              43.7121802922517
            ],
            [
              -79.2252080566355,
              43.71240369149
            ],
            [
              -79.2260084984359,
              43.7126916729709
            ],
            [
              -79.2253439077337,
              43.7145706474961
            ],
            [
              -79.2247508015488,
              43.7156049861202
            ],
            [
              -79.2240919840583,
              43.717059350293
            ],
            [
              -79.2235474682073,
              43.71802622711011
            ],
            [
              -79.2229530234687,
              43.7187712704162
            ],
            [
              -79.2205130785049,
              43.7210864818528
            ],
            [
              -79.2191929937617,
              43.7220620506704
            ],
            [
              -79.2187656545706,
              43.72224624560321
            ],
            [
              -79.2176941683912,
              43.7217840727941
            ],
            [
              -79.2170814471259,
              43.723158667759
            ],
            [
              -79.2164277524936,
              43.7234515144729
            ],
            [
              -79.2161673880067,
              43.7243729552579
            ],
            [
              -79.2156488427634,
              43.7249251526112
            ],
            [
              -79.2151283833658,
              43.7249337310274
            ],
            [
              -79.2147352792042,
              43.7259630592727
            ],
            [
              -79.2140122736659,
              43.7263699717062
            ],
            [
              -79.2127612905359,
              43.7280935596794
            ],
            [
              -79.2121725777517,
              43.7290054787978
            ],
            [
              -79.2113969279071,
              43.7293678388063
            ],
            [
              -79.2113149803483,
              43.729765441262
            ],
            [
              -79.2109441276428,
              43.7300374483213
            ],
            [
              -79.2101927008367,
              43.7301859021132
            ],
            [
              -79.2098135457344,
              43.7306513118465
            ],
            [
              -79.2101591819988,
              43.7309331531811
            ],
            [
              -79.2099490427964,
              43.7312977909564
            ],
            [
              -79.2092904321257,
              43.7316627107645
            ],
            [
              -79.2075945150275,
              43.7333466637968
            ],
            [
              -79.2069535532587,
              43.7333254176124
            ],
            [
              -79.2064270867393,
              43.7341851687319
            ],
            [
              -79.20523862580481,
              43.7348380111742
            ],
            [
              -79.2023764556137,
              43.7357322646344
            ],
            [
              -79.2011881235302,
              43.7366113017519
            ],
            [
              -79.1994571377754,
              43.7377769577586
            ],
            [
              -79.1975442710124,
              43.739144651501
            ],
            [
              -79.1964037578126,
              43.7406628779908
            ],
            [
              -79.195842819855,
              43.7412311364137
            ],
            [
              -79.1952177814828,
              43.7413934375107
            ],
            [
              -79.1940743255657,
              43.7425650047114
            ],
            [
              -79.1914590563129,
              43.744495827002
            ],
            [
              -79.1904529171833,
              43.7454139569285
            ],
            [
              -79.1897800797921,
              43.7458721213086
            ],
            [
              -79.1886883316032,
              43.74684509944401
            ],
            [
              -79.1880360723065,
              43.7468377942982
            ],
            [
              -79.1871753924134,
              43.7473547392917
            ],
            [
              -79.1863502034252,
              43.7476469071421
            ],
            [
              -79.1857465927806,
              43.7481980129055
            ],
            [
              -79.1831111065331,
              43.7495140297742
            ],
            [
              -79.1807733824594,
              43.75090475338501
            ],
            [
              -79.1806156866465,
              43.7512450081
            ],
            [
              -79.1797512313242,
              43.751509978766
            ],
            [
              -79.1792029490005,
              43.7518781562957
            ],
            [
              -79.1787177779526,
              43.7522951510403
            ],
            [
              -79.1774275755476,
              43.7527169854895
            ],
            [
              -79.1750729064925,
              43.7540753195705
            ],
            [
              -79.1735321998199,
              43.7546650617789
            ],
            [
              -79.17274674772192,
              43.7548743705399
            ],
            [
              -79.1701249573734,
              43.7558615461353
            ],
            [
              -79.1684602853231,
              43.7563293188884
            ],
            [
              -79.167280471169,
              43.7568344755552
            ],
            [
              -79.1661684929133,
              43.7569977730934
            ],
            [
              -79.1640349389623,
              43.7574596012367
            ],
            [
              -79.1633491621416,
              43.7575341114655
            ],
            [
              -79.161751514186,
              43.7579974741433
            ],
            [
              -79.1604448997859,
              43.7582591437991
            ],
            [
              -79.1589754605121,
              43.7586939816235
            ],
            [
              -79.1568745692524,
              43.7590180913007
            ],
            [
              -79.15531461205521,
              43.7591264073824
            ],
            [
              -79.1532276665619,
              43.7591027223883
            ],
            [
              -79.1527708178871,
              43.7592839153744
            ],
            [
              -79.1515157201078,
              43.7601541281865
            ],
            [
              -79.1494897386385,
              43.7624734055008
            ],
            [
              -79.1486228785425,
              43.7635479775042
            ],
            [
              -79.1474359973332,
              43.7647047448462
            ],
            [
              -79.1472231927072,
              43.7650299216614
            ],
            [
              -79.1464086955008,
              43.7657394244667
            ],
            [
              -79.1455871467368,
              43.7660243683065
            ],
            [
              -79.14413995772692,
              43.7670135557555
            ],
            [
              -79.1437627010356,
              43.7674247330749
            ],
            [
              -79.1428089984975,
              43.7681435962163
            ],
            [
              -79.1423429326853,
              43.7686645304446
            ],
            [
              -79.1416685222578,
              43.7690561740581
            ],
            [
              -79.1407377026734,
              43.7689421326006
            ],
            [
              -79.1400493638156,
              43.7699805195526
            ],
            [
              -79.1385984300223,
              43.7708117349037
            ],
            [
              -79.1381950433142,
              43.77140346424981
            ],
            [
              -79.1373394292113,
              43.7715219891907
            ],
            [
              -79.137090637407,
              43.7722596007427
            ],
            [
              -79.1364312461144,
              43.7728703941057
            ],
            [
              -79.1359888795439,
              43.7728398403235
            ],
            [
              -79.1358659412112,
              43.7733741265696
            ],
            [
              -79.1354064934984,
              43.773977017633406
            ],
            [
              -79.1348195862864,
              43.7741571563131
            ],
            [
              -79.1342873224224,
              43.7738966801484
            ],
            [
              -79.1339971840238,
              43.7742648708727
            ],
            [
              -79.1340610989889,
              43.7746330518287
            ],
            [
              -79.1337716227227,
              43.775321415164704
            ],
            [
              -79.1337901643696,
              43.7758453508084
            ],
            [
              -79.1330170848702,
              43.7765086775229
            ],
            [
              -79.1320394251615,
              43.7775303154282
            ],
            [
              -79.1310523004834,
              43.778326084358
            ],
            [
              -79.1291180836339,
              43.7804869407756
            ],
            [
              -79.1282706244654,
              43.7808635409406
            ],
            [
              -79.1276905148002,
              43.7816316467252
            ],
            [
              -79.1268904770031,
              43.7822359129713
            ],
            [
              -79.1267718465394,
              43.7827285452975
            ],
            [
              -79.125673205797,
              43.7839151734206
            ],
            [
              -79.12486638022652,
              43.7841463867254
            ],
            [
              -79.124631901534,
              43.7849601120822
            ],
            [
              -79.1237563247688,
              43.785405507824606
            ],
            [
              -79.1237510833323,
              43.7860272352291
            ],
            [
              -79.123253625482,
              43.786091223807
            ],
            [
              -79.1227904069074,
              43.787226368542
            ],
            [
              -79.1219116593424,
              43.7876785173515
            ],
            [
              -79.1219449707059,
              43.7881318797095
            ],
            [
              -79.1215962062855,
              43.788540817215
            ],
            [
              -79.1211751263664,
              43.7884908071682
            ],
            [
              -79.1207618125355,
              43.7889478462132
            ],
            [
              -79.1210402299295,
              43.789149251958
            ],
            [
              -79.12080539661152,
              43.7896598274247
            ],
            [
              -79.1202050980928,
              43.789784714136
            ],
            [
              -79.1200593344532,
              43.7902126745374
            ],
            [
              -79.1204298222085,
              43.790570080326
            ],
            [
              -79.1202810873384,
              43.7910139270796
            ],
            [
              -79.11852682643492,
              43.792820039488
            ],
            [
              -79.1169525370164,
              43.7941716578235
            ],
            [
              -79.1154514950547,
              43.794555969822
            ],
            [
              -79.1162205544202,
              43.794748892643
            ],
            [
              -79.1171359300426,
              43.7943652204404
            ],
            [
              -79.118413062868,
              43.7944806195011
            ],
            [
              -79.1193212413309,
              43.7947972112552
            ],
            [
              -79.121003344313,
              43.7947406038787
            ],
            [
              -79.1211120332515,
              43.7953253982287
            ],
            [
              -79.1202725471391,
              43.7956184340415
            ],
            [
              -79.1203061840931,
              43.7961544636336
            ],
            [
              -79.1211740217565,
              43.7970220902171
            ],
            [
              -79.121932277766,
              43.7974029991345
            ],
            [
              -79.1223445925156,
              43.7974262170393
            ],
            [
              -79.1234741868708,
              43.7971785517614
            ],
            [
              -79.1242252226761,
              43.7974272942291
            ],
            [
              -79.1243552741194,
              43.7977321396357
            ],
            [
              -79.124201774365,
              43.7983530632938
            ],
            [
              -79.1242266730957,
              43.7990102268028
            ],
            [
              -79.1248743553258,
              43.799925895872
            ],
            [
              -79.1255725741139,
              43.8002169322739
            ],
            [
              -79.1264003294182,
              43.8001573533943
            ],
            [
              -79.127683111259,
              43.8002863669536
            ],
            [
              -79.1284635370376,
              43.8006346305157
            ],
            [
              -79.1302314083948,
              43.8016077407289
            ],
            [
              -79.1310270675971,
              43.8017819814644
            ],
            [
              -79.1317852151327,
              43.8017330932153
            ],
            [
              -79.1342698544199,
              43.8008711944559
            ],
            [
              -79.1352561294056,
              43.8006718482234
            ],
            [
              -79.1352147933857,
              43.8013155660677
            ],
            [
              -79.1346555333434,
              43.8017419536762
            ],
            [
              -79.1337707984169,
              43.8027165169259
            ],
            [
              -79.1336949827722,
              43.8032725966846
            ],
            [
              -79.1343907542408,
              43.8044286769497
            ],
            [
              -79.1343028666158,
              43.8052182250895
            ],
            [
              -79.1339485572849,
              43.8059525263558
            ],
            [
              -79.1340371751162,
              43.8067930634637
            ],
            [
              -79.1355874892799,
              43.8079231463636
            ],
            [
              -79.1362604794488,
              43.8080737994581
            ],
            [
              -79.1370503040589,
              43.8077117657374
            ],
            [
              -79.1376114361268,
              43.8078620645964
            ],
            [
              -79.1381632167493,
              43.8074947675703
            ],
            [
              -79.13841021343622,
              43.8079590971894
            ],
            [
              -79.1389460176127,
              43.807992294999
            ],
            [
              -79.1395819059702,
              43.8084443483002
            ],
            [
              -79.1406399326833,
              43.8084476619858
            ],
            [
              -79.140698179421,
              43.8087808859461
            ],
            [
              -79.1412431316351,
              43.8089131048762
            ],
            [
              -79.1419726431514,
              43.8096414124513
            ],
            [
              -79.1424645237881,
              43.8094458281614
            ],
            [
              -79.1431510569595,
              43.8096302461494
            ],
            [
              -79.1428768045716,
              43.8100782474371
            ],
            [
              -79.1434286485845,
              43.8106196764962
            ],
            [
              -79.143638133229,
              43.8100622616307
            ],
            [
              -79.1452815962063,
              43.809993835309
            ],
            [
              -79.146095795582,
              43.8100667120699
            ],
            [
              -79.1464044233751,
              43.8104812769468
            ],
            [
              -79.1461283374886,
              43.8108369650208
            ],
            [
              -79.1466722155067,
              43.8113421332666
            ],
            [
              -79.1482264905451,
              43.812319622569
            ],
            [
              -79.1494726812546,
              43.8124794315347
            ],
            [
              -79.1512320930711,
              43.8138819014438
            ],
            [
              -79.1517428539905,
              43.8139846672972
            ],
            [
              -79.1521581508901,
              43.8146850290788
            ],
            [
              -79.152795994535,
              43.8167212606017
            ],
            [
              -79.1554974647575,
              43.8225805471385
            ],
            [
              -79.1588972437805,
              43.830214719359404
            ],
            [
              -79.16049670158452,
              43.8338537529815
            ],
            [
              -79.1625004420541,
              43.8382415754789
            ],
            [
              -79.16495186063642,
              43.84371757669151
            ],
            [
              -79.1659064612318,
              43.8459082109445
            ],
            [
              -79.1674396092199,
              43.8492089006759
            ],
            [
              -79.1702915177967,
              43.8554571861712
            ],
            [
              -79.1769472036027,
              43.8539057032944
            ],
            [
              -79.1814444542456,
              43.8528253230682
            ],
            [
              -79.1950315102283,
              43.8494942540992
            ],
            [
              -79.1989288286159,
              43.8485991190225
            ],
            [
              -79.2044977667187,
              43.847253686673
            ],
            [
              -79.2092959545785,
              43.8462038242408
            ],
            [
              -79.21483858773331,
              43.8449665800727
            ],
            [
              -79.2278142704233,
              43.8420905838785
            ],
            [
              -79.2297359009406,
              43.8416540027351
            ],
            [
              -79.23924855632161,
              43.8393897624241
            ],
            [
              -79.248490375191,
              43.8372411833503
            ],
            [
              -79.2511891488379,
              43.8365989872391
            ],
            [
              -79.260035298539,
              43.8345650760383
            ],
            [
              -79.2679625210449,
              43.8327043091125
            ],
            [
              -79.2755227567675,
              43.8309714187814
            ],
            [
              -79.2767814066946,
              43.8306658763414
            ],
            [
              -79.2872021430405,
              43.82829493398561
            ],
            [
              -79.2959933881964,
              43.8262721484992
            ],
            [
              -79.2973325288169,
              43.8259504741618
            ],
            [
              -79.3054912072424,
              43.8240743335248
            ],
            [
              -79.3070666398246,
              43.8236899303012
            ],
            [
              -79.320373485425,
              43.8205880350589
            ],
            [
              -79.3266866868434,
              43.8190945288962
            ],
            [
              -79.3320837684822,
              43.817878419184
            ],
            [
              -79.3374751847611,
              43.816626212889
            ],
            [
              -79.3413178929128,
              43.81565075423731
            ],
            [
              -79.3422010596824,
              43.8154179844849
            ],
            [
              -79.3485557932883,
              43.8139697808004
            ],
            [
              -79.3519658922389,
              43.813215950828
            ],
            [
              -79.3575556725031,
              43.8119179303512
            ],
            [
              -79.3645757810187,
              43.810309406576
            ],
            [
              -79.3677550711533,
              43.8095983065908
            ],
            [
              -79.3717562163925,
              43.8086516200708
            ],
            [
              -79.3725082420786,
              43.8085079576189
            ],
            [
              -79.3819043429221,
              43.8064035656288
            ],
            [
              -79.38486321341742,
              43.8057742114416
            ],
            [
              -79.3894001690219,
              43.8047607917959
            ],
            [
              -79.39623005788661,
              43.8032701311798
            ],
            [
              -79.426378474157,
              43.7966223806342
            ],
            [
              -79.4292679942717,
              43.7960076369876
            ],
            [
              -79.4365648852745,
              43.7944144259901
            ],
            [
              -79.4389508493451,
              43.7939206540047
            ],
            [
              -79.4433486621435,
              43.7929598420596
            ],
            [
              -79.44575516760682,
              43.792407466692
            ],
            [
              -79.4530346336878,
              43.7908118086972
            ],
            [
              -79.4576350005287,
              43.7898475501653
            ],
            [
              -79.4631884218653,
              43.7886477313178
            ],
            [
              -79.4700896742123,
              43.7872832010882
            ],
            [
              -79.4873055772169,
              43.7832181609663
            ],
            [
              -79.4945063595238,
              43.7815790749568
            ],
            [
              -79.504339154684,
              43.7792364478206
            ],
            [
              -79.5110925903654,
              43.7777181895058
            ],
            [
              -79.5170107512026,
              43.7763624451289
            ],
            [
              -79.5190058267566,
              43.775977340092
            ],
            [
              -79.5199438842346,
              43.7758645667069
            ],
            [
              -79.5216160016868,
              43.7755045222112
            ],
            [
              -79.5234479016865,
              43.774991211747
            ],
            [
              -79.5350772073467,
              43.7726429715053
            ],
            [
              -79.5521956585059,
              43.7691171401983
            ],
            [
              -79.5549881135823,
              43.7685669032639
            ],
            [
              -79.5647842958979,
              43.7665453900781
            ],
            [
              -79.5748719500655,
              43.7643434795002
            ],
            [
              -79.5775376329862,
              43.7637016102077
            ],
            [
              -79.5806438818039,
              43.7630179182296
            ],
            [
              -79.5904153157141,
              43.7607798335846
            ],
            [
              -79.6020523373788,
              43.7581532282044
            ],
            [
              -79.6112275727958,
              43.7561121535561
            ],
            [
              -79.62491153441772,
              43.7530507442462
            ],
            [
              -79.6296041298404,
              43.7519692102324
            ],
            [
              -79.631721857084,
              43.7515094653301
            ],
            [
              -79.6331431368219,
              43.7513061196545
            ],
            [
              -79.6352527965954,
              43.7512343784588
            ],
            [
              -79.6364548228442,
              43.7510550500096
            ],
            [
              -79.6373669492935,
              43.7507621474884
            ],
            [
              -79.6392649324429,
              43.7498707479426
            ]
          ]
        ]
      }
    };

    const addMask = function (map) {

      map.addSource('mask-source', {
        type: 'geojson',
        data: wards,
      });

      map.addLayer({
        id: 'mask-fill',
        type: 'fill',
        source: 'mask-source', // reference the data source
        layout: {},
        paint: {
          'fill-color': '#fbfbfb', // blue color fill
          'fill-opacity': 1,
        },
      });

    };

    const addMask$1 = function (map) {

      // map.addSource('mask-source', {
      //   type: 'geojson',
      //   data: wards,
      // })

      // map.addLayer({
      //   id: 'mask-fill',
      //   type: 'fill',
      //   source: 'mask-source', // reference the data source
      //   layout: {},
      //   paint: {
      //     'fill-color': '#fff', // blue color fill
      //     'fill-opacity': 1,
      //   },
      // })

      // Add a data source containing GeoJSON data.
      map.addSource('ground', {
        type: 'geojson',
        data: data
      });


      map.addLayer({
        'id': 'ground',
        'type': 'fill', //extr
        'source': 'ground',
        'paint': {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.1
          // 'fill-extrusion-color': ['get', 'color'],
          // 'fill-extrusion-height': 450,
          // 'fill-extrusion-base': 50,
          // 'fill-extrusion-opacity': 0.9
        }
      });

    };

    /* 2022/construction-map/Post.svelte generated by Svelte v3.29.0 */
    const file$2 = "2022/construction-map/Post.svelte";

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-1uoqds8-style";
    	style.textContent = ".container.svelte-1uoqds8{border:1px solid grey;border-radius:5px;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2);margin:5%;padding:0px;overflow:hidden}#map.svelte-1uoqds8{min-width:100%;min-height:700px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBIZWFkIGZyb20gJy4uLy4uL2NvbXBvbmVudHMvSGVhZC5zdmVsdGUnXG4gIGltcG9ydCBGb290IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvRm9vdC5zdmVsdGUnXG4gIGltcG9ydCB7IG9uTW91bnQgfSBmcm9tICdzdmVsdGUnXG4gIGltcG9ydCBhZGRXYXJkcyBmcm9tICcuL2xheWVycy9hZGRXYXJkcy5qcydcbiAgaW1wb3J0IGFkZERvdHMgZnJvbSAnLi9sYXllcnMvYWRkQnVpbGRpbmdzLmpzJ1xuICBpbXBvcnQgYWRkTWFzayBmcm9tICcuL2xheWVycy9hZGRNYXNrLmpzJ1xuICBpbXBvcnQgYWRkR3JvdW5kIGZyb20gJy4vbGF5ZXJzL2FkZEdyb3VuZC5qcydcbiAgaW1wb3J0IG1hcGJveGdsIGZyb20gJ21hcGJveC1nbCdcbiAgbWFwYm94Z2wuYWNjZXNzVG9rZW4gPVxuICAgICdway5leUoxSWpvaWMzQmxibU5sY20xdmRXNTBZV2x1SWl3aVlTSTZJbnA1VVZaRVkzY2lmUS5kaC1fU3ZrUGd2OVlPUVpMRzVaSEtnJ1xuXG4gIGxldCB0aXRsZSA9ICdBY3RpdmUgYnVpbGRpbmcgcGVybWl0cyBpbiBUb3JvbnRvJ1xuICBvbk1vdW50KGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBtYXAgPSBuZXcgbWFwYm94Z2wuTWFwKHtcbiAgICAgIGNvbnRhaW5lcjogJ21hcCcsIC8vIGNvbnRhaW5lciBJRFxuICAgICAgc3R5bGU6ICdtYXBib3g6Ly9zdHlsZXMvc3BlbmNlcm1vdW50YWluL2NsOGhzYjZwdTAwMGIxNHB2bDZ5Z2k3NmYnLFxuICAgICAgY2VudGVyOiBbLTc5LjQzLCA0My42NV0sXG4gICAgICBwaXRjaDogNTUsXG4gICAgICBiZWFyaW5nOiA1LFxuICAgICAgem9vbTogMTEuMSxcbiAgICAgIHByb2plY3Rpb246ICdnbG9iZScsXG4gICAgICBtYXhCb3VuZHM6IFtcbiAgICAgICAgLTc5LjY4NTA3LFxuICAgICAgICA0My40MjA0LCAvL3NvdXRod2VzdFxuICAgICAgICAtNzkuMDM0OSxcbiAgICAgICAgNDQuMDQ5MiwgLy9ub3J0aGVhc3RcbiAgICAgIF0sXG4gICAgfSlcbiAgICBtYXAub24oJ2xvYWQnLCAoKSA9PiB7XG4gICAgICBhZGRXYXJkcyhtYXApXG4gICAgICBhZGREb3RzKG1hcClcbiAgICAgIC8vIGFkZFRUQyhtYXApXG4gICAgICBhZGRNYXNrKG1hcClcbiAgICAgIGFkZEdyb3VuZChtYXApXG4gICAgfSlcbiAgfSlcbjwvc2NyaXB0PlxuXG48SGVhZCB7dGl0bGV9IG51bT1cIjAzXCIgc3ViPVwiT2N0IDIwMjJcIiAvPlxuPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiPlxuICA8ZGl2IGlkPVwibWFwXCIgLz5cbjwvZGl2PlxuPEZvb3Qge3RpdGxlfSAvPlxuXG48c3R5bGU+XG4gIC5jb250YWluZXIge1xuICAgIC8qIG1hcmdpbjogM3JlbTsgKi9cbiAgICAvKiB3aWR0aDogMTAwdnc7ICovXG4gICAgLyogbWluLWhlaWdodDogODAwcHg7ICovXG4gICAgYm9yZGVyOiAxcHggc29saWQgZ3JleTtcbiAgICBib3JkZXItcmFkaXVzOiA1cHg7XG4gICAgYm94LXNoYWRvdzogMnB4IDJweCA4cHggMHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcbiAgICBtYXJnaW46IDUlO1xuICAgIHBhZGRpbmc6IDBweDtcbiAgICBvdmVyZmxvdzogaGlkZGVuO1xuICB9XG4gICNtYXAge1xuICAgIG1pbi13aWR0aDogMTAwJTtcbiAgICBtaW4taGVpZ2h0OiA3MDBweDtcbiAgfVxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUE4Q0UsVUFBVSxlQUFDLENBQUMsQUFJVixNQUFNLENBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQ3RCLGFBQWEsQ0FBRSxHQUFHLENBQ2xCLFVBQVUsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FDOUMsTUFBTSxDQUFFLEVBQUUsQ0FDVixPQUFPLENBQUUsR0FBRyxDQUNaLFFBQVEsQ0FBRSxNQUFNLEFBQ2xCLENBQUMsQUFDRCxJQUFJLGVBQUMsQ0FBQyxBQUNKLFNBQVMsQ0FBRSxJQUFJLENBQ2YsVUFBVSxDQUFFLEtBQUssQUFDbkIsQ0FBQyJ9 */";
    	append_dev(document.head, style);
    }

    function create_fragment$2(ctx) {
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
    				num: "03",
    				sub: "Oct 2022"
    			},
    			$$inline: true
    		});

    	foot = new Foot({
    			props: { title: /*title*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(head.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			div0 = element("div");
    			t1 = space();
    			create_component(foot.$$.fragment);
    			attr_dev(div0, "id", "map");
    			attr_dev(div0, "class", "svelte-1uoqds8");
    			add_location(div0, file$2, 41, 2, 1157);
    			attr_dev(div1, "class", "container svelte-1uoqds8");
    			add_location(div1, file$2, 40, 0, 1131);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(head, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			insert_dev(target, t1, anchor);
    			mount_component(foot, target, anchor);
    			current = true;
    		},
    		p: noop,
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
    			destroy_component(head, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t1);
    			destroy_component(foot, detaching);
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
    	mapboxgl__default['default'].accessToken = "pk.eyJ1Ijoic3BlbmNlcm1vdW50YWluIiwiYSI6Inp5UVZEY3cifQ.dh-_SvkPgv9YOQZLG5ZHKg";
    	let title = "Active building permits in Toronto";

    	onMount(async () => {
    		const map = new mapboxgl__default['default'].Map({
    				container: "map", // container ID
    				style: "mapbox://styles/spencermountain/cl8hsb6pu000b14pvl6ygi76f",
    				center: [-79.43, 43.65],
    				pitch: 55,
    				bearing: 5,
    				zoom: 11.1,
    				projection: "globe",
    				maxBounds: [-79.68507, 43.4204, -79.0349, 44.0492], //southwest
    				//northeast
    				
    			});

    		map.on("load", () => {
    			addWards(map);
    			addDots(map);

    			// addTTC(map)
    			addMask(map);

    			addMask$1(map);
    		});
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Head,
    		Foot,
    		onMount,
    		addWards,
    		addDots,
    		addMask,
    		addGround: addMask$1,
    		mapboxgl: mapboxgl__default['default'],
    		title
    	});

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
    		if (!document.getElementById("svelte-1uoqds8-style")) add_css$2();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$2.name
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

}(mapboxgl));
