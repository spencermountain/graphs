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
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
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
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.22.3' }, detail)));
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
        if (text.data === data)
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

    /* components/Head.svelte generated by Svelte v3.22.3 */

    const file = "components/Head.svelte";

    function create_fragment(ctx) {
    	let div;
    	let a;
    	let t0;
    	let t1;
    	let t2;
    	let t3;

    	const block = {
    		c: function create() {
    			div = element("div");
    			a = element("a");
    			t0 = text("〱 ./");
    			t1 = text(/*year*/ ctx[1]);
    			t2 = text("/ ");
    			t3 = text(/*num*/ ctx[0]);
    			attr_dev(a, "class", "link f1 blue svelte-7y3xyx");
    			attr_dev(a, "href", "../../");
    			add_location(a, file, 34, 2, 601);
    			attr_dev(div, "class", "blue ml1 goleft left svelte-7y3xyx");
    			add_location(div, file, 33, 0, 564);
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
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*num*/ 1) set_data_dev(t3, /*num*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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
    	let year = new Date().getFullYear();
    	let { num = "01" } = $$props;
    	const writable_props = ["num"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Head> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Head", $$slots, []);

    	$$self.$set = $$props => {
    		if ("num" in $$props) $$invalidate(0, num = $$props.num);
    	};

    	$$self.$capture_state = () => ({ year, num });

    	$$self.$inject_state = $$props => {
    		if ("year" in $$props) $$invalidate(1, year = $$props.year);
    		if ("num" in $$props) $$invalidate(0, num = $$props.num);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [num, year];
    }

    class Head extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { num: 0 });

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
    }

    /* components/Foot.svelte generated by Svelte v3.22.3 */

    const file$1 = "components/Foot.svelte";

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
    function create_if_block(ctx) {
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
    		id: create_if_block.name,
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
    		if (/*num*/ ctx[0] && /*year*/ ctx[1]) return create_if_block;
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
    	let { num = "" } = $$props;
    	let { year = "" } = $$props;
    	const writable_props = ["num", "year"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Foot> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Foot", $$slots, []);

    	$$self.$set = $$props => {
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

    function noop$1() { }
    function assign(tar, src) {
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
    function set_store_value(store, ret, value = ret) {
        store.set(value);
        return ret;
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
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text$1(data) {
        return document.createTextNode(data);
    }
    function space$1() {
        return text$1(' ');
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
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
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
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
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
    function group_outros() {
        outros$1 = {
            r: 0,
            c: [],
            p: outros$1 // parent group
        };
    }
    function check_outros() {
        if (!outros$1.r) {
            run_all$1(outros$1.c);
        }
        outros$1 = outros$1.p;
    }
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
    function create_component$1(block) {
        block && block.c();
    }
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
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
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
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev$1(type, detail) {
        document.dispatchEvent(custom_event$1(type, Object.assign({ version: '3.22.2' }, detail)));
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
    function set_data_dev$1(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev$1("SvelteDOMSetData", { node: text, data });
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

    // add forward/backwards links
    const addLinks = function (byCol) {
      byCol.forEach((nodes, i) => {
        nodes.forEach((node) => {
          if (node.to && byCol[i + 1]) {
            let foundTo = byCol[i + 1].find((n) => n.name === node.to);
            if (foundTo) {
              node.tos.push(foundTo);
              foundTo.froms.push(node);
            }
          }
          // allow backward-set links, too
          if (node.from && byCol[i - 1]) {
            let found = byCol[i - 1].find((n) => n.name === node.from);
            // found.tos.push(node)
            // node.froms.push(found)
          }
        });
      });
    };

    const addStack = function (byCol) {
      byCol.forEach((nodes) => {
        let lastOne = null;
        nodes.forEach((node) => {
          if (node.to === lastOne) {
            node.stacked = true;
          }
          lastOne = node.to;
        });
      });
    };

    const byColumn = function (items) {
      let byCol = [];
      items.forEach((node) => {
        if (node.value) {
          node.value = Number(node.value);
        }
        byCol[node.col] = byCol[node.col] || [];
        node.top = 0;
        node.inputs = 0;
        node.froms = [];
        node.stacked = false;

        node.tos = [];
        byCol[node.col].push(node);
      });
      byCol.shift();
      return byCol
    };

    // turn into array of arrays (by Column)
    const fmt = function (items) {
      let byCol = byColumn(items);
      addLinks(byCol);
      addStack(byCol);
      return byCol
    };

    //get value from sum of inputs
    const getValues = function (byCol) {
      byCol.forEach((nodes) => {
        nodes.forEach((node) => {
          node.sum = 0;
          node.froms.forEach((n) => (node.sum += n.value));
          if (node.sum > node.value) {
            node.value = node.sum;
          }
        });
      });
      return byCol
    };

    const bySum = function (byCol) {
      byCol.forEach((nodes) => {
        let already = 0;
        nodes.forEach((node) => {
          node.top = already;
          already += node.value;
        });
      });
      return byCol
    };

    // align each node with right-node
    const byNeighbour = function (byCol) {
      byCol.forEach((nodes) => {
        nodes.forEach((node, n) => {
          if (node.tos.length === 1 && node.tos[0].top > node.top) {
            console.log('moving ' + node.name);
            node.top = node.tos[0].top;
            // move down stacked-nodes as well
            let already = node.top + node.value;
            for (let i = n + 1; i < nodes.length; i += 1) {
              // console.log('... and moving ' + nodes[i].name)
              if (nodes[i].stacked === true) {
                nodes[i].top = already;
                already += nodes[i].value;
              } else {
                break
              }
            }
          }
        });
      });
      return byCol
    };

    const getMax = function (byCol) {
      let max = 0;
      byCol.forEach((nodes) => {
        nodes.forEach((node) => {
          let total = node.top + node.value;
          if (total > max) {
            max = total;
          }
        });
      });
      return max
    };

    // splay-out stacked nodes a bit
    const addMargin = function (byCol) {
      let max = getMax(byCol);
      let margin = max * 0.015;
      byCol.forEach((nodes) => {
        let count = 1;
        nodes.forEach((node) => {
          if (node.stacked) {
            node.top += margin * count;
            count += 1;
          } else {
            count = 1;
          }
        });
      });
      return byCol
    };

    const findStart = function (byCol) {
      byCol = bySum(byCol);
      // wiggle-this out by right-neighbour
      byCol = byNeighbour(byCol);
      byCol = addMargin(byCol);
      byCol = byNeighbour(byCol);
      return byCol
    };
    var _03GetTops = findStart;

    //a very-tiny version of d3-scale's scaleLinear
    const scaleLinear = function (obj) {
      let world = obj.world || [];
      let minmax = obj.minmax || obj.minMax || [];
      const calc = (num) => {
        let range = minmax[1] - minmax[0];
        let percent = (num - minmax[0]) / range;
        let size = world[1] - world[0];
        return parseInt(size * percent, 10)
      };

      return calc
    };

    // let scale = scaleLinear({
    //   world: [0, 300],
    //   minmax: [0, 100]
    // })
    // console.log(scale(50))

    var scale = /*#__PURE__*/Object.freeze({
        __proto__: null,
        'default': scaleLinear
    });

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    function getCjsExportFromNamespace (n) {
    	return n && n['default'] || n;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var linear = getCjsExportFromNamespace(scale);

    const topRoom = 20;

    const getMax$1 = function (byCol) {
      let max = 0;
      byCol.forEach((nodes) => {
        nodes.forEach((node) => {
          let total = node.top + node.value;
          if (total > max) {
            max = total;
          }
        });
      });
      return max
    };

    const applyDx = function (node) {
      if (node.dx) {
        node.x += node.dx;
      }
      if (node.dy) {
        node.y += node.dy;
      }
      return node
    };

    const shrinkLongNodes = function (byCol) {
      byCol.forEach((nodes) => {
        if (nodes.length === 1) {
          nodes[0].y += topRoom;
        }
      });
    };

    const makePoints = function (byCol, width, height, nodeWidth) {
      let max = getMax$1(byCol);
      let yScale = linear({ minmax: [0, max], world: [0, height] });
      let xScale = linear({ minmax: [0, byCol.length], world: [0, width] });
      byCol.forEach((nodes) => {
        nodes.forEach((node) => {
          node.y = yScale(node.top);
          node.height = yScale(node.value);
          node.x = xScale(node.col - 1);
          node.width = nodeWidth;
          node = applyDx(node);
        });
      });
      // give cols with many margins more space
      shrinkLongNodes(byCol);
      return byCol
    };
    var _04MakePoints = makePoints;

    const pinchDown = function (from, to) {
      return ` L${to[0]},${to[1]}`
      // return ` S${from[0] + 50},${from[1] + 15}   ${to[0]},${to[1]}`
    };
    const pinchUp = function (from, to) {
      return ` L${to[0]},${to[1]}`
      // return ` S${from[0] + 50},${from[1] - 15}   ${to[0]},${to[1]}`
    };

    const makePath = function (from, to) {
      let already = from.alreadyFrom;
      let path = `M${from.x + from.width},${from.y + already}`; // (source-top)
      // dest-top
      path += ` L${to.x},${to.y}`;
      // dest-bottom
      path += ` L${to.x},${to.y + to.height}`;
      // source-bottom
      path += ` L${from.x + from.width},${from.y + to.height + already}`;
      path += ` Z`;
      return path
    };

    const backwardPaths = function (nodes) {
      let paths = [];
      nodes.forEach((to) => {
        if (to.from) {
          let source = nodes.find((n) => n.name === to.from);
          source.alreadyFrom = source.alreadyFrom || 0;
          let path = makePath(source, to);
          source.alreadyFrom += to.height;
          paths.push(path);
        }
      });
      return paths
    };

    const makePaths = function (nodes) {
      let paths = [];
      nodes.forEach((node) => {
        let fromX = node.x + node.width;
        let fromY = node.y;
        let h = node.height;
        node.tos.forEach((to) => {
          to.already = to.already || 0;
          // node top-right
          let d = `M${fromX},${fromY}`;
          // dest top-left
          d += pinchDown([fromX, fromY], [to.x, to.y + to.already]);
          // dest bottom-left
          d += ` L${to.x},${to.y + h + to.already}`;
          // back to bottom of node
          d += pinchUp([to.x, to.y + h + to.already], [fromX, fromY + h]);
          // fill it
          d += ` Z`;
          to.already += node.height;

          paths.push(d);
        });
      });
      let backward = backwardPaths(nodes);
      paths = paths.concat(backward);
      return paths
    };
    var _05MakePaths = makePaths;

    let toFlat = function (byCol) {
      let list = [];
      byCol.forEach((nodes) => {
        nodes.forEach((node) => {
          list.push(node);
        });
      });
      // remove empty nodes
      list = list.filter((n) => n.value);
      return list
    };

    const layout = function (items, width, height, nodeWidth) {
      let byCol = fmt(items);
      // add value
      byCol = getValues(byCol);
      // add top
      byCol = _03GetTops(byCol);
      // add x, y, width, height
      byCol = _04MakePoints(byCol, width, height, nodeWidth);

      let nodes = toFlat(byCol);
      let paths = _05MakePaths(nodes);

      return {
        nodes: nodes,
        paths: paths,
        nodeWidth: nodeWidth,
      }
    };

    /* Users/spencer/mountain/somehow-sankey/src/Dots.svelte generated by Svelte v3.22.3 */

    const { console: console_1 } = globals;
    const file$2 = "Users/spencer/mountain/somehow-sankey/src/Dots.svelte";

    function create_fragment$2(ctx) {
    	let svg;
    	let defs;
    	let pattern;
    	let circle;
    	let rect;
    	let rect_fill_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			pattern = svg_element("pattern");
    			circle = svg_element("circle");
    			rect = svg_element("rect");
    			attr_dev$1(circle, "fill", /*color*/ ctx[0]);
    			attr_dev$1(circle, "cx", "4");
    			attr_dev$1(circle, "cy", "4");
    			attr_dev$1(circle, "r", "2");
    			add_location$1(circle, file$2, 45, 6, 900);
    			attr_dev$1(pattern, "id", /*id*/ ctx[1]);
    			attr_dev$1(pattern, "x", "0");
    			attr_dev$1(pattern, "y", "0");
    			attr_dev$1(pattern, "width", "6");
    			attr_dev$1(pattern, "height", "6");
    			attr_dev$1(pattern, "patternUnits", "userSpaceOnUse");
    			add_location$1(pattern, file$2, 38, 4, 780);
    			add_location$1(defs, file$2, 37, 2, 769);
    			attr_dev$1(rect, "x", "0");
    			attr_dev$1(rect, "y", "0");
    			attr_dev$1(rect, "width", "100%");
    			attr_dev$1(rect, "height", "100%");
    			attr_dev$1(rect, "fill", rect_fill_value = "url(#" + /*id*/ ctx[1] + ")");
    			add_location$1(rect, file$2, 49, 2, 972);
    			attr_dev$1(svg, "width", "100%");
    			attr_dev$1(svg, "height", "100%");
    			add_location$1(svg, file$2, 36, 0, 734);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, svg, anchor);
    			append_dev$1(svg, defs);
    			append_dev$1(defs, pattern);
    			append_dev$1(pattern, circle);
    			append_dev$1(svg, rect);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*color*/ 1) {
    				attr_dev$1(circle, "fill", /*color*/ ctx[0]);
    			}
    		},
    		i: noop$1,
    		o: noop$1,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(svg);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function uuid() {
    	return ("xxxxxx").replace(/[xy]/g, function (c) {
    		var r = Math.random() * 16 | 0, v = c == "x" ? r : r & 3 | 8;
    		return v.toString(16);
    	});
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { color = "steelblue" } = $$props;
    	let id = uuid();
    	console.log(color);
    	const writable_props = ["color"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Dots> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots$1("Dots", $$slots, []);

    	$$self.$set = $$props => {
    		if ("color" in $$props) $$invalidate(0, color = $$props.color);
    	};

    	$$self.$capture_state = () => ({ color, uuid, id });

    	$$self.$inject_state = $$props => {
    		if ("color" in $$props) $$invalidate(0, color = $$props.color);
    		if ("id" in $$props) $$invalidate(1, id = $$props.id);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [color, id];
    }

    class Dots extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$2, create_fragment$2, safe_not_equal$1, { color: 0 });

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Dots",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get color() {
    		throw new Error("<Dots>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Dots>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

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

    const items = writable([]);
    let colCount = writable(0);

    var spencerColor = createCommonjsModule(function (module, exports) {
    !function(e){module.exports=e();}(function(){return function u(i,a,c){function f(r,e){if(!a[r]){if(!i[r]){var o="function"==typeof commonjsRequire&&commonjsRequire;if(!e&&o)return o(r,!0);if(d)return d(r,!0);var n=new Error("Cannot find module '"+r+"'");throw n.code="MODULE_NOT_FOUND",n}var t=a[r]={exports:{}};i[r][0].call(t.exports,function(e){return f(i[r][1][e]||e)},t,t.exports,u,i,a,c);}return a[r].exports}for(var d="function"==typeof commonjsRequire&&commonjsRequire,e=0;e<c.length;e++)f(c[e]);return f}({1:[function(e,r,o){r.exports={blue:"#6699cc",green:"#6accb2",yellow:"#e1e6b3",red:"#cc7066",pink:"#F2C0BB",brown:"#705E5C",orange:"#cc8a66",purple:"#d8b3e6",navy:"#335799",olive:"#7f9c6c",fuscia:"#735873",beige:"#e6d7b3",slate:"#8C8C88",suede:"#9c896c",burnt:"#603a39",sea:"#50617A",sky:"#2D85A8",night:"#303b50",rouge:"#914045",grey:"#838B91",mud:"#C4ABAB",royal:"#275291",cherry:"#cc6966",tulip:"#e6b3bc",rose:"#D68881",fire:"#AB5850",greyblue:"#72697D",greygreen:"#8BA3A2",greypurple:"#978BA3",burn:"#6D5685",slategrey:"#bfb0b3",light:"#a3a5a5",lighter:"#d7d5d2",fudge:"#4d4d4d",lightgrey:"#949a9e",white:"#fbfbfb",dimgrey:"#606c74",softblack:"#463D4F",dark:"#443d3d",black:"#333333"};},{}],2:[function(e,r,o){var n=e("./colors"),t={juno:["blue","mud","navy","slate","pink","burn"],barrow:["rouge","red","orange","burnt","brown","greygreen"],roma:["#8a849a","#b5b0bf","rose","lighter","greygreen","mud"],palmer:["red","navy","olive","pink","suede","sky"],mark:["#848f9a","#9aa4ac","slate","#b0b8bf","mud","grey"],salmon:["sky","sea","fuscia","slate","mud","fudge"],dupont:["green","brown","orange","red","olive","blue"],bloor:["night","navy","beige","rouge","mud","grey"],yukon:["mud","slate","brown","sky","beige","red"],david:["blue","green","yellow","red","pink","light"],neste:["mud","cherry","royal","rouge","greygreen","greypurple"],ken:["red","sky","#c67a53","greygreen","#dfb59f","mud"]};Object.keys(t).forEach(function(e){t[e]=t[e].map(function(e){return n[e]||e});}),r.exports=t;},{"./colors":1}],3:[function(e,r,o){var n=e("./colors"),t=e("./combos"),u={colors:n,list:Object.keys(n).map(function(e){return n[e]}),combos:t};r.exports=u;},{"./colors":1,"./combos":2}]},{},[3])(3)});
    });

    /* Users/spencer/mountain/somehow-sankey/src/Sankey.svelte generated by Svelte v3.22.3 */
    const file$3 = "Users/spencer/mountain/somehow-sankey/src/Sankey.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	return child_ctx;
    }

    // (100:8) {#if d.full !== 100}
    function create_if_block_1(ctx) {
    	let div;
    	let current;

    	const dots = new Dots({
    			props: { color: "white" },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			create_component$1(dots.$$.fragment);
    			attr_dev$1(div, "class", "dots svelte-j4zr01");
    			set_style(div, "background-color", /*colors*/ ctx[5][/*d*/ ctx[12].color] || /*d*/ ctx[12].color || /*color*/ ctx[6]);
    			add_location$1(div, file$3, 100, 10, 2287);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);
    			mount_component$1(dots, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*nodes*/ 8) {
    				set_style(div, "background-color", /*colors*/ ctx[5][/*d*/ ctx[12].color] || /*d*/ ctx[12].color || /*color*/ ctx[6]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in$1(dots.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out$1(dots.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div);
    			destroy_component$1(dots);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(100:8) {#if d.full !== 100}",
    		ctx
    	});

    	return block;
    }

    // (114:8) {#if d.append}
    function create_if_block$1(ctx) {
    	let div;
    	let t_value = /*d*/ ctx[12].append + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			t = text$1(t_value);
    			attr_dev$1(div, "class", "append svelte-j4zr01");
    			set_style(div, "color", /*colors*/ ctx[5][/*d*/ ctx[12].color] || /*d*/ ctx[12].color || /*color*/ ctx[6]);
    			add_location$1(div, file$3, 114, 10, 2707);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);
    			append_dev$1(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*nodes*/ 8 && t_value !== (t_value = /*d*/ ctx[12].append + "")) set_data_dev$1(t, t_value);

    			if (dirty & /*nodes*/ 8) {
    				set_style(div, "color", /*colors*/ ctx[5][/*d*/ ctx[12].color] || /*d*/ ctx[12].color || /*color*/ ctx[6]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(114:8) {#if d.append}",
    		ctx
    	});

    	return block;
    }

    // (89:4) {#each nodes as d}
    function create_each_block_1(ctx) {
    	let div3;
    	let div0;
    	let t0;
    	let t1;
    	let div1;
    	let t2_value = /*d*/ ctx[12].name + "";
    	let t2;
    	let t3;
    	let div2;
    	let t4_value = /*fmt*/ ctx[2](/*d*/ ctx[12].value) + "";
    	let t4;
    	let t5;
    	let t6;
    	let current;
    	let if_block0 = /*d*/ ctx[12].full !== 100 && create_if_block_1(ctx);
    	let if_block1 = /*d*/ ctx[12].append && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div3 = element$1("div");
    			div0 = element$1("div");
    			t0 = space$1();
    			if (if_block0) if_block0.c();
    			t1 = space$1();
    			div1 = element$1("div");
    			t2 = text$1(t2_value);
    			t3 = space$1();
    			div2 = element$1("div");
    			t4 = text$1(t4_value);
    			t5 = space$1();
    			if (if_block1) if_block1.c();
    			t6 = space$1();
    			attr_dev$1(div0, "class", "drop svelte-j4zr01");
    			set_style(div0, "width", "100%");
    			set_style(div0, "height", /*d*/ ctx[12].full + "%");
    			set_style(div0, "background-color", /*colors*/ ctx[5][/*d*/ ctx[12].color] || /*d*/ ctx[12].color || /*color*/ ctx[6]);
    			add_location$1(div0, file$3, 95, 8, 2112);
    			attr_dev$1(div1, "class", "label svelte-j4zr01");
    			add_location$1(div1, file$3, 106, 8, 2471);
    			attr_dev$1(div2, "class", "value svelte-j4zr01");
    			set_style(div2, "color", /*colors*/ ctx[5][/*d*/ ctx[12].accent] || /*accent*/ ctx[7]);
    			toggle_class(div2, "tiny", /*d*/ ctx[12].height < 80);
    			add_location$1(div2, file$3, 107, 8, 2513);
    			attr_dev$1(div3, "class", "node svelte-j4zr01");
    			set_style(div3, "left", /*d*/ ctx[12].x + "px");
    			set_style(div3, "top", /*d*/ ctx[12].y + "px");
    			set_style(div3, "width", /*d*/ ctx[12].width + "px");
    			set_style(div3, "height", /*d*/ ctx[12].height + "px");
    			set_style(div3, "border-bottom", "4px solid " + (/*colors*/ ctx[5][/*d*/ ctx[12].accent] || /*d*/ ctx[12].accent || /*accent*/ ctx[7]));
    			set_style(div3, "opacity", /*d*/ ctx[12].opacity || 1);
    			toggle_class(div3, "tiny", /*d*/ ctx[12].height < 80);
    			add_location$1(div3, file$3, 89, 6, 1850);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div3, anchor);
    			append_dev$1(div3, div0);
    			append_dev$1(div3, t0);
    			if (if_block0) if_block0.m(div3, null);
    			append_dev$1(div3, t1);
    			append_dev$1(div3, div1);
    			append_dev$1(div1, t2);
    			append_dev$1(div3, t3);
    			append_dev$1(div3, div2);
    			append_dev$1(div2, t4);
    			append_dev$1(div3, t5);
    			if (if_block1) if_block1.m(div3, null);
    			append_dev$1(div3, t6);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*nodes*/ 8) {
    				set_style(div0, "height", /*d*/ ctx[12].full + "%");
    			}

    			if (!current || dirty & /*nodes*/ 8) {
    				set_style(div0, "background-color", /*colors*/ ctx[5][/*d*/ ctx[12].color] || /*d*/ ctx[12].color || /*color*/ ctx[6]);
    			}

    			if (/*d*/ ctx[12].full !== 100) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*nodes*/ 8) {
    						transition_in$1(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					transition_in$1(if_block0, 1);
    					if_block0.m(div3, t1);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out$1(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if ((!current || dirty & /*nodes*/ 8) && t2_value !== (t2_value = /*d*/ ctx[12].name + "")) set_data_dev$1(t2, t2_value);
    			if ((!current || dirty & /*fmt, nodes*/ 12) && t4_value !== (t4_value = /*fmt*/ ctx[2](/*d*/ ctx[12].value) + "")) set_data_dev$1(t4, t4_value);

    			if (!current || dirty & /*nodes*/ 8) {
    				set_style(div2, "color", /*colors*/ ctx[5][/*d*/ ctx[12].accent] || /*accent*/ ctx[7]);
    			}

    			if (dirty & /*nodes*/ 8) {
    				toggle_class(div2, "tiny", /*d*/ ctx[12].height < 80);
    			}

    			if (/*d*/ ctx[12].append) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$1(ctx);
    					if_block1.c();
    					if_block1.m(div3, t6);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (!current || dirty & /*nodes*/ 8) {
    				set_style(div3, "left", /*d*/ ctx[12].x + "px");
    			}

    			if (!current || dirty & /*nodes*/ 8) {
    				set_style(div3, "top", /*d*/ ctx[12].y + "px");
    			}

    			if (!current || dirty & /*nodes*/ 8) {
    				set_style(div3, "width", /*d*/ ctx[12].width + "px");
    			}

    			if (!current || dirty & /*nodes*/ 8) {
    				set_style(div3, "height", /*d*/ ctx[12].height + "px");
    			}

    			if (!current || dirty & /*nodes*/ 8) {
    				set_style(div3, "border-bottom", "4px solid " + (/*colors*/ ctx[5][/*d*/ ctx[12].accent] || /*d*/ ctx[12].accent || /*accent*/ ctx[7]));
    			}

    			if (!current || dirty & /*nodes*/ 8) {
    				set_style(div3, "opacity", /*d*/ ctx[12].opacity || 1);
    			}

    			if (dirty & /*nodes*/ 8) {
    				toggle_class(div3, "tiny", /*d*/ ctx[12].height < 80);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in$1(if_block0);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out$1(if_block0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div3);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(89:4) {#each nodes as d}",
    		ctx
    	});

    	return block;
    }

    // (127:4) {#each paths as d}
    function create_each_block(ctx) {
    	let path;
    	let path_d_value;
    	let path_stroke_width_value;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev$1(path, "class", "link svelte-j4zr01");
    			attr_dev$1(path, "d", path_d_value = /*d*/ ctx[12]);
    			attr_dev$1(path, "stroke", "none");
    			attr_dev$1(path, "fill", "lightsteelblue");
    			attr_dev$1(path, "stroke-width", path_stroke_width_value = 1);
    			add_location$1(path, file$3, 127, 6, 2979);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, path, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*paths*/ 16 && path_d_value !== (path_d_value = /*d*/ ctx[12])) {
    				attr_dev$1(path, "d", path_d_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(path);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(127:4) {#each paths as d}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let svg;
    	let svg_viewBox_value;
    	let t1;
    	let current;
    	let each_value_1 = /*nodes*/ ctx[3];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out$1(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	let each_value = /*paths*/ ctx[4];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const default_slot_template = /*$$slots*/ ctx[11].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[10], null);

    	const block = {
    		c: function create() {
    			div1 = element$1("div");
    			div0 = element$1("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t0 = space$1();
    			svg = svg_element("svg");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space$1();
    			if (default_slot) default_slot.c();
    			set_style(div0, "position", "absolute");
    			set_style(div0, "width", /*width*/ ctx[0] + "px");
    			set_style(div0, "height", /*height*/ ctx[1] + "px");
    			add_location$1(div0, file$3, 87, 2, 1752);
    			attr_dev$1(svg, "viewBox", svg_viewBox_value = "0,0," + /*width*/ ctx[0] + "," + /*height*/ ctx[1]);
    			attr_dev$1(svg, "width", /*width*/ ctx[0]);
    			attr_dev$1(svg, "height", /*height*/ ctx[1]);
    			add_location$1(svg, file$3, 125, 2, 2896);
    			set_style(div1, "position", "relative");
    			add_location$1(div1, file$3, 86, 0, 1717);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div1, anchor);
    			append_dev$1(div1, div0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div0, null);
    			}

    			append_dev$1(div1, t0);
    			append_dev$1(div1, svg);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(svg, null);
    			}

    			insert_dev$1(target, t1, anchor);

    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*nodes, colors, accent, color, fmt*/ 236) {
    				each_value_1 = /*nodes*/ ctx[3];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    						transition_in$1(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						transition_in$1(each_blocks_1[i], 1);
    						each_blocks_1[i].m(div0, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks_1.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (!current || dirty & /*width*/ 1) {
    				set_style(div0, "width", /*width*/ ctx[0] + "px");
    			}

    			if (!current || dirty & /*height*/ 2) {
    				set_style(div0, "height", /*height*/ ctx[1] + "px");
    			}

    			if (dirty & /*paths*/ 16) {
    				each_value = /*paths*/ ctx[4];
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

    			if (!current || dirty & /*width, height*/ 3 && svg_viewBox_value !== (svg_viewBox_value = "0,0," + /*width*/ ctx[0] + "," + /*height*/ ctx[1])) {
    				attr_dev$1(svg, "viewBox", svg_viewBox_value);
    			}

    			if (!current || dirty & /*width*/ 1) {
    				attr_dev$1(svg, "width", /*width*/ ctx[0]);
    			}

    			if (!current || dirty & /*height*/ 2) {
    				attr_dev$1(svg, "height", /*height*/ ctx[1]);
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 1024) {
    					default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[10], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[10], dirty, null));
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in$1(each_blocks_1[i]);
    			}

    			transition_in$1(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks_1 = each_blocks_1.filter(Boolean);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out$1(each_blocks_1[i]);
    			}

    			transition_out$1(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div1);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev$1(t1);
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
    	let $items;
    	validate_store(items, "items");
    	component_subscribe($$self, items, $$value => $$invalidate(9, $items = $$value));
    	let colors = spencerColor.colors;
    	let { width = 800 } = $$props;
    	let { height = 500 } = $$props;
    	let { nodeWidth = 120 } = $$props;

    	let { fmt = num => {
    		if (num >= 1000000) {
    			num = Math.round(num / 1000000) * 1000000;
    			return String(num / 1000000) + "m";
    		}

    		if (num > 1000) {
    			return String(num / 1000) + "k";
    		}

    		return String(num);
    	} } = $$props;

    	height = Number(height);
    	width = Number(width);
    	let nodes = [];
    	let paths = [];
    	let color = "steelblue";
    	let accent = "#d98b89";

    	onMount(() => {
    		
    		$$invalidate(3, { nodes, paths } = layout($items, width, height, nodeWidth), nodes, $$invalidate(4, paths));
    	}); // console.log(paths)

    	const writable_props = ["width", "height", "nodeWidth", "fmt"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Sankey> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots$1("Sankey", $$slots, ['default']);

    	$$self.$set = $$props => {
    		if ("width" in $$props) $$invalidate(0, width = $$props.width);
    		if ("height" in $$props) $$invalidate(1, height = $$props.height);
    		if ("nodeWidth" in $$props) $$invalidate(8, nodeWidth = $$props.nodeWidth);
    		if ("fmt" in $$props) $$invalidate(2, fmt = $$props.fmt);
    		if ("$$scope" in $$props) $$invalidate(10, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		layout,
    		Dots,
    		items,
    		onMount,
    		c: spencerColor,
    		colors,
    		width,
    		height,
    		nodeWidth,
    		fmt,
    		nodes,
    		paths,
    		color,
    		accent,
    		$items
    	});

    	$$self.$inject_state = $$props => {
    		if ("colors" in $$props) $$invalidate(5, colors = $$props.colors);
    		if ("width" in $$props) $$invalidate(0, width = $$props.width);
    		if ("height" in $$props) $$invalidate(1, height = $$props.height);
    		if ("nodeWidth" in $$props) $$invalidate(8, nodeWidth = $$props.nodeWidth);
    		if ("fmt" in $$props) $$invalidate(2, fmt = $$props.fmt);
    		if ("nodes" in $$props) $$invalidate(3, nodes = $$props.nodes);
    		if ("paths" in $$props) $$invalidate(4, paths = $$props.paths);
    		if ("color" in $$props) $$invalidate(6, color = $$props.color);
    		if ("accent" in $$props) $$invalidate(7, accent = $$props.accent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		width,
    		height,
    		fmt,
    		nodes,
    		paths,
    		colors,
    		color,
    		accent,
    		nodeWidth,
    		$items,
    		$$scope,
    		$$slots
    	];
    }

    class Sankey extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$3, create_fragment$3, safe_not_equal$1, {
    			width: 0,
    			height: 1,
    			nodeWidth: 8,
    			fmt: 2
    		});

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sankey",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get width() {
    		throw new Error("<Sankey>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Sankey>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Sankey>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Sankey>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nodeWidth() {
    		throw new Error("<Sankey>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nodeWidth(value) {
    		throw new Error("<Sankey>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fmt() {
    		throw new Error("<Sankey>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fmt(value) {
    		throw new Error("<Sankey>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Users/spencer/mountain/somehow-sankey/src/Node.svelte generated by Svelte v3.22.3 */

    function create_fragment$4(ctx) {
    	const block = {
    		c: noop$1,
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: noop$1,
    		p: noop$1,
    		i: noop$1,
    		o: noop$1,
    		d: noop$1
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
    	let $colCount;
    	validate_store(colCount, "colCount");
    	component_subscribe($$self, colCount, $$value => $$invalidate(11, $colCount = $$value));
    	let { value = null } = $$props;
    	let { from = null } = $$props;
    	let { name = "" } = $$props;
    	let { full = "100" } = $$props;
    	let { to = "" } = $$props;
    	let { color = "steelblue" } = $$props;
    	let { append = "" } = $$props;
    	let { accent = "#d98b89" } = $$props;
    	let { dy = "0" } = $$props;
    	let { dx = "0" } = $$props;
    	let { opacity = "1" } = $$props;

    	if (typeof value === "string") {
    		value = value.replace(/,/g, "");
    	}

    	let row = {
    		name,
    		to,
    		value: Number(value),
    		full: Number(full),
    		from,
    		dy: Number(dy),
    		dx: Number(dx),
    		color,
    		append,
    		accent,
    		opacity,
    		col: $colCount
    	};

    	items.update(arr => {
    		arr.push(row);
    		return arr;
    	});

    	const writable_props = [
    		"value",
    		"from",
    		"name",
    		"full",
    		"to",
    		"color",
    		"append",
    		"accent",
    		"dy",
    		"dx",
    		"opacity"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Node> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots$1("Node", $$slots, []);

    	$$self.$set = $$props => {
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("from" in $$props) $$invalidate(1, from = $$props.from);
    		if ("name" in $$props) $$invalidate(2, name = $$props.name);
    		if ("full" in $$props) $$invalidate(3, full = $$props.full);
    		if ("to" in $$props) $$invalidate(4, to = $$props.to);
    		if ("color" in $$props) $$invalidate(5, color = $$props.color);
    		if ("append" in $$props) $$invalidate(6, append = $$props.append);
    		if ("accent" in $$props) $$invalidate(7, accent = $$props.accent);
    		if ("dy" in $$props) $$invalidate(8, dy = $$props.dy);
    		if ("dx" in $$props) $$invalidate(9, dx = $$props.dx);
    		if ("opacity" in $$props) $$invalidate(10, opacity = $$props.opacity);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		items,
    		colCount,
    		value,
    		from,
    		name,
    		full,
    		to,
    		color,
    		append,
    		accent,
    		dy,
    		dx,
    		opacity,
    		row,
    		$colCount
    	});

    	$$self.$inject_state = $$props => {
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("from" in $$props) $$invalidate(1, from = $$props.from);
    		if ("name" in $$props) $$invalidate(2, name = $$props.name);
    		if ("full" in $$props) $$invalidate(3, full = $$props.full);
    		if ("to" in $$props) $$invalidate(4, to = $$props.to);
    		if ("color" in $$props) $$invalidate(5, color = $$props.color);
    		if ("append" in $$props) $$invalidate(6, append = $$props.append);
    		if ("accent" in $$props) $$invalidate(7, accent = $$props.accent);
    		if ("dy" in $$props) $$invalidate(8, dy = $$props.dy);
    		if ("dx" in $$props) $$invalidate(9, dx = $$props.dx);
    		if ("opacity" in $$props) $$invalidate(10, opacity = $$props.opacity);
    		if ("row" in $$props) row = $$props.row;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [value, from, name, full, to, color, append, accent, dy, dx, opacity];
    }

    class Node extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$4, create_fragment$4, safe_not_equal$1, {
    			value: 0,
    			from: 1,
    			name: 2,
    			full: 3,
    			to: 4,
    			color: 5,
    			append: 6,
    			accent: 7,
    			dy: 8,
    			dx: 9,
    			opacity: 10
    		});

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Node",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get value() {
    		throw new Error("<Node>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Node>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get from() {
    		throw new Error("<Node>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set from(value) {
    		throw new Error("<Node>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get name() {
    		throw new Error("<Node>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Node>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get full() {
    		throw new Error("<Node>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set full(value) {
    		throw new Error("<Node>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get to() {
    		throw new Error("<Node>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set to(value) {
    		throw new Error("<Node>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Node>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Node>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get append() {
    		throw new Error("<Node>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set append(value) {
    		throw new Error("<Node>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get accent() {
    		throw new Error("<Node>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set accent(value) {
    		throw new Error("<Node>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dy() {
    		throw new Error("<Node>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dy(value) {
    		throw new Error("<Node>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dx() {
    		throw new Error("<Node>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dx(value) {
    		throw new Error("<Node>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get opacity() {
    		throw new Error("<Node>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set opacity(value) {
    		throw new Error("<Node>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const uuid$1 = function () {
      return 'xxxxxx'.replace(/[xy]/g, function (c) {
        let r = (Math.random() * 16) | 0; //eslint-disable-line
        let v = c === 'x' ? r : (r & 0x3) | 0x8; //eslint-disable-line
        return v.toString(16)
      })
    };

    /* Users/spencer/mountain/somehow-sankey/src/Col.svelte generated by Svelte v3.22.3 */
    const file$4 = "Users/spencer/mountain/somehow-sankey/src/Col.svelte";

    function create_fragment$5(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			if (default_slot) default_slot.c();
    			add_location$1(div, file$4, 11, 0, 191);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 2) {
    					default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[1], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null));
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
    			if (default_slot) default_slot.d(detaching);
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
    	let $colCount;
    	validate_store(colCount, "colCount");
    	component_subscribe($$self, colCount, $$value => $$invalidate(0, $colCount = $$value));
    	set_store_value(colCount, $colCount += 1);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Col> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots$1("Col", $$slots, ['default']);

    	$$self.$set = $$props => {
    		if ("$$scope" in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		setContext,
    		getContext,
    		colCount,
    		uuid: uuid$1,
    		$colCount
    	});

    	return [$colCount, $$scope, $$slots];
    }

    class Col extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$5, create_fragment$5, safe_not_equal$1, {});

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Col",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* 2020/cerb-population/Post.svelte generated by Svelte v3.22.3 */
    const file$5 = "2020/cerb-population/Post.svelte";

    // (49:6) <Col>
    function create_default_slot_3(ctx) {
    	let t;
    	let current;

    	const node0 = new Node({
    			props: {
    				name: "CERB",
    				to: "Working Age",
    				value: "8.5",
    				color: "red"
    			},
    			$$inline: true
    		});

    	const node1 = new Node({
    			props: {
    				name: "CPP/OAS",
    				to: "Retired",
    				value: "6.5",
    				color: "blue"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(node0.$$.fragment);
    			t = space();
    			create_component(node1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(node0, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(node1, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(node0.$$.fragment, local);
    			transition_in(node1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(node0.$$.fragment, local);
    			transition_out(node1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(node0, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(node1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(49:6) <Col>",
    		ctx
    	});

    	return block;
    }

    // (53:6) <Col>
    function create_default_slot_2(ctx) {
    	let t0;
    	let t1;
    	let current;

    	const node0 = new Node({
    			props: {
    				name: "Young",
    				to: "Canada",
    				value: "8",
    				color: "blue"
    			},
    			$$inline: true
    		});

    	const node1 = new Node({
    			props: {
    				name: "Working Age",
    				to: "Canada",
    				value: "22",
    				color: "sky"
    			},
    			$$inline: true
    		});

    	const node2 = new Node({
    			props: {
    				name: "Retired",
    				to: "Canada",
    				value: "6.5",
    				color: "blue"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(node0.$$.fragment);
    			t0 = space();
    			create_component(node1.$$.fragment);
    			t1 = space();
    			create_component(node2.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(node0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(node1, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(node2, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(node0.$$.fragment, local);
    			transition_in(node1.$$.fragment, local);
    			transition_in(node2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(node0.$$.fragment, local);
    			transition_out(node1.$$.fragment, local);
    			transition_out(node2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(node0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(node1, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(node2, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(53:6) <Col>",
    		ctx
    	});

    	return block;
    }

    // (58:6) <Col>
    function create_default_slot_1(ctx) {
    	let current;

    	const node = new Node({
    			props: {
    				name: "Canada",
    				value: "30",
    				color: "orange",
    				accent: "red"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(node.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(node, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(node.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(node.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(node, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(58:6) <Col>",
    		ctx
    	});

    	return block;
    }

    // (48:4) <Sankey height="750" {fmt}>
    function create_default_slot(ctx) {
    	let t0;
    	let t1;
    	let current;

    	const col0 = new Col({
    			props: {
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const col1 = new Col({
    			props: {
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const col2 = new Col({
    			props: {
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(col0.$$.fragment);
    			t0 = space();
    			create_component(col1.$$.fragment);
    			t1 = space();
    			create_component(col2.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(col0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(col1, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(col2, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const col0_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				col0_changes.$$scope = { dirty, ctx };
    			}

    			col0.$set(col0_changes);
    			const col1_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				col1_changes.$$scope = { dirty, ctx };
    			}

    			col1.$set(col1_changes);
    			const col2_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				col2_changes.$$scope = { dirty, ctx };
    			}

    			col2.$set(col2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(col0.$$.fragment, local);
    			transition_in(col1.$$.fragment, local);
    			transition_in(col2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(col0.$$.fragment, local);
    			transition_out(col1.$$.fragment, local);
    			transition_out(col2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(col0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(col1, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(col2, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(48:4) <Sankey height=\\\"750\\\" {fmt}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div2;
    	let t0;
    	let div0;
    	let b;
    	let t2;
    	let br;
    	let t3;
    	let t4;
    	let div1;
    	let t5;
    	let current;
    	const head = new Head({ props: { num: "18" }, $$inline: true });

    	const sankey = new Sankey({
    			props: {
    				height: "750",
    				fmt: /*fmt*/ ctx[0],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const foot = new Foot({ $$inline: true });

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			create_component(head.$$.fragment);
    			t0 = space();
    			div0 = element("div");
    			b = element("b");
    			b.textContent = "Canada's Population on CERB benefit";
    			t2 = space();
    			br = element("br");
    			t3 = text("\n    in 2020");
    			t4 = space();
    			div1 = element("div");
    			create_component(sankey.$$.fragment);
    			t5 = space();
    			create_component(foot.$$.fragment);
    			add_location(b, file$5, 42, 4, 973);
    			add_location(br, file$5, 43, 4, 1020);
    			attr_dev(div0, "class", "m3 svelte-156y5lo");
    			add_location(div0, file$5, 41, 2, 952);
    			attr_dev(div1, "class", "main m3 row svelte-156y5lo");
    			add_location(div1, file$5, 46, 2, 1050);
    			add_location(div2, file$5, 39, 0, 924);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			mount_component(head, div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, div0);
    			append_dev(div0, b);
    			append_dev(div0, t2);
    			append_dev(div0, br);
    			append_dev(div0, t3);
    			append_dev(div2, t4);
    			append_dev(div2, div1);
    			mount_component(sankey, div1, null);
    			append_dev(div2, t5);
    			mount_component(foot, div2, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const sankey_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				sankey_changes.$$scope = { dirty, ctx };
    			}

    			sankey.$set(sankey_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(head.$$.fragment, local);
    			transition_in(sankey.$$.fragment, local);
    			transition_in(foot.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(head.$$.fragment, local);
    			transition_out(sankey.$$.fragment, local);
    			transition_out(foot.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(head);
    			destroy_component(sankey);
    			destroy_component(foot);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let fmt = num => {
    		num = Number(num) * 1000000;

    		if (num >= 1000000000) {
    			num = Math.round(num / 100000000) * 100000000;
    			num = Math.round(num);
    			return String(num / 1000000000) + "b";
    		}

    		if (num >= 1000000) {
    			num = Math.round(num / 100000) * 100000;
    			num = Math.round(num);
    			return String(num / 1000000) + "m";
    		}

    		if (num > 1000) {
    			num = Math.round(num / 10000) * 10000;
    			return String(num / 1000) + "k";
    		}

    		return num;
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Post", $$slots, []);
    	$$self.$capture_state = () => ({ Head, Foot, Sankey, Node, Col, fmt });

    	$$self.$inject_state = $$props => {
    		if ("fmt" in $$props) $$invalidate(0, fmt = $$props.fmt);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [fmt];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$6.name
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
