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

    /* drafts/toronto-elections/Post.svelte generated by Svelte v3.29.0 */
    const file$2 = "drafts/toronto-elections/Post.svelte";

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-1te0rxq-style";
    	style.textContent = ".container.svelte-1te0rxq{margin:3rem;max-width:800px;padding-right:2rem;padding-top:3rem;padding-bottom:3rem;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2)}.year.svelte-1te0rxq{min-height:90px}.digit.svelte-1te0rxq{width:80px;display:flex;flex-direction:row;justify-content:center;align-items:center;margin-bottom:1rem;color:grey}.person.svelte-1te0rxq{height:80%;width:500px;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2);margin-right:4px;border-radius:5px}.person.svelte-1te0rxq:hover{box-shadow:4px 4px 8px 0px rgba(0, 0, 0, 0.4)}.other.svelte-1te0rxq{background-color:lightgrey}.row.svelte-1te0rxq{display:flex;flex-direction:row;justify-content:center;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch}.people.svelte-1te0rxq{width:400px;display:flex;flex-direction:row;justify-content:stretch;align-items:flex-start;text-align:left;flex-wrap:nowrap;align-self:stretch}.all.svelte-1te0rxq{display:flex;flex-direction:column;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch}.col.svelte-1te0rxq{display:flex;flex-direction:column;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBIZWFkIGZyb20gJy4uLy4uL2NvbXBvbmVudHMvSGVhZC5zdmVsdGUnXG4gIGltcG9ydCBGb290IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvRm9vdC5zdmVsdGUnXG4gIGltcG9ydCBuYW1lcyBmcm9tICcuL2NvbG9ycy5qcydcblxuICBpbXBvcnQgZGF0YSBmcm9tICcuL2RhdGEuanMnXG4gIGxldCBjb2xvcnMgPSB7XG4gICAgJ0plbm5pZmVyIEtlZXNtYWF0JzogbmFtZXNbJ3BpbmsnXSxcbiAgICAnSmFjayBMYXl0b24nOiBuYW1lc1sneWVsbG93J10sXG4gICAgJ0JhcmJhcmEgSGFsbCc6IG5hbWVzWydtdWQnXSxcbiAgICAnQS4gSHVtbWVyJzogbmFtZXNbJ3BpbmsnXSxcbiAgICAnR2VvcmdlIFNtaXRoZXJtYW4nOiBuYW1lc1snZnVzY2lhJ10sXG4gICAgJ0dpbCBQZcOxYWxvc2EnOiBuYW1lc1sncm95YWwnXSxcbiAgICAnSnVuZSBSb3dsYW5kcyc6IG5hbWVzWyd0dWxpcCddLFxuICAgICdKb2huIFRvcnknOiBuYW1lc1snc2VhJ10sXG4gICAgJ0RvdWcgRm9yZCc6IG5hbWVzWydza3knXSxcbiAgICAnT2xpdmlhIENob3cnOiBuYW1lc1snb2xpdmUnXSxcbiAgICAnQXJ0IEVnZ2xldG9uJzogbmFtZXNbJ3N1ZWRlJ10sXG4gICAgJ05hdGhhbiBQaGlsbGlwcyc6IG5hbWVzWydza3knXSxcbiAgICAnV2lsbGlhbSBEZW5uaXNvbic6IG5hbWVzWydncmV5Ymx1ZSddLFxuICAgICdQaGlsaXAgR2l2ZW5zJzogbmFtZXNbJ3R1bGlwJ10sXG4gICAgJ0RhdmlkIENyb21iaWUnOiBuYW1lc1snb3JhbmdlJ10sXG4gICAgXCJUb255IE8nRG9ub2h1ZVwiOiBuYW1lc1snZ3JlZW4nXSxcbiAgICAnQWxsYW4gTGFtcG9ydCc6IG5hbWVzWydyZWQnXSxcbiAgICAnU3RlcGhlbiBDbGFya3NvbnQnOiBuYW1lc1snZmlyZSddLFxuICAgICdNZWwgTGFzdG1hbic6IG5hbWVzWydjaGVycnknXSxcbiAgICAnVG9va2VyIEdvbWJlcmcnOiBuYW1lc1snZmlyZSddLFxuICAgICdEYXZpZCBNaWxsZXInOiBuYW1lc1snYnJvd24nXSxcbiAgICAnUm9iIEZvcmQnOiBuYW1lc1snZmlyZSddLFxuICAgICdEb3VnIEZvcmQnOiBuYW1lc1snZmlyZSddLFxuICAgICdDaGxvZS1NYXJpZSBCcm93bic6IG5hbWVzWydyZWQnXSxcbiAgICAnSm9lIFBhbnRhbG9uZSc6IG5hbWVzWydzbGF0ZSddLFxuICAgICdDYXJvbGFubiBXcmlnaHQnOiBuYW1lc1snZ3JlZW4nXSxcbiAgICAnQW5uZSBKb2huc3Rvbic6IG5hbWVzWydvbGl2ZSddLFxuICAgICdKb2huIFNld2VsbCc6IG5hbWVzWydibHVlJ10sXG4gICAgJ0RvbiBBbmRyZXdzJzogbmFtZXNbJ3JlZCddLFxuICAgICdNYXJnYXJldCBDYW1wYmVsbCc6IG5hbWVzWydyb3VnZSddLFxuICAgICdTdGVwaGVuIENsYXJrc29uJzogbmFtZXNbJ2JlaWdlJ10sXG4gICAgJ0RvbmFsZCBTdW1tZXJ2aWxsZSc6IG5hbWVzWydncmV5Z3JlZW4nXSxcbiAgICAnQXJ0aHVyIEouIEJyb3duJzogbmFtZXNbJ3NsYXRlJ10sXG4gICAgJ0ZvcmQgQnJhbmQnOiBuYW1lc1snb2xpdmUnXSxcbiAgICAnQXJ0aHVyIEJyb3duJzogbmFtZXNbJ2dyZWVuJ10sXG4gICAgJ0xlc2xpZSBTYXVuZGVycyc6IG5hbWVzWydwdXJwbGUnXSxcbiAgICAnUm95IEUuIEJlbHllYSc6IG5hbWVzWydncmV5Z3JlZW4nXSxcbiAgICAnUm9zcyBEb3dzb24nOiBuYW1lc1snb3JhbmdlJ10sXG4gICAgJ0hpcmFtIEUuIE1jQ2FsbHVtJzogbmFtZXNbJ3BpbmsnXSxcbiAgICAnUm9zcyBEb3dzb24nOiBuYW1lc1snZ3JleXB1cnBsZSddLFxuICAgICdDaGFybGVzIE1haG9uZXknOiBuYW1lc1sncm9zZSddLFxuICB9XG4gIGV4cG9ydCBsZXQgdGl0bGUgPSAnRWxlY3Rpb25zIGluIFRvcm9udG8nXG4gIGRhdGEuZm9yRWFjaCgobywgaSkgPT4ge1xuICAgIGxldCBzdW0gPSAwXG4gICAgby5wZW9wbGUuZm9yRWFjaCgocCkgPT4ge1xuICAgICAgbGV0IG51bSA9IHBhcnNlSW50KHAucGVyY2VudC5yZXBsYWNlKC8lLywgJycpKVxuICAgICAgc3VtICs9IG51bVxuICAgIH0pXG4gICAgby55ZWFycyA9IDRcbiAgICBpZiAoZGF0YVtpICsgMV0pIHtcbiAgICAgIG8ueWVhcnMgPSBkYXRhW2kgKyAxXS55ZWFyIC0gby55ZWFyXG4gICAgICBpZiAoby55ZWFycyA8PSAwKSB7XG4gICAgICAgIG8ueWVhcnMgPSAxXG4gICAgICB9XG4gICAgfVxuICAgIG8ub3RoZXIgPSAxMDAgLSBzdW1cbiAgfSlcbjwvc2NyaXB0PlxuXG48ZGl2IGNsYXNzPVwiYWxsXCI+XG4gIDxIZWFkIHt0aXRsZX0gbnVtPVwiMTFcIiAvPlxuICA8ZGl2IGNsYXNzPVwiY29udGFpbmVyIGNvbFwiPlxuICAgIHsjZWFjaCBkYXRhIGFzIG8sIGl9XG4gICAgICA8IS0tIDxkaXYgY2xhc3M9XCJyb3dcIiBzdHlsZT1cImhlaWdodDp7by55ZWFycyAqIDQwfXB4O1wiPiAtLT5cbiAgICAgIDxkaXYgY2xhc3M9XCJyb3cgeWVhclwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGlnaXRcIj57by55ZWFyfTwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwicGVvcGxlXCI+XG4gICAgICAgICAgeyNlYWNoIG8ucGVvcGxlIGFzIHAsIGl9XG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgIGNsYXNzPVwicGVyc29uXCJcbiAgICAgICAgICAgICAgc3R5bGU9XCJ3aWR0aDp7cC5wZXJjZW50fTsgYmFja2dyb3VuZC1jb2xvcjp7Y29sb3JzW3AubmFtZV0gfHwgJ3N0ZWVsYmx1ZSd9O1wiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDwhLS0ge3AubmFtZX0gLS0+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICB7L2VhY2h9XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInBlcnNvbiBvdGhlclwiIHN0eWxlPVwid2lkdGg6e28ub3RoZXJ9JTsgXCIgLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICB7L2VhY2h9XG4gIDwvZGl2PlxuICA8Rm9vdCB7dGl0bGV9IC8+XG48L2Rpdj5cblxuPHN0eWxlPlxuICAuY29udGFpbmVyIHtcbiAgICBtYXJnaW46IDNyZW07XG4gICAgbWF4LXdpZHRoOiA4MDBweDtcbiAgICBwYWRkaW5nLXJpZ2h0OiAycmVtO1xuICAgIHBhZGRpbmctdG9wOiAzcmVtO1xuICAgIHBhZGRpbmctYm90dG9tOiAzcmVtO1xuICAgIGJveC1zaGFkb3c6IDJweCAycHggOHB4IDBweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gIH1cbiAgLnllYXIge1xuICAgIG1pbi1oZWlnaHQ6IDkwcHg7XG4gIH1cbiAgLmRpZ2l0IHtcbiAgICB3aWR0aDogODBweDtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XG4gICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICBtYXJnaW4tYm90dG9tOiAxcmVtO1xuICAgIGNvbG9yOiBncmV5O1xuICB9XG4gIC5wZXJzb24ge1xuICAgIGhlaWdodDogODAlO1xuICAgIHdpZHRoOiA1MDBweDtcbiAgICBib3gtc2hhZG93OiAycHggMnB4IDhweCAwcHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgIG1hcmdpbi1yaWdodDogNHB4O1xuICAgIGJvcmRlci1yYWRpdXM6IDVweDtcbiAgfVxuICAucGVyc29uOmhvdmVyIHtcbiAgICBib3gtc2hhZG93OiA0cHggNHB4IDhweCAwcHggcmdiYSgwLCAwLCAwLCAwLjQpO1xuICB9XG4gIC5vdGhlciB7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogbGlnaHRncmV5O1xuICB9XG4gIC5yb3cge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgYWxpZ24tc2VsZjogc3RyZXRjaDtcbiAgfVxuICAucGVvcGxlIHtcbiAgICB3aWR0aDogNDAwcHg7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgIGp1c3RpZnktY29udGVudDogc3RyZXRjaDtcbiAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcbiAgICB0ZXh0LWFsaWduOiBsZWZ0O1xuICAgIGZsZXgtd3JhcDogbm93cmFwO1xuICAgIGFsaWduLXNlbGY6IHN0cmV0Y2g7XG4gIH1cbiAgLmFsbCB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYXJvdW5kO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIGZsZXgtd3JhcDogd3JhcDtcbiAgICBhbGlnbi1zZWxmOiBzdHJldGNoO1xuICB9XG4gIC5jb2wge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWFyb3VuZDtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBmbGV4LXdyYXA6IHdyYXA7XG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBNEZFLFVBQVUsZUFBQyxDQUFDLEFBQ1YsTUFBTSxDQUFFLElBQUksQ0FDWixTQUFTLENBQUUsS0FBSyxDQUNoQixhQUFhLENBQUUsSUFBSSxDQUNuQixXQUFXLENBQUUsSUFBSSxDQUNqQixjQUFjLENBQUUsSUFBSSxDQUNwQixVQUFVLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEFBQ2hELENBQUMsQUFDRCxLQUFLLGVBQUMsQ0FBQyxBQUNMLFVBQVUsQ0FBRSxJQUFJLEFBQ2xCLENBQUMsQUFDRCxNQUFNLGVBQUMsQ0FBQyxBQUNOLEtBQUssQ0FBRSxJQUFJLENBQ1gsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsR0FBRyxDQUNuQixlQUFlLENBQUUsTUFBTSxDQUN2QixXQUFXLENBQUUsTUFBTSxDQUNuQixhQUFhLENBQUUsSUFBSSxDQUNuQixLQUFLLENBQUUsSUFBSSxBQUNiLENBQUMsQUFDRCxPQUFPLGVBQUMsQ0FBQyxBQUNQLE1BQU0sQ0FBRSxHQUFHLENBQ1gsS0FBSyxDQUFFLEtBQUssQ0FDWixVQUFVLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQzlDLFlBQVksQ0FBRSxHQUFHLENBQ2pCLGFBQWEsQ0FBRSxHQUFHLEFBQ3BCLENBQUMsQUFDRCxzQkFBTyxNQUFNLEFBQUMsQ0FBQyxBQUNiLFVBQVUsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQUFDaEQsQ0FBQyxBQUNELE1BQU0sZUFBQyxDQUFDLEFBQ04sZ0JBQWdCLENBQUUsU0FBUyxBQUM3QixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxNQUFNLENBQ3ZCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLFNBQVMsQ0FBRSxJQUFJLENBQ2YsVUFBVSxDQUFFLE9BQU8sQUFDckIsQ0FBQyxBQUNELE9BQU8sZUFBQyxDQUFDLEFBQ1AsS0FBSyxDQUFFLEtBQUssQ0FDWixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLGVBQWUsQ0FBRSxPQUFPLENBQ3hCLFdBQVcsQ0FBRSxVQUFVLENBQ3ZCLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLFNBQVMsQ0FBRSxNQUFNLENBQ2pCLFVBQVUsQ0FBRSxPQUFPLEFBQ3JCLENBQUMsQUFDRCxJQUFJLGVBQUMsQ0FBQyxBQUNKLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLE1BQU0sQ0FDdEIsZUFBZSxDQUFFLFlBQVksQ0FDN0IsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsVUFBVSxDQUFFLE1BQU0sQ0FDbEIsU0FBUyxDQUFFLElBQUksQ0FDZixVQUFVLENBQUUsT0FBTyxBQUNyQixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLGVBQWUsQ0FBRSxZQUFZLENBQzdCLFdBQVcsQ0FBRSxNQUFNLENBQ25CLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLFNBQVMsQ0FBRSxJQUFJLEFBQ2pCLENBQUMifQ== */";
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

    // (76:10) {#each o.people as p, i}
    function create_each_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "person svelte-1te0rxq");
    			set_style(div, "width", /*p*/ ctx[5].percent);
    			set_style(div, "background-color", /*colors*/ ctx[1][/*p*/ ctx[5].name] || "steelblue");
    			add_location(div, file$2, 76, 12, 2405);
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
    		source: "(76:10) {#each o.people as p, i}",
    		ctx
    	});

    	return block;
    }

    // (71:4) {#each data as o, i}
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
    			attr_dev(div0, "class", "digit svelte-1te0rxq");
    			add_location(div0, file$2, 73, 8, 2295);
    			attr_dev(div1, "class", "person other svelte-1te0rxq");
    			set_style(div1, "width", /*o*/ ctx[2].other + "%");
    			add_location(div1, file$2, 83, 10, 2623);
    			attr_dev(div2, "class", "people svelte-1te0rxq");
    			add_location(div2, file$2, 74, 8, 2337);
    			attr_dev(div3, "class", "row year svelte-1te0rxq");
    			add_location(div3, file$2, 72, 6, 2264);
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
    		source: "(71:4) {#each data as o, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div1;
    	let head;
    	let t0;
    	let div0;
    	let t1;
    	let foot;
    	let current;

    	head = new Head({
    			props: { title: /*title*/ ctx[0], num: "11" },
    			$$inline: true
    		});

    	let each_value = data;
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
    			div1 = element("div");
    			create_component(head.$$.fragment);
    			t0 = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			create_component(foot.$$.fragment);
    			attr_dev(div0, "class", "container col svelte-1te0rxq");
    			add_location(div0, file$2, 69, 2, 2139);
    			attr_dev(div1, "class", "all svelte-1te0rxq");
    			add_location(div1, file$2, 67, 0, 2091);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			mount_component(head, div1, null);
    			append_dev(div1, t0);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_dev(div1, t1);
    			mount_component(foot, div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const head_changes = {};
    			if (dirty & /*title*/ 1) head_changes.title = /*title*/ ctx[0];
    			head.$set(head_changes);

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
    						each_blocks[i].m(div0, null);
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
    			if (detaching) detach_dev(div1);
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

    	$$self.$capture_state = () => ({ Head, Foot, names, data, colors, title });

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
    		if (!document.getElementById("svelte-1te0rxq-style")) add_css$2();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { title: 0 });

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
