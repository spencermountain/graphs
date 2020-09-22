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
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
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

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
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
    function is_empty(obj) {
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
            if (this.$$set && !is_empty($$props)) {
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
    function set_data_dev$1(text, data) {
        data = '' + data;
        if (text.wholeText === data)
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

    const things = writable([]);

    // const ratio = 0.61803

    const fmt = function (num) {
      const round = (x) => Math.round(x * 10) / 10;
      const decimal = (x) => String(round(x % 1)).replace(/^0/, '');
      if (num > 1000000) {
        num = round(num / 1000000);
        return [num, decimal(num), 'm']
      }
      if (num > 1000) {
        num = round(num / 1000);
        return [num, decimal(num), 'k']
      }
      return [num.toLocaleString(), '']
    };

    const layout = function (arr) {
      if (!arr.length) {
        return []
      }
      // find max
      let max = arr[0].value;
      arr.forEach((o) => {
        if (o.value > max) {
          max = o.value;
        }
      });
      // add percentage of max
      arr.forEach((o) => {
        let percentage = (o.value / max) * 100;
        o.height = percentage;
        // o.width = percentage * ratio
        o.percentage = parseInt(percentage, 10);
        o.height = o.percentage;
        o.width = '100%';
        if (o.percentage <= 5) {
          o.width = '25%';
          o.rescaled = true;
          o.height = o.percentage * 4;
        }
        o.fmt = fmt(o.value);
      });
      return arr
    };

    /* Users/spencer/mountain/somehow-scale/src/Scale.svelte generated by Svelte v3.22.3 */
    const file$2 = "Users/spencer/mountain/somehow-scale/src/Scale.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (147:8) {#if bar.rescaled}
    function create_if_block_2(ctx) {
    	let div0;
    	let t0;
    	let div1;
    	let t1;
    	let div2;

    	const block = {
    		c: function create() {
    			div0 = element$1("div");
    			t0 = space$1();
    			div1 = element$1("div");
    			t1 = space$1();
    			div2 = element$1("div");
    			attr_dev$1(div0, "class", "ghost svelte-1ic7itr");
    			add_location$1(div0, file$2, 147, 10, 3050);
    			attr_dev$1(div1, "class", "ghost svelte-1ic7itr");
    			add_location$1(div1, file$2, 148, 10, 3082);
    			attr_dev$1(div2, "class", "ghost svelte-1ic7itr");
    			add_location$1(div2, file$2, 149, 10, 3114);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div0, anchor);
    			insert_dev$1(target, t0, anchor);
    			insert_dev$1(target, div1, anchor);
    			insert_dev$1(target, t1, anchor);
    			insert_dev$1(target, div2, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div0);
    			if (detaching) detach_dev$1(t0);
    			if (detaching) detach_dev$1(div1);
    			if (detaching) detach_dev$1(t1);
    			if (detaching) detach_dev$1(div2);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(147:8) {#if bar.rescaled}",
    		ctx
    	});

    	return block;
    }

    // (156:10) {#if bar.rescaled}
    function create_if_block_1(ctx) {
    	let div;

    	let t_value = (/*bar*/ ctx[5].percentage !== 100
    	? /*bar*/ ctx[5].percentage + "%"
    	: "") + "";

    	let t;

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			t = text$1(t_value);
    			attr_dev$1(div, "class", "inside svelte-1ic7itr");
    			add_location$1(div, file$2, 156, 12, 3340);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);
    			append_dev$1(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*arr*/ 2 && t_value !== (t_value = (/*bar*/ ctx[5].percentage !== 100
    			? /*bar*/ ctx[5].percentage + "%"
    			: "") + "")) set_data_dev$1(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(156:10) {#if bar.rescaled}",
    		ctx
    	});

    	return block;
    }

    // (162:10) {#if bar.percentage !== 100 && bar.rescaled !== true}
    function create_if_block$1(ctx) {
    	let div0;
    	let t0;
    	let div1;

    	let t1_value = (/*bar*/ ctx[5].percentage !== 100
    	? /*bar*/ ctx[5].percentage + "%"
    	: "") + "";

    	let t1;

    	const block = {
    		c: function create() {
    			div0 = element$1("div");
    			t0 = space$1();
    			div1 = element$1("div");
    			t1 = text$1(t1_value);
    			attr_dev$1(div0, "class", "axis svelte-1ic7itr");
    			add_location$1(div0, file$2, 162, 12, 3556);
    			attr_dev$1(div1, "class", "percent svelte-1ic7itr");
    			add_location$1(div1, file$2, 163, 12, 3589);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div0, anchor);
    			insert_dev$1(target, t0, anchor);
    			insert_dev$1(target, div1, anchor);
    			append_dev$1(div1, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*arr*/ 2 && t1_value !== (t1_value = (/*bar*/ ctx[5].percentage !== 100
    			? /*bar*/ ctx[5].percentage + "%"
    			: "") + "")) set_data_dev$1(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div0);
    			if (detaching) detach_dev$1(t0);
    			if (detaching) detach_dev$1(div1);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(162:10) {#if bar.percentage !== 100 && bar.rescaled !== true}",
    		ctx
    	});

    	return block;
    }

    // (139:2) {#each arr as bar}
    function create_each_block(ctx) {
    	let div5;
    	let div0;
    	let span0;
    	let t0_value = /*bar*/ ctx[5].fmt[0] + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2_value = (/*bar*/ ctx[5].fmt[2] || "") + "";
    	let t2;
    	let t3;
    	let div3;
    	let t4;
    	let div1;
    	let t5;
    	let div2;
    	let t6;
    	let div4;
    	let t7_value = /*bar*/ ctx[5].label + "";
    	let t7;
    	let t8;
    	let if_block0 = /*bar*/ ctx[5].rescaled && create_if_block_2(ctx);
    	let if_block1 = /*bar*/ ctx[5].rescaled && create_if_block_1(ctx);
    	let if_block2 = /*bar*/ ctx[5].percentage !== 100 && /*bar*/ ctx[5].rescaled !== true && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div5 = element$1("div");
    			div0 = element$1("div");
    			span0 = element$1("span");
    			t0 = text$1(t0_value);
    			t1 = space$1();
    			span1 = element$1("span");
    			t2 = text$1(t2_value);
    			t3 = space$1();
    			div3 = element$1("div");
    			if (if_block0) if_block0.c();
    			t4 = space$1();
    			div1 = element$1("div");
    			if (if_block1) if_block1.c();
    			t5 = space$1();
    			div2 = element$1("div");
    			if (if_block2) if_block2.c();
    			t6 = space$1();
    			div4 = element$1("div");
    			t7 = text$1(t7_value);
    			t8 = space$1();
    			attr_dev$1(span0, "class", "num svelte-1ic7itr");
    			add_location$1(span0, file$2, 142, 8, 2852);
    			attr_dev$1(span1, "class", "unit svelte-1ic7itr");
    			add_location$1(span1, file$2, 143, 8, 2898);
    			attr_dev$1(div0, "class", "value svelte-1ic7itr");
    			set_style(div0, "border-bottom", "2px solid " + /*bar*/ ctx[5].color);
    			add_location$1(div0, file$2, 141, 6, 2778);
    			attr_dev$1(div1, "class", "bar svelte-1ic7itr");
    			set_style(div1, "background-color", /*bar*/ ctx[5].color);
    			set_style(div1, "width", /*bar*/ ctx[5].width);
    			set_style(div1, "max-width", /*bar*/ ctx[5].width);
    			set_style(div1, "height", "100%");
    			add_location$1(div1, file$2, 151, 8, 3158);
    			attr_dev$1(div2, "class", "beside svelte-1ic7itr");
    			add_location$1(div2, file$2, 160, 8, 3459);
    			attr_dev$1(div3, "class", "sized svelte-1ic7itr");
    			set_style(div3, "height", /*bar*/ ctx[5].height + "%");
    			add_location$1(div3, file$2, 145, 6, 2962);
    			attr_dev$1(div4, "class", "label svelte-1ic7itr");
    			add_location$1(div4, file$2, 168, 6, 3747);
    			attr_dev$1(div5, "class", "box svelte-1ic7itr");
    			add_location$1(div5, file$2, 139, 4, 2728);
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div5, anchor);
    			append_dev$1(div5, div0);
    			append_dev$1(div0, span0);
    			append_dev$1(span0, t0);
    			append_dev$1(div0, t1);
    			append_dev$1(div0, span1);
    			append_dev$1(span1, t2);
    			append_dev$1(div5, t3);
    			append_dev$1(div5, div3);
    			if (if_block0) if_block0.m(div3, null);
    			append_dev$1(div3, t4);
    			append_dev$1(div3, div1);
    			if (if_block1) if_block1.m(div1, null);
    			append_dev$1(div3, t5);
    			append_dev$1(div3, div2);
    			if (if_block2) if_block2.m(div2, null);
    			append_dev$1(div5, t6);
    			append_dev$1(div5, div4);
    			append_dev$1(div4, t7);
    			append_dev$1(div5, t8);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*arr*/ 2 && t0_value !== (t0_value = /*bar*/ ctx[5].fmt[0] + "")) set_data_dev$1(t0, t0_value);
    			if (dirty & /*arr*/ 2 && t2_value !== (t2_value = (/*bar*/ ctx[5].fmt[2] || "") + "")) set_data_dev$1(t2, t2_value);

    			if (dirty & /*arr*/ 2) {
    				set_style(div0, "border-bottom", "2px solid " + /*bar*/ ctx[5].color);
    			}

    			if (/*bar*/ ctx[5].rescaled) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					if_block0.m(div3, t4);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*bar*/ ctx[5].rescaled) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*arr*/ 2) {
    				set_style(div1, "background-color", /*bar*/ ctx[5].color);
    			}

    			if (dirty & /*arr*/ 2) {
    				set_style(div1, "width", /*bar*/ ctx[5].width);
    			}

    			if (dirty & /*arr*/ 2) {
    				set_style(div1, "max-width", /*bar*/ ctx[5].width);
    			}

    			if (/*bar*/ ctx[5].percentage !== 100 && /*bar*/ ctx[5].rescaled !== true) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$1(ctx);
    					if_block2.c();
    					if_block2.m(div2, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty & /*arr*/ 2) {
    				set_style(div3, "height", /*bar*/ ctx[5].height + "%");
    			}

    			if (dirty & /*arr*/ 2 && t7_value !== (t7_value = /*bar*/ ctx[5].label + "")) set_data_dev$1(t7, t7_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(div5);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(139:2) {#each arr as bar}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div;
    	let t;
    	let current;
    	let each_value = /*arr*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const default_slot_template = /*$$slots*/ ctx[4].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

    	const block = {
    		c: function create() {
    			div = element$1("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space$1();
    			if (default_slot) default_slot.c();
    			attr_dev$1(div, "class", "container svelte-1ic7itr");
    			set_style(div, "min-height", /*height*/ ctx[0] + "px");
    			add_location$1(div, file$2, 136, 0, 2647);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			insert_dev$1(target, t, anchor);

    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*arr*/ 2) {
    				each_value = /*arr*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (!current || dirty & /*height*/ 1) {
    				set_style(div, "min-height", /*height*/ ctx[0] + "px");
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 8) {
    					default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[3], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null));
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
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $things;
    	validate_store(things, "things");
    	component_subscribe($$self, things, $$value => $$invalidate(2, $things = $$value));
    	let { height = 400 } = $$props;
    	let arr = [];

    	onMount(() => {
    		$$invalidate(1, arr = layout($things));
    	});

    	const writable_props = ["height"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Scale> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots$1("Scale", $$slots, ['default']);

    	$$self.$set = $$props => {
    		if ("height" in $$props) $$invalidate(0, height = $$props.height);
    		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		setContext,
    		onMount,
    		things,
    		layout,
    		height,
    		arr,
    		$things
    	});

    	$$self.$inject_state = $$props => {
    		if ("height" in $$props) $$invalidate(0, height = $$props.height);
    		if ("arr" in $$props) $$invalidate(1, arr = $$props.arr);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [height, arr, $things, $$scope, $$slots];
    }

    class Scale extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$2, create_fragment$2, safe_not_equal$1, { height: 0 });

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Scale",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get height() {
    		throw new Error("<Scale>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Scale>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var spencerColor = createCommonjsModule(function (module, exports) {
    !function(e){module.exports=e();}(function(){return function u(i,a,c){function f(r,e){if(!a[r]){if(!i[r]){var o="function"==typeof commonjsRequire&&commonjsRequire;if(!e&&o)return o(r,!0);if(d)return d(r,!0);var n=new Error("Cannot find module '"+r+"'");throw n.code="MODULE_NOT_FOUND",n}var t=a[r]={exports:{}};i[r][0].call(t.exports,function(e){return f(i[r][1][e]||e)},t,t.exports,u,i,a,c);}return a[r].exports}for(var d="function"==typeof commonjsRequire&&commonjsRequire,e=0;e<c.length;e++)f(c[e]);return f}({1:[function(e,r,o){r.exports={blue:"#6699cc",green:"#6accb2",yellow:"#e1e6b3",red:"#cc7066",pink:"#F2C0BB",brown:"#705E5C",orange:"#cc8a66",purple:"#d8b3e6",navy:"#335799",olive:"#7f9c6c",fuscia:"#735873",beige:"#e6d7b3",slate:"#8C8C88",suede:"#9c896c",burnt:"#603a39",sea:"#50617A",sky:"#2D85A8",night:"#303b50",rouge:"#914045",grey:"#838B91",mud:"#C4ABAB",royal:"#275291",cherry:"#cc6966",tulip:"#e6b3bc",rose:"#D68881",fire:"#AB5850",greyblue:"#72697D",greygreen:"#8BA3A2",greypurple:"#978BA3",burn:"#6D5685",slategrey:"#bfb0b3",light:"#a3a5a5",lighter:"#d7d5d2",fudge:"#4d4d4d",lightgrey:"#949a9e",white:"#fbfbfb",dimgrey:"#606c74",softblack:"#463D4F",dark:"#443d3d",black:"#333333"};},{}],2:[function(e,r,o){var n=e("./colors"),t={juno:["blue","mud","navy","slate","pink","burn"],barrow:["rouge","red","orange","burnt","brown","greygreen"],roma:["#8a849a","#b5b0bf","rose","lighter","greygreen","mud"],palmer:["red","navy","olive","pink","suede","sky"],mark:["#848f9a","#9aa4ac","slate","#b0b8bf","mud","grey"],salmon:["sky","sea","fuscia","slate","mud","fudge"],dupont:["green","brown","orange","red","olive","blue"],bloor:["night","navy","beige","rouge","mud","grey"],yukon:["mud","slate","brown","sky","beige","red"],david:["blue","green","yellow","red","pink","light"],neste:["mud","cherry","royal","rouge","greygreen","greypurple"],ken:["red","sky","#c67a53","greygreen","#dfb59f","mud"]};Object.keys(t).forEach(function(e){t[e]=t[e].map(function(e){return n[e]||e});}),r.exports=t;},{"./colors":1}],3:[function(e,r,o){var n=e("./colors"),t=e("./combos"),u={colors:n,list:Object.keys(n).map(function(e){return n[e]}),combos:t};r.exports=u;},{"./colors":1,"./combos":2}]},{},[3])(3)});
    });

    /* Users/spencer/mountain/somehow-scale/src/Thing.svelte generated by Svelte v3.22.3 */
    const file$3 = "Users/spencer/mountain/somehow-scale/src/Thing.svelte";

    function create_fragment$3(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			add_location$1(div, file$3, 19, 0, 354);
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
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $things;
    	validate_store(things, "things");
    	component_subscribe($$self, things, $$value => $$invalidate(4, $things = $$value));
    	let { color = "steelblue" } = $$props;
    	let { label = "" } = $$props;
    	let { value = 0 } = $$props;
    	let { aspect = "" } = $$props;
    	let colors = spencerColor.colors;
    	color = colors[color] || color;

    	$things.push({
    		color,
    		aspect,
    		value: Number(value),
    		label
    	});

    	const writable_props = ["color", "label", "value", "aspect"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Thing> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots$1("Thing", $$slots, []);

    	$$self.$set = $$props => {
    		if ("color" in $$props) $$invalidate(0, color = $$props.color);
    		if ("label" in $$props) $$invalidate(1, label = $$props.label);
    		if ("value" in $$props) $$invalidate(2, value = $$props.value);
    		if ("aspect" in $$props) $$invalidate(3, aspect = $$props.aspect);
    	};

    	$$self.$capture_state = () => ({
    		things,
    		color,
    		label,
    		value,
    		aspect,
    		c: spencerColor,
    		colors,
    		$things
    	});

    	$$self.$inject_state = $$props => {
    		if ("color" in $$props) $$invalidate(0, color = $$props.color);
    		if ("label" in $$props) $$invalidate(1, label = $$props.label);
    		if ("value" in $$props) $$invalidate(2, value = $$props.value);
    		if ("aspect" in $$props) $$invalidate(3, aspect = $$props.aspect);
    		if ("colors" in $$props) colors = $$props.colors;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [color, label, value, aspect];
    }

    class Thing extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$3, create_fragment$3, safe_not_equal$1, { color: 0, label: 1, value: 2, aspect: 3 });

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Thing",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get color() {
    		throw new Error("<Thing>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Thing>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label() {
    		throw new Error("<Thing>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<Thing>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Thing>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Thing>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get aspect() {
    		throw new Error("<Thing>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set aspect(value) {
    		throw new Error("<Thing>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function noop$2() { }
    function add_location$2(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run$2(fn) {
        return fn();
    }
    function blank_object$2() {
        return Object.create(null);
    }
    function run_all$2(fns) {
        fns.forEach(run$2);
    }
    function is_function$2(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal$2(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty$1(obj) {
        return Object.keys(obj).length === 0;
    }
    function insert$2(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach$2(node) {
        node.parentNode.removeChild(node);
    }
    function element$2(name) {
        return document.createElement(name);
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr$2(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children$2(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event$2(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component$2;
    function set_current_component$2(component) {
        current_component$2 = component;
    }
    function get_current_component$1() {
        if (!current_component$2)
            throw new Error(`Function called outside component initialization`);
        return current_component$2;
    }
    function createEventDispatcher() {
        const component = get_current_component$1();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event$2(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components$2 = [];
    const binding_callbacks$2 = [];
    const render_callbacks$2 = [];
    const flush_callbacks$2 = [];
    const resolved_promise$2 = Promise.resolve();
    let update_scheduled$2 = false;
    function schedule_update$2() {
        if (!update_scheduled$2) {
            update_scheduled$2 = true;
            resolved_promise$2.then(flush$2);
        }
    }
    function add_render_callback$2(fn) {
        render_callbacks$2.push(fn);
    }
    let flushing$2 = false;
    const seen_callbacks$2 = new Set();
    function flush$2() {
        if (flushing$2)
            return;
        flushing$2 = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components$2.length; i += 1) {
                const component = dirty_components$2[i];
                set_current_component$2(component);
                update$2(component.$$);
            }
            dirty_components$2.length = 0;
            while (binding_callbacks$2.length)
                binding_callbacks$2.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks$2.length; i += 1) {
                const callback = render_callbacks$2[i];
                if (!seen_callbacks$2.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks$2.add(callback);
                    callback();
                }
            }
            render_callbacks$2.length = 0;
        } while (dirty_components$2.length);
        while (flush_callbacks$2.length) {
            flush_callbacks$2.pop()();
        }
        update_scheduled$2 = false;
        flushing$2 = false;
        seen_callbacks$2.clear();
    }
    function update$2($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all$2($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback$2);
        }
    }
    const outroing$2 = new Set();
    function transition_in$2(block, local) {
        if (block && block.i) {
            outroing$2.delete(block);
            block.i(local);
        }
    }
    function mount_component$2(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback$2(() => {
            const new_on_destroy = on_mount.map(run$2).filter(is_function$2);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all$2(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback$2);
    }
    function destroy_component$2(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all$2($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty$2(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components$2.push(component);
            schedule_update$2();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init$2(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component$2;
        set_current_component$2(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop$2,
            not_equal,
            bound: blank_object$2(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object$2(),
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
                        make_dirty$2(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all$2($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children$2(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach$2);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in$2(component.$$.fragment);
            mount_component$2(component, options.target, options.anchor);
            flush$2();
        }
        set_current_component$2(parent_component);
    }
    class SvelteComponent$2 {
        $destroy() {
            destroy_component$2(this, 1);
            this.$destroy = noop$2;
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

    function dispatch_dev$2(type, detail) {
        document.dispatchEvent(custom_event$2(type, Object.assign({ version: '3.24.1' }, detail)));
    }
    function insert_dev$2(target, node, anchor) {
        dispatch_dev$2("SvelteDOMInsert", { target, node, anchor });
        insert$2(target, node, anchor);
    }
    function detach_dev$2(node) {
        dispatch_dev$2("SvelteDOMRemove", { node });
        detach$2(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev$2("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev$2("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev$2(node, attribute, value) {
        attr$2(node, attribute, value);
        if (value == null)
            dispatch_dev$2("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev$2("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function validate_slots$2(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev$2 extends SvelteComponent$2 {
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

    /* Users/spencer/mountain/somehow-input/src/Text.svelte generated by Svelte v3.22.3 */
    const file$4 = "Users/spencer/mountain/somehow-input/src/Text.svelte";

    function create_fragment$4(ctx) {
    	let input;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element$2("input");
    			attr_dev$2(input, "class", "input svelte-fx9i9q");
    			attr_dev$2(input, "type", "text");
    			add_location$2(input, file$4, 55, 0, 1168);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev$2(target, input, anchor);
    			set_input_value(input, /*tmp*/ ctx[0]);
    			if (remount) run_all$2(dispose);

    			dispose = [
    				listen_dev(input, "keyup", /*debounce*/ ctx[1], false, false, false),
    				listen_dev(input, "input", /*input_input_handler*/ ctx[7])
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*tmp*/ 1 && input.value !== /*tmp*/ ctx[0]) {
    				set_input_value(input, /*tmp*/ ctx[0]);
    			}
    		},
    		i: noop$2,
    		o: noop$2,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$2(input);
    			run_all$2(dispose);
    		}
    	};

    	dispatch_dev$2("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { text = "" } = $$props;
    	let tmp = text;
    	let { delay = 0 } = $$props;
    	let timer = null;

    	// boilerplate required to produce events
    	const dispatch = createEventDispatcher();

    	const debounce = e => {
    		clearTimeout(timer);

    		timer = setTimeout(
    			() => {
    				$$invalidate(2, text = tmp);
    			},
    			delay
    		);
    	};

    	// made up event handler
    	function onChange() {
    		// fire event named 'message'
    		dispatch("change", {});
    	}

    	const writable_props = ["text", "delay"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Text> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots$2("Text", $$slots, []);

    	function input_input_handler() {
    		tmp = this.value;
    		$$invalidate(0, tmp);
    	}

    	$$self.$set = $$props => {
    		if ("text" in $$props) $$invalidate(2, text = $$props.text);
    		if ("delay" in $$props) $$invalidate(3, delay = $$props.delay);
    	};

    	$$self.$capture_state = () => ({
    		text,
    		tmp,
    		delay,
    		timer,
    		createEventDispatcher,
    		dispatch,
    		debounce,
    		onChange
    	});

    	$$self.$inject_state = $$props => {
    		if ("text" in $$props) $$invalidate(2, text = $$props.text);
    		if ("tmp" in $$props) $$invalidate(0, tmp = $$props.tmp);
    		if ("delay" in $$props) $$invalidate(3, delay = $$props.delay);
    		if ("timer" in $$props) timer = $$props.timer;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [tmp, debounce, text, delay, timer, dispatch, onChange, input_input_handler];
    }

    class Text extends SvelteComponentDev$2 {
    	constructor(options) {
    		super(options);
    		init$2(this, options, instance$4, create_fragment$4, safe_not_equal$2, { text: 2, delay: 3 });

    		dispatch_dev$2("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Text",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get text() {
    		throw new Error("<Text>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set text(value) {
    		throw new Error("<Text>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get delay() {
    		throw new Error("<Text>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set delay(value) {
    		throw new Error("<Text>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var spencerColor$1 = createCommonjsModule(function (module, exports) {
    !function(e){module.exports=e();}(function(){return function u(i,a,c){function f(r,e){if(!a[r]){if(!i[r]){var o="function"==typeof commonjsRequire&&commonjsRequire;if(!e&&o)return o(r,!0);if(d)return d(r,!0);var n=new Error("Cannot find module '"+r+"'");throw n.code="MODULE_NOT_FOUND",n}var t=a[r]={exports:{}};i[r][0].call(t.exports,function(e){return f(i[r][1][e]||e)},t,t.exports,u,i,a,c);}return a[r].exports}for(var d="function"==typeof commonjsRequire&&commonjsRequire,e=0;e<c.length;e++)f(c[e]);return f}({1:[function(e,r,o){r.exports={blue:"#6699cc",green:"#6accb2",yellow:"#e1e6b3",red:"#cc7066",pink:"#F2C0BB",brown:"#705E5C",orange:"#cc8a66",purple:"#d8b3e6",navy:"#335799",olive:"#7f9c6c",fuscia:"#735873",beige:"#e6d7b3",slate:"#8C8C88",suede:"#9c896c",burnt:"#603a39",sea:"#50617A",sky:"#2D85A8",night:"#303b50",rouge:"#914045",grey:"#838B91",mud:"#C4ABAB",royal:"#275291",cherry:"#cc6966",tulip:"#e6b3bc",rose:"#D68881",fire:"#AB5850",greyblue:"#72697D",greygreen:"#8BA3A2",greypurple:"#978BA3",burn:"#6D5685",slategrey:"#bfb0b3",light:"#a3a5a5",lighter:"#d7d5d2",fudge:"#4d4d4d",lightgrey:"#949a9e",white:"#fbfbfb",dimgrey:"#606c74",softblack:"#463D4F",dark:"#443d3d",black:"#333333"};},{}],2:[function(e,r,o){var n=e("./colors"),t={juno:["blue","mud","navy","slate","pink","burn"],barrow:["rouge","red","orange","burnt","brown","greygreen"],roma:["#8a849a","#b5b0bf","rose","lighter","greygreen","mud"],palmer:["red","navy","olive","pink","suede","sky"],mark:["#848f9a","#9aa4ac","slate","#b0b8bf","mud","grey"],salmon:["sky","sea","fuscia","slate","mud","fudge"],dupont:["green","brown","orange","red","olive","blue"],bloor:["night","navy","beige","rouge","mud","grey"],yukon:["mud","slate","brown","sky","beige","red"],david:["blue","green","yellow","red","pink","light"],neste:["mud","cherry","royal","rouge","greygreen","greypurple"],ken:["red","sky","#c67a53","greygreen","#dfb59f","mud"]};Object.keys(t).forEach(function(e){t[e]=t[e].map(function(e){return n[e]||e});}),r.exports=t;},{"./colors":1}],3:[function(e,r,o){var n=e("./colors"),t=e("./combos"),u={colors:n,list:Object.keys(n).map(function(e){return n[e]}),combos:t};r.exports=u;},{"./colors":1,"./combos":2}]},{},[3])(3)});
    });

    ({
      atlantic: [
        { short: 'BOS', place: 'Boston', name: 'Boston Bruins', color: spencerColor$1.brown },
        { short: 'BUF', place: 'Buffalo', name: 'Buffalo Sabres', color: spencerColor$1.sea },
        { short: 'DET', place: 'Detroit', name: 'Detroit Red Wings', color: spencerColor$1.red },
        {
          short: 'FLR',
          place: 'Florida',
          name: 'Florida Panthers',
          color: spencerColor$1.cherry,
        },
        {
          short: 'MTL',
          place: 'Montreal',
          name: 'Montreal Canadiens',
          color: spencerColor$1.rouge,
        },
        { short: 'OTT', place: 'Ottawa', name: 'Ottawa Senators', color: spencerColor$1.cherry },
        {
          short: 'TMP',
          place: 'Tampa',
          name: 'Tampa Bay Lightning',
          color: spencerColor$1.royal,
        },
        {
          short: 'TOR',
          place: 'Toronto',
          name: 'Toronto Maple Leafs',
          color: spencerColor$1.blue,
        },
      ],
      metro: [
        {
          short: 'CAR',
          place: 'Carolina',
          name: 'Carolina Hurricanes',
          color: spencerColor$1.fire,
        },
        {
          short: 'COL',
          place: 'Columbus',
          name: 'Columbus Blue Jackets',
          color: spencerColor$1.navy,
        },
        {
          short: 'NJ',
          place: 'New Jersey',
          name: 'New Jersey Devils',
          color: spencerColor$1.burnt,
        },
        {
          short: 'NYI',
          place: 'Long Island',
          name: 'New York Islanders',
          color: spencerColor$1.orange,
        },
        {
          short: 'NYR',
          place: 'New York',
          name: 'New York Rangers',
          color: spencerColor$1.rouge,
        },
        {
          short: 'PHL',
          place: 'Philadelphia',
          name: 'Philadelphia Flyers',
          color: spencerColor$1.orange,
        },
        {
          short: 'PIT',
          place: 'Pittsburgh',
          name: 'Pittsburgh Penguins',
          color: spencerColor$1.fudge,
        },
        {
          short: 'WSH',
          place: 'Washington',
          name: 'Washington Capitals',
          color: spencerColor$1.cherry,
        },
      ],
      central: [
        { short: 'ARI', place: 'Arizona', name: 'Arizona Coyotes', color: spencerColor$1.rouge },
        {
          short: 'CHI',
          place: 'Chicago',
          name: 'Chicago Blackhawks',
          color: spencerColor$1.fudge,
        },
        {
          short: 'COL',
          place: 'Colorado',
          name: 'Colorado Avalanche',
          color: spencerColor$1.burnt,
        },
        { short: 'DAL', place: 'Dallas', name: 'Dallas Stars', color: spencerColor$1.olive },
        {
          short: 'MIN',
          place: 'Minnesota',
          name: 'Minnesota Wild',
          color: spencerColor$1.green,
        },
        {
          short: 'NSH',
          place: 'Nashville',
          name: 'Nashville Predators',
          color: '#b2b17b',
        },
        { short: 'WIN', place: 'Winnipeg', name: 'Winnipeg Jets', color: spencerColor$1.sea },
      ],
      pacific: [
        { short: 'ANA', place: 'Anaheim', name: 'Anaheim Ducks', color: spencerColor$1.dimgrey },
        { short: 'CAL', place: 'Calgary', name: 'Calgary Flames', color: spencerColor$1.red },
        {
          short: 'EDM',
          place: 'Edmonton',
          name: 'Edmonton Oilers',
          color: spencerColor$1.orange,
        },
        {
          short: 'LOS',
          place: 'Los Angeles',
          name: 'Los Angeles Kings',
          color: spencerColor$1.black,
        },
        { short: 'SJ', place: 'San Jose', name: 'San Jose Sharks', color: spencerColor$1.sky },
        {
          short: 'VAN',
          place: 'Vancouver',
          name: 'Vancouver Canucks',
          color: spencerColor$1.blue,
        },
        {
          short: 'VGS',
          place: 'Vegas',
          name: 'Vegas Golden Knights',
          color: '#b2b17b',
        },
        {
          short: 'STL',
          place: 'Seattle',
          name: 'Seattle Kraken',
          color: spencerColor$1.greygreen,
        },
      ],
      //defunct
      // 'California Golden Seals': c.green,
      // 'Kansas City Scouts': c.navy,
      // 'Cleveland Barons': c.red,
      // 'Atlanta Flames': c.orange,
      // 'Colorado Rockies': c.navy,
      // 'Minnesota North Stars': c.olive,
      // 'Quebec Nordiques': c.sky,
      // 'Winnipeg_Jets_(1972–96)': c.rouge,
      // 'Hartford Whalers': c.green,
      // 'Atlanta Thrashers': c.fire,
    });

    //this is a not-well-thought-out way to reduce our dependence on `object===object` stuff
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('');

    //generates a unique id for this term
    function makeId(str) {
      str = str || '_';
      let text = str + '-';
      for (let i = 0; i < 7; i++) {
        text += chars[Math.floor(Math.random() * chars.length)];
      }
      return text
    }

    var _id = makeId;

    //a hugely-ignorant, and widely subjective transliteration of latin, cryllic, greek unicode characters to english ascii.
    //approximate visual (not semantic or phonetic) relationship between unicode and ascii characters
    //http://en.wikipedia.org/wiki/List_of_Unicode_characters
    //https://docs.google.com/spreadsheet/ccc?key=0Ah46z755j7cVdFRDM1A2YVpwa1ZYWlpJM2pQZ003M0E
    let compact = {
      '!': '¡',
      '?': '¿Ɂ',
      '"': '“”"❝❞',
      "'": '‘‛❛❜',
      '-': '—–',
      a: 'ªÀÁÂÃÄÅàáâãäåĀāĂăĄąǍǎǞǟǠǡǺǻȀȁȂȃȦȧȺΆΑΔΛάαλАадѦѧӐӑӒӓƛɅæ',
      b: 'ßþƀƁƂƃƄƅɃΒβϐϦБВЪЬвъьѢѣҌҍ',
      c: '¢©ÇçĆćĈĉĊċČčƆƇƈȻȼͻͼͽϲϹϽϾСсєҀҁҪҫ',
      d: 'ÐĎďĐđƉƊȡƋƌǷ',
      e: 'ÈÉÊËèéêëĒēĔĕĖėĘęĚěƎƏƐǝȄȅȆȇȨȩɆɇΈΕΞΣέεξϱϵ϶ЀЁЕЭеѐёҼҽҾҿӖӗӘәӚӛӬӭ',
      f: 'ƑƒϜϝӺӻҒғſ',
      g: 'ĜĝĞğĠġĢģƓǤǥǦǧǴǵ',
      h: 'ĤĥĦħƕǶȞȟΉΗЂЊЋНнђћҢңҤҥҺһӉӊ',
      I: 'ÌÍÎÏ',
      i: 'ìíîïĨĩĪīĬĭĮįİıƖƗȈȉȊȋΊΐΪίιϊІЇії',
      j: 'ĴĵǰȷɈɉϳЈј',
      k: 'ĶķĸƘƙǨǩΚκЌЖКжкќҚқҜҝҞҟҠҡ',
      l: 'ĹĺĻļĽľĿŀŁłƚƪǀǏǐȴȽΙӀӏ',
      m: 'ΜϺϻМмӍӎ',
      n: 'ÑñŃńŅņŇňŉŊŋƝƞǸǹȠȵΝΠήηϞЍИЙЛПийлпѝҊҋӅӆӢӣӤӥπ',
      o: 'ÒÓÔÕÖØðòóôõöøŌōŎŏŐőƟƠơǑǒǪǫǬǭǾǿȌȍȎȏȪȫȬȭȮȯȰȱΌΘΟθοσόϕϘϙϬϭϴОФоѲѳӦӧӨөӪӫ',
      p: 'ƤƿΡρϷϸϼРрҎҏÞ',
      q: 'Ɋɋ',
      r: 'ŔŕŖŗŘřƦȐȑȒȓɌɍЃГЯгяѓҐґ',
      s: 'ŚśŜŝŞşŠšƧƨȘșȿЅѕ',
      t: 'ŢţŤťŦŧƫƬƭƮȚțȶȾΓΤτϮТт',
      u: 'µÙÚÛÜùúûüŨũŪūŬŭŮůŰűŲųƯưƱƲǓǔǕǖǗǘǙǚǛǜȔȕȖȗɄΰμυϋύ',
      v: 'νѴѵѶѷ',
      w: 'ŴŵƜωώϖϢϣШЩшщѡѿ',
      x: '×ΧχϗϰХхҲҳӼӽӾӿ',
      y: 'ÝýÿŶŷŸƳƴȲȳɎɏΎΥΫγψϒϓϔЎУучўѰѱҮүҰұӮӯӰӱӲӳ',
      z: 'ŹźŻżŽžƩƵƶȤȥɀΖζ',
    };
    //decompress data into two hashes
    let unicode = {};
    Object.keys(compact).forEach(function(k) {
      compact[k].split('').forEach(function(s) {
        unicode[s] = k;
      });
    });

    const killUnicode = str => {
      let chars = str.split('');
      chars.forEach((s, i) => {
        if (unicode[s]) {
          chars[i] = unicode[s];
        }
      });
      return chars.join('')
    };
    var unicode_1 = killUnicode;

    const periodAcronym = /([A-Z]\.)+[A-Z]?,?$/;
    const oneLetterAcronym = /^[A-Z]\.,?$/;
    const noPeriodAcronym = /[A-Z]{2,}('s|,)?$/;
    const lowerCaseAcronym = /([a-z]\.){2,}[a-z]\.?$/;

    const isAcronym = function(str) {
      //like N.D.A
      if (periodAcronym.test(str) === true) {
        return true
      }
      //like c.e.o
      if (lowerCaseAcronym.test(str) === true) {
        return true
      }
      //like 'F.'
      if (oneLetterAcronym.test(str) === true) {
        return true
      }
      //like NDA
      if (noPeriodAcronym.test(str) === true) {
        return true
      }
      return false
    };
    var isAcronym_1 = isAcronym;

    const hasSlash = /[a-z\u00C0-\u00FF] ?\/ ?[a-z\u00C0-\u00FF]/;

    /** some basic operations on a string to reduce noise */
    const clean = function(str) {
      str = str || '';
      str = str.toLowerCase();
      str = str.trim();
      let original = str;
      //(very) rough ASCII transliteration -  bjŏrk -> bjork
      str = unicode_1(str);
      //rough handling of slashes - 'see/saw'
      if (hasSlash.test(str) === true) {
        str = str.replace(/\/.*/, '');
      }
      //#tags, @mentions
      str = str.replace(/^[#@]/, '');
      //punctuation
      str = str.replace(/[,;.!?]+$/, '');
      // coerce single curly quotes
      str = str.replace(/[\u0027\u0060\u00B4\u2018\u2019\u201A\u201B\u2032\u2035\u2039\u203A]+/g, "'");
      // coerce double curly quotes
      str = str.replace(
        /[\u0022\u00AB\u00BB\u201C\u201D\u201E\u201F\u2033\u2034\u2036\u2037\u2E42\u301D\u301E\u301F\uFF02]+/g,
        '"'
      );
      //coerce Unicode ellipses
      str = str.replace(/\u2026/g, '...');
      //en-dash
      str = str.replace(/\u2013/g, '-');
      //lookin'->looking (make it easier for conjugation)
      str = str.replace(/([aeiou][ktrp])in$/, '$1ing');
      //turn re-enactment to reenactment
      if (/^(re|un)-?[^aeiou]./.test(str) === true) {
        str = str.replace('-', '');
      }
      //strip leading & trailing grammatical punctuation
      if (/^[:;]/.test(str) === false) {
        str = str.replace(/\.{3,}$/g, '');
        str = str.replace(/[",\.!:;\?\)]+$/g, '');
        str = str.replace(/^['"\(]+/g, '');
      }
      //do this again..
      str = str.trim();
      //oh shucks,
      if (str === '') {
        str = original;
      }
      //compact acronyms
      if (isAcronym_1(str)) {
        str = str.replace(/\./g, '');
      }
      //nice-numbers
      str = str.replace(/([0-9]),([0-9])/g, '$1$2');
      return str
    };

    var clean_1 = clean;

    /** reduced is one step further than clean */
    const reduced = function(str) {
      // remove apostrophes
      str = str.replace(/['’]s$/, '');
      str = str.replace(/s['’]$/, 's');
      return str
    };
    var reduce = reduced;

    // basically, tokenize for terms.

    //all punctuation marks, from https://en.wikipedia.org/wiki/Punctuation
    //we have slightly different rules for start/end - like #hashtags.
    const startings = /^[ \n\t\.’'\[\](){}⟨⟩:,،、‒–—―…!.‹›«»‐\-?‘’;\/⁄·&*•^†‡°¡¿※№÷×ºª%‰+−=‱¶′″‴§~|‖¦©℗®℠™¤₳฿\u0022|\uFF02|\u0027|\u201C|\u2018|\u201F|\u201B|\u201E|\u2E42|\u201A|\u00AB|\u2039|\u2035|\u2036|\u2037|\u301D|\u0060|\u301F]+/;
    const endings = /[ \n\t\.’'\[\](){}⟨⟩:,،、‒–—―…!.‹›«»‐\-?‘’;\/⁄·&*@•^†‡°¡¿※#№÷×ºª‰+−=‱¶′″‴§~|‖¦©℗®℠™¤₳฿\u0022|\uFF02|\u0027|\u201D|\u2019|\u201D|\u2019|\u201D|\u201D|\u2019|\u00BB|\u203A|\u2032|\u2033|\u2034|\u301E|\u00B4|\u301E]+$/;

    //money = ₵¢₡₢$₫₯֏₠€ƒ₣₲₴₭₺₾ℳ₥₦₧₱₰£៛₽₹₨₪৳₸₮₩¥
    const hasSlash$1 = /\//;
    const hasApostrophe = /['’]/;
    const hasAcronym = /^[a-z]\.([a-z]\.)+/i;
    const minusNumber = /^[-+\.][0-9]/;

    /** turn given text into a parsed-up object
     * seperate the 'meat' of the word from the whitespace+punctuation
     */
    const parseTerm = str => {
      let original = str;
      let pre = '';
      let post = '';
      str = str.replace(startings, found => {
        pre = found;
        // support '-40'
        if ((pre === '-' || pre === '+' || pre === '.') && minusNumber.test(str)) {
          pre = '';
          return found
        }
        return ''
      });
      str = str.replace(endings, found => {
        post = found;
        // keep s-apostrophe - "flanders'" or "chillin'"
        if (hasApostrophe.test(found) && /[sn]['’]$/.test(original) && hasApostrophe.test(pre) === false) {
          post = post.replace(hasApostrophe, '');
          return `'`
        }
        //keep end-period in acronym
        if (hasAcronym.test(str) === true) {
          post = post.replace(/\./, '');
          return '.'
        }
        return ''
      });
      //we went too far..
      if (str === '') {
        // do a very mild parse, and hope for the best.
        original = original.replace(/ *$/, after => {
          post = after || '';
          return ''
        });
        str = original;
        pre = '';
        post = post;
      }
      // create the various forms of our text,
      let clean = clean_1(str);
      const parsed = {
        text: str,
        clean: clean,
        reduced: reduce(clean),
        pre: pre,
        post: post,
      };
      // support aliases for slashes
      if (hasSlash$1.test(str)) {
        str.split(hasSlash$1).forEach(word => {
          parsed.alias = parsed.alias || {};
          parsed.alias[word.trim()] = true;
        });
      }
      return parsed
    };
    var parse = parseTerm;

    var _01Case = createCommonjsModule(function (module, exports) {
    const titleCase = /^[A-Z][a-z'\u00C0-\u00FF]/;
    const upperCase = /^[A-Z]+s?$/;

    /** convert all text to uppercase */
    exports.toUpperCase = function() {
      this.text = this.text.toUpperCase();
      return this
    };

    /** convert all text to lowercase */
    exports.toLowerCase = function() {
      this.text = this.text.toLowerCase();
      return this
    };

    /** only set the first letter to uppercase
     * leave any existing uppercase alone
     */
    exports.toTitleCase = function() {
      this.text = this.text.replace(/^ *[a-z\u00C0-\u00FF]/, x => x.toUpperCase()); //support unicode?
      return this
    };

    /** if all letters are uppercase */
    exports.isUpperCase = function() {
      return upperCase.test(this.text)
    };
    /** if the first letter is uppercase, and the rest are lowercase */
    exports.isTitleCase = function() {
      return titleCase.test(this.text)
    };
    exports.titleCase = exports.isTitleCase;
    });
    var _01Case_1 = _01Case.toUpperCase;
    var _01Case_2 = _01Case.toLowerCase;
    var _01Case_3 = _01Case.toTitleCase;
    var _01Case_4 = _01Case.isUpperCase;
    var _01Case_5 = _01Case.isTitleCase;
    var _01Case_6 = _01Case.titleCase;

    var _02Punctuation = createCommonjsModule(function (module, exports) {
    // these methods are called with '@hasComma' in the match syntax
    // various unicode quotation-mark formats
    const startQuote = /(\u0022|\uFF02|\u0027|\u201C|\u2018|\u201F|\u201B|\u201E|\u2E42|\u201A|\u00AB|\u2039|\u2035|\u2036|\u2037|\u301D|\u0060|\u301F)/;
    const endQuote = /(\u0022|\uFF02|\u0027|\u201D|\u2019|\u201D|\u2019|\u201D|\u201D|\u2019|\u00BB|\u203A|\u2032|\u2033|\u2034|\u301E|\u00B4|\u301E)/;

    /** search the term's 'post' punctuation  */
    exports.hasPost = function(punct) {
      return this.post.indexOf(punct) !== -1
    };
    /** search the term's 'pre' punctuation  */
    exports.hasPre = function(punct) {
      return this.pre.indexOf(punct) !== -1
    };

    /** does it have a quotation symbol?  */
    exports.hasQuote = function() {
      return startQuote.test(this.pre) || endQuote.test(this.post)
    };
    exports.hasQuotation = exports.hasQuote;

    /** does it have a comma?  */
    exports.hasComma = function() {
      return this.hasPost(',')
    };

    /** does it end in a period? */
    exports.hasPeriod = function() {
      return this.hasPost('.') === true && this.hasPost('...') === false
    };

    /** does it end in an exclamation */
    exports.hasExclamation = function() {
      return this.hasPost('!')
    };

    /** does it end with a question mark? */
    exports.hasQuestionMark = function() {
      return this.hasPost('?') || this.hasPost('¿')
    };

    /** is there a ... at the end? */
    exports.hasEllipses = function() {
      return this.hasPost('..') || this.hasPost('…') || this.hasPre('..') || this.hasPre('…')
    };

    /** is there a semicolon after this word? */
    exports.hasSemicolon = function() {
      return this.hasPost(';')
    };

    /** is there a slash '/' in this word? */
    exports.hasSlash = function() {
      return /\//.test(this.text)
    };

    /** a hyphen connects two words like-this */
    exports.hasHyphen = function() {
      const hyphen = /(-|–|—)/;
      return hyphen.test(this.post) || hyphen.test(this.pre)
    };
    /** a dash separates words - like that */
    exports.hasDash = function() {
      const hyphen = / (-|–|—) /;
      return hyphen.test(this.post) || hyphen.test(this.pre)
    };

    /** is it multiple words combinded */
    exports.hasContraction = function() {
      return Boolean(this.implicit)
    };

    /** try to sensibly put this punctuation mark into the term */
    exports.addPunctuation = function(punct) {
      // dont add doubles
      if (punct === ',' || punct === ';') {
        this.post = this.post.replace(punct, '');
      }
      this.post = punct + this.post;
      return this
    };
    });
    var _02Punctuation_1 = _02Punctuation.hasPost;
    var _02Punctuation_2 = _02Punctuation.hasPre;
    var _02Punctuation_3 = _02Punctuation.hasQuote;
    var _02Punctuation_4 = _02Punctuation.hasQuotation;
    var _02Punctuation_5 = _02Punctuation.hasComma;
    var _02Punctuation_6 = _02Punctuation.hasPeriod;
    var _02Punctuation_7 = _02Punctuation.hasExclamation;
    var _02Punctuation_8 = _02Punctuation.hasQuestionMark;
    var _02Punctuation_9 = _02Punctuation.hasEllipses;
    var _02Punctuation_10 = _02Punctuation.hasSemicolon;
    var _02Punctuation_11 = _02Punctuation.hasSlash;
    var _02Punctuation_12 = _02Punctuation.hasHyphen;
    var _02Punctuation_13 = _02Punctuation.hasDash;
    var _02Punctuation_14 = _02Punctuation.hasContraction;
    var _02Punctuation_15 = _02Punctuation.addPunctuation;

    //declare it up here
    let wrapMatch = function() {};

    /** ignore optional/greedy logic, straight-up term match*/
    const doesMatch = function(t, reg, index, length) {
      // support id matches
      if (reg.id === t.id) {
        return true
      }
      // support '.'
      if (reg.anything === true) {
        return true
      }
      // support '^' (in parentheses)
      if (reg.start === true && index !== 0) {
        return false
      }
      // support '$' (in parentheses)
      if (reg.end === true && index !== length - 1) {
        return false
      }
      //support a text match
      if (reg.word !== undefined) {
        //match contractions
        if (t.implicit !== null && t.implicit === reg.word) {
          return true
        }
        // term aliases for slashes and things
        if (t.alias !== undefined && t.alias.hasOwnProperty(reg.word)) {
          return true
        }
        // support ~ match
        if (reg.soft === true && reg.word === t.root) {
          return true
        }
        //match either .clean or .text
        return reg.word === t.clean || reg.word === t.text || reg.word === t.reduced
      }
      //support #Tag
      if (reg.tag !== undefined) {
        return t.tags[reg.tag] === true
      }
      //support @method
      if (reg.method !== undefined) {
        if (typeof t[reg.method] === 'function' && t[reg.method]() === true) {
          return true
        }
        return false
      }
      //support /reg/
      if (reg.regex !== undefined) {
        return reg.regex.test(t.clean)
      }
      // support optimized (one|two)
      if (reg.oneOf !== undefined) {
        return reg.oneOf.hasOwnProperty(t.reduced) || reg.oneOf.hasOwnProperty(t.text)
      }
      //support (one|two)
      if (reg.choices !== undefined) {
        // try to support && operator
        if (reg.operator === 'and') {
          // must match them all
          return reg.choices.every(r => wrapMatch(t, r, index, length))
        }
        // or must match one
        return reg.choices.some(r => wrapMatch(t, r, index, length))
      }
      return false
    };

    // wrap result for !negative match logic
    wrapMatch = function(t, reg, index, length) {
      let result = doesMatch(t, reg, index, length);
      if (reg.negative === true) {
        return !result
      }
      return result
    };

    var _doesMatch = wrapMatch;

    // these tags aren't juicy-enough
    const boring = {};

    /** check a match object against this term */
    var doesMatch_1 = function(reg, index, length) {
      return _doesMatch(this, reg, index, length)
    };

    /** does this term look like an acronym? */
    var isAcronym_1$1 = function() {
      return isAcronym_1(this.text)
    };

    /** is this term implied by a contraction? */
    var isImplicit = function() {
      return this.text === '' && Boolean(this.implicit)
    };

    /** does the term have at least one good tag? */
    var isKnown = function() {
      return Object.keys(this.tags).some(t => boring[t] !== true)
    };

    /** cache the root property of the term */
    var setRoot = function(world) {
      let transform = world.transforms;
      let str = this.implicit || this.clean;
      if (this.tags.Plural) {
        str = transform.toSingular(str, world);
      }
      if (this.tags.Verb && !this.tags.Negative && !this.tags.Infinitive) {
        let tense = null;
        if (this.tags.PastTense) {
          tense = 'PastTense';
        } else if (this.tags.Gerund) {
          tense = 'Gerund';
        } else if (this.tags.PresentTense) {
          tense = 'PresentTense';
        } else if (this.tags.Participle) {
          tense = 'Participle';
        } else if (this.tags.Actor) {
          tense = 'Actor';
        }
        str = transform.toInfinitive(str, world, tense);
      }
      this.root = str;
    };

    var _03Misc = {
    	doesMatch: doesMatch_1,
    	isAcronym: isAcronym_1$1,
    	isImplicit: isImplicit,
    	isKnown: isKnown,
    	setRoot: setRoot
    };

    const hasSpace = /[\s-]/;
    const isUpperCase = /^[A-Z-]+$/;

    // const titleCase = str => {
    //   return str.charAt(0).toUpperCase() + str.substr(1)
    // }

    /** return various text formats of this term */
    var textOut = function(options, showPre, showPost) {
      options = options || {};
      let word = this.text;
      let before = this.pre;
      let after = this.post;

      // -word-
      if (options.reduced === true) {
        word = this.reduced || '';
      }
      if (options.root === true) {
        word = this.root || '';
      }
      if (options.implicit === true && this.implicit) {
        word = this.implicit || '';
      }
      if (options.normal === true) {
        word = this.clean || this.text || '';
      }
      if (options.root === true) {
        word = this.root || this.reduced || '';
      }
      if (options.unicode === true) {
        word = unicode_1(word);
      }
      // cleanup case
      if (options.titlecase === true) {
        if (this.tags.ProperNoun && !this.titleCase()) ; else if (this.tags.Acronym) {
          word = word.toUpperCase(); //uppercase acronyms
        } else if (isUpperCase.test(word) && !this.tags.Acronym) {
          // lowercase everything else
          word = word.toLowerCase();
        }
      }
      if (options.lowercase === true) {
        word = word.toLowerCase();
      }
      // remove the '.'s from 'F.B.I.' (safely)
      if (options.acronyms === true && this.tags.Acronym) {
        word = word.replace(/\./g, '');
      }

      // -before/after-
      if (options.whitespace === true || options.root === true) {
        before = '';
        after = ' ';
        if ((hasSpace.test(this.post) === false || options.last) && !this.implicit) {
          after = '';
        }
      }
      if (options.punctuation === true && !options.root) {
        //normalized end punctuation
        if (this.hasPost('.') === true) {
          after = '.' + after;
        } else if (this.hasPost('?') === true) {
          after = '?' + after;
        } else if (this.hasPost('!') === true) {
          after = '!' + after;
        } else if (this.hasPost(',') === true) {
          after = ',' + after;
        } else if (this.hasEllipses() === true) {
          after = '...' + after;
        }
      }
      if (showPre !== true) {
        before = '';
      }
      if (showPost !== true) {
        // let keep = after.match(/\)/) || ''
        after = ''; //keep //after.replace(/[ .?!,]+/, '')
      }
      // remove the '.' from 'Mrs.' (safely)
      if (options.abbreviations === true && this.tags.Abbreviation) {
        after = after.replace(/^\./, '');
      }
      return before + word + after
    };

    var _04Text = {
    	textOut: textOut
    };

    const boringTags = {
      Auxiliary: 1,
      Possessive: 1,
    };

    /** a subjective ranking of tags kinda tfidf-based */
    const rankTags = function(term, world) {
      let tags = Object.keys(term.tags);
      const tagSet = world.tags;
      tags = tags.sort((a, b) => {
        //bury the tags we dont want
        if (boringTags[b] || !tagSet[b]) {
          return -1
        }
        // unknown tags are interesting
        if (!tagSet[b]) {
          return 1
        }
        if (!tagSet[a]) {
          return 0
        }
        // then sort by #of parent tags (most-specific tags first)
        if (tagSet[a].lineage.length > tagSet[b].lineage.length) {
          return 1
        }
        if (tagSet[a].isA.length > tagSet[b].isA.length) {
          return -1
        }
        return 0
      });
      return tags
    };
    var _bestTag = rankTags;

    const jsonDefault = {
      text: true,
      tags: true,
      implicit: true,
      whitespace: true,

      clean: false,
      id: false,
      index: false,
      offset: false,
      bestTag: false,
    };

    /** return various metadata for this term */
    var json = function(options, world) {
      options = options || {};
      options = Object.assign({}, jsonDefault, options);
      let result = {};

      // default on
      if (options.text) {
        result.text = this.text;
      }
      if (options.normal) {
        result.normal = this.normal;
      }

      if (options.tags) {
        result.tags = Object.keys(this.tags);
      }

      // default off
      if (options.clean) {
        result.clean = this.clean;
      }
      if (options.id || options.offset) {
        result.id = this.id;
      }
      if (options.implicit && this.implicit !== null) {
        result.implicit = this.implicit;
      }
      if (options.whitespace) {
        result.pre = this.pre;
        result.post = this.post;
      }
      if (options.bestTag) {
        result.bestTag = _bestTag(this, world)[0];
      }

      return result
    };

    var _05Json = {
    	json: json
    };

    var methods = Object.assign(
      {},
      _01Case,
      _02Punctuation,
      _03Misc,
      _04Text,
      _05Json
    );

    function isClientSide() {
      return typeof window !== 'undefined' && window.document
    }

    /** add spaces at the end */
    const padEnd = function(str, width) {
      str = str.toString();
      while (str.length < width) {
        str += ' ';
      }
      return str
    };

    /** output for verbose-mode */
    var logTag = function(t, tag, reason) {
      if (isClientSide()) {
        console.log('%c' + padEnd(t.clean, 3) + '  + ' + tag + ' ', 'color: #6accb2;');
        return
      }
      //server-side
      let log = '\x1b[33m' + padEnd(t.clean, 15) + '\x1b[0m + \x1b[32m' + tag + '\x1b[0m ';
      if (reason) {
        log = padEnd(log, 35) + ' ' + reason + '';
      }
      console.log(log);
    };

    /** output for verbose mode  */
    var logUntag = function(t, tag, reason) {
      if (isClientSide()) {
        console.log('%c' + padEnd(t.clean, 3) + '  - ' + tag + ' ', 'color: #AB5850;');
        return
      }
      //server-side
      let log = '\x1b[33m' + padEnd(t.clean, 3) + ' \x1b[31m - #' + tag + '\x1b[0m ';
      if (reason) {
        log = padEnd(log, 35) + ' ' + reason;
      }
      console.log(log);
    };

    var isArray = function(arr) {
      return Object.prototype.toString.call(arr) === '[object Array]'
    };

    var titleCase = str => {
      return str.charAt(0).toUpperCase() + str.substr(1)
    };

    var fns = {
    	logTag: logTag,
    	logUntag: logUntag,
    	isArray: isArray,
    	titleCase: titleCase
    };

    /** add a tag, and its descendents, to a term */
    const addTag = function(t, tag, reason, world) {
      let tagset = world.tags;
      //support '.' or '-' notation for skipping the tag
      if (tag === '' || tag === '.' || tag === '-') {
        return
      }
      if (tag[0] === '#') {
        tag = tag.replace(/^#/, '');
      }
      tag = fns.titleCase(tag);
      //if we already got this one
      if (t.tags[tag] === true) {
        return
      }
      // log it?
      const isVerbose = world.isVerbose();
      if (isVerbose === true) {
        fns.logTag(t, tag, reason);
      }
      //add tag
      t.tags[tag] = true; //whee!

      //check tagset for any additional things to do...
      if (tagset.hasOwnProperty(tag) === true) {
        //add parent Tags
        tagset[tag].isA.forEach(down => {
          t.tags[down] = true;
          if (isVerbose === true) {
            fns.logTag(t, '→ ' + down);
          }
        });
        //remove any contrary tags
        t.unTag(tagset[tag].notA, '←', world);
      }
    };

    /** support an array of tags */
    const addTags = function(term, tags, reason, world) {
      if (typeof tags !== 'string') {
        for (let i = 0; i < tags.length; i++) {
          addTag(term, tags[i], reason, world);
        }
        // tags.forEach(tag => addTag(term, tag, reason, world))
      } else {
        addTag(term, tags, reason, world);
      }
    };
    var add = addTags;

    const lowerCase = /^[a-z]/;

    const titleCase$1 = str => {
      return str.charAt(0).toUpperCase() + str.substr(1)
    };

    /** remove this tag, and its descentents from the term */
    const unTag = function(t, tag, reason, world) {
      const isVerbose = world.isVerbose();
      //support '*' for removing all tags
      if (tag === '*') {
        t.tags = {};
        return t
      }
      tag = tag.replace(/^#/, '');
      if (lowerCase.test(tag) === true) {
        tag = titleCase$1(tag);
      }
      // remove the tag
      if (t.tags[tag] === true) {
        delete t.tags[tag];
        //log in verbose-mode
        if (isVerbose === true) {
          fns.logUntag(t, tag, reason);
        }
      }
      //delete downstream tags too
      const tagset = world.tags;
      if (tagset[tag]) {
        let lineage = tagset[tag].lineage;
        for (let i = 0; i < lineage.length; i++) {
          if (t.tags[lineage[i]] === true) {
            delete t.tags[lineage[i]];
            if (isVerbose === true) {
              fns.logUntag(t, ' - ' + lineage[i]);
            }
          }
        }
      }
      return t
    };

    //handle an array of tags
    const untagAll = function(term, tags, reason, world) {
      if (typeof tags !== 'string' && tags) {
        for (let i = 0; i < tags.length; i++) {
          unTag(term, tags[i], reason, world);
        }
        return
      }
      unTag(term, tags, reason, world);
    };
    var unTag_1 = untagAll;

    //recursively-check compatibility of this tag and term
    const canBe = function(term, tag, world) {
      const tagset = world.tags;
      // cleanup tag
      if (tag[0] === '#') {
        tag = tag.replace(/^#/, '');
      }
      //fail-fast
      if (tagset[tag] === undefined) {
        return true
      }
      //loop through tag's contradictory tags
      let enemies = tagset[tag].notA || [];
      for (let i = 0; i < enemies.length; i++) {
        if (term.tags[enemies[i]] === true) {
          return false
        }
      }
      if (tagset[tag].isA !== undefined) {
        return canBe(term, tagset[tag].isA, world) //recursive
      }
      return true
    };

    var canBe_1 = canBe;

    /** add a tag or tags, and their descendents to this term
     * @param  {string | string[]} tags - a tag or tags
     * @param {string?} [reason] a clue for debugging
     */
    var tag_1 = function(tags, reason, world) {
      add(this, tags, reason, world);
      return this
    };

    /** only tag this term if it's consistent with it's current tags */
    var tagSafe = function(tags, reason, world) {
      if (canBe_1(this, tags, world)) {
        add(this, tags, reason, world);
      }
      return this
    };

    /** remove a tag or tags, and their descendents from this term
     * @param {string | string[]} tags  - a tag or tags
     * @param {string?} [reason] a clue for debugging
     */
    var unTag_1$1 = function(tags, reason, world) {
      unTag_1(this, tags, reason, world);
      return this
    };

    /** is this tag consistent with the word's current tags?
     * @param {string | string[]} tags - a tag or tags
     * @returns {boolean}
     */
    var canBe_1$1 = function(tags, world) {
      return canBe_1(this, tags, world)
    };

    var tag = {
    	tag: tag_1,
    	tagSafe: tagSafe,
    	unTag: unTag_1$1,
    	canBe: canBe_1$1
    };

    class Term {
      constructor(text = '') {
        text = String(text);
        let obj = parse(text);
        // the various forms of our text
        this.text = obj.text || '';
        this.clean = obj.clean;
        this.reduced = obj.reduced;
        this.root =  null;
        this.implicit =  null;

        this.pre = obj.pre || '';
        this.post = obj.post || '';
        this.tags = {};
        this.prev = null;
        this.next = null;
        this.id = _id(obj.clean);
        this.isA = 'Term'; // easier than .constructor...
        // support alternative matches
        if (obj.alias) {
          this.alias = obj.alias;
        }
      }
      /** set the text of the Term to something else*/
      set(str) {
        let obj = parse(str);

        this.text = obj.text;
        this.clean = obj.clean;
        return this
      }
    }

    /** create a deep-copy of this term */
    Term.prototype.clone = function () {
      let term = new Term(this.text);
      term.pre = this.pre;
      term.post = this.post;
      term.clean = this.clean;
      term.reduced = this.reduced;
      term.root = this.root;
      term.implicit = this.implicit;
      term.tags = Object.assign({}, this.tags);
      //use the old id, so it can be matched with .match(doc)
      // term.id = this.id
      return term
    };

    Object.assign(Term.prototype, methods);
    Object.assign(Term.prototype, tag);

    var Term_1 = Term;

    /** return a flat array of Term objects */
    var terms = function (n) {
      if (this.length === 0) {
        return []
      }
      // use cache, if it exists
      if (this.cache.terms) {
        if (n !== undefined) {
          return this.cache.terms[n]
        }
        return this.cache.terms
      }
      let terms = [this.pool.get(this.start)];
      for (let i = 0; i < this.length - 1; i += 1) {
        let id = terms[terms.length - 1].next;
        if (id === null) {
          // throw new Error('linked-list broken')
          console.error("Compromise error: Linked list broken in phrase '" + this.start + "'");
          break
        }
        let term = this.pool.get(id);
        terms.push(term);
        //return this one?
        if (n !== undefined && n === i) {
          return terms[n]
        }
      }
      if (n === undefined) {
        this.cache.terms = terms;
      }
      if (n !== undefined) {
        return terms[n]
      }
      return terms
    };

    /** return a shallow or deep copy of this phrase  */
    var clone = function (isShallow) {
      if (isShallow) {
        let p = this.buildFrom(this.start, this.length);
        p.cache = this.cache;
        return p
      }
      //how do we clone part of the pool?
      let terms = this.terms();
      let newTerms = terms.map(t => t.clone());
      // console.log(newTerms)
      //connect these new ids up
      newTerms.forEach((t, i) => {
        //add it to the pool..
        this.pool.add(t);
        if (newTerms[i + 1]) {
          t.next = newTerms[i + 1].id;
        }
        if (newTerms[i - 1]) {
          t.prev = newTerms[i - 1].id;
        }
      });
      return this.buildFrom(newTerms[0].id, newTerms.length)
    };

    /** return last term object */
    var lastTerm = function () {
      let terms = this.terms();
      return terms[terms.length - 1]
    };

    /** quick lookup for a term id */
    var hasId = function (wantId) {
      if (this.length === 0 || !wantId) {
        return false
      }
      if (this.start === wantId) {
        return true
      }
      // use cache, if available
      if (this.cache.terms) {
        let terms = this.cache.terms;
        for (let i = 0; i < terms.length; i++) {
          if (terms[i].id === wantId) {
            return true
          }
        }
        return false
      }
      // otherwise, go through each term
      let lastId = this.start;
      for (let i = 0; i < this.length - 1; i += 1) {
        let term = this.pool.get(lastId);
        if (term === undefined) {
          console.error(`Compromise error: Linked list broken. Missing term '${lastId}' in phrase '${this.start}'\n`);
          // throw new Error('linked List error')
          return false
        }
        if (term.next === wantId) {
          return true
        }
        lastId = term.next;
      }
      return false
    };

    /** how many seperate, non-empty words is it? */
    var wordCount = function () {
      return this.terms().filter(t => t.text !== '').length
    };

    /** get the full-sentence this phrase belongs to */
    var fullSentence = function () {
      let t = this.terms(0);
      //find first term in sentence
      while (t.prev) {
        t = this.pool.get(t.prev);
      }
      let start = t.id;
      let len = 1;
      //go to end of sentence
      while (t.next) {
        t = this.pool.get(t.next);
        len += 1;
      }
      return this.buildFrom(start, len)
    };

    var _01Utils = {
    	terms: terms,
    	clone: clone,
    	lastTerm: lastTerm,
    	hasId: hasId,
    	wordCount: wordCount,
    	fullSentence: fullSentence
    };

    const trimEnd = function(str) {
      return str.replace(/ +$/, '')
    };

    /** produce output in the given format */
    var text$2 = function(options = {}, isFirst, isLast) {
      if (typeof options === 'string') {
        if (options === 'normal') {
          options = {
            whitespace: true,
            unicode: true,
            lowercase: true,
            punctuation: true,
            acronyms: true,
            abbreviations: true,
            implicit: true,
            normal: true,
          };
        } else if (options === 'clean') {
          options = {
            titlecase: false,
            lowercase: true,
            punctuation: true,
            whitespace: true,
            unicode: true,
            implicit: true,
          };
        } else if (options === 'reduced') {
          options = {
            titlecase: false,
            lowercase: true,
            punctuation: false, //FIXME: reversed?
            whitespace: true,
            unicode: true,
            implicit: true,
            reduced: true,
          };
        } else if (options === 'root') {
          options = {
            titlecase: false,
            lowercase: true,
            punctuation: true,
            whitespace: true,
            unicode: true,
            implicit: true,
            root: true,
          };
        } else {
          options = {};
        }
      }
      let terms = this.terms();
      //this this phrase a complete sentence?
      let isFull = false;
      if (terms[0] && terms[0].prev === null && terms[terms.length - 1].next === null) {
        isFull = true;
      }
      let text = terms.reduce((str, t, i) => {
        options.last = isLast && i === terms.length - 1;
        let showPre = true;
        let showPost = true;
        if (isFull === false) {
          // dont show beginning whitespace
          if (i === 0 && isFirst) {
            showPre = false;
          }
          // dont show end-whitespace
          if (i === terms.length - 1 && isLast) {
            showPost = false;
          }
        }
        let txt = t.textOut(options, showPre, showPost);
        // if (options.titlecase && i === 0) {
        // txt = titleCase(txt)
        // }
        return str + txt
      }, '');
      //full-phrases show punctuation, but not whitespace
      if (isFull === true && isLast) {
        text = trimEnd(text);
      }
      if (options.trim === true) {
        text = text.trim();
      }
      return text
    };

    var _02Text = {
    	text: text$2
    };

    /** remove start and end whitespace */
    var trim = function() {
      let terms = this.terms();
      if (terms.length > 0) {
        //trim starting
        terms[0].pre = terms[0].pre.replace(/^\s+/, '');
        //trim ending
        let lastTerm = terms[terms.length - 1];
        lastTerm.post = lastTerm.post.replace(/\s+$/, '');
      }
      return this
    };

    var _03Change = {
    	trim: trim
    };

    const endOfSentence = /[.?!]\s*$/;

    // replacing a 'word.' with a 'word!'
    const combinePost = function(before, after) {
      //only transfer the whitespace
      if (endOfSentence.test(after)) {
        let whitespace = before.match(/\s*$/);
        return after + whitespace
      }
      return before
    };

    //add whitespace to the start of the second bit
    const addWhitespace = function(beforeTerms, newTerms) {
      // add any existing pre-whitespace to beginning
      newTerms[0].pre = beforeTerms[0].pre;
      let lastTerm = beforeTerms[beforeTerms.length - 1];

      //add any existing punctuation to end of our new terms
      let newTerm = newTerms[newTerms.length - 1];
      newTerm.post = combinePost(lastTerm.post, newTerm.post);
      // remove existing punctuation
      lastTerm.post = '';

      //before ←[space]  - after
      if (lastTerm.post === '') {
        lastTerm.post += ' ';
      }
    };

    //insert this segment into the linked-list
    const stitchIn = function(beforeTerms, newTerms, pool) {
      let lastBefore = beforeTerms[beforeTerms.length - 1];
      let lastNew = newTerms[newTerms.length - 1];
      let afterId = lastBefore.next;
      //connect ours in (main → newPhrase)
      lastBefore.next = newTerms[0].id;
      //stich the end in  (newPhrase → after)
      lastNew.next = afterId;
      //do it backwards, too
      if (afterId) {
        // newPhrase ← after
        let afterTerm = pool.get(afterId);
        afterTerm.prev = lastNew.id;
      }
      // before ← newPhrase
      let beforeId = beforeTerms[0].id;
      if (beforeId) {
        let newTerm = newTerms[0];
        newTerm.prev = beforeId;
      }
    };

    // avoid stretching a phrase twice.
    const unique = function(list) {
      return list.filter((o, i) => {
        return list.indexOf(o) === i
      })
    };

    //append one phrase onto another.
    const appendPhrase = function(before, newPhrase, doc) {
      let beforeTerms = before.terms();
      let newTerms = newPhrase.terms();
      //spruce-up the whitespace issues
      addWhitespace(beforeTerms, newTerms);
      //insert this segment into the linked-list
      stitchIn(beforeTerms, newTerms, before.pool);

      // stretch!
      // make each effected phrase longer
      let toStretch = [before];
      let hasId = before.start;
      let docs = [doc];

      docs = docs.concat(doc.parents()); // find them all!

      docs.forEach(parent => {
        // only the phrases that should change
        let shouldChange = parent.list.filter(p => {
          return p.hasId(hasId)
        });
        toStretch = toStretch.concat(shouldChange);
      });
      // don't double-count a phrase
      toStretch = unique(toStretch);
      toStretch.forEach(p => {
        p.length += newPhrase.length;
      });
      before.cache = {};
      return before
    };
    var append$2 = appendPhrase;

    const hasSpace$1 = / /;

    //a new space needs to be added, either on the new phrase, or the old one
    // '[new] [◻old]'   -or-   '[old] [◻new] [old]'
    const addWhitespace$1 = function(newTerms) {
      //add a space before our new text?
      // add a space after our text
      let lastTerm = newTerms[newTerms.length - 1];
      if (hasSpace$1.test(lastTerm.post) === false) {
        lastTerm.post += ' ';
      }
      return
    };

    //insert this segment into the linked-list
    const stitchIn$1 = function(main, newPhrase, newTerms) {
      // [newPhrase] → [main]
      let lastTerm = newTerms[newTerms.length - 1];
      lastTerm.next = main.start;
      // [before] → [main]
      let pool = main.pool;
      let start = pool.get(main.start);
      if (start.prev) {
        let before = pool.get(start.prev);
        before.next = newPhrase.start;
      }
      //do it backwards, too
      // before ← newPhrase
      newTerms[0].prev = main.terms(0).prev;
      // newPhrase ← main
      main.terms(0).prev = lastTerm.id;
    };

    const unique$1 = function(list) {
      return list.filter((o, i) => {
        return list.indexOf(o) === i
      })
    };

    //append one phrase onto another
    const joinPhrase = function(original, newPhrase, doc) {
      const starterId = original.start;
      let newTerms = newPhrase.terms();
      //spruce-up the whitespace issues
      addWhitespace$1(newTerms);
      //insert this segment into the linked-list
      stitchIn$1(original, newPhrase, newTerms);
      //increase the length of our phrases
      let toStretch = [original];
      let docs = [doc];
      docs = docs.concat(doc.parents());
      docs.forEach(d => {
        // only the phrases that should change
        let shouldChange = d.list.filter(p => {
          return p.hasId(starterId) || p.hasId(newPhrase.start)
        });
        toStretch = toStretch.concat(shouldChange);
      });
      // don't double-count
      toStretch = unique$1(toStretch);
      // stretch these phrases
      toStretch.forEach(p => {
        p.length += newPhrase.length;
        // change the start too, if necessary
        if (p.start === starterId) {
          p.start = newPhrase.start;
        }
        p.cache = {};
      });
      return original
    };
    var prepend = joinPhrase;

    //recursively decrease the length of all the parent phrases
    const shrinkAll = function(doc, id, deleteLength, after) {
      let arr = doc.parents();
      arr.push(doc);

      arr.forEach(d => {
        //find our phrase to shrink
        let phrase = d.list.find(p => p.hasId(id));
        if (!phrase) {
          return
        }
        phrase.length -= deleteLength;
        // does it start with this soon-removed word?
        if (phrase.start === id) {
          phrase.start = after.id;
        }
        phrase.cache = {};
      });
      // cleanup empty phrase objects
      doc.list = doc.list.filter(p => {
        if (!p.start || !p.length) {
          return false
        }
        return true
      });
    };

    /** wrap the linked-list around these terms
     * so they don't appear any more
     */
    const deletePhrase = function(phrase, doc) {
      let pool = doc.pool();
      let terms = phrase.terms();

      //grab both sides of the chain,
      let prev = pool.get(terms[0].prev) || {};
      let after = pool.get(terms[terms.length - 1].next) || {};

      if (terms[0].implicit && prev.implicit) {
        prev.set(prev.implicit);
        prev.post += ' ';
      }

      // //first, change phrase lengths
      shrinkAll(doc, phrase.start, phrase.length, after);

      // connect [prev]->[after]
      if (prev) {
        prev.next = after.id;
      }
      // connect [prev]<-[after]
      if (after) {
        after.prev = prev.id;
      }

      // lastly, actually delete the terms from the pool?
      // for (let i = 0; i < terms.length; i++) {
      //   pool.remove(terms[i].id)
      // }
    };
    var _delete = deletePhrase;

    // const tokenize = require('../../01-tokenizer')

    /** put this text at the end */
    var append_1 = function(newPhrase, doc) {
      append$2(this, newPhrase, doc);
      return this
    };

    /** add this text to the beginning */
    var prepend_1 = function(newPhrase, doc) {
      prepend(this, newPhrase, doc);
      return this
    };

    var _delete$1 = function(doc) {
      _delete(this, doc);
      return this
    };

    // stich-in newPhrase, stretch 'doc' + parents
    var replace = function(newPhrase, doc) {
      //add it do the end
      let firstLength = this.length;
      append$2(this, newPhrase, doc);

      //delete original terms
      let tmp = this.buildFrom(this.start, this.length);
      tmp.length = firstLength;
      _delete(tmp, doc);
    };

    /**
     * Turn this phrase object into 3 phrase objects
     */
    var splitOn = function(p) {
      let terms = this.terms();
      let result = {
        before: null,
        match: null,
        after: null,
      };
      let index = terms.findIndex(t => t.id === p.start);
      if (index === -1) {
        return result
      }
      //make all three sections into phrase-objects
      let start = terms.slice(0, index);
      if (start.length > 0) {
        result.before = this.buildFrom(start[0].id, start.length);
      }
      let match = terms.slice(index, index + p.length);
      if (match.length > 0) {
        result.match = this.buildFrom(match[0].id, match.length);
      }
      let end = terms.slice(index + p.length, terms.length);
      if (end.length > 0) {
        result.after = this.buildFrom(end[0].id, end.length, this.pool);
      }
      return result
    };

    var _04Insert = {
    	append: append_1,
    	prepend: prepend_1,
    	delete: _delete$1,
    	replace: replace,
    	splitOn: splitOn
    };

    /** return json metadata for this phrase */
    var json$1 = function(options = {}, world) {
      let res = {};
      // text data
      if (options.text) {
        res.text = this.text();
      }
      if (options.normal) {
        res.normal = this.text('normal');
      }
      if (options.clean) {
        res.clean = this.text('clean');
      }
      if (options.reduced) {
        res.reduced = this.text('reduced');
      }
      if (options.root) {
        res.root = this.text('root');
      }
      if (options.trim) {
        if (res.text) {
          res.text = res.text.trim();
        }
        if (res.normal) {
          res.normal = res.normal.trim();
        }
        if (res.reduced) {
          res.reduced = res.reduced.trim();
        }
      }
      // terms data
      if (options.terms) {
        if (options.terms === true) {
          options.terms = {};
        }
        res.terms = this.terms().map(t => t.json(options.terms, world));
      }
      return res
    };

    var _05Json$1 = {
    	json: json$1
    };

    /** match any terms after this phrase */
    var lookAhead = function(regs) {
      // if empty match string, return everything after
      if (!regs) {
        regs = '.*';
      }
      let pool = this.pool;
      // get a list of all terms preceding our start
      let terms = [];
      const getAfter = function(id) {
        let term = pool.get(id);
        if (!term) {
          return
        }
        terms.push(term);
        if (term.prev) {
          getAfter(term.next); //recursion
        }
      };
      let all = this.terms();
      let lastTerm = all[all.length - 1];
      getAfter(lastTerm.next);
      if (terms.length === 0) {
        return []
      }
      // got the terms, make a phrase from them
      let p = this.buildFrom(terms[0].id, terms.length);
      return p.match(regs)
    };

    /** match any terms before this phrase */
    var lookBehind = function(regs) {
      // if empty match string, return everything before
      if (!regs) {
        regs = '.*';
      }
      let pool = this.pool;
      // get a list of all terms preceding our start
      let terms = [];
      const getBefore = function(id) {
        let term = pool.get(id);
        if (!term) {
          return
        }
        terms.push(term);
        if (term.prev) {
          getBefore(term.prev); //recursion
        }
      };
      let term = pool.get(this.start);
      getBefore(term.prev);
      if (terms.length === 0) {
        return []
      }
      // got the terms, make a phrase from them
      let p = this.buildFrom(terms[terms.length - 1].id, terms.length);
      return p.match(regs)
    };

    var _06Lookahead = {
    	lookAhead: lookAhead,
    	lookBehind: lookBehind
    };

    var methods$1 = Object.assign(
      {},
      _01Utils,
      _02Text,
      _03Change,
      _04Insert,
      _05Json$1,
      _06Lookahead
    );

    // try to avoid doing the match
    const failFast = function(p, regs) {
      if (regs.length === 0) {
        return true
      }
      for (let i = 0; i < regs.length; i += 1) {
        let reg = regs[i];
        //logical quick-ones
        if (reg.optional !== true && reg.negative !== true) {
          //start/end impossibilites
          if (reg.start === true && i > 0) {
            return true
          }
        }
        //this is not possible
        if (reg.anything === true && reg.negative === true) {
          return true
        }
      }
      return false
    };
    var _02FailFast = failFast;

    // i formally apologize for how complicated this is.

    //found a match? it's greedy? keep going!
    const getGreedy = function (terms, t, reg, until, index, length) {
      let start = t;
      for (; t < terms.length; t += 1) {
        //stop for next-reg match
        if (until && terms[t].doesMatch(until, index + t, length)) {
          return t
        }
        let count = t - start + 1;
        // is it max-length now?
        if (reg.max !== undefined && count === reg.max) {
          return t
        }
        //stop here
        if (terms[t].doesMatch(reg, index + t, length) === false) {
          // is it too short?
          if (reg.min !== undefined && count < reg.min) {
            return null
          }
          return t
        }
      }
      return t
    };

    //'unspecific greedy' is a weird situation.
    const greedyTo = function (terms, t, nextReg, index, length) {
      //if there's no next one, just go off the end!
      if (!nextReg) {
        return terms.length
      }
      //otherwise, we're looking for the next one
      for (; t < terms.length; t += 1) {
        if (terms[t].doesMatch(nextReg, index + t, length) === true) {
          return t
        }
      }
      //guess it doesn't exist, then.
      return null
    };

    // get or create named group
    const getOrCreateGroup = function (namedGroups, namedGroupId, terms, startIndex, group) {
      const g = namedGroups[namedGroupId];

      if (g) {
        return g
      }

      const { id } = terms[startIndex];

      namedGroups[namedGroupId] = {
        group: String(group),
        start: id,
        length: 0,
      };

      return namedGroups[namedGroupId]
    };

    /** tries to match a sequence of terms, starting from here */
    const tryHere = function (terms, regs, index, length) {
      const namedGroups = {};
      let previousGroupId = null;
      let t = 0;
      // we must satisfy each rule in 'regs'
      for (let r = 0; r < regs.length; r += 1) {
        let reg = regs[r];

        // Check if this reg has a named capture group
        const isNamedGroup = typeof reg.named === 'string' || typeof reg.named === 'number';
        let namedGroupId = null;

        // Reuse previous capture group if same
        if (isNamedGroup) {
          const prev = regs[r - 1];
          if (prev && prev.named === reg.named && previousGroupId) {
            namedGroupId = previousGroupId;
          } else {
            namedGroupId = _id(reg.named);
            previousGroupId = namedGroupId;
          }
        }

        //should we fail here?
        if (!terms[t]) {
          //are all remaining regs optional?
          const hasNeeds = regs.slice(r).some(remain => !remain.optional);
          if (hasNeeds === false) {
            break
          }
          // have unmet needs
          return [false, null]
        }

        //support 'unspecific greedy' .* properly
        if (reg.anything === true && reg.greedy === true) {
          let skipto = greedyTo(terms, t, regs[r + 1], reg, index);
          // ensure it's long enough
          if (reg.min !== undefined && skipto - t < reg.min) {
            return [false, null]
          }
          // reduce it back, if it's too long
          if (reg.max !== undefined && skipto - t > reg.max) {
            t = t + reg.max;
            continue
          }

          if (skipto === null) {
            return [false, null] //couldn't find it
          }

          // is it really this easy?....
          if (isNamedGroup) {
            const g = getOrCreateGroup(namedGroups, namedGroupId, terms, t, reg.named);

            // Update group
            g.length = skipto - t;
          }

          t = skipto;

          continue
        }
        //if it looks like a match, continue
        //we have a special case where an end-anchored greedy match may need to
        //start matching before the actual end; we do this by (temporarily!)
        //removing the "end" property from the matching token... since this is
        //very situation-specific, we *only* do this when we really need to.
        if (
          reg.anything === true ||
          (reg.end === true &&
            reg.greedy === true &&
            index + t < length - 1 &&
            terms[t].doesMatch(Object.assign({}, reg, { end: false }), index + t, length) === true) ||
          terms[t].doesMatch(reg, index + t, length) === true
        ) {
          let startAt = t;
          // okay, it was a match, but if it optional too,
          // we should check the next reg too, to skip it?
          if (reg.optional && regs[r + 1]) {
            // does the next reg match it too?
            if (terms[t].doesMatch(regs[r + 1], index + t, length) === true) {
              // but does the next reg match the next term??
              // only skip if it doesn't
              if (!terms[t + 1] || terms[t + 1].doesMatch(regs[r + 1], index + t, length) === false) {
                r += 1;
              }
            }
          }
          //advance to the next term!
          t += 1;
          //check any ending '$' flags
          if (reg.end === true) {
            //if this isn't the last term, refuse the match
            if (t !== terms.length && reg.greedy !== true) {
              return [false, null]
            }
          }

          //try keep it going!
          if (reg.greedy === true) {
            // for greedy checking, we no longer care about the reg.start
            // value, and leaving it can cause failures for anchored greedy
            // matches.  ditto for end-greedy matches: we need an earlier non-
            // ending match to succceed until we get to the actual end.
            t = getGreedy(terms, t, Object.assign({}, reg, { start: false, end: false }), regs[r + 1], index, length);
            if (t === null) {
              return [false, null] //greedy was too short
            }
            if (reg.min && reg.min > t) {
              return [false, null] //greedy was too short
            }
            // if this was also an end-anchor match, check to see we really
            // reached the end
            if (reg.end === true && index + t !== length) {
              return [false, null] //greedy didn't reach the end
            }
          }
          if (isNamedGroup) {
            // Get or create capture group
            const g = getOrCreateGroup(namedGroups, namedGroupId, terms, startAt, reg.named);

            // Update group - add greedy or increment length
            if (t > 1 && reg.greedy) {
              g.length += t - startAt;
            } else {
              g.length++;
            }
          }

          continue
        }

        //bah, who cares, keep going
        if (reg.optional === true) {
          continue
        }
        // should we skip-over an implicit word?
        if (terms[t].isImplicit() && regs[r - 1] && terms[t + 1]) {
          // does the next one match?
          if (terms[t + 1].doesMatch(reg, index + t, length)) {
            t += 2;
            continue
          }
        }
        // console.log('   ❌\n\n')
        return [false, null]
      }

      //return our result
      return [terms.slice(0, t), namedGroups]
    };
    var _03TryMatch = tryHere;

    const postProcess = function(terms, regs, matches) {
      if (!matches || matches.length === 0) {
        return matches
      }
      // ensure end reg has the end term
      let atEnd = regs.some(r => r.end);
      if (atEnd) {
        let lastTerm = terms[terms.length - 1];
        matches = matches.filter(({ match: arr }) => arr.indexOf(lastTerm) !== -1);
      }
      return matches
    };
    var _04PostProcess = postProcess;

    /* break-down a match expression into this:
    {
      word:'',
      tag:'',
      regex:'',

      start:false,
      end:false,
      negative:false,
      anything:false,
      greedy:false,
      optional:false,

      named:'',
      choices:[],
    }
    */
    const hasMinMax = /\{([0-9]+,?[0-9]*)\}/;
    const andSign = /&&/;
    const captureName = new RegExp(/^<(\S+)>/);

    const titleCase$2 = str => {
      return str.charAt(0).toUpperCase() + str.substr(1)
    };

    const end = function(str) {
      return str[str.length - 1]
    };
    const start = function(str) {
      return str[0]
    };
    const stripStart = function(str) {
      return str.substr(1)
    };
    const stripEnd = function(str) {
      return str.substr(0, str.length - 1)
    };
    const stripBoth = function(str) {
      str = stripStart(str);
      str = stripEnd(str);
      return str
    };

    //
    const parseToken = function(w) {
      let obj = {};
      //collect any flags (do it twice)
      for (let i = 0; i < 2; i += 1) {
        //end-flag
        if (end(w) === '$') {
          obj.end = true;
          w = stripEnd(w);
        }
        //front-flag
        if (start(w) === '^') {
          obj.start = true;
          w = stripStart(w);
        }
        //capture group (this one can span multiple-terms)
        if (start(w) === '[' || end(w) === ']') {
          obj.named = true;

          if (start(w) === '[') {
            obj.groupType = end(w) === ']' ? 'single' : 'start';
          } else {
            obj.groupType = 'end';
          }

          w = w.replace(/^\[/, '');
          w = w.replace(/\]$/, '');

          // Use capture group name
          if (start(w) === '<') {
            const res = captureName.exec(w);

            if (res.length >= 2) {
              obj.named = res[1];
              w = w.replace(res[0], '');
            }
          }
        }
        //back-flags
        if (end(w) === '+') {
          obj.greedy = true;
          w = stripEnd(w);
        }
        if (w !== '*' && end(w) === '*' && w !== '\\*') {
          obj.greedy = true;
          w = stripEnd(w);
        }
        if (end(w) === '?') {
          obj.optional = true;
          w = stripEnd(w);
        }

        if (start(w) === '!') {
          obj.negative = true;
          w = stripStart(w);
        }
        //wrapped-flags
        if (start(w) === '(' && end(w) === ')') {
          // support (one && two)
          if (andSign.test(w)) {
            obj.choices = w.split(andSign);
            obj.operator = 'and';
          } else {
            obj.choices = w.split('|');
            obj.operator = 'or';
          }
          //remove '(' and ')'
          obj.choices[0] = stripStart(obj.choices[0]);
          let last = obj.choices.length - 1;
          obj.choices[last] = stripEnd(obj.choices[last]);
          // clean up the results
          obj.choices = obj.choices.map(s => s.trim());
          obj.choices = obj.choices.filter(s => s);
          //recursion alert!
          obj.choices = obj.choices.map(parseToken);
          w = '';
        }

        //regex
        if (start(w) === '/' && end(w) === '/') {
          w = stripBoth(w);
          obj.regex = new RegExp(w); //potential vuln - security/detect-non-literal-regexp
          return obj
        }
        //soft-match
        if (start(w) === '~' && end(w) === '~') {
          w = stripBoth(w);
          obj.soft = true;
          obj.word = w;
          return obj
        }
      }
      // support #Tag{0,9}
      if (hasMinMax.test(w) === true) {
        w = w.replace(hasMinMax, (a, b) => {
          let arr = b.split(/,/g);
          if (arr.length === 1) {
            // '{3}'	Exactly three times
            obj.min = Number(arr[0]);
            obj.max = Number(arr[0]);
          } else {
            // '{2,4}' Two to four times
            // '{3,}' Three or more times
            obj.min = Number(arr[0]);
            obj.max = Number(arr[1] || 999);
          }
          obj.greedy = true;
          return ''
        });
      }

      //do the actual token content
      if (start(w) === '#') {
        obj.tag = stripStart(w);
        obj.tag = titleCase$2(obj.tag);
        return obj
      }
      //dynamic function on a term object
      if (start(w) === '@') {
        obj.method = stripStart(w);
        return obj
      }
      if (w === '.') {
        obj.anything = true;
        return obj
      }
      //support alone-astrix
      if (w === '*') {
        obj.anything = true;
        obj.greedy = true;
        obj.optional = true;
        return obj
      }
      if (w) {
        //somehow handle encoded-chars?
        w = w.replace('\\*', '*');
        w = w.replace('\\.', '.');
        obj.word = w.toLowerCase();
      }
      return obj
    };
    var parseToken_1 = parseToken;

    const isNamed = function(capture) {
      return typeof capture === 'string' || typeof capture === 'number'
    };

    const fillGroups = function(tokens) {
      let convert = false;
      let index = -1;
      let current;

      //'fill in' capture groups between start-end
      for (let i = 0; i < tokens.length; i++) {
        const n = tokens[i];

        // Give name to un-named single tokens
        if (n.groupType === 'single' && n.named === true) {
          index += 1;
          n.named = index;
          continue
        }

        // Start converting tokens
        if (n.groupType === 'start') {
          convert = true;
          if (isNamed(n.named)) {
            current = n.named;
          } else {
            index += 1;
            current = index;
          }
        }

        // Ensure this token has the right name
        if (convert) {
          n.named = current;
        }

        // Stop converting tokens
        if (n.groupType === 'end') {
          convert = false;
        }
      }
      return tokens
    };

    const useOneOf = function(tokens) {
      return tokens.map(token => {
        if (token.choices !== undefined) {
          // are they all straight non-optional words?
          let shouldPack = token.choices.every(c => c.optional !== true && c.negative !== true && c.word !== undefined);
          if (shouldPack === true) {
            let oneOf = {};
            token.choices.forEach(c => (oneOf[c.word] = true));
            token.oneOf = oneOf;
            delete token.choices;
          }
        }
        return token
      })
    };

    const postProcess$1 = function(tokens) {
      // ensure all capture groups are filled between start and end
      // give all capture groups names
      let count = tokens.filter(t => t.groupType).length;
      if (count > 0) {
        tokens = fillGroups(tokens);
      }
      // convert 'choices' format to 'oneOf' format
      tokens = useOneOf(tokens);
      // console.log(tokens)

      return tokens
    };
    var postProcess_1 = postProcess$1;

    const isArray$1 = function(arr) {
      return Object.prototype.toString.call(arr) === '[object Array]'
    };

    //split-up by (these things)
    const byParentheses = function(str) {
      let arr = str.split(/([\^\[\!]*(?:<\S+>)?\(.*?\)[?+*]*\]?\$?)/);
      arr = arr.map(s => s.trim());
      return arr
    };

    const byWords = function(arr) {
      let words = [];
      arr.forEach(a => {
        //keep brackets lumped together
        if (/^[[^_/]?\(/.test(a[0])) {
          words.push(a);
          return
        }
        let list = a.split(' ');
        list = list.filter(w => w);
        words = words.concat(list);
      });
      return words
    };

    //turn an array into a 'choices' list
    const byArray = function(arr) {
      return [
        {
          choices: arr.map(s => {
            return {
              word: s,
            }
          }),
        },
      ]
    };

    const fromDoc = function(doc) {
      if (!doc || !doc.list || !doc.list[0]) {
        return []
      }
      let ids = [];
      doc.list.forEach(p => {
        p.terms().forEach(t => {
          ids.push({ id: t.id });
        });
      });
      return [{ choices: ids, greedy: true }]
    };

    /** parse a match-syntax string into json */
    const syntax = function(input) {
      // fail-fast
      if (input === null || input === undefined || input === '') {
        return []
      }
      //try to support a ton of different formats:
      if (typeof input === 'object') {
        if (isArray$1(input)) {
          if (input.length === 0 || !input[0]) {
            return []
          }

          //is it a pre-parsed reg-list?
          if (typeof input[0] === 'object') {
            return input
          }
          //support a flat array of normalized words
          if (typeof input[0] === 'string') {
            return byArray(input)
          }
        }
        //support passing-in a compromise object as a match
        if (input && input.isA === 'Doc') {
          return fromDoc(input)
        }
        return []
      }
      if (typeof input === 'number') {
        input = String(input); //go for it?
      }
      let tokens = byParentheses(input);
      tokens = byWords(tokens);
      tokens = tokens.map(parseToken_1);
      //clean up anything weird
      tokens = postProcess_1(tokens);
      // console.log(JSON.stringify(tokens, null, 2))
      return tokens
    };

    var syntax_1 = syntax;

    /**  returns a simple array of arrays */
    const matchAll = function(p, regs, matchOne = false) {
      //if we forgot to parse it..
      if (typeof regs === 'string') {
        regs = syntax_1(regs);
      }
      //try to dismiss it, at-once
      if (_02FailFast(p, regs) === true) {
        return []
      }

      //any match needs to be this long, at least
      const minLength = regs.filter(r => r.optional !== true).length;
      let terms = p.terms();
      let matches = [];

      //optimisation for '^' start logic
      if (regs[0].start === true) {
        let [match, groups] = _03TryMatch(terms, regs, 0, terms.length);
        if (match !== false && match.length > 0) {
          match = match.filter(m => m);
          matches.push({ match, groups });
        }

        return _04PostProcess(terms, regs, matches)
      }
      //try starting, from every term
      for (let i = 0; i < terms.length; i += 1) {
        // slice may be too short
        if (i + minLength > terms.length) {
          break
        }
        //try it!
        let [match, groups] = _03TryMatch(terms.slice(i), regs, i, terms.length);
        if (match !== false && match.length > 0) {
          //zoom forward!
          i += match.length - 1;
          //[capture-groups] return some null responses
          match = match.filter(m => m);
          matches.push({ match, groups });

          //ok, maybe that's enough?
          if (matchOne === true) {
            return _04PostProcess(terms, regs, matches)
          }
        }
      }
      return _04PostProcess(terms, regs, matches)
    };
    var _01MatchAll = matchAll;

    /** return anything that doesn't match.
     * returns a simple array of arrays
     */
    const notMatch = function(p, regs) {
      let found = {};
      let arr = _01MatchAll(p, regs);
      arr.forEach(({ match: ts }) => {
        ts.forEach(t => {
          found[t.id] = true;
        });
      });
      //return anything not found
      let terms = p.terms();
      let result = [];
      let current = [];
      terms.forEach(t => {
        if (found[t.id] === true) {
          if (current.length > 0) {
            result.push(current);
            current = [];
          }
          return
        }
        current.push(t);
      });
      if (current.length > 0) {
        result.push(current);
      }
      return result
    };
    var not = notMatch;

    /** return an array of matching phrases */
    var match_1 = function(regs, justOne = false) {
      let matches = _01MatchAll(this, regs, justOne);
      //make them phrase objects
      matches = matches.map(({ match, groups }) => {
        let p = this.buildFrom(match[0].id, match.length, groups);
        p.cache.terms = match;
        return p
      });
      return matches
    };

    /** return boolean if one match is found */
    var has = function(regs) {
      let matches = _01MatchAll(this, regs, true);
      return matches.length > 0
    };

    /** remove all matches from the result */
    var not$1 = function(regs) {
      let matches = not(this, regs);
      //make them phrase objects
      matches = matches.map(list => {
        return this.buildFrom(list[0].id, list.length)
      });
      return matches
    };

    /** return a list of phrases that can have this tag */
    var canBe$1 = function(tag, world) {
      let results = [];
      let terms = this.terms();
      let previous = false;
      for (let i = 0; i < terms.length; i += 1) {
        let can = terms[i].canBe(tag, world);
        if (can === true) {
          if (previous === true) {
            //add it to the end
            results[results.length - 1].push(terms[i]);
          } else {
            results.push([terms[i]]); //make a new one
          }
          previous = can;
        }
      }
      //turn them into Phrase objects
      results = results
        .filter(a => a.length > 0)
        .map(arr => {
          return this.buildFrom(arr[0].id, arr.length)
        });
      return results
    };

    var match = {
    	match: match_1,
    	has: has,
    	not: not$1,
    	canBe: canBe$1
    };

    // const tokenize = require('../01-tokenizer')

    class Phrase {
      constructor(id, length, pool) {
        this.start = id;
        this.length = length;
        this.isA = 'Phrase'; // easier than .constructor...
        Object.defineProperty(this, 'pool', {
          enumerable: false,
          writable: true,
          value: pool,
        });
        Object.defineProperty(this, 'cache', {
          enumerable: false,
          writable: true,
          value: {},
        });
        Object.defineProperty(this, 'groups', {
          enumerable: false,
          writable: true,
          value: {},
        });
      }
    }

    /** create a new Phrase object from an id and length */
    Phrase.prototype.buildFrom = function(id, length, groups) {
      let p = new Phrase(id, length, this.pool);
      //copy-over or replace capture-groups too
      if (groups && Object.keys(groups).length > 0) {
        p.groups = groups;
      } else {
        p.groups = this.groups;
      }
      return p
    };

    //apply methods
    Object.assign(Phrase.prototype, match);
    Object.assign(Phrase.prototype, methods$1);

    //apply aliases
    const aliases = {
      term: 'terms',
    };
    Object.keys(aliases).forEach(k => (Phrase.prototype[k] = Phrase.prototype[aliases[k]]));

    var Phrase_1 = Phrase;

    /** a key-value store of all terms in our Document */
    class Pool {
      constructor(words = {}) {
        //quiet this property in console.logs
        Object.defineProperty(this, 'words', {
          enumerable: false,
          value: words,
        });
      }
      /** throw a new term object in */
      add(term) {
        this.words[term.id] = term;
        return this
      }
      /** find a term by it's id */
      get(id) {
        return this.words[id]
      }
      /** find a term by it's id */
      remove(id) {
        delete this.words[id];
      }
      merge(pool) {
        Object.assign(this.words, pool.words);
        return this
      }
      /** helper method */
      stats() {
        return {
          words: Object.keys(this.words).length,
        }
      }
    }

    /** make a deep-copy of all terms */
    Pool.prototype.clone = function() {
      let keys = Object.keys(this.words);
      let words = keys.reduce((h, k) => {
        let t = this.words[k].clone();
        h[t.id] = t;
        return h
      }, {});
      return new Pool(words)
    };

    var Pool_1 = Pool;

    //add forward/backward 'linked-list' prev/next ids
    const linkTerms = terms => {
      terms.forEach((term, i) => {
        if (i > 0) {
          term.prev = terms[i - 1].id;
        }
        if (terms[i + 1]) {
          term.next = terms[i + 1].id;
        }
      });
    };
    var _linkTerms = linkTerms;

    //(Rule-based sentence boundary segmentation) - chop given text into its proper sentences.
    // Ignore periods/questions/exclamations used in acronyms/abbreviations/numbers, etc.
    // @spencermountain 2017 MIT

    //proper nouns with exclamation marks
    // const blacklist = {
    //   yahoo: true,
    //   joomla: true,
    //   jeopardy: true,
    // }

    //regs-
    const initSplit = /(\S.+?[.!?\u203D\u2E18\u203C\u2047-\u2049])(?=\s+|$)/g;
    const hasSomething = /\S/;

    const isAcronym$1 = /[ .][A-Z]\.? *$/i;
    const hasEllipse = /(?:\u2026|\.{2,}) *$/;
    const newLine = /((?:\r?\n|\r)+)/; // Match different new-line formats
    const hasLetter = /[a-z0-9\u00C0-\u00FF\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]/i;

    const startWhitespace = /^\s+/;

    // Start with a regex:
    const naiive_split = function (text) {
      let all = [];
      //first, split by newline
      let lines = text.split(newLine);
      for (let i = 0; i < lines.length; i++) {
        //split by period, question-mark, and exclamation-mark
        let arr = lines[i].split(initSplit);
        for (let o = 0; o < arr.length; o++) {
          all.push(arr[o]);
        }
      }
      return all
    };

    /** does this look like a sentence? */
    const isSentence = function (str, abbrevs) {
      // check for 'F.B.I.'
      if (isAcronym$1.test(str) === true) {
        return false
      }
      //check for '...'
      if (hasEllipse.test(str) === true) {
        return false
      }
      // must have a letter
      if (hasLetter.test(str) === false) {
        return false
      }

      let txt = str.replace(/[.!?\u203D\u2E18\u203C\u2047-\u2049] *$/, '');
      let words = txt.split(' ');
      let lastWord = words[words.length - 1].toLowerCase();
      // check for 'Mr.'
      if (abbrevs.hasOwnProperty(lastWord)) {
        return false
      }
      // //check for jeopardy!
      // if (blacklist.hasOwnProperty(lastWord)) {
      //   return false
      // }
      return true
    };

    const splitSentences = function (text, world) {
      let abbrevs = world.cache.abbreviations;

      text = text || '';
      text = String(text);
      let sentences = [];
      // First do a greedy-split..
      let chunks = [];
      // Ensure it 'smells like' a sentence
      if (!text || typeof text !== 'string' || hasSomething.test(text) === false) {
        return sentences
      }
      // cleanup unicode-spaces
      text = text.replace('\xa0', ' ');
      // Start somewhere:
      let splits = naiive_split(text);
      // Filter-out the crap ones
      for (let i = 0; i < splits.length; i++) {
        let s = splits[i];
        if (s === undefined || s === '') {
          continue
        }
        //this is meaningful whitespace
        if (hasSomething.test(s) === false) {
          //add it to the last one
          if (chunks[chunks.length - 1]) {
            chunks[chunks.length - 1] += s;
            continue
          } else if (splits[i + 1]) {
            //add it to the next one
            splits[i + 1] = s + splits[i + 1];
            continue
          }
        }
        //else, only whitespace, no terms, no sentence
        chunks.push(s);
      }

      //detection of non-sentence chunks:
      //loop through these chunks, and join the non-sentence chunks back together..
      for (let i = 0; i < chunks.length; i++) {
        let c = chunks[i];
        //should this chunk be combined with the next one?
        if (chunks[i + 1] && isSentence(c, abbrevs) === false) {
          chunks[i + 1] = c + (chunks[i + 1] || '');
        } else if (c && c.length > 0) {
          //&& hasLetter.test(c)
          //this chunk is a proper sentence..
          sentences.push(c);
          chunks[i] = '';
        }
      }
      //if we never got a sentence, return the given text
      if (sentences.length === 0) {
        return [text]
      }

      //move whitespace to the ends of sentences, when possible
      //['hello',' world'] -> ['hello ','world']
      for (let i = 1; i < sentences.length; i += 1) {
        let ws = sentences[i].match(startWhitespace);
        if (ws !== null) {
          sentences[i - 1] += ws[0];
          sentences[i] = sentences[i].replace(startWhitespace, '');
        }
      }
      return sentences
    };

    var _01Sentences = splitSentences;

    const wordlike = /\S/;
    const isBoundary = /^[!?.]+$/;
    const naiiveSplit = /(\S+)/;
    const isSlash = /[a-z] ?\/ ?[a-z]*$/;

    const notWord = {
      '.': true,
      '-': true, //dash
      '–': true, //en-dash
      '—': true, //em-dash
      '--': true,
      '...': true,
      // '/': true, // 'one / two'
    };

    const hasHyphen = function (str) {
      //dont split 're-do'
      if (/^(re|un)-?[^aeiou]./.test(str) === true) {
        return false
      }
      //letter-number
      let reg = /^([a-z\u00C0-\u00FF`"'/]+)(-|–|—)([a-z0-9\u00C0-\u00FF].*)/i;
      if (reg.test(str) === true) {
        return true
      }
      //support weird number-emdash combo '2010–2011'
      // let reg2 = /^([0-9]+)(–|—)([0-9].*)/i
      // if (reg2.test(str)) {
      //   return true
      // }
      return false
    };

    // 'he / she' should be one word
    const combineSlashes = function (arr) {
      for (let i = 1; i < arr.length - 1; i++) {
        if (isSlash.test(arr[i])) {
          arr[i - 1] += arr[i] + arr[i + 1];
          arr[i] = null;
          arr[i + 1] = null;
        }
      }
      return arr
    };

    const splitHyphens = function (word) {
      let arr = [];
      //support multiple-hyphenated-terms
      const hyphens = word.split(/[-–—]/);
      let whichDash = '-';
      let found = word.match(/[-–—]/);
      if (found && found[0]) {
        whichDash = found;
      }
      for (let o = 0; o < hyphens.length; o++) {
        if (o === hyphens.length - 1) {
          arr.push(hyphens[o]);
        } else {
          arr.push(hyphens[o] + whichDash);
        }
      }
      return arr
    };

    const isArray$2 = function (arr) {
      return Object.prototype.toString.call(arr) === '[object Array]'
    };

    //turn a string into an array of strings (naiive for now, lumped later)
    const splitWords = function (str) {
      let result = [];
      let arr = [];
      //start with a naiive split
      str = str || '';
      if (typeof str === 'number') {
        str = String(str);
      }
      if (isArray$2(str)) {
        return str
      }

      const words = str.split(naiiveSplit);
      for (let i = 0; i < words.length; i++) {
        //split 'one-two'
        if (hasHyphen(words[i]) === true) {
          arr = arr.concat(splitHyphens(words[i]));
          continue
        }
        arr.push(words[i]);
      }
      //greedy merge whitespace+arr to the right
      let carry = '';
      for (let i = 0; i < arr.length; i++) {
        let word = arr[i];
        //if it's more than a whitespace
        if (wordlike.test(word) === true && notWord.hasOwnProperty(word) === false && isBoundary.test(word) === false) {
          //put whitespace on end of previous term, if possible
          if (result.length > 0) {
            result[result.length - 1] += carry;
            result.push(word);
          } else {
            //otherwise, but whitespace before
            result.push(carry + word);
          }
          carry = '';
        } else {
          carry += word;
        }
      }
      //handle last one
      if (carry) {
        if (result.length === 0) {
          result[0] = '';
        }
        result[result.length - 1] += carry; //put it on the end
      }
      // combine 'one / two'
      result = combineSlashes(result);
      // remove empty results
      result = result.filter(s => s);
      return result
    };
    var _02Words = splitWords;

    const isArray$3 = function (arr) {
      return Object.prototype.toString.call(arr) === '[object Array]'
    };

    /** turn a string into an array of Phrase objects */
    const fromText = function (text = '', world, pool) {
      let sentences = null;
      //a bit of validation, first
      if (typeof text !== 'string') {
        if (typeof text === 'number') {
          text = String(text);
        } else if (isArray$3(text)) {
          sentences = text;
        }
      }
      //tokenize into words
      sentences = sentences || _01Sentences(text, world);
      sentences = sentences.map(str => _02Words(str));

      //turn them into proper objects
      pool = pool || new Pool_1();

      let phrases = sentences.map(terms => {
        terms = terms.map(str => {
          let term = new Term_1(str);
          pool.add(term);
          return term
        });
        //add next/previous ids
        _linkTerms(terms);

        //return phrase objects
        let p = new Phrase_1(terms[0].id, terms.length, pool);
        p.cache.terms = terms;
        return p
      });
      //return them ready for a Document object
      return phrases
    };

    var _01Tokenizer = fromText;

    const fromJSON = function(json, world) {
      let pool = new Pool_1();
      let phrases = json.map((p, k) => {
        let terms = p.terms.map((o, i) => {
          let term = new Term_1(o.text);
          term.pre = o.pre !== undefined ? o.pre : '';
          if (o.post === undefined) {
            o.post = ' ';
            //no given space for very last term
            if (i >= p.terms.length - 1) {
              o.post = '. ';
              if (k >= p.terms.length - 1) {
                o.post = '.';
              }
            }
          }
          term.post = o.post !== undefined ? o.post : ' ';

          if (o.tags) {
            o.tags.forEach(tag => term.tag(tag, '', world));
          }
          pool.add(term);
          return term
        });
        //add prev/next links
        _linkTerms(terms);
        // return a proper Phrase object
        return new Phrase_1(terms[0].id, terms.length, pool)
      });
      return phrases
    };
    var fromJSON_1 = fromJSON;

    var _version = '13.5.0';

    var _data={
      "Comparative": "true¦better",
      "Superlative": "true¦earlier",
      "PresentTense": "true¦is,sounds",
      "Value": "true¦a few",
      "Noun": "true¦a5b4c2f1here,ie,lit,m0no doubt,pd,tce;a,d;t,y;a,ca,o0;l,rp;a,l;d,l,rc",
      "Copula": "true¦a1is,w0;as,ere;m,re",
      "PastTense": "true¦be3came,d2had,lied,meant,sa2taken,w0;as,e0;nt,re;id;en,gan",
      "Condition": "true¦if,lest,unless",
      "Gerund": "true¦accord0be0develop0go0result0stain0;ing",
      "Negative": "true¦n0;ever,o0;!n,t",
      "QuestionWord": "true¦how3wh0;at,e1ich,o0y;!m,se;n,re; come,'s",
      "Plural": "true¦records",
      "Conjunction": "true¦&,aEbAcuz,how8in caDno7o6p4supposing,t1vers5wh0yet;eth8ile;h0o;eref9o0;!uC;l0rovided that;us;r,therwi6; matt1r;!ev0;er;e0ut;cau1f0;ore;se;lthou1nd,s 0;far as,if;gh",
      "Pronoun": "true¦'em,elle,h4i3me,ourselves,she5th1us,we,you0;!rself;e0ou;m,y;!l,t;e0im;!'s",
      "Singular": "true¦0:0Z;1:12;a0Yb0Mc0Dd06e04fZgUhQiPjel0kitty,lOmKnJoIpEquestion mark,rCs7t4u2womY;nc0Ts 2;doll0Fst0H; rex,a3h2ic,ragedy,v show;ere,i1;l0x return;i5ky,omeone,t2uper bowl,yst0Y;ep3ri1u2;de0Rff;faOmoO;st0Nze;al0i1o2;om,se;a4i0Kl06r3u2;dMrpoE;erogaWobl0P;rt,te0J;bjTceHthers;othi1umb0F;a4ee05o2;del,m2nopo0th0D;!my;n,yf0;i0unch;ci1nsect;ead start,o2;l0me3u2;se;! run;adf0entlem5irlZlaci04od,rand3u2;l0y; slam,fa2mo2;th01;an;a5ella,ly,ol0r3un2;di1;iTo2;ntiWsN;mi0thV;conomy,gg,ner5veWx2;ampQecu7;ad7e4innSo2ragonf0ude;cumentFg2i0l0or;gy;ath,t2;ec2;tive;!dy;a8eili1h6i4o2redit card;ttage,u2;riJsin;ty,vil w2;ar;andeliGocol2;ate;n2rD;ary;aAel0lesHo6r4u2;n2tterf0;ti1;eakfast,o2;!th8;dy,tt4y2;!fri2;end;le;nki1r2;ri2;er;d4l0noma0u2;nt;ly; homin4verti2;si1;ng;em",
      "Actor": "true¦aJbGcFdCengineIfAgardenIh9instructPjournalLlawyIm8nurse,opeOp5r3s1t0;echnCherapK;ailNcientJoldiGu0;pervKrgeon;e0oofE;ceptionGsearC;hotographClumbColi1r0sychologF;actitionBogrammB;cem6t5;echanic,inist9us4;airdress8ousekeep8;arm7ire0;fight6m2;eputy,iet0;ici0;an;arpent2lerk;ricklay1ut0;ch0;er;ccoun6d2ge7r0ssis6ttenda7;chitect,t0;ist;minist1v0;is1;rat0;or;ta0;nt",
      "Honorific": "true¦a03b00cSdReQfiLgKhon,jr,king,lJmEoDp8queen,r4s0taoiseach,vice7;e1fc,gt,ir,r,u0;ltTpt,rg;c0nDrgeaL;ond liJretary;abbi,e0;ar1pAs,v0;!erend; admirY;astPhd,r0vt;esideEi1of0;!essN;me mini5nce0;!ss;fficOp,rd;a3essrs,i2lle,me,r1s0;!tr;!s;stK;gistrate,j,r6yF;i3lb,t;en,ov;eld mar3rst l0;ady,i0;eutena0;nt;shG;sq,xcellency;et,oct6r,utchess;apt6hance4mdr,o0pl;lonel,m2ngress0unci3;m0wom0;an;dr,mand5;ll0;or;!ain;ldg,rig0;!adi0;er;d0sst,tty,yatullah;j,m0v;!ir0;al",
      "SportsTeam": "true¦0:1A;1:1H;2:1G;a1Eb16c0Td0Kfc dallas,g0Ihouston 0Hindiana0Gjacksonville jagua0k0El0Bm01newToQpJqueens parkIreal salt lake,sAt5utah jazz,vancouver whitecaps,w3yW;ashington 3est ham0Rh10;natio1Oredski2wizar0W;ampa bay 6e5o3;ronto 3ttenham hotspur;blue ja0Mrapto0;nnessee tita2xasC;buccanee0ra0K;a7eattle 5heffield0Kporting kansas0Wt3;. louis 3oke0V;c1Frams;marine0s3;eah15ounG;cramento Rn 3;antonio spu0diego 3francisco gJjose earthquak1;char08paA; ran07;a8h5ittsburgh 4ortland t3;imbe0rail blaze0;pirat1steele0;il3oenix su2;adelphia 3li1;eagl1philNunE;dr1;akland 3klahoma city thunder,rlando magic;athle0Mrai3;de0; 3castle01;england 7orleans 6york 3;city fc,g4je0FknXme0Fred bul0Yy3;anke1;ian0D;pelica2sain0C;patrio0Brevolut3;ion;anchester Be9i3ontreal impact;ami 7lwaukee b6nnesota 3;t4u0Fvi3;kings;imberwolv1wi2;rewe0uc0K;dolphi2heat,marli2;mphis grizz3ts;li1;cXu08;a4eicesterVos angeles 3;clippe0dodDla9; galaxy,ke0;ansas city 3nE;chiefs,roya0E; pace0polis colU;astr06dynamo,rockeTtexa2;olden state warrio0reen bay pac3;ke0;.c.Aallas 7e3i05od5;nver 5troit 3;lio2pisto2ti3;ge0;broncZnuggeM;cowbo4maver3;ic00;ys; uQ;arCelKh8incinnati 6leveland 5ol3;orado r3umbus crew sc;api5ocki1;brow2cavalie0india2;bengaWre3;ds;arlotte horAicago 3;b4cubs,fire,wh3;iteB;ea0ulR;diff3olina panthe0; c3;ity;altimore 9lackburn rove0oston 5rooklyn 3uffalo bilN;ne3;ts;cel4red3; sox;tics;rs;oriol1rave2;rizona Ast8tlanta 3;brav1falco2h4u3;nited;aw9;ns;es;on villa,r3;os;c5di3;amondbac3;ks;ardi3;na3;ls",
      "Uncountable": "true¦a1Ib1Ac11d0Ye0Rf0Lg0Hh0Ci08j07knowled1Hl02mUnews,oTpQrLsAt5vi4w0;a2ea05i1oo0;d,l;ldlife,ne;rmth,t17;neg0Yol06tae;e3h2oothpaste,r0una;affPou0;ble,sers,t;ermod1Eund12;a,nnis;a8cene04eri0Oh7il6kittl0Onow,o5p3t1u0;g0Rnshi0H;ati1De0;am,el;ace16e0;ci0Jed;ap,cc0U;k,v0T;eep,ingl0G;d04fe10l0nd;m0St;a3e1ic0;e,ke0D;c0laxa09search;ogni08rea08;bi09in;aJe1hys10last5o0ressV;lit0Zrk,w0J;a0Vtrol;bstetr0Xil,xygen;a5e3ilk,o2u0;mps,s0;ic;nGo0A;a0chan0S;slZt;chine0il,themat0Q; learn05ry;aught08e2i1ogi0Nu0;ck,g0C;ce,ghtn02ngui0LteratH;a0isG;th04;ewel7usti0G;ce,mp0nformaOtself;a0ortan0E;ti0;en0C;a3isto2o0;ck0mework,n0spitali06;ey;ry;ir,libut,ppi7;en01o1r0um,ymna08;a6ound;l0ssip;d,f;i4lour,o1urnit0;ure;od,rgive0uriNwl;ne0;ss;c6sh;conomZduca5lectr4n2quip3thZvery0;body,o0thE;ne;joy0tertain0;ment;iciNonU;tiF;ar1iabet0raugh1;es;ts;a7elcius,h3ivPl2o0urrency;al,ld w0nfusiAttA;ar;assMoth2;aos,e0;e1w0;ing;se;r4sh;a4eef,i1lood,owls,read,utt0;er;lliar1s0;on;ds;g0ss;ga0;ge;c6dvi5ero3ir2mnes1rt,thl0;et7;ty;craft;b4d0naut4;ynam3;ce;id,ou0;st0;ics",
      "Infinitive": "true¦0:6K;1:6Y;2:57;3:6W;4:6V;5:5Z;6:67;7:6U;8:6Q;9:6I;A:6S;B:6P;C:6Z;D:6D;E:56;F:5P;a6Cb61c52d4Ae3Uf3Hg3Bh34i2Rj2Pk2Nl2Fm25n22o1Xp1Iques3Ir0Qs05tXuSvOwHyG;awn,ield;aJe1Yhist6iIoGre65;nd0rG;k,ry;pe,sh,th0;lk,nHrGsh,tDve;n,raC;d0t;aIiGo7;eGsB;!w;l6Cry;nHpGr4se;gra4Mli3Z;dGi7lo5Spub3O;erGo;mi58w1I;aMeLhKoJrHuGwi8;ne,rn;aGe0Mi5Nu8y;de,in,nsf0p,v5F;r2XuD;ank,reat2N;nd,st;lk,rg1Ps7;aZcWeVhTi4Akip,lSmRnee3Jo4YpQtJuGwitD;bmBck,ff0gge8ppHrGspe5;ge,pri1rou4Vvi3;ly,o34;aLeKoJrHuG;dy,mb6;aEeGi3;ngth2Dss,tD;p,re;m,p;in,ke,r0Qy;laFoil,rink6;e1Xi6o3H;am,ip;a2iv0oG;ck,ut;arDem,le5n1r3tt6;aHo2rG;atDew;le,re;il,ve;a05eIisk,oHuG;in,le,sh;am,ll;a01cZdu9fYgXje5lUmTnt,pQquPsKtJvGwa5O;eGiew,o34;al,l,rG;se,t;aEi2u40;eJi8oItG;!o2rG;i5uc1Y;l3rt;mb6nt,r3;e8i2;air,eHlGo3ZreseC;a9y;at;aEemb0i3Vo3;aHeGi3y;a1nt;te,x;a56r0I;act1Wer,le5u1;a11ei3k5IoGyc6;gni2Anci6rd;ch,li29s5G;i1nG;ge,k;aTerSiRlOoMrIuG;b1Zll,mp,rGsh;cha1s4J;ai1eIiCoG;cGdu9greAhibBmi1te8vi2T;eAlaim;di5pa2ss,veC;iCp,rtr3ZsGur;e,t;aHuG;g,n4;n,y;ck,le;fo30mBsi8;ck,iCrt4Fss,u1;bJccur,ff0pera7utweIverGwe;co40lap,ta20u1wG;helm;igh;ser3taE;eHotG;e,i9;ed,gle5;aLeKiIoHuG;ltip3Crd0;nit11ve;nGrr10;d,g6us;asu2lt,n0Nr4;intaEna4rHtG;ch,t0;ch,kGry;et;aLeKiIoGu1B;aGck,ok,ve;d,n;ft,ke,mBnGst2Wve;e,k;a2Dc0Et;b0Nck,uG;gh,nD;iGno2Z;ck,ll,ss;am,oEuG;d4mp;gno2mQnGss3C;cOdica7flu0MhNsKtIvG;eGol3;nt,st;erGrodu9;a5fe2;i8tG;aGru5;ll;abBibB;lu1Er1C;agi22pG;lemeCo20ro3;aKeIi2oHuG;nt,rry;n02pe,st;aGlp;d,t;nd6ppGrm,te;en;aKloAove1MrIuG;arGeAi13;ant33d;aGip,umb6;b,sp;in,th0ze;aQeaPiNlLoIracHuncG;ti3D;tu2;cus,lHrG;ce,eca8m,s2V;d,l1Z;aFoG;at,od,w;gu2lGniFx;e,l;r,tu2;il,vG;or;a13cho,le5mSnPstNvalua7xG;a0AcLerKi8pGte17;a16eHi2laEoGreA;rt,se;ct,riG;en9;ci1t;el,han4;abGima7;liF;ab6couXdHfor9ga4han9j03riDsu2t0vG;isi2Qy;!u2;body,er4pG;hasiGow0;ze;a06eUiLoKrHuG;mp;aHeAiG;ft;g,in;d4ubt;ff0p,re5sHvG;iYor9;aKcHliGmiApl16tinguiF;ke;oGuA;uGv0;ra4;gr1TppG;ear,ro3;cNem,fLliv0ma0Dny,pKsHterG;mi0E;cribe,er3iHtrG;oy;gn,re;a09e08i5osB;eGi09y;at,ct;iIlHrG;ea1;a2i05;de;ma4n9re,te;a0Ae09h06i7l04oJrG;aHeGoAuFy;a7dB;ck,ve;llZmSnHok,py,uGv0;gh,nt;cePdu5fMsKtIvG;eGin9;rt,y;aEin0SrG;a8ibu7ol;iGtitu7;d0st;iHoGroC;rm;gu2rm;rn;biLfoKmaJpG;a2laE;in;re;nd;rt;ne;ap1e5;aGip,o1;im,w;aHeG;at,ck,w;llen4n4r4se;a1nt0;ll,ncIrGt0u1;eGry;!en;el;aPeMloLoJruFuG;lGry;ly;sh;a8mb,o8rrGth0un9;ow;ck;ar,lHnefBtrG;ay;ie3ong;ng,se;band0Jc0Bd06ffo05gr04id,l01mu1nYppTrQsKttGvoid,waB;acIeHra5;ct;m0Fnd;h,k;k,sG;eIiHocia7uG;me;gn,st;mb6rt;le;chHgGri3;ue;!i3;eaJlIroG;aDve;ch;aud,y;l,r;noun9sw0tG;icipa7;ce;lHt0;er;e4ow;ee;rd;aRdIju8mBoR;it;st;!reA;ss;cJhie3knowled4tiva7;te;ge;ve;eIouCu1;se;nt;pt;on",
      "Unit": "true¦0:19;a14b12c0Od0Ne0Lf0Gg0Ch09in0Hjoule0k02l00mNnMoLpIqHsqCt7volts,w6y4z3°2µ1;g,s;c,f,n;b,e2;a0Nb,d0Dears old,o1;tt0H;att0b;able4b3d,e2on1sp;!ne0;a2r0D;!l,sp;spo04; ft,uare 1;c0Id0Hf3i0Fkilo0Jm1ya0E;e0Mil1;e0li0H;eet0o0D;t,uart0;ascals,e2i1ou0Pt;c0Mnt0;rcent,t02;hms,uYz;an0JewtT;/s,b,e9g,i3l,m2p1²,³;h,s;!²;!/h,cro5l1;e1li08;! pFs1²;! 1;anEpD;g06s0B;gQter1;! 2s1;! 1;per second;b,i00m,u1x;men0x0;b,elvin0g,ilo2m1nR;!/h,ph,²;byZgXmeter1;! p2s1;! p1;er1; hour;e1g,r0z;ct1rtz0;aXogQ;al2b,igAra1;in0m0;!l1;on0;a4emtPl2t1;²,³; oz,uid ou1;nce0;hrenheit0rad0;b,x1;abyH;eciCg,l,mA;arat0eAg,m9oulomb0u1;bic 1p0;c5d4fo3i2meAya1;rd0;nch0;ot0;eci2;enti1;me4;!²,³;lsius0nti1;g2li1me1;ter0;ram0;bl,y1;te0;c4tt1;os1;eco1;nd0;re0;!s",
      "Organization": "true¦0:46;a3Ab2Qc2Ad21e1Xf1Tg1Lh1Gi1Dj19k17l13m0Sn0Go0Dp07qu06rZsStFuBv8w3y1;amaha,m0Xou1w0X;gov,tu2S;a3e1orld trade organizati41;lls fargo,st1;fie22inghou16;l1rner br3D;-m11gree31l street journ25m11;an halNeriz3Wisa,o1;dafo2Gl1;kswagLvo;bs,kip,n2ps,s1;a tod2Rps;es35i1;lev2Xted natio2Uv; mobi2Kaco bePd bMeAgi frida9h3im horto2Tmz,o1witt2W;shiba,y1;ota,s r Y;e 1in lizzy;b3carpen33daily ma2Xguess w2holli0rolling st1Ms1w2;mashing pumpki2Ouprem0;ho;ea1lack eyed pe3Fyrds;ch bo1tl0;ys;l2s1;co,la m12;efoni07us;a6e4ieme2Gnp,o2pice gir5ta1ubaru;rbucks,to2N;ny,undgard1;en;a2Rx pisto1;ls;few25insbu26msu1X;.e.m.,adiohead,b6e3oyal 1yan2X;b1dutch she4;ank;/max,aders dige1Ed 1vl32;bu1c1Uhot chili peppe2Klobst28;ll;c,s;ant2Vizno2F;an5bs,e3fiz24hilip morrBi2r1;emier27octer & gamb1Rudenti14;nk floyd,zza hut;psi28tro1uge08;br2Qchina,n2Q; 2ason1Xda2G;ld navy,pec,range juli2xf1;am;us;a9b8e5fl,h4i3o1sa,wa;kia,tre dame,vart1;is;ke,ntendo,ss0K;l,s;c,st1Etflix,w1; 1sweek;kids on the block,york08;a,c;nd1Us2t1;ional aca2Fo,we0Q;a,cYd0O;aAcdonald9e5i3lb,o1tv,yspace;b1Nnsanto,ody blu0t1;ley crue,or0O;crosoft,t1;as,subisO;dica3rcedes2talli1;ca;!-benz;id,re;'s,s;c's milk,tt13z1Y;'ore09a3e1g,ittle caesa1Ktd;novo,x1;is,mark; pres5-z-boy,bour party;atv,fc,kk,m1od1K;art;iffy lu0Lo3pmorgan1sa;! cha1;se;hnson & johns1Sy d1R;bm,hop,n1tv;c,g,te1;l,rpol; & m,asbro,ewlett-packaTi3o1sbc,yundai;me dep1n1J;ot;tac1zbollah;hi;eneral 6hq,l5mb,o2reen d0Iu1;cci,ns n ros0;ldman sachs,o1;dye1g0B;ar;axo smith kliZencore;electr0Im1;oto0V;a3bi,da,edex,i1leetwood mac,oGrito-l0A;at,nancial1restoV; tim0;cebook,nnie mae;b06sa,u3xxon1; m1m1;ob0H;!rosceptics;aiml0Ae5isney,o3u1;nkin donuts,po0Wran dur1;an;j,w j1;on0;a,f leppa3ll,p2r spiegZstiny's chi1;ld;eche mode,t;rd;aEbc,hBi9nn,o3r1;aigsli5eedence clearwater reviv1ossra05;al;!ca c5l4m1o0Ast05;ca2p1;aq;st;dplMgate;ola;a,sco1tigroup;! systems;ev2i1;ck fil-a,na daily;r0Hy;dbury,pital o1rl's jr;ne;aGbc,eCfAl6mw,ni,o2p,r1;exiteeWos;ei3mbardiJston 1;glo1pizza;be;ng;ack & deckFo2ue c1;roX;ckbuster video,omingda1;le; g1g1;oodriN;cht3e ge0n & jer2rkshire hathaw1;ay;ryH;el;nana republ3s1xt5y5;f,kin robbi1;ns;ic;bXcSdidRerosmith,ig,lLmFnheuser-busEol,ppleAr7s3t&t,v2y1;er;is,on;hland2s1;n,ociated F; o1;il;by4g2m1;co;os; compu2bee1;'s;te1;rs;ch;c,d,erican3t1;!r1;ak; ex1;pre1;ss; 4catel2t1;air;!-luce1;nt;jazeera,qae1;da;as;/dc,a3er,t1;ivisi1;on;demy of scienc0;es;ba,c",
      "Demonym": "true¦0:16;1:13;a0Wb0Nc0Cd0Ae09f07g04h02iYjVkTlPmLnIomHpDqatari,rBs7t5u4v3wel0Rz2;am0Fimbabwe0;enezuel0ietnam0H;g9krai1;aiwThai,rinida0Iu2;ni0Qrkmen;a4cot0Ke3ingapoOlovak,oma0Tpa05udRw2y0X;edi0Kiss;negal0Br08;mo0uU;o6us0Lw2;and0;a3eru0Hhilipp0Po2;li0Ertugu06;kist3lesti1na2raguay0;ma1;ani;amiZi2orweP;caragu0geri2;an,en;a3ex0Mo2;ngo0Erocc0;cedo1la2;gasy,y08;a4eb9i2;b2thua1;e0Dy0;o,t02;azakh,eny0o2uwaiti;re0;a2orda1;ma0Bp2;anN;celandic,nd4r2sraeli,ta02vo06;a2iT;ni0qi;i0oneV;aiDin2ondur0unN;di;amDe2hanai0reek,uatemal0;or2rm0;gi0;i2ren7;lipino,n4;cuadoVgyp6ngliJsto1thiopi0urope0;a2ominXut4;niH;a9h6o4roa3ub0ze2;ch;ti0;lom2ngol5;bi0;a6i2;le0n2;ese;lifor1m2na3;bo2eroo1;di0;angladeshi,el8o6r3ul2;gaG;aziBi2;ti2;sh;li2s1;vi0;aru2gi0;si0;fAl7merBngol0r5si0us2;sie,tr2;a2i0;li0;gent2me1;ine;ba1ge2;ri0;ni0;gh0r2;ic0;an",
      "Possessive": "true¦anyAh5its,m3noCo1sometBthe0yo1;ir1mselves;ur0;!s;i8y0;!se4;er1i0;mse2s;!s0;!e0;lf;o1t0;hing;ne",
      "Currency": "true¦$,aud,bScQdLeurKfJgbp,hkd,iIjpy,kGlEp8r7s3usd,x2y1z0¢,£,¥,ден,лв,руб,฿,₡,₨,€,₭,﷼;lotySł;en,uanR;af,of;h0t5;e0il5;k0q0;elM;iel,oubleLp,upeeL;e2ound st0;er0;lingI;n0soH;ceGn0;ies,y;e0i8;i,mpi7;n,r0wanzaCyatC;!onaBw;ls,nr;ori7ranc9;!o8;en3i2kk,o0;b0ll2;ra5;me4n0rham4;ar3;ad,e0ny;nt1;aht,itcoin0;!s",
      "City": "true¦a2Wb26c1Wd1Re1Qf1Og1Ih1Ai18jakar2Hk0Zl0Tm0Gn0Co0ApZquiYrVsLtCuBv8w3y1z0;agreb,uri1Z;ang1Te0okohama;katerin1Hrev34;ars3e2i0rocl3;ckl0Vn0;nipeg,terth0W;llingt1Oxford;aw;a1i0;en2Hlni2Z;lenc2Uncouv0Gr2G;lan bat0Dtrecht;a6bilisi,e5he4i3o2rondheim,u0;nVr0;in,ku;kyo,ronIulouC;anj23l13miso2Jra2A; haJssaloni0X;gucigalpa,hr2Ol av0L;i0llinn,mpe2Bngi07rtu;chu22n2MpT;a3e2h1kopje,t0ydney;ockholm,uttga12;angh1Fenzh1X;o0KvZ;int peters0Ul3n0ppo1F; 0ti1B;jo0salv2;se;v0z0Q;adU;eykjavik,i1o0;me,sario,t25;ga,o de janei17;to;a8e6h5i4o2r0ueb1Qyongya1N;a0etor24;gue;rt0zn24; elizabe3o;ls1Grae24;iladelph1Znom pe07oenix;r0tah tik19;th;lerJr0tr10;is;dessa,s0ttawa;a1Hlo;a2ew 0is;delTtaip0york;ei;goya,nt0Upl0Uv1R;a5e4i3o1u0;mb0Lni0I;nt0scH;evideo,real;l1Mn01skolc;dellín,lbour0S;drid,l5n3r0;ib1se0;ille;or;chest0dalWi0Z;er;mo;a4i1o0vAy01;nd00s angel0F;ege,ma0nz,sbZverpo1;!ss0;ol; pla0Iusan0F;a5hark4i3laipeda,o1rak0uala lump2;ow;be,pavog0sice;ur;ev,ng8;iv;b3mpa0Kndy,ohsiu0Hra0un03;c0j;hi;ncheMstanb0̇zmir;ul;a5e3o0; chi mi1ms,u0;stI;nh;lsin0rakliG;ki;ifa,m0noi,va0A;bu0SiltD;alw4dan3en2hent,iza,othen1raz,ua0;dalaj0Gngzhou;bu0P;eUoa;sk;ay;es,rankfu0;rt;dmont4indhovU;a1ha01oha,u0;blRrb0Eshanbe;e0kar,masc0FugavpiJ;gu,je0;on;a7ebu,h2o0raioJuriti01;lo0nstanJpenhagNrk;gFmbo;enn3i1ristchur0;ch;ang m1c0ttagoL;ago;ai;i0lgary,pe town,rac4;ro;aHeBirminghWogoAr5u0;char3dap3enos air2r0sZ;g0sa;as;es;est;a2isba1usse0;ls;ne;silPtisla0;va;ta;i3lgrade,r0;g1l0n;in;en;ji0rut;ng;ku,n3r0sel;celo1ranquil0;la;na;g1ja lu0;ka;alo0kok;re;aBb9hmedabad,l7m4n2qa1sh0thens,uckland;dod,gabat;ba;k0twerp;ara;m5s0;terd0;am;exandr0maty;ia;idj0u dhabi;an;lbo1rh0;us;rg",
      "Abbreviation": "true¦a0Tb0Qc0Kd0Ie0Ff0Cg0Ah08i06j04k02l00mRnOoNpIqHrFs9t6u5v2w0yb,µg;is0r,y0L;!c;a,b,e1i0ol,s,t;tro,vo;r,t;niv,safa,t;b1ce,d,e0sp;l,mp,nn,x;!l,sp;ask,e3fc,gt,i2q1r,s,t,u0;pt,rg;! ft;r,tu;c,nVp0;!t;b,d,e0;pSs,v;t,ue;a,d,enn3hd,l,p,r1s0t,vt;!eud;ef,o0;b,f,n;!a;ct,kla,nt,p,rd,z;e0ov;b0e;!r;a7b,d,essrs,g,i4l3m2p1rHs0t;!tr;h,s;!e;!le;!n1s0;c,ter;!n;!j,r,sc;at,b,it,lb,m,ng,t0x;!d;an6b,g,m0;!ph;an,d,r,u0;l,n;a,da,e,n0;c,f;g,on,r0wy,z;!s;a0b,en,ov;!l;e1ig,l0m,r,t,y;! oz,a;b,m;a,g,ng,s1tc,x0;!p;p,q,t;ak,e0g,ist,l,m,r;c,f,pt,t;a3ca,g,l,m2o0pl,res,t,yn;!l0mdr,nn,rp;!o;!dr;!l0pt;!if;a,c,l1r0;ig,os;!dg,vd;d4l3p2r1ss0tty,ug,ve;n,t;c,iz;prox,r,t;!ta;!j,m,v",
      "Country": "true¦0:38;1:2L;a2Wb2Dc21d1Xe1Rf1Lg1Bh19i13j11k0Zl0Um0Gn05om3CpZqat1JrXsKtCu6v4wal3yemTz2;a24imbabwe;es,lis and futu2X;a2enezue31ietnam;nuatu,tican city;.5gTkraiZnited 3ruXs2zbeE;a,sr;arab emirat0Kkingdom,states2;! of am2X;k.,s.2; 27a.;a7haBimor-les0Bo6rinidad4u2;nis0rk2valu;ey,me2Xs and caic1T; and 2-2;toba1J;go,kel0Ynga;iw2Vji2nz2R;ki2T;aCcotl1eBi8lov7o5pa2Bri lanka,u4w2yr0;az2ed9itzerl1;il1;d2Qriname;lomon1Vmal0uth 2;afr2IkLsud2O;ak0en0;erra leoEn2;gapo1Wt maart2;en;negKrb0ychellY;int 2moa,n marino,udi arab0;hele24luc0mart1Z;epublic of ir0Com2Cuss0w2;an25;a3eHhilippinTitcairn1Ko2uerto riM;l1rtugE;ki2Bl3nama,pua new0Tra2;gu6;au,esti2;ne;aAe8i6or2;folk1Gth3w2;ay; k2ern mariana1B;or0M;caragua,ger2ue;!ia;p2ther18w zeal1;al;mib0u2;ru;a6exi5icro09o2yanm04;ldova,n2roc4zamb9;a3gol0t2;enegro,serrat;co;c9dagascZl6r4urit3yot2;te;an0i14;shall0Vtin2;ique;a3div2i,ta;es;wi,ys0;ao,ed00;a5e4i2uxembourg;b2echtenste10thu1E;er0ya;ban0Gsotho;os,tv0;azakh1De2iriba02osovo,uwait,yrgyz1D;eling0Jnya;a2erF;ma15p1B;c6nd5r3s2taly,vory coast;le of m19rael;a2el1;n,q;ia,oI;el1;aiSon2ungary;dur0Mg kong;aAermany,ha0Pibralt9re7u2;a5ern4inea2ya0O;!-biss2;au;sey;deloupe,m,tema0P;e2na0M;ce,nl1;ar;bTmb0;a6i5r2;ance,ench 2;guia0Dpoly2;nes0;ji,nl1;lklandTroeT;ast tim6cu5gypt,l salv5ngl1quatorial3ritr4st2thiop0;on0; guin2;ea;ad2;or;enmark,jibou4ominica3r con2;go;!n B;ti;aAentral african 9h7o4roat0u3yprQzech2; 8ia;ba,racao;c3lo2morPngo-brazzaville,okFsta r03te d'ivoiK;mb0;osD;i2ristmasF;le,na;republic;m2naTpe verde,yman9;bod0ero2;on;aFeChut00o8r4u2;lgar0r2;kina faso,ma,undi;azil,itish 2unei;virgin2; is2;lands;liv0nai4snia and herzegoviGtswaGuvet2; isl1;and;re;l2n7rmuF;ar2gium,ize;us;h3ngladesh,rbad2;os;am3ra2;in;as;fghaFlCmAn5r3ustr2zerbaijH;al0ia;genti2men0uba;na;dorra,g4t2;arct6igua and barbu2;da;o2uil2;la;er2;ica;b2ger0;an0;ia;ni2;st2;an",
      "Region": "true¦0:1U;a20b1Sc1Id1Des1Cf19g13h10i0Xj0Vk0Tl0Qm0FnZoXpSqPrMsDtAut9v6w3y1zacatec22;o05u1;cat18kZ;a1est vi4isconsin,yomi14;rwick0shington1;! dc;er2i1;rgin1S;acruz,mont;ah,tar pradesh;a2e1laxca1DuscaA;nnessee,x1R;bas0Kmaulip1QsmJ;a6i4o2taf0Ou1ylh13;ffVrr00s0Y;me10no1Auth 1;cSdR;ber1Ic1naloa;hu0Sily;n2skatchew0Rxo1;ny; luis potosi,ta catari1I;a1hode7;j1ngp02;asth0Mshahi;inghai,u1;e1intana roo;bec,ensWreta0E;ara4e2rince edward1; isU;i,nnsylv1rnambu02;an14;!na;axa0Ndisha,h1klaho1Bntar1reg4x04;io;ayarit,eBo3u1;evo le1nav0L;on;r1tt0Rva scot0X;f6mandy,th1; 1ampton0;c3d2yo1;rk0;ako0Y;aroli0V;olk;bras0Xva01w1; 2foundland1;! and labrador;brunswick,hamp0jers1mexiJyork state;ey;a6i2o1;nta0Nrelos;ch3dlanBn2ss1;issippi,ouri;as geraGneso0M;igQoacQ;dhya,harasht04ine,ni3r1ssachusetts;anhao,y1;land;p1toba;ur;anca0e1incoln0ouis8;e1iH;ds;a1entucky,hul0A;ns08rnata0Dshmir;alis1iangxi;co;daho,llino2nd1owa;ia05;is;a2ert1idalEunA;ford0;mp0waii;ansu,eorgWlou5u1;an2erre1izhou,jarat;ro;ajuato,gdo1;ng;cester0;lori2uji1;an;da;sex;e4o2uran1;go;rs1;et;lawaErby0;a8ea7hi6o1umbrH;ahui4l3nnectic2rsi1ventry;ca;ut;iMorado;la;apEhuahua;ra;l8m1;bridge0peche;a5r4uck1;ingham0;shi1;re;emen,itish columb3;h2ja cal1sque,var2;iforn1;ia;guascalientes,l4r1;izo2kans1;as;na;a2ber1;ta;ba2s1;ka;ma",
      "FemaleName": "true¦0:FY;1:G2;2:FR;3:FD;4:FC;5:FS;6:ER;7:EP;8:GF;9:EZ;A:GB;B:E5;C:G8;D:FO;E:FL;F:EG;aE2bD4cB8dAIe9Gf91g8Hh83i7Sj6Uk60l4Om38n2To2Qp2Fqu2Er1Os0Qt04ursu6vUwOyLzG;aJeHoG;e,la,ra;lGna;da,ma;da,ra;as7EeHol1TvG;et7onB9;le0sen3;an9endBNhiB4iG;lInG;if3AniGo0;e,f39;a,helmi0lGma;a,ow;aMeJiG;cHviG;an9XenG1;kCZtor3;da,l8Vnus,rG;a,nGoniD2;a,iDC;leGnesEC;nDLrG;i1y;aSePhNiMoJrGu6y4;acG3iGu0E;c3na,sG;h9Mta;nHrG;a,i;i9Jya;a5IffaCGna,s5;al3eGomasi0;a,l8Go6Xres1;g7Uo6WrHssG;!a,ie;eFi,ri8;bNliMmKnIrHs5tGwa0;ia0um;a,yn;iGya;a,ka,s5;a4e4iGmCAra;!ka;a,t5;at5it5;a05carlet2Ye04hUiSkye,oQtMuHyG;bFJlvi1;e,sHzG;an2Tet7ie,y;anGi8;!a,e,nG;aEe;aIeG;fGl3DphG;an2;cF8r6;f3nGphi1;d4ia,ja,ya;er4lv3mon1nGobh75;dy;aKeGirlBLo0y6;ba,e0i6lIrG;iGrBPyl;!d70;ia,lBV;ki4nIrHu0w0yG;la,na;i,leAon,ron;a,da,ia,nGon;a,on;l5Yre0;bMdLi9lKmIndHrGs5vannaE;aEi0;ra,y;aGi4;nt5ra;lBNome;e,ie;in1ri0;a02eXhViToHuG;by,thBK;bQcPlOnNsHwe0xG;an94ie,y;aHeGie,lC;ann8ll1marBFtB;!lGnn1;iGyn;e,nG;a,d7W;da,i,na;an9;hel53io;bin,erByn;a,cGkki,na,ta;helBZki;ea,iannDXoG;da,n12;an0bIgi0i0nGta,y0;aGee;!e,ta;a,eG;cARkaE;chGe,i0mo0n5EquCDvDy0;aCCelGi9;!e,le;een2ia0;aMeLhJoIrG;iGudenAW;scil1Uyamva9;lly,rt3;ilome0oebe,ylG;is,lis;arl,ggy,nelope,r6t4;ige,m0Fn4Oo6rvaBBtHulG;a,et7in1;ricGsy,tA8;a,e,ia;ctav3deHfAWlGphAW;a,ga,iv3;l3t7;aQePiJoGy6;eHrG;aEeDma;ll1mi;aKcIkGla,na,s5ta;iGki;!ta;hoB2k8BolG;a,eBH;!mh;l7Tna,risF;dIi5PnHo23taG;li1s5;cy,et7;eAiCO;a01ckenz2eViLoIrignayani,uriBGyG;a,rG;a,na,tAS;i4ll9XnG;a,iG;ca,ka,qB4;a,chOkaNlJmi,nIrGtzi;aGiam;!n9;a,dy,erva,h,n2;a,dIi9JlG;iGy;cent,e;red;!e6;ae6el3G;ag4KgKi,lHrG;edi61isFyl;an2iGliF;nGsAM;a,da;!an,han;b08c9Ed06e,g04i03l01nZrKtJuHv6Sx87yGz2;a,bell,ra;de,rG;a,eD;h75il9t2;a,cSgOiJjor2l6In2s5tIyG;!aGbe5QjaAlou;m,n9S;a,ha,i0;!aIbALeHja,lCna,sGt53;!a,ol,sa;!l06;!h,m,nG;!a,e,n1;arIeHie,oGr3Kueri7;!t;!ry;et3IiB;elGi61y;a,l1;dGon,ue6;akranBy;iGlo36;a,ka,n9;a,re,s2;daGg2;!l2W;alCd2elGge,isBGon0;eiAin1yn;el,le;a0Ie08iWoQuKyG;d3la,nG;!a,dHe9SnGsAQ;!a,e9R;a,sAO;aB1cJelIiFlHna,pGz;e,iB;a,u;a,la;iGy;a2Ae,l25n9;is,l1GrHtt2uG;el6is1;aIeHi8na,rG;a6Zi8;lei,n1tB;!in1;aQbPd3lLnIsHv3zG;!a,be4Ket7z2;a,et7;a,dG;a,sGy;ay,ey,i,y;a,iaIlG;iGy;a8Ge;!n4F;b7Terty;!n5R;aNda,e0iLla,nKoIslARtGx2;iGt2;c3t3;la,nGra;a,ie,o4;a,or1;a,gh,laG;!ni;!h,nG;a,d4e,n4N;cNdon7Si6kes5na,rMtKurIvHxGy6;mi;ern1in3;a,eGie,yn;l,n;as5is5oG;nya,ya;a,isF;ey,ie,y;aZeUhadija,iMoLrIyG;lGra;a,ee,ie;istGy5B;a,en,iGy;!e,n48;ri,urtn9A;aMerLl99mIrGzzy;a,stG;en,in;!berlG;eGi,y;e,y;a,stD;!na,ra;el6PiJlInHrG;a,i,ri;d4na;ey,i,l9Qs2y;ra,s5;c8Wi5XlOma6nyakumari,rMss5LtJviByG;!e,lG;a,eG;e,i78;a5EeHhGi3PlCri0y;ar5Cer5Cie,leDr9Fy;!lyn73;a,en,iGl4Uyn;!ma,n31sF;ei72i,l2;a04eVilToMuG;anKdJliGst56;aHeGsF;!nAt0W;!n8X;i2Ry;a,iB;!anLcelCd5Vel71han6IlJni,sHva0yG;a,ce;eGie;fi0lCph4X;eGie;en,n1;!a,e,n36;!i10lG;!i0Z;anLle0nIrHsG;i5Qsi5Q;i,ri;!a,el6Pif1RnG;a,et7iGy;!e,f1P;a,e72iHnG;a,e71iG;e,n1;cLd1mi,nHqueliAsmin2Uvie4yAzG;min8;a8eHiG;ce,e,n1s;!lGsFt06;e,le;inHk2lCquelG;in1yn;da,ta;lPmNnMo0rLsHvaG;!na;aHiGob6U;do4;!belGdo4;!a,e,l2G;en1i0ma;a,di4es,gr5R;el9ogG;en1;a,eAia0o0se;aNeKilHoGyacin1N;ll2rten1H;aHdGlaH;a,egard;ry;ath0WiHlGnrietBrmiAst0W;en24ga;di;il75lKnJrGtt2yl75z6D;iGmo4Fri4G;etG;!te;aEnaE;ey,l2;aYeTiOlMold12rIwG;enGyne18;!dolC;acHetGisel9;a,chD;e,ieG;!la;adys,enGor3yn1Y;a,da,na;aJgi,lHna,ov71selG;a,e,le;da,liG;an;!n0;mYnIorgHrG;ald35i,m2Stru73;et7i5T;a,eGna;s1Nvieve;briel3Fil,le,rnet,yle;aReOio0loMrG;anHe9iG;da,e9;!cG;esHiGoi0G;n1s3V;!ca;!rG;a,en43;lHrnG;!an9;ec3ic3;rHtiGy8;ma;ah,rah;d0FileDkBl00mUn4ArRsMtLuKvG;aIelHiG;e,ta;in0Ayn;!ngel2H;geni1la,ni3R;h52ta;meral9peranJtG;eHhGrel6;er;l2Pr;za;iGma,nest29yn;cGka,n;a,ka;eJilImG;aGie,y;!liA;ee,i1y;lGrald;da,y;aTeRiMlLma,no4oJsIvG;a,iG;na,ra;a,ie;iGuiG;se;a,en,ie,y;a0c3da,nJsGzaH;aGe;!beG;th;!a,or;anor,nG;!a;in1na;en,iGna,wi0;e,th;aWeKiJoGul2U;lor51miniq3Yn30rGtt2;a,eDis,la,othGthy;ea,y;an09naEonAx2;anPbOde,eNiLja,lImetr3nGsir4U;a,iG;ce,se;a,iHla,orGphiA;es,is;a,l5J;dGrdG;re;!d4Mna;!b2CoraEra;a,d4nG;!a,e;hl3i0mMnKphn1rHvi1WyG;le,na;a,by,cHia,lG;a,en1;ey,ie;a,et7iG;!ca,el1Aka;arGia;is;a0Qe0Mh04i02lUoJrHynG;di,th3;istGy04;al,i0;lOnLrHurG;tn1D;aId28iGn28riA;!nG;a,e,n1;!l1S;n2sG;tanGuelo;ce,za;eGleD;en,t7;aIeoHotG;il4B;!pat4;ir8rIudG;et7iG;a,ne;a,e,iG;ce,sX;a4er4ndG;i,y;aPeMloe,rG;isHyG;stal;sy,tG;aHen,iGy;!an1e,n1;!l;lseHrG;!i8yl;a,y;nLrG;isJlHmG;aiA;a,eGot7;n1t7;!sa;d4el1PtG;al,el1O;cHlG;es7i3F;el3ilG;e,ia,y;iYlXmilWndVrNsLtGy6;aJeIhGri0;erGleDrCy;in1;ri0;li0ri0;a2GsG;a2Fie;a,iMlKmeIolHrG;ie,ol;!e,in1yn;lGn;!a,la;a,eGie,y;ne,y;na,sF;a0Di0D;a,e,l1;isBl2;tlG;in,yn;arb0CeYianXlVoTrG;andRePiIoHyG;an0nn;nwCok8;an2NdgKg0ItG;n27tG;!aHnG;ey,i,y;ny;etG;!t8;an0e,nG;da,na;i8y;bbi8nG;iBn2;ancGossom,ythe;a,he;ca;aRcky,lin9niBrNssMtIulaEvG;!erlG;ey,y;hHsy,tG;e,i0Zy8;!anG;ie,y;!ie;nGt5yl;adHiG;ce;et7iA;!triG;ce,z;a4ie,ra;aliy29b24d1Lg1Hi19l0Sm0Nn01rWsNthe0uJvIyG;anGes5;a,na;a,r25;drIgusHrG;el3;ti0;a,ey,i,y;hHtrG;id;aKlGt1P;eHi8yG;!n;e,iGy;gh;!nG;ti;iIleHpiB;ta;en,n1t7;an19elG;le;aYdWeUgQiOja,nHtoGya;inet7n3;!aJeHiGmI;e,ka;!mGt7;ar2;!belHliFmT;sa;!le;ka,sGta;a,sa;elGie;a,iG;a,ca,n1qG;ue;!t7;te;je6rea;la;!bHmGstas3;ar3;el;aIberHel3iGy;e,na;!ly;l3n9;da;aTba,eNiKlIma,yG;a,c3sG;a,on,sa;iGys0J;e,s0I;a,cHna,sGza;a,ha,on,sa;e,ia;c3is5jaIna,ssaIxG;aGia;!nd4;nd4;ra;ia;i0nHyG;ah,na;a,is,naE;c5da,leDmLnslKsG;haElG;inGyW;g,n;!h;ey;ee;en;at5g2nG;es;ie;ha;aVdiSelLrG;eIiG;anLenG;a,e,ne;an0;na;aKeJiHyG;nn;a,n1;a,e;!ne;!iG;de;e,lCsG;on;yn;!lG;iAyn;ne;agaJbHiG;!gaI;ey,i8y;!e;il;ah",
      "Place": "true¦a07b05cZdYeXfVgRhQiOjfk,kMlKmHneEoDp9que,rd,s8t5u4v3w0yyz;is1y0;!o;!c;a,t;pYsafa,t;e1he 0;bronx,hamptons;nn,x;ask,fo,oho,t,under6yd;a2e1h0;l,x;k,nnK;!cifX;kla,nt;b1w eng0;land;!r;a1co,i0t,uc;dKnn;libu,nhattS;a0gw,hr;s,x;an0ul;!s;a0cn,da,ndianMst;!x;arlem,kg,nd,wy;a2re0;at 0enwich;britain,lak6;!y village;co,l0ra;!a;urope,verglad2;ak,en,fw,ist,own4xb;al4dg,gk,hina3l2o1r0t;es;lo,nn;!t;town;!if;cn,e0kk,lvd,rooklyn;l air,verly hills;frica,lta,m5ntarct2r1sia,tl0ve;!ant1;ct0iz;ic0; oce0;an;ericas,s",
      "WeekDay": "true¦fri2mon2s1t0wednesd3;hurs1ues1;aturd1und1;!d0;ay0;!s",
      "Month": "true¦aBdec9feb7j2mar,nov9oct1sep0;!t8;!o8;an3u0;l1n0;!e;!y;!u1;!ru0;ary;!em0;ber;pr1ug0;!ust;!il",
      "Date": "true¦ago,t0weekend,yesterd2;mr2o0;d0morrow;ay;!w",
      "FirstName": "true¦aEblair,cCdevBj8k6lashawn,m3nelly,quinn,re2sh0;ay,e0iloh;a,lby;g1ne;ar1el,org0;an;ion,lo;as8e0r9;ls7nyatta,rry;am0ess1ude;ie,m0;ie;an,on;as0heyenne;ey,sidy;lex1ndra,ubr0;ey;is",
      "LastName": "true¦0:34;1:3B;2:39;3:2Y;4:2E;5:30;a3Bb31c2Od2Ee2Bf25g1Zh1Pi1Kj1Ek17l0Zm0Nn0Jo0Gp05rYsMtHvFwCxBy8zh6;a6ou,u;ng,o;a6eun2Uoshi1Kun;ma6ng;da,guc1Zmo27sh21zaR;iao,u;a7eb0il6o3right,u;li3Bs2;gn0lk0ng,tanabe;a6ivaldi;ssilj37zqu1;a9h8i2Go7r6sui,urn0;an,ynisJ;lst0Prr1Uth;at1Uomps2;kah0Vnaka,ylor;aEchDeChimizu,iBmiAo9t7u6zabo;ar1lliv2AzuE;a6ein0;l23rm0;sa,u3;rn4th;lva,mmo24ngh;mjon4rrano;midt,neid0ulz;ito,n7sa6to;ki;ch1dLtos,z;amBeag1Zi9o7u6;bio,iz,sD;b6dri1MgIj0Tme24osevelt,ssi,ux;erts,ins2;c6ve0F;ci,hards2;ir1os;aEeAh8ic6ow20ut1N;as6hl0;so;a6illips;m,n1T;ders5et8r7t6;e0Nr4;ez,ry;ers;h21rk0t6vl4;el,te0J;baBg0Blivei01r6;t6w1O;ega,iz;a6eils2guy5ix2owak,ym1E;gy,ka6var1K;ji6muW;ma;aEeCiBo8u6;ll0n6rr0Bssolini,ñ6;oz;lina,oKr6zart;al0Me6r0U;au,no;hhail4ll0;rci0ssi6y0;!er;eWmmad4r6tsu07;in6tin1;!o;aCe8i6op1uo;!n6u;coln,dholm;fe7n0Qr6w0J;oy;bv6v6;re;mmy,rs5u;aBennedy,imuAle0Lo8u7wo6;k,n;mar,znets4;bay6vacs;asY;ra;hn,rl9to,ur,zl4;aAen9ha3imen1o6u3;h6nYu3;an6ns2;ss2;ki0Es5;cks2nsse0D;glesi9ke8noue,shik7to,vano6;u,v;awa;da;as;aBe8itchcock,o7u6;!a3b0ghNynh;a3ffmann,rvat;mingw7nde6rN;rs2;ay;ns5rrQs7y6;asDes;an4hi6;moJ;a9il,o8r7u6;o,tierr1;ayli3ub0;m1nzal1;nd6o,rcia;hi;erAis9lor8o7uj6;ita;st0urni0;es;ch0;nand1;d7insteHsposi6vaL;to;is2wards;aCeBi9omin8u6;bo6rand;is;gu1;az,mitr4;ov;lgado,vi;nkula,rw7vi6;es,s;in;aFhBlarkAo6;h5l6op0rbyn,x;em7li6;ns;an;!e;an8e7iu,o6ristens5u3we;i,ng,u3w,y;!n,on6u3;!g;mpb7rt0st6;ro;ell;aBe8ha3lanco,oyko,r6yrne;ooks,yant;ng;ck7ethov5nnett;en;er,ham;ch,h8iley,rn6;es,i0;er;k,ng;dDl9nd6;ers6rA;en,on,s2;on;eks7iy8var1;ez;ej6;ev;ams",
      "MaleName": "true¦0:CE;1:BL;2:C2;3:BT;4:B5;5:BZ;6:AT;7:9V;8:BD;9:AX;A:AO;aB4bA8c97d87e7Gf6Yg6Gh5Wi5Ij4Lk4Bl3Rm2Pn2Eo28p22qu20r1As0Qt06u05v00wNxavi3yGzB;aBor0;cBh8Ine;hCkB;!aB1;ar51eB0;ass2i,oCuB;sDu25;nEsDusB;oBsC;uf;ef;at0g;aJeHiCoByaAP;lfgang,odrow;lBn1O;bDey,frBJlB;aA5iB;am,e,s;e89ur;i,nde7sB;!l6t1;de,lCrr5yB;l1ne;lBt3;a93y;aEern1iBladimir;cCha0kt5CnceBrg9Bva0;!nt;ente,t5A;lentin49n8Yughn;lyss4Msm0;aTeOhKiIoErCyB;!l3ro8s1;av9QeBist0oy,um0;nt9Iv54y;bDd7XmBny;!as,mBoharu;aAYie,y;i83y;mBt9;!my,othy;adDeoCia7DomB;!as;!do7M;!de9;dErB;en8HrB;an8GeBy;ll,n8F;!dy;dgh,ic9Tnn3req,ts45;aRcotPeNhJiHoFpenc3tBur1Oylve8Hzym1;anDeBua7B;f0phAFvBwa7A;e57ie;!islaw,l6;lom1nA3uB;leyma8ta;dBl7Jm1;!n6;aDeB;lBrm0;d1t1;h6Sne,qu0Uun,wn,y8;aBbasti0k1Xl41rg40th,ymo9I;m9n;!tB;!ie,y;lCmBnti21q4Iul;!mAu4;ik,vato6V;aWeShe92iOoFuCyB;an,ou;b6LdCf9pe6QssB;!elAI;ol2Uy;an,bIcHdGel,geFh0landA9mEnDry,sCyB;!ce;coe,s;!a95nA;an,eo;l3Jr;e4Qg3n6olfo,ri68;co,ky;bAe9U;cBl6;ar5Oc5NhCkBo;!ey,ie,y;a85ie;gCid,ub5x,yBza;ansh,nS;g8WiB;na8Ss;ch5Yfa4lDmCndBpha4sh6Uul,ymo70;al9Yol2By;i9Ion;f,ph;ent2inB;cy,t1;aFeDhilCier62ol,reB;st1;!ip,lip;d9Brcy,tB;ar,e2V;b3Sdra6Ft44ul;ctav2Vliv3m96rFsCtBum8Uw5;is,to;aCc8SvB;al52;ma;i,l49vJ;athJeHiDoB;aBel,l0ma0r2X;h,m;cCg4i3IkB;h6Uola;hol5XkBol5X;!ol5W;al,d,il,ls1vB;il50;anBy;!a4i4;aWeTiKoFuCyB;l21r1;hamCr5ZstaB;fa,p4G;ed,mF;dibo,e,hamDis1XntCsBussa;es,he;e,y;ad,ed,mB;ad,ed;cGgu4kElDnCtchB;!e7;a78ik;house,o03t1;e,olB;aj;ah,hBk6;a4eB;al,l;hClv2rB;le,ri7v2;di,met;ck,hNlLmOnu4rHs1tDuricCxB;!imilian8Cwe7;e,io;eo,hCi52tB;!eo,hew,ia;eBis;us,w;cDio,k86lCqu6Gsha7tBv2;i2Hy;in,on;!el,oKus;achBcolm,ik;ai,y;amBdi,moud;adB;ou;aReNiMlo2RoIuCyB;le,nd1;cEiDkBth3;aBe;!s;gi,s;as,iaB;no;g0nn6RrenDuBwe7;!iB;e,s;!zo;am,on4;a7Bevi,la4SnDoBst3vi;!nB;!a60el;!ny;mCnBr67ur4Twr4T;ce,d1;ar,o4N;aIeDhaled,iBrist4Vu48y3B;er0p,rB;by,k,ollos;en0iEnBrmit,v2;!dCnBt5C;e0Yy;a7ri4N;r,th;na68rBthem;im,l;aYeQiOoDuB;an,liBst2;an,o,us;aqu2eJhnInGrEsB;eChBi7Bue;!ua;!ph;dBge;an,i,on;!aBny;h,s,th4X;!ath4Wie,nA;!l,sBy;ph;an,e,mB;!mA;d,ffGrDsB;sBus;!e;a5JemCmai8oBry;me,ni0O;i6Uy;!e58rB;ey,y;cHd5kGmFrDsCvi3yB;!d5s1;on,p3;ed,od,rBv4M;e4Zod;al,es,is1;e,ob,ub;k,ob,quB;es;aNbrahMchika,gKkeJlija,nuIrGsDtBv0;ai,sB;uki;aBha0i6Fma4sac;ac,iaB;h,s;a,vinBw2;!g;k,nngu52;!r;nacBor;io;im;in,n;aJeFina4VoDuByd56;be25gBmber4CsD;h,o;m3ra33sBwa3X;se2;aDctCitCn4ErB;be20m0;or;th;bKlJmza,nIo,rDsCyB;a43d5;an,s0;lEo4FrDuBv6;hi40ki,tB;a,o;is1y;an,ey;k,s;!im;ib;aQeMiLlenKoIrEuB;illerCsB;!tavo;mo;aDegBov3;!g,orB;io,y;dy,h57nt;nzaBrd1;lo;!n;lbe4Qno,ovan4R;ne,oDrB;aBry;ld,rd4U;ffr6rge;bri4l5rBv2;la1Zr3Eth,y;aReNiLlJorr0IrB;anDedBitz;!dAeBri24;ri23;cDkB;!ie,lB;in,yn;esJisB;!co,zek;etch3oB;yd;d4lBonn;ip;deriDliCng,rnB;an01;pe,x;co;bi0di;arZdUfrTit0lNmGnFo2rCsteb0th0uge8vBym5zra;an,ere2V;gi,iCnBrol,v2w2;est45ie;c07k;och,rique,zo;aGerFiCmB;aFe2P;lCrB;!h0;!io;s1y;nu4;be09d1iEliDmCt1viBwood;n,s;er,o;ot1Ts;!as,j43sB;ha;a2en;!dAg32mEuCwB;a25in;arB;do;o0Su0S;l,nB;est;aYeOiLoErDuCwByl0;ay8ight;a8dl6nc0st2;ag0ew;minFnDri0ugCyB;le;!l03;!a29nBov0;e7ie,y;go,icB;!k;armuCeBll1on,rk;go;id;anIj0lbeHmetri9nFon,rEsDvCwBxt3;ay8ey;en,in;hawn,mo08;ek,ri0F;is,nBv3;is,y;rt;!dB;re;lKmInHrDvB;e,iB;!d;en,iDne7rByl;eBin,yl;l2Vn;n,o,us;!e,i4ny;iBon;an,en,on;e,lB;as;a06e04hWiar0lLoGrEuCyrB;il,us;rtB;!is;aBistobal;ig;dy,lEnCrB;ey,neli9y;or,rB;ad;by,e,in,l2t1;aGeDiByI;fBnt;fo0Ct1;meCt9velaB;nd;nt;rDuCyB;!t1;de;enB;ce;aFeErisCuB;ck;!tB;i0oph3;st3;d,rlBs;eBie;s,y;cBdric,s11;il;lEmer1rB;ey,lCro7y;ll;!os,t1;eb,v2;ar02eUilTlaSoPrCuByr1;ddy,rtI;aJeEiDuCyB;an,ce,on;ce,no;an,ce;nCtB;!t;dCtB;!on;an,on;dCndB;en,on;!foBl6y;rd;bCrByd;is;!by;i8ke;al,lA;nFrBshoi;at,nCtB;!r10;aBie;rd0S;!edict,iCjam2nA;ie,y;to;n6rBt;eBy;tt;ey;ar0Xb0Nd0Jgust2hm0Gid5ja0ElZmXnPputsiOrFsaEuCveBya0ziz;ry;gust9st2;us;hi;aIchHi4jun,maFnDon,tBy0;hBu06;ur;av,oB;ld;an,nd0A;el;ie;ta;aq;dGgel05tB;hoEoB;i8nB;!i02y;ne;ny;reBy;!as,s,w;ir,mBos;ar;an,beOd5eIfFi,lEonDphonHt1vB;aMin;on;so,zo;an,en;onCrB;edP;so;c,jaEksandDssaExB;!and3;er;ar,er;ndB;ro;rtH;ni;en;ad,eB;d,t;in;aColfBri0vik;!o;mBn;!a;dFeEraCuB;!bakr,lfazl;hBm;am;!l;allEel,oulaye,ulB;!lCrahm0;an;ah,o;ah;av,on",
      "Person": "true¦ashton kutchSbRcMdKeIgastNhGinez,jEkDleCmBnettJoAp8r4s3t2v0;a0irgin maG;lentino rossi,n go3;heresa may,iger woods,yra banks;addam hussain,carlett johanssJlobodan milosevic,uB;ay romano,eese witherspoIo1ush limbau0;gh;d stewart,nald0;inho,o;a0ipJ;lmIris hiltD;prah winfrFra;essiaen,itt romnEubarek;bron james,e;anye west,iefer sutherland,obe bryant;aime,effers8k rowli0;ng;alle ber0itlBulk hogan;ry;ff0meril lagasse,zekiel;ie;a0enzel washingt2ick wolf;lt1nte;ar1lint0ruz;on;dinal wols1son0;! palm2;ey;arack obama,rock;er",
      "Verb": "true¦awak9born,cannot,fr8g7h5k3le2m1s0wors9;e8h3;ake sure,sg;ngth6ss6;eep tabs,n0;own;as0e2;!t2;iv1onna;ight0;en",
      "PhrasalVerb": "true¦0:72;1:6Q;2:7E;3:74;4:6J;5:7H;6:76;7:6P;8:6C;9:6D;A:5I;B:71;C:70;a7Hb63c5Dd5Ae58f46g3Oh38iron0j34k2Zl2Km2Bn29o27p1Pr1Es09tQuOvacuum 1wGyammerCzD;eroAip EonD;e0k0;by,up;aJeGhFiEorDrit53;d 1k2R;mp0n4Ape0r8s8;eel Bip 7L;aEiD;gh 06rd0;n Br 3D;it 5Kk8lk6rm 0Qsh 74t67v4P;rgeCsD;e 9herA;aRePhNiJoHrFuDype 0N;ckArn D;d2in,o3Gup;ade YiDot0y 28;ckle68p 7A;ne67p Ds4D;d2o6Lup;ck FdEe Dgh5Tme0p o0Dre0;aw3ba4d2in,up;e5Ky 1;by,o6V;ink Drow 5V;ba4ov7up;aDe 4Ill4O;m 1r W;ckCke Elk D;ov7u4O;aDba4d2in,o31up;ba4ft7p4Tw3;a0Gc0Fe09h05i02lYmXnWoVpSquare RtJuHwD;earFiD;ngEtch D;aw3ba4o6P; by;ck Dit 1m 1ss0;in,up;aIe0RiHoFrD;aigh1MiD;ke 5Yn2Y;p Drm1P;by,in,o6B;n2Zr 1tc3I;c2Ymp0nd Dr6Hve6y 1;ba4d2up;d2o67up;ar2Vell0ill4UlErDurC;ingCuc8;a33it 3U;be4Crt0;ap 4Eow B;ash 4Zoke0;eep EiDow 9;c3Np 1;in,oD;ff,v7;gn Eng2Zt Dz8;d2o5up;in,o5up;aFoDu4F;ot Dut0w 5X;aw3ba4f37o5R;c2FdeAk4Sve6;e Hll0nd GtD; Dtl43;d2in,o5upD;!on;aw3ba4d2in,o1Yup;o5to;al4Lout0rap4L;il6v8;at0eKiJoGuD;b 4Ele0n Dstl8;aDba4d2in53o3Gt30u3E;c1Xw3;ot EuD;g2Knd6;a1Xf2Ro5;ng 4Op6;aDel6inAnt0;c4Yd D;o2Tu0C;aQePiOlMoKrHsyc2AuD;ll Ft D;aDba4d2in,o1Ht34up;p39w3;ap38d2in,o5t32up;attleCess EiGoD;p 1;ah1Hon;iDp 53re3Mur45wer 53;nt0;ay3ZuD;gAmp 9;ck 53g0leCn 9p3W;el 47ncilA;c3Pir 2In0ss FtEy D;ba4o4R; d2c1Y;aw3ba4o12;pDw3K;e3Jt B;arrow3Terd0oD;d6te3S;aJeHiGoEuD;ddl8ll37;c17p 1uth6ve D;al3Bd2in,o5up;ss0x 1;asur8lt 9ss D;a1Aup;ke Dn 9r30s1Lx0;do,o3Yup;aPeNiIoDuck0;a17c37g GoDse0;k Dse35;aft7ba4d2forw2Bin3Wov7uD;nd7p;in,o0J;e GghtFnEsDv1T;ten 4D;e 1k 1; 1e2Y;ar43d2;av1Ht 2YvelD; o3L;p 1sh DtchCugh6y1U;in3Lo5;eEick6nock D;d2o3H;eDyA;l2Hp D;aw3ba4d2fSin,o05to,up;aFoEuD;ic8mpA;ke2St2W;c31zz 1;aPeKiHoEuD;nker2Ts0U;lDneArse2O;d De 1;ba4d2fast,oZup;de Et D;ba4on,up;aw3o5;aDlp0;d Fl22r Dt 1;fDof;rom;in,oRu1A;cZm 1nDve it,ze1Y;d Dg 27kerF;d2in,o5;aReLive Jloss1VoFrEunD; f0M;in39ow 23; Dof 0U;aEb17it,oDr35t0Ou12;ff,n,v7;bo5ft7hJw3;aw3ba4d2in,oDup,w3;ff,n,ut;a17ek0t D;aEb11d2oDr2Zup;ff,n,ut,v7;cEhDl1Pr2Xt,w3;ead;ross;d aEnD;g 1;bo5;a08e01iRlNoJrFuD;cDel 1;k 1;eEighten DownCy 1;aw3o2L;eDshe1G; 1z8;lFol D;aDwi19;bo5r2I;d 9;aEeDip0;sh0;g 9ke0mDrD;e 2K;gLlJnHrFsEzzD;le0;h 2H;e Dm 1;aw3ba4up;d0isD;h 1;e Dl 11;aw3fI;ht ba4ure0;eInEsD;s 1;cFd D;fDo1X;or;e B;dQl 1;cHll Drm0t0O;apYbFd2in,oEtD;hrough;ff,ut,v7;a4ehi1S;e E;at0dge0nd Dy8;o1Mup;o09rD;ess 9op D;aw3bNin,o15;aShPlean 9oDross But 0T;me FoEuntD; o1M;k 1l6;aJbIforGin,oFtEuD;nd7;ogeth7;ut,v7;th,wD;ard;a4y;pDr19w3;art;eDipA;ck BeD;r 1;lJncel0rGsFtch EveA; in;o16up;h Bt6;ry EvD;e V;aw3o12;l Dm02;aDba4d2o10up;r0Vw3;a0He08l01oSrHuD;bbleFcklTilZlEndlTrn 05tDy 10zz6;t B;k 9; ov7;anMeaKiDush6;ghHng D;aEba4d2forDin,o5up;th;bo5lDr0Lw3;ong;teD;n 1;k D;d2in,o5up;ch0;arKgJil 9n8oGssFttlEunce Dx B;aw3ba4;e 9; ar0B;k Bt 1;e 1;d2up; d2;d 1;aIeed0oDurt0;cFw D;aw3ba4d2o5up;ck;k D;in,oK;ck0nk0st6; oJaGef 1nd D;d2ov7up;er;up;r0t D;d2in,oDup;ff,ut;ff,nD;to;ck Jil0nFrgEsD;h B;ainCe B;g BkC; on;in,o5; o5;aw3d2o5up;ay;cMdIsk Fuction6; oD;ff;arDo5;ouD;nd;d D;d2oDup;ff,n;own;t D;o5up;ut",
      "Modal": "true¦c5lets,m4ought3sh1w0;ill,o5;a0o4;ll,nt;! to;ay,ight,ust;an,o0;uld",
      "Adjective": "true¦0:73;1:7I;2:7O;3:7H;4:7A;5:5B;6:4R;7:49;8:48;9:7F;A:60;a6Eb60c5Md52e4Pf45g3Xh3Mi31j2Zk2Yl2Nm2Cn23o1Np16quack,r0Ws0Ct05uMvJwByear5;arp0eFholeEiDoB;man5oBu67;d69zy;despr6Zs5B;!sa7;eClBste22;co1El o4H;!k5;aCiBola47;b7Nce versa,ol50;ca2gabo5Ynilla;ltSnFpCrb55su4tterB;!mo6U; f30b1KpCsBti1D;ca7et,ide dItairs;er,i3J;aLbeco6Lconvin23deIeHfair,ivers4knGprecedUrEsCwB;iel1Writt5U;i1RuB;pervis0specti3;eBu5;cognHgul6Bl6B;own;ndi3v5Oxpect0;cid0rB;!grou5JsB;iz0tood;b7ppeaHssu6AuthorB;iz0;i20ra;aFeDhough4KoCrB;i1oubl0;geth6p,rp6B;en5LlBm4Vrr2Q;li3;boo,lBn;ent0;aTcSeQhPiNmug,nobbi3AoLpKqueami3AtFuBymb5Y;bDi gener50pBrprisi3;erBre0H;! dup6b,i25;du0seq4P;anda6OeEi0LrBy34;aightBip0; fBfB;or56;adfa5Wreotyp0;a4Uec2Cir1Flend5Wot on; call0le,mb6phist1TrBu0Tvi3X;d5Ury;gnifica2nB;ce4Qg7;am2Le6ocki3ut;cBda1em5lfi2Uni1Spa63re8;o1Cr3R;at53ient24reec53;cr0me,ns serif;aIeEiCoB;bu5Ktt4PuOy4;ghtBv4;!-25fA;ar,bel,condi1du5Xfres4XlDpublic3RsBtard0;is43oB;lu1na2;e1Auc41;b5EciB;al,st;aMeKicayu8lac5Copuli5BrCuB;bl54mp0;eFiCoB;!b06fu5Cmi2Xp6;mCor,sBva1;ti8;a4Re;ci58mB;a0EiB;er,um;ac1WrBti1;fe9ma2Pplexi3v2Z;rBst;allelDtB;-tiBi4;me;!ed;bMffKkJld fashion0nIpHrg1Dth6utGvB;al,erB;!aDniCt,wB;eiBrouB;ght;ll;do0Rer,g2Hsi41;en,posi1; boa5Ag2Fli8;!ay; gua58bBli8;eat;eDsB;cBer0Dole1;e8u3F;d2Ose;ak0eIiHoBua4J;nFrCtB;ab7;thB;!eB;rn;chala2descri4Ustop;ght5;arby,cessa3Sighbor5xt;aJeHiEoBultip7;bi7derClBnth5ot,st;dy;a1n;nBx0;iaBor;tu2Y;di49naBre;ci3;cBgenta,in,jZkeshift,le,mmoth,ny,sculi8;ab2Uho;aKeFiCoBu0Z;uti0Yvi3;mCteraB;l,te;it0;ftEgBth4;al,eCitiB;ma1;nda38;!-08;ngu3Lst,tt6;ap1Oind5no06;agg0uB;niKstifi0veni7;de4gno46lleg4mOnDpso 1RrB;a1releB;va2; JaIbr0corHdFfluenPiPnEsDtB;a9en3GoxB;ic31;a8i2N;a1er,oce2;iCoB;or;re9;deq3Eppr2T;fBsitu,vitro;ro2;mFpB;arDerfe9oBrop6;li1rtB;a2ed;ti4;eBi0M;d2Ln30;aGelFiDoBumdr36;ne2Uok0rrBs03ur5;if2N;ghfalut1KspB;an2L;liVpfA;lEnDrB;d01roB;wi3;dy,gi3;f,low0;ainfAener2Eiga1YlHoGraDuB;ilBng ho;ty;cCtB;efAis;efA;ne,od;ea28ob4;aQeKinJlIoDrB;a1PeBoz1G;e28q0YtfA;oDrB; keeps,eBm6tuna1;g00ign;liB;sh;ag2Uue2;al,i1;dFmCrB;ti7;a7ini8;ne;le; up;bl0i2l20r Cux,voB;ri1uri1;oBreac1A;ff;aJfficie2lImiHnFre9there4veExB;a9cess,pe1JtraCuB;be2Gl0D;!va19;n,ryday; Bcouragi3ti0M;rou1sui1;ne2;abo1YdMe14i1;g6sB;t,ygB;oi3;er;aReJiDoBrea11ue;mina2ne,ubB;le,tfA;dact16fficu1JsCvB;er1F;creDeas0gruntl0hone1AordCtB;a2ress0;er5;et; HadpGfFgene1KliDrang0spe1KtCvoB;ut;ail0ermin0;be1Hca1ghB;tfA;ia2;an;facto;i5magBngeroVs0E;ed,i3;ly;ertaNhief,ivil,oDrB;aBowd0u0D;mp0vYz0;loJmHnCoi3rrBve0K;e9u1D;cre1grEsDtB;emBra0B;po09;ta2;ue2;mer04pleB;te,x;ni4ss4;in;aLeHizarGlFoCrB;and new,isk,okL;gCna fiSttom,urgeoB;is;us;ank,iE;re;autifAhiClov0nBst,yoC;eRt;nd;ul;ckCnkru0SrrB;en;!wards; priori,b0Ic0Fd05fra04g00hZlUma01ntiquTppQrKsIttracti02utheHvEwB;aCkB;wa0P;ke,re;ant garCerB;age;de;ntQ;leep,tonisB;hi3;ab,bitEroDtiB;fiB;ci4;ga2;raB;ry;are2etiLrB;oprB;ia1;at0;arEcohCeBiIl,oof;rt;olB;ic;mi3;ead;ainDgressiConiB;zi3;ve;st;id; IeGuFvB;aCerB;se;nc0;ed;lt;pt,qB;ua1;hoc,infinitB;um;cuCtu4u1;al;ra1;erLlKoIruHsCuB;nda2;e2oCtra9;ct;lu1rbi3;ng;te;pt;aBve;rd;aze,e;ra2;nt",
      "Comparable": "true¦0:3Z;1:4G;2:43;3:49;4:3V;5:2W;a4Mb42c3Md3Be33f2Pg2Dh22i1Tj1Sk1Pl1Hm1Bn15o13p0Tqu0Rr0IsRtKuIvFw7y6za11;ell25ou3;aBe9hi1Wi7r6;o3y;ck0Mde,l6n1ry,se;d,y;a6i4Kt;k,ry;n1Rr6sI;m,y;a7e6ulgar;nge4rda2xi3;gue,in,st;g0n6pco3Kse4;like0ti1;aAen9hi8i7ough,r6;anqu2Oen1ue;dy,g3Sme0ny,r09;ck,n,rs2P;d40se;ll,me,rt,s6wd45;te4;aVcarUeThRiQkin0FlMmKoHpGqua1FtAu7w6;eet,ift;b7dd13per0Gr6;e,re2H;sta2Ft5;aAe9iff,r7u6;pXr1;a6ict,o3;ig3Fn0U;a1ep,rn;le,rk;e22i3Fright0;ci28ft,l7o6re,ur;n,thi3;emn,id;a6el0ooth;ll,rt;e8i6ow,y;ck,g35m6;!y;ek,nd3D;ck,l0mp5;a6iTort,rill,y;dy,ll0Xrp;cu0Rve0Rxy;ce,ed,y;d,fe,int0l1Vv14;aBe9i8o6ude;mantic,o1Isy,u6;gh,nd;ch,pe,tzy;a6d,mo0H;dy,l;gg7ndom,p6re,w;id;ed;ai2i6;ck,et;aEhoDi1QlCoBr8u6;ny,r6;e,p5;egna2ic7o6;fouYud;ey,k0;li04or,te1B;ain,easa2;ny;in4le;dd,f6i0ld,ranQ;fi10;aAe8i7o6;b5isy,rm15sy;ce,mb5;a6w;r,t;ive,rr01;aAe8ild,o7u6;nda19te;ist,o1;a6ek,llX;n,s0ty;d,tuQ;aBeAi9o6ucky;f0Un7o1Du6ve0w17y0T;d,sy;e0g;g1Tke0tt5ve0;an,wd;me,r6te;ge;e7i6;nd;en;ol0ui1P;cy,ll,n6;sBt6;e6ima8;llege2r6;es7media6;te;ti3;ecu6ta2;re;aEeBiAo8u6;ge,m6ng1R;b5id;ll6me0t;ow;gh,l0;a6f04sita2;dy,v6;en0y;nd1Hppy,r6te4;d,sh;aGenFhDiClBoofy,r6;a9e8is0o6ue1E;o6ss;vy;at,en,y;nd,y;ad,ib,ooI;a2d1;a6o6;st0;t5uiY;u1y;aIeeb5iDlat,oAr8u6;ll,n6r14;!ny;aHe6iend0;e,sh;a7r6ul;get4mG;my;erce8n6rm,t;an6e;ciC;! ;le;ir,ke,n0Fr,st,t,ulA;aAerie,mp9sse7v6xtre0Q;il;nti6;al;ty;r7s6;tern,y;ly,th0;aFeCi9r7u6;ll,mb;u6y;nk;r7vi6;ne;e,ty;a6ep,nD;d6f,r;!ly;mp,pp03rk;aHhDlAo8r7u6;dd0r0te;isp,uel;ar6ld,mmon,ol,st0ward0zy;se;e6ou1;a6vW;n,r;ar8e6il0;ap,e6;sy;mi3;gey,lm8r6;e4i3;ful;!i3;aNiLlIoEr8u6;r0sy;ly;aAi7o6;ad,wn;ef,g7llia2;nt;ht;sh,ve;ld,r7un6;cy;ed,i3;ng;a7o6ue;nd,o1;ck,nd;g,tt6;er;d,ld,w1;dy;bsu9ng8we6;so6;me;ry;rd",
      "TextValue": "true¦bOeJfDhundredNmOninAone,qu8s6t0zeroN;enMh3rNw0;e0o;l0ntD;fHve;ir0ousandKree;d,t6;e0ix8;cond,pt1ven7xt1;adr0int0;illionD;e0th;!t0;e9ie8y;i3o0;rt1ur0;!t2;ie4y;ft0rst,ve;e3h,ie2y;ight0lev2;!e1h,ie0y;th;en0;!th;illion0;!s,th",
      "Ordinal": "true¦bGeDf9hundredHmGnin7qu6s4t0zeroH;enGh1rFwe0;lfFn9;ir0ousandE;d,t4;e0ixt9;cond,ptAvent8xtA;adr9int9;et0th;e6ie8;i2o0;r0urt3;tie5;ft1rst;ight0lev1;e0h,ie2;en1;illion0;th",
      "Cardinal": "true¦bHeEf8hundred,mHnineAone,qu6s4t0zero;en,h2rGw0;e0o;lve,n8;irt9ousandEree;e0ix5;pt1ven4xt1;adr0int0;illion;i3o0;r1ur0;!t2;ty;ft0ve;e2y;ight0lev1;!e0y;en;illion0;!s",
      "Expression": "true¦a02b01dXeVfuck,gShLlImHnGoDpBshAtsk,u7voi04w3y0;a1eLu0;ck,p;!a,hoo,y;h1ow,t0;af,f;e0oa;e,w;gh,h0;! 0h,m;huh,oh;eesh,hh,it;ff,hew,l0sst;ease,z;h1o0w,y;h,o,ps;!h;ah,ope;eh,mm;m1ol0;!s;ao,fao;a4e2i,mm,oly1urr0;ah;! mo6;e,ll0y;!o;ha0i;!ha;ah,ee,o0rr;l0odbye;ly;e0h,t cetera,ww;k,p;'oh,a0uh;m0ng;mit,n0;!it;ah,oo,ye; 1h0rgh;!em;la",
      "Adverb": "true¦a07by 05d01eYfShQinPjustOkinda,mMnJoEpCquite,r9s5t2up1very,w0Bye0;p,s; to,wards5;h1o0wiO;o,t6ward;en,us;everal,o0uch;!me1rt0; of;hXtimes,w07;a1e0;alS;ndomRthN;ar excellDer0oint blank; Mhaps;f3n0;ce0ly;! 0;ag00moU; courHten;ewJo0; longEt 0;onHwithstanding;aybe,eanwhiAore0;!ovB;! aboS;deed,steT;en0;ce;or2u0;l9rther0;!moH; 0ev3;examp0good,suF;le;n mas1v0;er;se;e0irect1; 1finite0;ly;ju7trop;far,n0;ow; CbroBd nauseam,gAl5ny2part,side,t 0w3;be5l0mo5wor5;arge,ea4;mo1w0;ay;re;l 1mo0one,ready,so,ways;st;b1t0;hat;ut;ain;ad;lot,posteriori",
      "Preposition": "true¦'o,-,aKbHcGdFexcept,fEinDmidPnotwithstandiQoBpRqua,sAt6u3vi2w0;/o,hereMith0;!in,oQ;a,s-a-vis;n1p0;!on;like,til;h0ill,owards;an,r0;ough0u;!oI;ans,ince,o that;',f0n1ut;!f;!to;or,rom;espite,own,u3;hez,irca;ar1e0oAy;low,sides,tween;ri6;',bo7cross,ft6lo5m3propos,round,s1t0;!op;! long 0;as;id0ong0;!st;ng;er;ut",
      "Determiner": "true¦aAboth,d8e5few,l3mu7neiCown,plenty,some,th2various,wh0;at0ich0;evB;at,e3is,ose;a,e0;!ast,s;a1i6l0nough,very;!se;ch;e0u;!s;!n0;!o0y;th0;er"
    };

    const entity = ['Person', 'Place', 'Organization'];

    var nouns = {
      Noun: {
        notA: ['Verb', 'Adjective', 'Adverb'],
      },
      // - singular
      Singular: {
        isA: 'Noun',
        notA: 'Plural',
      },
      //a specific thing that's capitalized
      ProperNoun: {
        isA: 'Noun',
      },

      // -- people
      Person: {
        isA: ['ProperNoun', 'Singular'],
        notA: ['Place', 'Organization', 'Date'],
      },
      FirstName: {
        isA: 'Person',
      },
      MaleName: {
        isA: 'FirstName',
        notA: ['FemaleName', 'LastName'],
      },
      FemaleName: {
        isA: 'FirstName',
        notA: ['MaleName', 'LastName'],
      },
      LastName: {
        isA: 'Person',
        notA: ['FirstName'],
      },
      NickName: {
        isA: 'Person',
        notA: ['FirstName', 'LastName'],
      },
      Honorific: {
        isA: 'Noun',
        notA: ['FirstName', 'LastName', 'Value'],
      },

      // -- places
      Place: {
        isA: 'Singular',
        notA: ['Person', 'Organization'],
      },
      Country: {
        isA: ['Place', 'ProperNoun'],
        notA: ['City'],
      },
      City: {
        isA: ['Place', 'ProperNoun'],
        notA: ['Country'],
      },
      Region: {
        isA: ['Place', 'ProperNoun'],
      },
      Address: {
        isA: 'Place',
      },

      //---Orgs---
      Organization: {
        isA: ['Singular', 'ProperNoun'],
        notA: ['Person', 'Place'],
      },
      SportsTeam: {
        isA: 'Organization',
      },
      School: {
        isA: 'Organization',
      },
      Company: {
        isA: 'Organization',
      },

      // - plural
      Plural: {
        isA: 'Noun',
        notA: ['Singular'],
      },
      //(not plural or singular)
      Uncountable: {
        isA: 'Noun',
      },
      Pronoun: {
        isA: 'Noun',
        notA: entity,
      },
      //a word for someone doing something -'plumber'
      Actor: {
        isA: 'Noun',
        notA: entity,
      },
      //a gerund-as-noun - 'swimming'
      Activity: {
        isA: 'Noun',
        notA: ['Person', 'Place'],
      },
      //'kilograms'
      Unit: {
        isA: 'Noun',
        notA: entity,
      },
      //'Canadians'
      Demonym: {
        isA: ['Noun', 'ProperNoun'],
        notA: entity,
      },
      //`john's`
      Possessive: {
        isA: 'Noun',
        // notA: 'Pronoun',
      },
    };

    var verbs = {
      Verb: {
        notA: ['Noun', 'Adjective', 'Adverb', 'Value'],
      },
      // walks
      PresentTense: {
        isA: 'Verb',
        notA: ['PastTense', 'Copula', 'FutureTense'],
      },
      // neutral form - 'walk'
      Infinitive: {
        isA: 'PresentTense',
        notA: ['PastTense', 'Gerund'],
      },
      // walking
      Gerund: {
        isA: 'PresentTense',
        notA: ['PastTense', 'Copula', 'FutureTense'],
      },
      // walked
      PastTense: {
        isA: 'Verb',
        notA: ['FutureTense'],
      },
      // will walk
      FutureTense: {
        isA: 'Verb',
      },

      // is
      Copula: {
        isA: 'Verb',
      },
      // would have
      Modal: {
        isA: 'Verb',
        notA: ['Infinitive'],
      },
      // had walked
      PerfectTense: {
        isA: 'Verb',
        notA: 'Gerund',
      },
      Pluperfect: {
        isA: 'Verb',
      },
      // shown
      Participle: {
        isA: 'Verb',
      },
      // show up
      PhrasalVerb: {
        isA: 'Verb',
      },
      //'up' part
      Particle: {
        isA: 'PhrasalVerb',
      },
    };

    var values = {
      Value: {
        notA: ['Verb', 'Adjective', 'Adverb'],
      },
      Ordinal: {
        isA: 'Value',
        notA: ['Cardinal'],
      },
      Cardinal: {
        isA: 'Value',
        notA: ['Ordinal'],
      },
      RomanNumeral: {
        isA: 'Cardinal', //can be a person, too
        notA: ['Ordinal', 'TextValue'],
      },
      TextValue: {
        isA: 'Value',
        notA: ['NumericValue'],
      },
      NumericValue: {
        isA: 'Value',
        notA: ['TextValue'],
      },
      Money: {
        isA: 'Cardinal',
      },
      Percent: {
        isA: 'Value',
      },
    };

    const anything = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Value', 'QuestionWord'];

    var misc = {
      //--Adjectives--
      Adjective: {
        notA: ['Noun', 'Verb', 'Adverb', 'Value'],
      },
      // adjectives that can conjugate
      Comparable: {
        isA: ['Adjective'],
      },
      // better
      Comparative: {
        isA: ['Adjective'],
      },
      // best
      Superlative: {
        isA: ['Adjective'],
        notA: ['Comparative'],
      },

      NumberRange: {
        isA: ['Contraction'],
      },
      Adverb: {
        notA: ['Noun', 'Verb', 'Adjective', 'Value'],
      },

      // Dates:
      //not a noun, but usually is
      Date: {
        notA: ['Verb', 'Conjunction', 'Adverb', 'Preposition', 'Adjective'],
      },
      Month: {
        isA: ['Date', 'Singular'],
        notA: ['Year', 'WeekDay', 'Time'],
      },
      WeekDay: {
        isA: ['Date', 'Noun'],
      },
      // '9:20pm'
      Time: {
        isA: ['Date'],
        notA: ['Value'],
      },

      //glue
      Determiner: {
        notA: anything,
      },
      Conjunction: {
        notA: anything,
      },
      Preposition: {
        notA: anything,
      },

      // what, who, why
      QuestionWord: {
        notA: ['Determiner'],
      },

      // peso, euro
      Currency: {},
      // ughh
      Expression: {
        notA: ['Noun', 'Adjective', 'Verb', 'Adverb'],
      },
      // dr.
      Abbreviation: {},

      // internet tags
      Url: {
        notA: ['HashTag', 'PhoneNumber', 'Verb', 'Adjective', 'Value', 'AtMention', 'Email'],
      },
      PhoneNumber: {
        notA: ['HashTag', 'Verb', 'Adjective', 'Value', 'AtMention', 'Email'],
      },
      HashTag: {},
      AtMention: {
        isA: ['Noun'],
        notA: ['HashTag', 'Verb', 'Adjective', 'Value', 'Email'],
      },
      Emoji: {
        notA: ['HashTag', 'Verb', 'Adjective', 'Value', 'AtMention'],
      },
      Emoticon: {
        notA: ['HashTag', 'Verb', 'Adjective', 'Value', 'AtMention'],
      },
      Email: {
        notA: ['HashTag', 'Verb', 'Adjective', 'Value', 'AtMention'],
      },

      //non-exclusive
      Auxiliary: {
        notA: ['Noun', 'Adjective', 'Value'],
      },
      Acronym: {
        notA: ['Plural', 'RomanNumeral'],
      },
      Negative: {
        notA: ['Noun', 'Adjective', 'Value'],
      },
      // if, unless, were
      Condition: {
        notA: ['Verb', 'Adjective', 'Noun', 'Value'],
      },
    };

    // i just made these up
    const colorMap = {
      Noun: 'blue',

      Verb: 'green',
      Negative: 'green',

      Date: 'red',
      Value: 'red',

      Adjective: 'magenta',

      Preposition: 'cyan',
      Conjunction: 'cyan',
      Determiner: 'cyan',
      Adverb: 'cyan',
    };

    /** add a debug color to some tags */
    const addColors = function(tags) {
      Object.keys(tags).forEach(k => {
        // assigned from plugin, for example
        if (tags[k].color) {
          tags[k].color = tags[k].color;
          return
        }
        // defined above
        if (colorMap[k]) {
          tags[k].color = colorMap[k];
          return
        }
        tags[k].isA.some(t => {
          if (colorMap[t]) {
            tags[k].color = colorMap[t];
            return true
          }
          return false
        });
      });
      return tags
    };

    var _color = addColors;

    const unique$2 = function(arr) {
      return arr.filter((v, i, a) => a.indexOf(v) === i)
    };

    //add 'downward' tags (that immediately depend on this one)
    const inferIsA = function(tags) {
      Object.keys(tags).forEach(k => {
        let tag = tags[k];
        let len = tag.isA.length;
        for (let i = 0; i < len; i++) {
          let down = tag.isA[i];
          if (tags[down]) {
            tag.isA = tag.isA.concat(tags[down].isA);
          }
        }
        // clean it up
        tag.isA = unique$2(tag.isA);
      });
      return tags
    };
    var _isA = inferIsA;

    const unique$3 = function(arr) {
      return arr.filter((v, i, a) => a.indexOf(v) === i)
    };

    // crawl the tag-graph and infer any conflicts
    // faster than doing this at tag-time
    const inferNotA = function(tags) {
      let keys = Object.keys(tags);
      keys.forEach(k => {
        let tag = tags[k];
        tag.notA = tag.notA || [];
        tag.isA.forEach(down => {
          if (tags[down] && tags[down].notA) {
            // borrow its conflicts
            let notA = typeof tags[down].notA === 'string' ? [tags[down].isA] : tags[down].notA || [];
            tag.notA = tag.notA.concat(notA);
          }
        });
        // any tag that lists us as a conflict, we conflict it back.
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (tags[key].notA.indexOf(k) !== -1) {
            tag.notA.push(key);
          }
        }
        // clean it up
        tag.notA = unique$3(tag.notA);
      });
      return tags
    };
    var _notA = inferNotA;

    // a lineage is all 'incoming' tags that have this as 'isA'
    const inferLineage = function(tags) {
      let keys = Object.keys(tags);
      keys.forEach(k => {
        let tag = tags[k];
        tag.lineage = [];
        // find all tags with it in their 'isA' set
        for (let i = 0; i < keys.length; i++) {
          if (tags[keys[i]].isA.indexOf(k) !== -1) {
            tag.lineage.push(keys[i]);
          }
        }
      });
      return tags
    };
    var _lineage = inferLineage;

    const validate = function(tags) {
      // cleanup format
      Object.keys(tags).forEach(k => {
        let tag = tags[k];
        // ensure isA is an array
        tag.isA = tag.isA || [];
        if (typeof tag.isA === 'string') {
          tag.isA = [tag.isA];
        }
        // ensure notA is an array
        tag.notA = tag.notA || [];
        if (typeof tag.notA === 'string') {
          tag.notA = [tag.notA];
        }
      });
      return tags
    };

    // build-out the tag-graph structure
    const inferTags = function(tags) {
      // validate data
      tags = validate(tags);
      // build its 'down tags'
      tags = _isA(tags);
      // infer the conflicts
      tags = _notA(tags);
      // debug tag color
      tags = _color(tags);
      // find incoming links
      tags = _lineage(tags);
      return tags
    };
    var inference = inferTags;

    //extend tagset with new tags
    const addIn = function(obj, tags) {
      Object.keys(obj).forEach(k => {
        tags[k] = obj[k];
      });
    };

    const build = () => {
      let tags = {};
      addIn(nouns, tags);
      addIn(verbs, tags);
      addIn(values, tags);
      addIn(misc, tags);
      // do the graph-stuff
      tags = inference(tags);
      return tags
    };
    var tags = build();

    const seq="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",cache=seq.split("").reduce(function(n,o,e){return n[o]=e,n},{}),toAlphaCode=function(n){if(void 0!==seq[n])return seq[n];let o=1,e=36,t="";for(;n>=e;n-=e,o++,e*=36);for(;o--;){const o=n%36;t=String.fromCharCode((o<10?48:55)+o)+t,n=(n-o)/36;}return t},fromAlphaCode=function(n){if(void 0!==cache[n])return cache[n];let o=0,e=1,t=36,r=1;for(;e<n.length;o+=t,e++,t*=36);for(let e=n.length-1;e>=0;e--,r*=36){let t=n.charCodeAt(e)-48;t>10&&(t-=7),o+=t*r;}return o};var encoding={toAlphaCode:toAlphaCode,fromAlphaCode:fromAlphaCode},symbols=function(n){const o=new RegExp("([0-9A-Z]+):([0-9A-Z]+)");for(let e=0;e<n.nodes.length;e++){const t=o.exec(n.nodes[e]);if(!t){n.symCount=e;break}n.syms[encoding.fromAlphaCode(t[1])]=encoding.fromAlphaCode(t[2]);}n.nodes=n.nodes.slice(n.symCount,n.nodes.length);};const indexFromRef=function(n,o,e){const t=encoding.fromAlphaCode(o);return t<n.symCount?n.syms[t]:e+t+1-n.symCount},toArray=function(n){const o=[],e=(t,r)=>{let s=n.nodes[t];"!"===s[0]&&(o.push(r),s=s.slice(1));const c=s.split(/([A-Z0-9,]+)/g);for(let s=0;s<c.length;s+=2){const u=c[s],i=c[s+1];if(!u)continue;const l=r+u;if(","===i||void 0===i){o.push(l);continue}const f=indexFromRef(n,i,t);e(f,l);}};return e(0,""),o},unpack=function(n){const o={nodes:n.split(";"),syms:[],symCount:0};return n.match(":")&&symbols(o),toArray(o)};var unpack_1=unpack,unpack_1$1=function(n){const o=n.split("|").reduce((n,o)=>{const e=o.split("¦");return n[e[0]]=e[1],n},{}),e={};return Object.keys(o).forEach(function(n){const t=unpack_1(o[n]);"true"===n&&(n=!0);for(let o=0;o<t.length;o++){const r=t[o];!0===e.hasOwnProperty(r)?!1===Array.isArray(e[r])?e[r]=[e[r],n]:e[r].push(n):e[r]=n;}}),e};var efrtUnpack_min=unpack_1$1;

    //safely add it to the lexicon
    const addWord = function(word, tag, lex) {
      if (lex[word] !== undefined) {
        if (typeof lex[word] === 'string') {
          lex[word] = [lex[word]];
        }
        if (typeof tag === 'string') {
          lex[word].push(tag);
        } else {
          lex[word] = lex[word].concat(tag);
        }
      } else {
        lex[word] = tag;
      }
    };

    // blast-out more forms for some given words
    const addMore = function(word, tag, world) {
      let lexicon = world.words;
      let transform = world.transforms;

      // cache multi-words
      let words = word.split(' ');
      if (words.length > 1) {
        //cache the beginning word
        world.hasCompound[words[0]] = true;
      }
      // inflect our nouns
      if (tag === 'Singular') {
        let plural = transform.toPlural(word, world);
        lexicon[plural] = lexicon[plural] || 'Plural'; // only if it's safe
      }
      //conjugate our verbs
      if (tag === 'Infinitive') {
        let conj = transform.conjugate(word, world);
        let tags = Object.keys(conj);
        for (let i = 0; i < tags.length; i++) {
          let w = conj[tags[i]];
          lexicon[w] = lexicon[w] || tags[i]; // only if it's safe
        }
      }
      //derive more adjective forms
      if (tag === 'Comparable') {
        let conj = transform.adjectives(word);
        let tags = Object.keys(conj);
        for (let i = 0; i < tags.length; i++) {
          let w = conj[tags[i]];
          lexicon[w] = lexicon[w] || tags[i]; // only if it's safe
        }
      }
      //conjugate phrasal-verbs
      if (tag === 'PhrasalVerb') {
        //add original form
        addWord(word, 'Infinitive', lexicon);
        //conjugate first word
        let conj = transform.conjugate(words[0], world);
        let tags = Object.keys(conj);
        for (let i = 0; i < tags.length; i++) {
          //add it to our cache
          world.hasCompound[conj[tags[i]]] = true;
          //first + last words
          let w = conj[tags[i]] + ' ' + words[1];

          addWord(w, tags[i], lexicon);
          addWord(w, 'PhrasalVerb', lexicon);
        }
      }
      // inflect our demonyms - 'germans'
      if (tag === 'Demonym') {
        let plural = transform.toPlural(word, world);
        lexicon[plural] = lexicon[plural] || ['Demonym', 'Plural']; // only if it's safe
      }
    };

    // throw a bunch of words in our lexicon
    // const doWord = function(words, tag, world) {
    //   let lexicon = world.words
    //   for (let i = 0; i < words.length; i++) {
    //     addWord(words[i], tag, lexicon)
    //     // do some fancier stuff
    //     addMore(words[i], tag, world)
    //   }
    // }
    var addWords = {
      addWord: addWord,
      addMore: addMore,
    };

    // add words from plurals and conjugations data
    const addIrregulars = function(world) {
      //add irregular plural nouns
      let nouns = world.irregulars.nouns;
      let words = Object.keys(nouns);
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        world.words[w] = 'Singular';
        world.words[nouns[w]] = 'Plural';
      }

      // add irregular verb conjugations
      let verbs = world.irregulars.verbs;
      let keys = Object.keys(verbs);
      for (let i = 0; i < keys.length; i++) {
        const inf = keys[i];
        //add only if it it's safe...
        world.words[inf] = world.words[inf] || 'Infinitive';
        let forms = world.transforms.conjugate(inf, world);
        forms = Object.assign(forms, verbs[inf]);
        //add the others
        Object.keys(forms).forEach(tag => {
          world.words[forms[tag]] = world.words[forms[tag]] || tag;
        });
      }
    };
    var addIrregulars_1 = addIrregulars;

    //words that can't be compressed, for whatever reason
    var misc$1 = {
      // numbers
      '20th century fox': 'Organization',
      // '3m': 'Organization',
      '7 eleven': 'Organization',
      '7-eleven': 'Organization',
      g8: 'Organization',
      'motel 6': 'Organization',
      vh1: 'Organization',
      q1: 'Date',
      q2: 'Date',
      q3: 'Date',
      q4: 'Date',
    };

    //nouns with irregular plural/singular forms
    //used in noun.inflect, and also in the lexicon.

    var plurals = {
      addendum: 'addenda',
      alga: 'algae',
      alumna: 'alumnae',
      alumnus: 'alumni',
      analysis: 'analyses',
      antenna: 'antennae',
      appendix: 'appendices',
      avocado: 'avocados',
      axis: 'axes',
      bacillus: 'bacilli',
      barracks: 'barracks',
      beau: 'beaux',
      bus: 'buses',
      cactus: 'cacti',
      chateau: 'chateaux',
      child: 'children',
      circus: 'circuses',
      clothes: 'clothes',
      corpus: 'corpora',
      criterion: 'criteria',
      curriculum: 'curricula',
      database: 'databases',
      deer: 'deer',
      diagnosis: 'diagnoses',
      echo: 'echoes',
      embargo: 'embargoes',
      epoch: 'epochs',
      foot: 'feet',
      formula: 'formulae',
      fungus: 'fungi',
      genus: 'genera',
      goose: 'geese',
      halo: 'halos',
      hippopotamus: 'hippopotami',
      index: 'indices',
      larva: 'larvae',
      leaf: 'leaves',
      libretto: 'libretti',
      loaf: 'loaves',
      man: 'men',
      matrix: 'matrices',
      memorandum: 'memoranda',
      modulus: 'moduli',
      mosquito: 'mosquitoes',
      mouse: 'mice',
      move: 'moves',
      nebula: 'nebulae',
      nucleus: 'nuclei',
      octopus: 'octopi',
      opus: 'opera',
      ovum: 'ova',
      ox: 'oxen',
      parenthesis: 'parentheses',
      person: 'people',
      phenomenon: 'phenomena',
      prognosis: 'prognoses',
      quiz: 'quizzes',
      radius: 'radii',
      referendum: 'referenda',
      rodeo: 'rodeos',
      sex: 'sexes',
      shoe: 'shoes',
      sombrero: 'sombreros',
      stimulus: 'stimuli',
      stomach: 'stomachs',
      syllabus: 'syllabi',
      synopsis: 'synopses',
      tableau: 'tableaux',
      thesis: 'theses',
      thief: 'thieves',
      tooth: 'teeth',
      tornado: 'tornados',
      tuxedo: 'tuxedos',
      vertebra: 'vertebrae',
      // virus: 'viri',
      // zero: 'zeros',
    };

    // a list of irregular verb conjugations
    // used in verbs().conjugate()
    // but also added to our lexicon

    //use shorter key-names
    const mapping = {
      g: 'Gerund',
      prt: 'Participle',
      perf: 'PerfectTense',
      pst: 'PastTense',
      fut: 'FuturePerfect',
      pres: 'PresentTense',
      pluperf: 'Pluperfect',
      a: 'Actor',
    };

    // '_' in conjugations is the infinitive form
    let conjugations = {
      act: {
        a: '_or',
      },
      ache: {
        pst: 'ached',
        g: 'aching',
      },
      age: {
        g: 'ageing',
        pst: 'aged',
        pres: 'ages',
      },
      aim: {
        a: '_er',
        g: '_ing',
        pst: '_ed',
      },
      arise: {
        prt: '_n',
        pst: 'arose',
      },
      babysit: {
        a: '_ter',
        pst: 'babysat',
      },
      ban: {
        a: '',
        g: '_ning',
        pst: '_ned',
      },
      be: {
        a: '',
        g: 'am',
        prt: 'been',
        pst: 'was',
        pres: 'is',
      },
      beat: {
        a: '_er',
        g: '_ing',
        prt: '_en',
      },
      become: {
        prt: '_',
      },
      begin: {
        g: '_ning',
        prt: 'begun',
        pst: 'began',
      },
      being: {
        g: 'are',
        pst: 'were',
        pres: 'are',
      },
      bend: {
        prt: 'bent',
      },
      bet: {
        a: '_ter',
        prt: '_',
      },
      bind: {
        pst: 'bound',
      },
      bite: {
        g: 'biting',
        prt: 'bitten',
        pst: 'bit',
      },
      bleed: {
        prt: 'bled',
        pst: 'bled',
      },
      blow: {
        prt: '_n',
        pst: 'blew',
      },
      boil: {
        a: '_er',
      },
      brake: {
        prt: 'broken',
      },
      break: {
        pst: 'broke',
      },
      breed: {
        pst: 'bred',
      },
      bring: {
        prt: 'brought',
        pst: 'brought',
      },
      broadcast: {
        pst: '_',
      },
      budget: {
        pst: '_ed',
      },
      build: {
        prt: 'built',
        pst: 'built',
      },
      burn: {
        prt: '_ed',
      },
      burst: {
        prt: '_',
      },
      buy: {
        prt: 'bought',
        pst: 'bought',
      },
      can: {
        a: '',
        fut: '_',
        g: '',
        pst: 'could',
        perf: 'could',
        pluperf: 'could',
        pres: '_',
      },
      catch: {
        pst: 'caught',
      },
      choose: {
        g: 'choosing',
        prt: 'chosen',
        pst: 'chose',
      },
      cling: {
        prt: 'clung',
      },
      come: {
        prt: '_',
        pst: 'came',
        g: 'coming',
      },
      compete: {
        a: 'competitor',
        g: 'competing',
        pst: '_d',
      },
      cost: {
        pst: '_',
      },
      creep: {
        prt: 'crept',
      },
      cut: {
        prt: '_',
      },
      deal: {
        prt: '_t',
        pst: '_t',
      },
      develop: {
        a: '_er',
        g: '_ing',
        pst: '_ed',
      },
      die: {
        g: 'dying',
        pst: '_d',
      },
      dig: {
        g: '_ging',
        prt: 'dug',
        pst: 'dug',
      },
      dive: {
        prt: '_d',
      },
      do: {
        pst: 'did',
        pres: '_es',
      },
      draw: {
        prt: '_n',
        pst: 'drew',
      },
      dream: {
        prt: '_t',
      },
      drink: {
        prt: 'drunk',
        pst: 'drank',
      },
      drive: {
        g: 'driving',
        prt: '_n',
        pst: 'drove',
      },
      drop: {
        g: '_ping',
        pst: '_ped',
      },
      eat: {
        a: '_er',
        g: '_ing',
        prt: '_en',
        pst: 'ate',
      },
      edit: {
        pst: '_ed',
        g: '_ing',
      },
      egg: {
        pst: '_ed',
      },
      fall: {
        prt: '_en',
        pst: 'fell',
      },
      feed: {
        prt: 'fed',
        pst: 'fed',
      },
      feel: {
        a: '_er',
        pst: 'felt',
      },
      fight: {
        prt: 'fought',
        pst: 'fought',
      },
      find: {
        pst: 'found',
      },
      flee: {
        g: '_ing',
        prt: 'fled',
      },
      fling: {
        prt: 'flung',
      },
      fly: {
        prt: 'flown',
        pst: 'flew',
      },
      forbid: {
        pst: 'forbade',
      },
      forget: {
        g: '_ing',
        prt: 'forgotten',
        pst: 'forgot',
      },
      forgive: {
        g: 'forgiving',
        prt: '_n',
        pst: 'forgave',
      },
      free: {
        a: '',
        g: '_ing',
      },
      freeze: {
        g: 'freezing',
        prt: 'frozen',
        pst: 'froze',
      },
      get: {
        pst: 'got',
        prt: 'gotten',
      },
      give: {
        g: 'giving',
        prt: '_n',
        pst: 'gave',
      },
      go: {
        prt: '_ne',
        pst: 'went',
        pres: 'goes',
      },
      grow: {
        prt: '_n',
      },
      hang: {
        prt: 'hung',
        pst: 'hung',
      },
      have: {
        g: 'having',
        prt: 'had',
        pst: 'had',
        pres: 'has',
      },
      hear: {
        prt: '_d',
        pst: '_d',
      },
      hide: {
        prt: 'hidden',
        pst: 'hid',
      },
      hit: {
        prt: '_',
      },
      hold: {
        prt: 'held',
        pst: 'held',
      },
      hurt: {
        prt: '_',
        pst: '_',
      },
      ice: {
        g: 'icing',
        pst: '_d',
      },
      imply: {
        pst: 'implied',
        pres: 'implies',
      },
      is: {
        a: '',
        g: 'being',
        pst: 'was',
        pres: '_',
      },
      keep: {
        prt: 'kept',
      },
      kneel: {
        prt: 'knelt',
      },
      know: {
        prt: '_n',
      },
      lay: {
        prt: 'laid',
        pst: 'laid',
      },
      lead: {
        prt: 'led',
        pst: 'led',
      },
      leap: {
        prt: '_t',
      },
      leave: {
        prt: 'left',
        pst: 'left',
      },
      lend: {
        prt: 'lent',
      },
      lie: {
        g: 'lying',
        pst: 'lay',
      },
      light: {
        prt: 'lit',
        pst: 'lit',
      },
      log: {
        g: '_ging',
        pst: '_ged',
      },
      loose: {
        prt: 'lost',
      },
      lose: {
        g: 'losing',
        pst: 'lost',
      },
      make: {
        prt: 'made',
        pst: 'made',
      },
      mean: {
        prt: '_t',
        pst: '_t',
      },
      meet: {
        a: '_er',
        g: '_ing',
        prt: 'met',
        pst: 'met',
      },
      miss: {
        pres: '_',
      },
      name: {
        g: 'naming',
      },
      pay: {
        prt: 'paid',
        pst: 'paid',
      },
      prove: {
        prt: '_n',
      },
      puke: {
        g: 'puking',
      },
      put: {
        prt: '_',
      },
      quit: {
        prt: '_',
      },
      read: {
        prt: '_',
        pst: '_',
      },
      ride: {
        prt: 'ridden',
      },
      ring: {
        prt: 'rung',
        pst: 'rang',
      },
      rise: {
        fut: 'will have _n',
        g: 'rising',
        prt: '_n',
        pst: 'rose',
        pluperf: 'had _n',
      },
      rub: {
        g: '_bing',
        pst: '_bed',
      },
      run: {
        g: '_ning',
        prt: '_',
        pst: 'ran',
      },
      say: {
        prt: 'said',
        pst: 'said',
        pres: '_s',
      },
      seat: {
        prt: 'sat',
      },
      see: {
        g: '_ing',
        prt: '_n',
        pst: 'saw',
      },
      seek: {
        prt: 'sought',
      },
      sell: {
        prt: 'sold',
        pst: 'sold',
      },
      send: {
        prt: 'sent',
      },
      set: {
        prt: '_',
      },
      sew: {
        prt: '_n',
      },
      shake: {
        prt: '_n',
      },
      shave: {
        prt: '_d',
      },
      shed: {
        g: '_ding',
        pst: '_',
        pres: '_s',
      },
      shine: {
        prt: 'shone',
        pst: 'shone',
      },
      shoot: {
        prt: 'shot',
        pst: 'shot',
      },
      show: {
        pst: '_ed',
      },
      shut: {
        prt: '_',
      },
      sing: {
        prt: 'sung',
        pst: 'sang',
      },
      sink: {
        pst: 'sank',
        pluperf: 'had sunk',
      },
      sit: {
        pst: 'sat',
      },
      ski: {
        pst: '_ied',
      },
      slay: {
        prt: 'slain',
      },
      sleep: {
        prt: 'slept',
      },
      slide: {
        prt: 'slid',
        pst: 'slid',
      },
      smash: {
        pres: '_es',
      },
      sneak: {
        prt: 'snuck',
      },
      speak: {
        fut: 'will have spoken',
        prt: 'spoken',
        pst: 'spoke',
        perf: 'have spoken',
        pluperf: 'had spoken',
      },
      speed: {
        prt: 'sped',
      },
      spend: {
        prt: 'spent',
      },
      spill: {
        prt: '_ed',
        pst: 'spilt',
      },
      spin: {
        g: '_ning',
        prt: 'spun',
        pst: 'spun',
      },
      spit: {
        prt: 'spat',
      },
      split: {
        prt: '_',
      },
      spread: {
        pst: '_',
      },
      spring: {
        prt: 'sprung',
      },
      stand: {
        pst: 'stood',
      },
      steal: {
        a: '_er',
        pst: 'stole',
      },
      stick: {
        pst: 'stuck',
      },
      sting: {
        pst: 'stung',
      },
      stink: {
        prt: 'stunk',
        pst: 'stunk',
      },
      stream: {
        a: '_er',
      },
      strew: {
        prt: '_n',
      },
      strike: {
        g: 'striking',
        pst: 'struck',
      },
      suit: {
        a: '_er',
        g: '_ing',
        pst: '_ed',
      },
      sware: {
        prt: 'sworn',
      },
      swear: {
        pst: 'swore',
      },
      sweep: {
        prt: 'swept',
      },
      swim: {
        g: '_ming',
        pst: 'swam',
      },
      swing: {
        pst: 'swung',
      },
      take: {
        fut: 'will have _n',
        pst: 'took',
        perf: 'have _n',
        pluperf: 'had _n',
      },
      teach: {
        pst: 'taught',
        pres: '_es',
      },
      tear: {
        pst: 'tore',
      },
      tell: {
        pst: 'told',
      },
      think: {
        pst: 'thought',
      },
      thrive: {
        prt: '_d',
      },
      tie: {
        g: 'tying',
        pst: '_d',
      },
      undergo: {
        prt: '_ne',
      },
      understand: {
        pst: 'understood',
      },
      upset: {
        prt: '_',
      },
      wait: {
        a: '_er',
        g: '_ing',
        pst: '_ed',
      },
      wake: {
        pst: 'woke',
      },
      wear: {
        pst: 'wore',
      },
      weave: {
        prt: 'woven',
      },
      wed: {
        pst: 'wed',
      },
      weep: {
        prt: 'wept',
      },
      win: {
        g: '_ning',
        pst: 'won',
      },
      wind: {
        prt: 'wound',
      },
      withdraw: {
        pst: 'withdrew',
      },
      wring: {
        prt: 'wrung',
      },
      write: {
        g: 'writing',
        prt: 'written',
        pst: 'wrote',
      },
    };

    //uncompress our ad-hoc compression scheme
    let keys = Object.keys(conjugations);
    for (let i = 0; i < keys.length; i++) {
      const inf = keys[i];
      let final = {};
      Object.keys(conjugations[inf]).forEach(key => {
        let str = conjugations[inf][key];
        //swap-in infinitives for '_'
        str = str.replace('_', inf);

        let full = mapping[key];
        final[full] = str;
      });
      //over-write original
      conjugations[inf] = final;
    }

    var conjugations_1 = conjugations;

    const endsWith = {
      b: [
        {
          reg: /([^aeiou][aeiou])b$/i,
          repl: {
            pr: '$1bs',
            pa: '$1bbed',
            gr: '$1bbing',
          },
        },
      ],
      d: [
        {
          reg: /(end)$/i,
          repl: {
            pr: '$1s',
            pa: 'ent',
            gr: '$1ing',
            ar: '$1er',
          },
        },
        {
          reg: /(eed)$/i,
          repl: {
            pr: '$1s',
            pa: '$1ed',
            gr: '$1ing',
            ar: '$1er',
          },
        },
        {
          reg: /(ed)$/i,
          repl: {
            pr: '$1s',
            pa: '$1ded',
            ar: '$1der',
            gr: '$1ding',
          },
        },
        {
          reg: /([^aeiou][ou])d$/i,
          repl: {
            pr: '$1ds',
            pa: '$1dded',
            gr: '$1dding',
          },
        },
      ],
      e: [
        {
          reg: /(eave)$/i,
          repl: {
            pr: '$1s',
            pa: '$1d',
            gr: 'eaving',
            ar: '$1r',
          },
        },
        {
          reg: /(ide)$/i,
          repl: {
            pr: '$1s',
            pa: 'ode',
            gr: 'iding',
            ar: 'ider',
          },
        },
        {
          //shake
          reg: /(t|sh?)(ake)$/i,
          repl: {
            pr: '$1$2s',
            pa: '$1ook',
            gr: '$1aking',
            ar: '$1$2r',
          },
        },
        {
          //awake
          reg: /w(ake)$/i,
          repl: {
            pr: 'w$1s',
            pa: 'woke',
            gr: 'waking',
            ar: 'w$1r',
          },
        },
        {
          //make
          reg: /m(ake)$/i,
          repl: {
            pr: 'm$1s',
            pa: 'made',
            gr: 'making',
            ar: 'm$1r',
          },
        },
        {
          reg: /(a[tg]|i[zn]|ur|nc|gl|is)e$/i,
          repl: {
            pr: '$1es',
            pa: '$1ed',
            gr: '$1ing',
            // prt: '$1en',
          },
        },
        {
          reg: /([bd]l)e$/i,
          repl: {
            pr: '$1es',
            pa: '$1ed',
            gr: '$1ing',
          },
        },
        {
          reg: /(om)e$/i,
          repl: {
            pr: '$1es',
            pa: 'ame',
            gr: '$1ing',
          },
        },
      ],

      g: [
        {
          reg: /([^aeiou][ou])g$/i,
          repl: {
            pr: '$1gs',
            pa: '$1gged',
            gr: '$1gging',
          },
        },
      ],
      h: [
        {
          reg: /(..)([cs]h)$/i,
          repl: {
            pr: '$1$2es',
            pa: '$1$2ed',
            gr: '$1$2ing',
          },
        },
      ],
      k: [
        {
          reg: /(ink)$/i,
          repl: {
            pr: '$1s',
            pa: 'unk',
            gr: '$1ing',
            ar: '$1er',
          },
        },
      ],

      m: [
        {
          reg: /([^aeiou][aeiou])m$/i,
          repl: {
            pr: '$1ms',
            pa: '$1mmed',
            gr: '$1mming',
          },
        },
      ],

      n: [
        {
          reg: /(en)$/i,
          repl: {
            pr: '$1s',
            pa: '$1ed',
            gr: '$1ing',
          },
        },
      ],
      p: [
        {
          reg: /(e)(ep)$/i,
          repl: {
            pr: '$1$2s',
            pa: '$1pt',
            gr: '$1$2ing',
            ar: '$1$2er',
          },
        },
        {
          reg: /([^aeiou][aeiou])p$/i,
          repl: {
            pr: '$1ps',
            pa: '$1pped',
            gr: '$1pping',
          },
        },
        {
          reg: /([aeiu])p$/i,
          repl: {
            pr: '$1ps',
            pa: '$1p',
            gr: '$1pping',
          },
        },
      ],

      r: [
        {
          reg: /([td]er)$/i,
          repl: {
            pr: '$1s',
            pa: '$1ed',
            gr: '$1ing',
          },
        },
        {
          reg: /(er)$/i,
          repl: {
            pr: '$1s',
            pa: '$1ed',
            gr: '$1ing',
          },
        },
      ],
      s: [
        {
          reg: /(ish|tch|ess)$/i,
          repl: {
            pr: '$1es',
            pa: '$1ed',
            gr: '$1ing',
          },
        },
      ],

      t: [
        {
          reg: /(ion|end|e[nc]t)$/i,
          repl: {
            pr: '$1s',
            pa: '$1ed',
            gr: '$1ing',
          },
        },
        {
          reg: /(.eat)$/i,
          repl: {
            pr: '$1s',
            pa: '$1ed',
            gr: '$1ing',
          },
        },
        {
          reg: /([aeiu])t$/i,
          repl: {
            pr: '$1ts',
            pa: '$1t',
            gr: '$1tting',
          },
        },
        {
          reg: /([^aeiou][aeiou])t$/i,
          repl: {
            pr: '$1ts',
            pa: '$1tted',
            gr: '$1tting',
          },
        },
      ],

      w: [
        {
          reg: /(..)(ow)$/i,
          repl: {
            pr: '$1$2s',
            pa: '$1ew',
            gr: '$1$2ing',
            prt: '$1$2n',
          },
        },
      ],
      y: [
        {
          reg: /([i|f|rr])y$/i,
          repl: {
            pr: '$1ies',
            pa: '$1ied',
            gr: '$1ying',
          },
        },
      ],

      z: [
        {
          reg: /([aeiou]zz)$/i,
          repl: {
            pr: '$1es',
            pa: '$1ed',
            gr: '$1ing',
          },
        },
      ],
    };

    var suffixes = endsWith;

    const posMap = {
      pr: 'PresentTense',
      pa: 'PastTense',
      gr: 'Gerund',
      prt: 'Participle',
      ar: 'Actor',
    };

    const doTransform = function (str, obj) {
      let found = {};
      let keys = Object.keys(obj.repl);
      for (let i = 0; i < keys.length; i += 1) {
        let pos = keys[i];
        found[posMap[pos]] = str.replace(obj.reg, obj.repl[pos]);
      }
      return found
    };

    //look at the end of the word for clues
    const checkSuffix = function (str = '') {
      let c = str[str.length - 1];
      if (suffixes.hasOwnProperty(c) === true) {
        for (let r = 0; r < suffixes[c].length; r += 1) {
          const reg = suffixes[c][r].reg;
          if (reg.test(str) === true) {
            return doTransform(str, suffixes[c][r])
          }
        }
      }
      return {}
    };
    var _01Suffixes = checkSuffix;

    //non-specifc, 'hail-mary' transforms from infinitive, into other forms
    const hasY = /[bcdfghjklmnpqrstvwxz]y$/;

    const generic = {
      Gerund: inf => {
        if (inf.charAt(inf.length - 1) === 'e') {
          return inf.replace(/e$/, 'ing')
        }
        return inf + 'ing'
      },

      PresentTense: inf => {
        if (inf.charAt(inf.length - 1) === 's') {
          return inf + 'es'
        }
        if (hasY.test(inf) === true) {
          return inf.slice(0, -1) + 'ies'
        }
        return inf + 's'
      },

      PastTense: inf => {
        if (inf.charAt(inf.length - 1) === 'e') {
          return inf + 'd'
        }
        if (inf.substr(-2) === 'ed') {
          return inf
        }
        if (hasY.test(inf) === true) {
          return inf.slice(0, -1) + 'ied'
        }
        return inf + 'ed'
      },
    };

    var _02Generic = generic;

    //we run this on every verb in the lexicon, so please keep it fast
    //we assume the input word is a proper infinitive
    const conjugate = function (inf = '', world) {
      let found = {};
      // 1. look at irregulars
      //the lexicon doesn't pass this in
      if (world && world.irregulars) {
        if (world.irregulars.verbs.hasOwnProperty(inf) === true) {
          found = Object.assign({}, world.irregulars.verbs[inf]);
        }
      }
      //2. rule-based regex
      found = Object.assign({}, _01Suffixes(inf), found);

      //3. generic transformations
      //'buzzing'
      if (found.Gerund === undefined) {
        found.Gerund = _02Generic.Gerund(inf);
      }
      //'buzzed'
      if (found.PastTense === undefined) {
        found.PastTense = _02Generic.PastTense(inf);
      }
      //'buzzes'
      if (found.PresentTense === undefined) {
        found.PresentTense = _02Generic.PresentTense(inf);
      }
      return found
    };
    var conjugate_1 = conjugate;

    //turn 'quick' into 'quickest'
    const do_rules = [/ght$/, /nge$/, /ough$/, /ain$/, /uel$/, /[au]ll$/, /ow$/, /oud$/, /...p$/];
    const dont_rules = [/ary$/];

    const irregulars = {
      nice: 'nicest',
      late: 'latest',
      hard: 'hardest',
      inner: 'innermost',
      outer: 'outermost',
      far: 'furthest',
      worse: 'worst',
      bad: 'worst',
      good: 'best',
      big: 'biggest',
      large: 'largest',
    };

    const transforms = [
      {
        reg: /y$/i,
        repl: 'iest',
      },
      {
        reg: /([aeiou])t$/i,
        repl: '$1ttest',
      },
      {
        reg: /([aeou])de$/i,
        repl: '$1dest',
      },
      {
        reg: /nge$/i,
        repl: 'ngest',
      },
      {
        reg: /([aeiou])te$/i,
        repl: '$1test',
      },
    ];

    const to_superlative = function(str) {
      //irregulars
      if (irregulars.hasOwnProperty(str)) {
        return irregulars[str]
      }
      //known transforms
      for (let i = 0; i < transforms.length; i++) {
        if (transforms[i].reg.test(str)) {
          return str.replace(transforms[i].reg, transforms[i].repl)
        }
      }
      //dont-rules
      for (let i = 0; i < dont_rules.length; i++) {
        if (dont_rules[i].test(str) === true) {
          return null
        }
      }
      //do-rules
      for (let i = 0; i < do_rules.length; i++) {
        if (do_rules[i].test(str) === true) {
          if (str.charAt(str.length - 1) === 'e') {
            return str + 'st'
          }
          return str + 'est'
        }
      }
      return str + 'est'
    };

    var toSuperlative = to_superlative;

    //turn 'quick' into 'quickly'
    const do_rules$1 = [/ght$/, /nge$/, /ough$/, /ain$/, /uel$/, /[au]ll$/, /ow$/, /old$/, /oud$/, /e[ae]p$/];
    const dont_rules$1 = [/ary$/, /ous$/];

    const irregulars$1 = {
      grey: 'greyer',
      gray: 'grayer',
      green: 'greener',
      yellow: 'yellower',
      red: 'redder',
      good: 'better',
      well: 'better',
      bad: 'worse',
      sad: 'sadder',
      big: 'bigger',
    };

    const transforms$1 = [
      {
        reg: /y$/i,
        repl: 'ier',
      },
      {
        reg: /([aeiou])t$/i,
        repl: '$1tter',
      },
      {
        reg: /([aeou])de$/i,
        repl: '$1der',
      },
      {
        reg: /nge$/i,
        repl: 'nger',
      },
    ];

    const to_comparative = function(str) {
      //known-irregulars
      if (irregulars$1.hasOwnProperty(str)) {
        return irregulars$1[str]
      }
      //known-transforms
      for (let i = 0; i < transforms$1.length; i++) {
        if (transforms$1[i].reg.test(str) === true) {
          return str.replace(transforms$1[i].reg, transforms$1[i].repl)
        }
      }
      //dont-patterns
      for (let i = 0; i < dont_rules$1.length; i++) {
        if (dont_rules$1[i].test(str) === true) {
          return null
        }
      }
      //do-patterns
      for (let i = 0; i < do_rules$1.length; i++) {
        if (do_rules$1[i].test(str) === true) {
          return str + 'er'
        }
      }
      //easy-one
      if (/e$/.test(str) === true) {
        return str + 'r'
      }
      return str + 'er'
    };

    var toComparative = to_comparative;

    const fns$1 = {
      toSuperlative: toSuperlative,
      toComparative: toComparative,
    };

    /** conjugate an adjective into other forms */
    const conjugate$1 = function(w) {
      let res = {};
      // 'greatest'
      let sup = fns$1.toSuperlative(w);
      if (sup) {
        res.Superlative = sup;
      }
      // 'greater'
      let comp = fns$1.toComparative(w);
      if (comp) {
        res.Comparative = comp;
      }
      return res
    };
    var adjectives = conjugate$1;

    /** patterns for turning 'bus' to 'buses'*/
    const suffixes$1 = {
      a: [[/(antenn|formul|nebul|vertebr|vit)a$/i, '$1ae'], [/([ti])a$/i, '$1a']],

      e: [
        [/(kn|l|w)ife$/i, '$1ives'],
        [/(hive)$/i, '$1s'],
        [/([m|l])ouse$/i, '$1ice'],
        [/([m|l])ice$/i, '$1ice'],
      ],

      f: [
        [/^(dwar|handkerchie|hoo|scar|whar)f$/i, '$1ves'],
        [/^((?:ca|e|ha|(?:our|them|your)?se|she|wo)l|lea|loa|shea|thie)f$/i, '$1ves'],
      ],

      i: [[/(octop|vir)i$/i, '$1i']],

      m: [[/([ti])um$/i, '$1a']],

      n: [[/^(oxen)$/i, '$1']],

      o: [[/(al|ad|at|er|et|ed|ad)o$/i, '$1oes']],

      s: [
        [/(ax|test)is$/i, '$1es'],
        [/(alias|status)$/i, '$1es'],
        [/sis$/i, 'ses'],
        [/(bu)s$/i, '$1ses'],
        [/(sis)$/i, 'ses'],
        [/^(?!talis|.*hu)(.*)man$/i, '$1men'],
        [/(octop|vir|radi|nucle|fung|cact|stimul)us$/i, '$1i'],
      ],

      x: [[/(matr|vert|ind|cort)(ix|ex)$/i, '$1ices'], [/^(ox)$/i, '$1en']],

      y: [[/([^aeiouy]|qu)y$/i, '$1ies']],

      z: [[/(quiz)$/i, '$1zes']],
    };

    var _rules = suffixes$1;

    const addE = /(x|ch|sh|s|z)$/;

    const trySuffix = function(str) {
      let c = str[str.length - 1];
      if (_rules.hasOwnProperty(c) === true) {
        for (let i = 0; i < _rules[c].length; i += 1) {
          let reg = _rules[c][i][0];
          if (reg.test(str) === true) {
            return str.replace(reg, _rules[c][i][1])
          }
        }
      }
      return null
    };

    /** Turn a singular noun into a plural
     * assume the given string is singular
     */
    const pluralize = function(str = '', world) {
      let irregulars = world.irregulars.nouns;

      // check irregulars list
      if (irregulars.hasOwnProperty(str)) {
        return irregulars[str]
      }

      //we have some rules to try-out
      let plural = trySuffix(str);
      if (plural !== null) {
        return plural
      }
      //like 'church'
      if (addE.test(str)) {
        return str + 'es'
      }
      // ¯\_(ツ)_/¯
      return str + 's'
    };
    var toPlural = pluralize;

    //patterns for turning 'dwarves' to 'dwarf'
    var _rules$1 = [
      [/([^v])ies$/i, '$1y'],
      [/ises$/i, 'isis'],
      [/(kn|[^o]l|w)ives$/i, '$1ife'],
      [/^((?:ca|e|ha|(?:our|them|your)?se|she|wo)l|lea|loa|shea|thie)ves$/i, '$1f'],
      [/^(dwar|handkerchie|hoo|scar|whar)ves$/i, '$1f'],
      [/(antenn|formul|nebul|vertebr|vit)ae$/i, '$1a'],
      [/(octop|vir|radi|nucle|fung|cact|stimul)(i)$/i, '$1us'],
      [/(buffal|tomat|tornad)(oes)$/i, '$1o'],
      // [/(analy|diagno|parenthe|progno|synop|the)ses$/i, '$1sis'],
      [/(eas)es$/i, '$1e'], //diseases
      [/(..[aeiou]s)es$/i, '$1'], //geniouses
      [/(vert|ind|cort)(ices)$/i, '$1ex'],
      [/(matr|append)(ices)$/i, '$1ix'],
      [/(x|ch|ss|sh|z|o)es$/i, '$1'],
      [/men$/i, 'man'],
      [/(n)ews$/i, '$1ews'],
      [/([ti])a$/i, '$1um'],
      [/([^aeiouy]|qu)ies$/i, '$1y'],
      [/(s)eries$/i, '$1eries'],
      [/(m)ovies$/i, '$1ovie'],
      [/([m|l])ice$/i, '$1ouse'],
      [/(cris|ax|test)es$/i, '$1is'],
      [/(alias|status)es$/i, '$1'],
      [/(ss)$/i, '$1'],
      [/(ics)$/i, '$1'],
      [/s$/i, ''],
    ];

    const invertObj = function (obj) {
      return Object.keys(obj).reduce((h, k) => {
        h[obj[k]] = k;
        return h
      }, {})
    };

    const toSingular = function (str, world) {
      let irregulars = world.irregulars.nouns;
      let invert = invertObj(irregulars); //(not very efficient)

      // check irregulars list
      if (invert.hasOwnProperty(str)) {
        return invert[str]
      }

      // go through our regexes
      for (let i = 0; i < _rules$1.length; i++) {
        if (_rules$1[i][0].test(str) === true) {
          str = str.replace(_rules$1[i][0], _rules$1[i][1]);
          return str
        }
      }
      return str
    };
    var toSingular_1 = toSingular;

    //rules for turning a verb into infinitive form
    let rules = {
      Participle: [
        {
          reg: /own$/i,
          to: 'ow',
        },
        {
          reg: /(.)un([g|k])$/i,
          to: '$1in$2',
        },
      ],

      Actor: [
        {
          reg: /(er)er$/i,
          to: '$1',
        },
      ],

      PresentTense: [
        {
          reg: /(..)(ies)$/i,
          to: '$1y',
        },
        {
          reg: /(tch|sh)es$/i,
          to: '$1',
        },
        {
          reg: /(ss|zz)es$/i,
          to: '$1',
        },
        {
          reg: /([tzlshicgrvdnkmu])es$/i,
          to: '$1e',
        },
        {
          reg: /(n[dtk]|c[kt]|[eo]n|i[nl]|er|a[ytrl])s$/i,
          to: '$1',
        },
        {
          reg: /(ow)s$/i,
          to: '$1',
        },
        {
          reg: /(op)s$/i,
          to: '$1',
        },
        {
          reg: /([eirs])ts$/i,
          to: '$1t',
        },
        {
          reg: /(ll)s$/i,
          to: '$1',
        },
        {
          reg: /(el)s$/i,
          to: '$1',
        },
        {
          reg: /(ip)es$/i,
          to: '$1e',
        },
        {
          reg: /ss$/i,
          to: 'ss',
        },
        {
          reg: /s$/i,
          to: '',
        },
      ],

      Gerund: [
        {
          //popping -> pop
          reg: /(..)(p|d|t|g){2}ing$/i,
          to: '$1$2',
        },
        {
          //fuzzing -> fuzz
          reg: /(ll|ss|zz)ing$/i,
          to: '$1',
        },
        {
          reg: /([^aeiou])ying$/i,
          to: '$1y',
        },
        {
          reg: /([^ae]i.)ing$/i,
          to: '$1e',
        },
        {
          //eating, reading
          reg: /(ea[dklnrtv])ing$/i,
          to: '$1',
        },
        {
          //washing -> wash
          reg: /(ch|sh)ing$/i,
          to: '$1',
        },
        //soft-e forms:
        {
          //z : hazing (not buzzing)
          reg: /(z)ing$/i,
          to: '$1e',
        },
        {
          //a : baking, undulating
          reg: /(a[gdkvtc])ing$/i,
          to: '$1e',
        },
        {
          //u : conjuring, tubing
          reg: /(u[rtcbn])ing$/i,
          to: '$1e',
        },
        {
          //o : forboding, poking, hoping, boring (not hooping)
          reg: /([^o]o[bdknprv])ing$/i,
          to: '$1e',
        },
        {
          //ling : tingling, wrinkling, circling, scrambling, bustling
          reg: /([tbckg]l)ing$/i, //dp
          to: '$1e',
        },
        {
          //cing : bouncing, denouncing
          reg: /(c|s)ing$/i, //dp
          to: '$1e',
        },

        // {
        //   //soft-e :
        //   reg: /([ua]s|[dr]g|z|o[rlsp]|cre)ing$/i,
        //   to: '$1e',
        // },
        {
          //fallback
          reg: /(..)ing$/i,
          to: '$1',
        },
      ],

      PastTense: [
        {
          reg: /(ued)$/i,
          to: 'ue',
        },
        {
          reg: /a([^aeiouy])ed$/i,
          to: 'a$1e',
        },
        {
          reg: /([aeiou]zz)ed$/i,
          to: '$1',
        },
        {
          reg: /(e|i)lled$/i,
          to: '$1ll',
        },
        {
          reg: /(.)(sh|ch)ed$/i,
          to: '$1$2',
        },
        {
          reg: /(tl|gl)ed$/i,
          to: '$1e',
        },
        {
          reg: /(um?pt?)ed$/i,
          to: '$1',
        },
        {
          reg: /(ss)ed$/i,
          to: '$1',
        },
        {
          reg: /pped$/i,
          to: 'p',
        },
        {
          reg: /tted$/i,
          to: 't',
        },
        {
          reg: /(..)gged$/i,
          to: '$1g',
        },
        {
          reg: /(..)lked$/i,
          to: '$1lk',
        },
        {
          reg: /([^aeiouy][aeiou])ked$/i,
          to: '$1ke',
        },
        {
          reg: /(.[aeiou])led$/i,
          to: '$1l',
        },
        {
          reg: /(..)(h|ion|n[dt]|ai.|[cs]t|pp|all|ss|tt|int|ail|ld|en|oo.|er|k|pp|w|ou.|rt|ght|rm)ed$/i,
          to: '$1$2',
        },
        {
          reg: /(.ut)ed$/i,
          to: '$1e',
        },
        {
          reg: /(.pt)ed$/i,
          to: '$1',
        },
        {
          reg: /(us)ed$/i,
          to: '$1e',
        },
        {
          reg: /(dd)ed$/i,
          to: '$1',
        },
        {
          reg: /(..[^aeiouy])ed$/i,
          to: '$1e',
        },
        {
          reg: /(..)ied$/i,
          to: '$1y',
        },
        {
          reg: /(.o)ed$/i,
          to: '$1o',
        },
        {
          reg: /(..i)ed$/i,
          to: '$1',
        },
        {
          reg: /(.a[^aeiou])ed$/i,
          to: '$1',
        },
        {
          //owed, aced
          reg: /([aeiou][^aeiou])ed$/i,
          to: '$1e',
        },
        {
          reg: /([rl])ew$/i,
          to: '$1ow',
        },
        {
          reg: /([pl])t$/i,
          to: '$1t',
        },
      ],
    };
    var _transform = rules;

    let guessVerb = {
      Gerund: ['ing'],
      Actor: ['erer'],
      Infinitive: [
        'ate',
        'ize',
        'tion',
        'rify',
        'then',
        'ress',
        'ify',
        'age',
        'nce',
        'ect',
        'ise',
        'ine',
        'ish',
        'ace',
        'ash',
        'ure',
        'tch',
        'end',
        'ack',
        'and',
        'ute',
        'ade',
        'ock',
        'ite',
        'ase',
        'ose',
        'use',
        'ive',
        'int',
        'nge',
        'lay',
        'est',
        'ain',
        'ant',
        'ent',
        'eed',
        'er',
        'le',
        'own',
        'unk',
        'ung',
        'en',
      ],
      PastTense: ['ed', 'lt', 'nt', 'pt', 'ew', 'ld'],
      PresentTense: [
        'rks',
        'cks',
        'nks',
        'ngs',
        'mps',
        'tes',
        'zes',
        'ers',
        'les',
        'acks',
        'ends',
        'ands',
        'ocks',
        'lays',
        'eads',
        'lls',
        'els',
        'ils',
        'ows',
        'nds',
        'ays',
        'ams',
        'ars',
        'ops',
        'ffs',
        'als',
        'urs',
        'lds',
        'ews',
        'ips',
        'es',
        'ts',
        'ns',
      ],
    };
    //flip it into a lookup object
    guessVerb = Object.keys(guessVerb).reduce((h, k) => {
      guessVerb[k].forEach(a => (h[a] = k));
      return h
    }, {});
    var _guess = guessVerb;

    /** it helps to know what we're conjugating from */
    const guessTense = function (str) {
      let three = str.substr(str.length - 3);
      if (_guess.hasOwnProperty(three) === true) {
        return _guess[three]
      }
      let two = str.substr(str.length - 2);
      if (_guess.hasOwnProperty(two) === true) {
        return _guess[two]
      }
      let one = str.substr(str.length - 1);
      if (one === 's') {
        return 'PresentTense'
      }
      return null
    };

    const toInfinitive = function (str, world, tense) {
      if (!str) {
        return ''
      }
      //1. look at known irregulars
      if (world.words.hasOwnProperty(str) === true) {
        let irregs = world.irregulars.verbs;
        let keys = Object.keys(irregs);
        for (let i = 0; i < keys.length; i++) {
          let forms = Object.keys(irregs[keys[i]]);
          for (let o = 0; o < forms.length; o++) {
            if (str === irregs[keys[i]][forms[o]]) {
              return keys[i]
            }
          }
        }
      }

      // give'r!
      tense = tense || guessTense(str);
      if (tense && _transform[tense]) {
        for (let i = 0; i < _transform[tense].length; i++) {
          const rule = _transform[tense][i];
          if (rule.reg.test(str) === true) {
            // console.log(rule.reg)
            return str.replace(rule.reg, rule.to)
          }
        }
      }
      return str
    };
    var toInfinitive_1 = toInfinitive;

    //these let users change inflection / verb conjugation
    const irregulars$2 = {
      nouns: plurals,
      verbs: conjugations_1,
    };

    //these behaviours are configurable & shared across some plugins
    const transforms$2 = {
      conjugate: conjugate_1,
      adjectives: adjectives,
      toPlural: toPlural,
      toSingular: toSingular_1,
      toInfinitive: toInfinitive_1,
    };

    let isVerbose = false;

    /** all configurable linguistic data */
    class World {
      constructor() {
        // quiet these properties from a console.log
        Object.defineProperty(this, 'words', {
          enumerable: false,
          value: misc$1,
          writable: true,
        });
        Object.defineProperty(this, 'hasCompound', {
          enumerable: false,
          value: {},
          writable: true,
        });
        Object.defineProperty(this, 'irregulars', {
          enumerable: false,
          value: irregulars$2,
          writable: true,
        });
        Object.defineProperty(this, 'tags', {
          enumerable: false,
          value: Object.assign({}, tags),
          writable: true,
        });
        Object.defineProperty(this, 'transforms', {
          enumerable: false,
          value: transforms$2,
          writable: true,
        });

        Object.defineProperty(this, 'taggers', {
          enumerable: false,
          value: [],
          writable: true,
        });
        // add our compressed data to lexicon
        this.unpackWords(_data);
        // add our irregulars to lexicon
        this.addIrregulars();

        // cache our abbreviations for our sentence-parser
        Object.defineProperty(this, 'cache', {
          enumerable: false,
          value: {
            abbreviations: this.getByTag('Abbreviation'),
          },
        });
      }

      /** more logs for debugging */
      verbose(bool) {
        isVerbose = bool;
        return this
      }
      isVerbose() {
        return isVerbose
      }

      /** get all terms in our lexicon with this tag */
      getByTag(tag) {
        let lex = this.words;
        let res = {};
        let words = Object.keys(lex);
        for (let i = 0; i < words.length; i++) {
          if (typeof lex[words[i]] === 'string') {
            if (lex[words[i]] === tag) {
              res[words[i]] = true;
            }
          } else if (lex[words[i]].some(t => t === tag)) {
            res[words[i]] = true;
          }
        }
        return res
      }

      /** augment our lingustic data with new data */
      unpackWords(lex) {
        let tags = Object.keys(lex);
        for (let i = 0; i < tags.length; i++) {
          let words = Object.keys(efrtUnpack_min(lex[tags[i]]));
          for (let w = 0; w < words.length; w++) {
            addWords.addWord(words[w], tags[i], this.words);
            // do some fancier stuff
            addWords.addMore(words[w], tags[i], this);
          }
        }
      }
      /** put new words into our lexicon, properly */
      addWords(obj) {
        let keys = Object.keys(obj);
        for (let i = 0; i < keys.length; i++) {
          let word = keys[i].toLowerCase();
          addWords.addWord(word, obj[keys[i]], this.words);
          // do some fancier stuff
          addWords.addMore(word, obj[keys[i]], this);
        }
      }

      addIrregulars() {
        addIrregulars_1(this);
        return this
      }

      /** extend the compromise tagset */
      addTags(tags) {
        tags = Object.assign({}, tags);
        this.tags = Object.assign(this.tags, tags);
        // calculate graph implications for the new tags
        this.tags = inference(this.tags);
        return this
      }
      /** call methods after tagger runs */
      postProcess(fn) {
        this.taggers.push(fn);
        return this
      }

      /** helper method for logging + debugging */
      stats() {
        return {
          words: Object.keys(this.words).length,
          plurals: Object.keys(this.irregulars.nouns).length,
          conjugations: Object.keys(this.irregulars.verbs).length,
          compounds: Object.keys(this.hasCompound).length,
          postProcessors: this.taggers.length,
        }
      }
    }

    //  ¯\_(:/)_/¯
    const clone$1 = function(obj) {
      return JSON.parse(JSON.stringify(obj))
    };

    /** produce a deep-copy of all lingustic data */
    World.prototype.clone = function() {
      let w2 = new World();
      // these are simple to copy:
      w2.words = Object.assign({}, this.words);
      w2.hasCompound = Object.assign({}, this.hasCompound);
      //these ones are nested:
      w2.irregulars = clone$1(this.irregulars);
      w2.tags = clone$1(this.tags);
      // these are functions
      w2.transforms = this.transforms;
      w2.taggers = this.taggers;
      return w2
    };
    var World_1 = World;

    var _01Utils$1 = createCommonjsModule(function (module, exports) {
    /** return the root, first document */
    exports.all = function () {
      return this.parents()[0] || this
    };

    /** return the previous result */
    exports.parent = function () {
      if (this.from) {
        return this.from
      }
      return this
    };

    /**  return a list of all previous results */
    exports.parents = function (n) {
      let arr = [];
      const addParent = function (doc) {
        if (doc.from) {
          arr.push(doc.from);
          addParent(doc.from);
        }
      };
      addParent(this);
      arr = arr.reverse();
      if (typeof n === 'number') {
        return arr[n]
      }
      return arr
    };

    /** deep-copy the document, so that no references remain */
    exports.clone = function (doShallow) {
      let list = this.list.map(ts => ts.clone(doShallow));
      let tmp = this.buildFrom(list);
      return tmp
    };

    /** how many seperate terms does the document have? */
    exports.wordCount = function () {
      return this.list.reduce((count, p) => {
        count += p.wordCount();
        return count
      }, 0)
    };
    exports.wordcount = exports.wordCount;

    /** turn on logging for decision-debugging */
    // exports.verbose = function(bool) {
    //   if (bool === undefined) {
    //     bool = true
    //   }
    //   this.world.verbose = bool
    // }
    });
    var _01Utils_1 = _01Utils$1.all;
    var _01Utils_2 = _01Utils$1.parent;
    var _01Utils_3 = _01Utils$1.parents;
    var _01Utils_4 = _01Utils$1.clone;
    var _01Utils_5 = _01Utils$1.wordCount;
    var _01Utils_6 = _01Utils$1.wordcount;

    var _02Accessors = createCommonjsModule(function (module, exports) {
    /** use only the first result(s) */
    exports.first = function(n) {
      if (n === undefined) {
        return this.get(0)
      }
      return this.slice(0, n)
    };

    /** use only the last result(s) */
    exports.last = function(n) {
      if (n === undefined) {
        return this.get(this.list.length - 1)
      }
      let end = this.list.length;
      return this.slice(end - n, end)
    };

    /** grab a given subset of the results*/
    exports.slice = function(start, end) {
      let list = this.list.slice(start, end);
      return this.buildFrom(list)
    };

    /* grab nth result */
    exports.eq = function(n) {
      let p = this.list[n];
      if (p === undefined) {
        return this.buildFrom([])
      }
      return this.buildFrom([p])
    };
    exports.get = exports.eq;

    /** grab term[0] for every match */
    exports.firstTerms = function() {
      return this.match('^.')
    };
    exports.firstTerm = exports.firstTerms;

    /** grab the last term for every match  */
    exports.lastTerms = function() {
      return this.match('.$')
    };
    exports.lastTerm = exports.lastTerms;

    /** return a flat array of term objects */
    exports.termList = function(num) {
      let arr = [];
      //'reduce' but faster
      for (let i = 0; i < this.list.length; i++) {
        let terms = this.list[i].terms();
        for (let o = 0; o < terms.length; o++) {
          arr.push(terms[o]);
          //support .termList(4)
          if (num !== undefined && arr[num] !== undefined) {
            return arr[num]
          }
        }
      }
      return arr
    };

    /* grab named capture group terms as object */
    const getGroups = function(doc) {
      let res = {};
      const allGroups = {};
      for (let i = 0; i < doc.list.length; i++) {
        const phrase = doc.list[i];
        const groups = Object.keys(phrase.groups).map(k => phrase.groups[k]);
        for (let j = 0; j < groups.length; j++) {
          const { group, start, length } = groups[j];

          if (!allGroups[group]) {
            allGroups[group] = [];
          }
          allGroups[group].push(phrase.buildFrom(start, length));
        }
      }
      const keys = Object.keys(allGroups);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        res[key] = doc.buildFrom(allGroups[key]);
      }
      return res
    };

    const getOneName = function(doc, name) {
      const arr = [];
      for (let i = 0; i < doc.list.length; i++) {
        const phrase = doc.list[i];
        let keys = Object.keys(phrase.groups);
        keys = keys.filter(id => phrase.groups[id].group === name);
        keys.forEach(id => {
          arr.push(phrase.buildFrom(phrase.groups[id].start, phrase.groups[id].length));
        });
      }
      return doc.buildFrom(arr)
    };

    /** grab named capture group results */
    exports.groups = function(target) {
      if (target === undefined) {
        return getGroups(this)
      }
      if (typeof target === 'number') {
        target = String(target);
      }
      return getOneName(this, target) || this.buildFrom([])
    };
    exports.group = exports.groups;

    /** get the full-sentence each phrase belongs to */
    exports.sentences = function(n) {
      let arr = [];
      this.list.forEach(p => {
        arr.push(p.fullSentence());
      });
      if (typeof n === 'number') {
        return this.buildFrom([arr[n]])
      }
      return this.buildFrom(arr)
    };
    exports.sentence = exports.sentences;
    });
    var _02Accessors_1 = _02Accessors.first;
    var _02Accessors_2 = _02Accessors.last;
    var _02Accessors_3 = _02Accessors.slice;
    var _02Accessors_4 = _02Accessors.eq;
    var _02Accessors_5 = _02Accessors.get;
    var _02Accessors_6 = _02Accessors.firstTerms;
    var _02Accessors_7 = _02Accessors.firstTerm;
    var _02Accessors_8 = _02Accessors.lastTerms;
    var _02Accessors_9 = _02Accessors.lastTerm;
    var _02Accessors_10 = _02Accessors.termList;
    var _02Accessors_11 = _02Accessors.groups;
    var _02Accessors_12 = _02Accessors.group;
    var _02Accessors_13 = _02Accessors.sentences;
    var _02Accessors_14 = _02Accessors.sentence;

    // cache the easier conditions up-front
    const cacheRequired = function(reg) {
      let needTags = [];
      let needWords = [];
      reg.forEach(obj => {
        if (obj.optional === true || obj.negative === true) {
          return
        }
        if (obj.tag !== undefined) {
          needTags.push(obj.tag);
        }
        if (obj.word !== undefined) {
          needWords.push(obj.word);
        }
      });
      return { tags: needTags, words: needWords }
    };

    const failFast$1 = function(doc, regs) {
      if (doc._cache && doc._cache.set === true) {
        let { words, tags } = cacheRequired(regs);
        //check required words
        for (let i = 0; i < words.length; i++) {
          if (doc._cache.words[words[i]] === undefined) {
            return false
          }
        }
        //check required tags
        for (let i = 0; i < tags.length; i++) {
          if (doc._cache.tags[tags[i]] === undefined) {
            return false
          }
        }
      }
      return true
    };
    var checkCache = failFast$1;

    var _03Match = createCommonjsModule(function (module, exports) {
    /** return a new Doc, with this one as a parent */
    exports.match = function(reg, name) {
      //parse-up the input expression
      let regs = syntax_1(reg);
      if (regs.length === 0) {
        return this.buildFrom([])
      }
      //check our cache, if it exists
      if (checkCache(this, regs) === false) {
        return this.buildFrom([])
      }
      //try expression on each phrase
      let matches = this.list.reduce((arr, p) => {
        return arr.concat(p.match(regs))
      }, []);

      if (name !== undefined && name !== null && name !== '') {
        return this.buildFrom(matches).groups(name)
      }
      return this.buildFrom(matches)
    };

    /** return all results except for this */
    exports.not = function(reg) {
      //parse-up the input expression
      let regs = syntax_1(reg);
      //if it's empty, return them all!
      if (regs.length === 0 || checkCache(this, regs) === false) {
        return this
      }
      //try expression on each phrase
      let matches = this.list.reduce((arr, p) => {
        return arr.concat(p.not(regs))
      }, []);
      return this.buildFrom(matches)
    };

    /** return only the first match */
    exports.matchOne = function(reg) {
      let regs = syntax_1(reg);
      //check our cache, if it exists
      if (checkCache(this, regs) === false) {
        return this.buildFrom([])
      }
      for (let i = 0; i < this.list.length; i++) {
        let match = this.list[i].match(regs, true);
        return this.buildFrom(match)
      }
      return this.buildFrom([])
    };

    /** return each current phrase, only if it contains this match */
    exports.if = function(reg) {
      let regs = syntax_1(reg);
      //consult our cache, if it exists
      if (checkCache(this, regs) === false) {
        return this.buildFrom([])
      }
      let found = this.list.filter(p => p.has(regs) === true);
      return this.buildFrom(found)
    };

    /** Filter-out any current phrases that have this match*/
    exports.ifNo = function(reg) {
      let regs = syntax_1(reg);
      let found = this.list.filter(p => p.has(regs) === false);
      return this.buildFrom(found)
    };

    /**Return a boolean if this match exists */
    exports.has = function(reg) {
      let regs = syntax_1(reg);
      //consult our cache, if it exists
      if (checkCache(this, regs) === false) {
        return false
      }
      return this.list.some(p => p.has(regs) === true)
    };

    /** match any terms after our matches, within the sentence */
    exports.lookAhead = function(reg) {
      // find everything afterwards, by default
      if (!reg) {
        reg = '.*';
      }
      let regs = syntax_1(reg);
      let matches = [];
      this.list.forEach(p => {
        matches = matches.concat(p.lookAhead(regs));
      });
      matches = matches.filter(p => p);
      return this.buildFrom(matches)
    };
    exports.lookAfter = exports.lookAhead;

    /** match any terms before our matches, within the sentence */
    exports.lookBehind = function(reg) {
      // find everything afterwards, by default
      if (!reg) {
        reg = '.*';
      }
      let regs = syntax_1(reg);
      let matches = [];
      this.list.forEach(p => {
        matches = matches.concat(p.lookBehind(regs));
      });
      matches = matches.filter(p => p);
      return this.buildFrom(matches)
    };
    exports.lookBefore = exports.lookBehind;

    /** return all terms before a match, in each phrase */
    exports.before = function(reg) {
      let regs = syntax_1(reg);
      //only the phrases we care about
      let phrases = this.if(regs).list;
      let befores = phrases.map(p => {
        let ids = p.terms().map(t => t.id);
        //run the search again
        let m = p.match(regs)[0];
        let index = ids.indexOf(m.start);
        //nothing is before a first-term match
        if (index === 0 || index === -1) {
          return null
        }
        return p.buildFrom(p.start, index)
      });
      befores = befores.filter(p => p !== null);
      return this.buildFrom(befores)
    };

    /** return all terms after a match, in each phrase */
    exports.after = function(reg) {
      let regs = syntax_1(reg);
      //only the phrases we care about
      let phrases = this.if(regs).list;
      let befores = phrases.map(p => {
        let terms = p.terms();
        let ids = terms.map(t => t.id);
        //run the search again
        let m = p.match(regs)[0];
        let index = ids.indexOf(m.start);
        //skip if nothing is after it
        if (index === -1 || !terms[index + m.length]) {
          return null
        }
        //create the new phrase, after our match.
        let id = terms[index + m.length].id;
        let len = p.length - index - m.length;
        return p.buildFrom(id, len)
      });
      befores = befores.filter(p => p !== null);
      return this.buildFrom(befores)
    };

    /** return only results with this match afterwards */
    exports.hasAfter = function(reg) {
      return this.filter(doc => {
        return doc.lookAfter(reg).found
      })
    };
    /** return only results with this match before it */
    exports.hasBefore = function(reg) {
      return this.filter(doc => {
        return doc.lookBefore(reg).found
      })
    };
    });
    var _03Match_1 = _03Match.match;
    var _03Match_2 = _03Match.not;
    var _03Match_3 = _03Match.matchOne;
    var _03Match_4 = _03Match.ifNo;
    var _03Match_5 = _03Match.has;
    var _03Match_6 = _03Match.lookAhead;
    var _03Match_7 = _03Match.lookAfter;
    var _03Match_8 = _03Match.lookBehind;
    var _03Match_9 = _03Match.lookBefore;
    var _03Match_10 = _03Match.before;
    var _03Match_11 = _03Match.after;
    var _03Match_12 = _03Match.hasAfter;
    var _03Match_13 = _03Match.hasBefore;

    /** apply a tag, or tags to all terms */
    const tagTerms = function(tag, doc, safe, reason) {
      let tagList = [];
      if (typeof tag === 'string') {
        tagList = tag.split(' ');
      }

      //do indepenent tags for each term:
      doc.list.forEach(p => {
        let terms = p.terms();
        // tagSafe - apply only to fitting terms
        if (safe === true) {
          terms = terms.filter(t => t.canBe(tag, doc.world));
        }
        terms.forEach((t, i) => {
          //fancy version:
          if (tagList.length > 1) {
            if (tagList[i] && tagList[i] !== '.') {
              t.tag(tagList[i], reason, doc.world);
            }
          } else {
            //non-fancy version (same tag for all terms)
            t.tag(tag, reason, doc.world);
          }
        });
      });
      return
    };
    var _setTag = tagTerms;

    /** Give all terms the given tag */
    var tag$1 = function(tags, why) {
      if (!tags) {
        return this
      }
      _setTag(tags, this, false, why);
      return this
    };

    /** Only apply tag to terms if it is consistent with current tags */
    var tagSafe$1 = function(tags, why) {
      if (!tags) {
        return this
      }
      _setTag(tags, this, true, why);
      return this
    };

    /** Remove this term from the given terms */
    var unTag$1 = function(tags, why) {
      this.list.forEach(p => {
        p.terms().forEach(t => t.unTag(tags, why, this.world));
      });
      return this
    };

    /** return only the terms that can be this tag*/
    var canBe$2 = function(tag) {
      if (!tag) {
        return this
      }
      let world = this.world;
      let matches = this.list.reduce((arr, p) => {
        return arr.concat(p.canBe(tag, world))
      }, []);
      return this.buildFrom(matches)
    };

    var _04Tag = {
    	tag: tag$1,
    	tagSafe: tagSafe$1,
    	unTag: unTag$1,
    	canBe: canBe$2
    };

    /* run each phrase through a function, and create a new document */
    var map = function(fn) {
      if (!fn) {
        return this
      }
      let list = this.list.map((p, i) => {
        let doc = this.buildFrom([p]);
        doc.from = null; //it's not a child/parent
        let res = fn(doc, i);
        // if its a doc, return one result
        if (res && res.list && res.list[0]) {
          return res.list[0]
        }
        return res
      });
      //remove nulls
      list = list.filter(x => x);
      // return an empty response
      if (list.length === 0) {
        return this.buildFrom(list)
      }
      // if it is not a list of Phrase objects, then don't try to make a Doc object
      if (typeof list[0] !== 'object' || list[0].isA !== 'Phrase') {
        return list
      }
      return this.buildFrom(list)
    };

    /** run a function on each phrase */
    var forEach = function(fn, detachParent) {
      if (!fn) {
        return this
      }
      this.list.forEach((p, i) => {
        let sub = this.buildFrom([p]);
        // if we're doing fancy insertions, we may want to skip updating the parent each time.
        if (detachParent === true) {
          sub.from = null; //
        }
        fn(sub, i);
      });
      return this
    };

    /** return only the phrases that return true */
    var filter = function(fn) {
      if (!fn) {
        return this
      }
      let list = this.list.filter((p, i) => {
        let doc = this.buildFrom([p]);
        doc.from = null; //it's not a child/parent
        return fn(doc, i)
      });
      return this.buildFrom(list)
    };

    /** return a document with only the first phrase that matches */
    var find = function(fn) {
      if (!fn) {
        return this
      }
      let phrase = this.list.find((p, i) => {
        let doc = this.buildFrom([p]);
        doc.from = null; //it's not a child/parent
        return fn(doc, i)
      });
      if (phrase) {
        return this.buildFrom([phrase])
      }
      return undefined
    };

    /** return true or false if there is one matching phrase */
    var some = function(fn) {
      if (!fn) {
        return this
      }
      return this.list.some((p, i) => {
        let doc = this.buildFrom([p]);
        doc.from = null; //it's not a child/parent
        return fn(doc, i)
      })
    };

    /** sample a subset of the results */
    var random = function(n) {
      if (!this.found) {
        return this
      }
      let r = Math.floor(Math.random() * this.list.length);
      if (n === undefined) {
        let list = [this.list[r]];
        return this.buildFrom(list)
      }
      //prevent it from going over the end
      if (r + n > this.length) {
        r = this.length - n;
        r = r < 0 ? 0 : r;
      }
      return this.slice(r, r + n)
    };

    /** combine each phrase into a new data-structure */
    // exports.reduce = function(fn, h) {
    //   let list = this.list.reduce((_h, ts) => {
    //     let doc = this.buildFrom([ts])
    //     doc.from = null //it's not a child/parent
    //     return fn(_h, doc)
    //   }, h)
    //   return this.buildFrom(list)
    // }

    var _05Loops = {
    	map: map,
    	forEach: forEach,
    	filter: filter,
    	find: find,
    	some: some,
    	random: random
    };

    // const tokenize = require('../../01-tokenizer/02-words')
    const tokenize = function(str) {
      return str.split(/[ -]/g)
    };
    // take a list of strings
    // look them up in the document
    const buildTree = function(termList, values = []) {
      let root = {};
      // parse our input
      termList.forEach((str, i) => {
        let val = true;
        if (values[i] !== undefined) {
          val = values[i];
        }
        // some rough normalization
        str = (str || '').toLowerCase();
        str = str.replace(/[,;.!?]+$/, '');
        let arr = tokenize(str).map(s => s.trim());
        root[arr[0]] = root[arr[0]] || {};
        if (arr.length === 1) {
          root[arr[0]].value = val;
        } else {
          root[arr[0]].more = root[arr[0]].more || [];
          root[arr[0]].more.push({
            rest: arr.slice(1),
            value: val,
          });
        }
      });
      // sort by longest-first?
      // console.log(JSON.stringify(root, null, 2))
      return root
    };

    const fastLookup = function(termList, values, doc) {
      let root = buildTree(termList, values);
      let found = [];
      // each phrase
      for (let i = 0; i < doc.list.length; i++) {
        const p = doc.list[i];
        let terms = p.terms();

        let words = terms.map(t => t.reduced);
        // each word
        for (let w = 0; w < words.length; w++) {
          if (root[words[w]] !== undefined) {
            // is it a multi-word match?
            if (root[words[w]].more !== undefined) {
              root[words[w]].more.forEach(more => {
                // is it too-long?
                if (words[w + more.rest.length] === undefined) {
                  return
                }
                // compare each subsequent term
                let everyTerm = more.rest.every((word, r) => {
                  return word === words[w + r + 1]
                });
                if (everyTerm === true) {
                  found.push({ id: p.terms()[w].id, value: more.value, length: more.rest.length + 1 });
                }
              });
            }
            // is it a single-word match?
            if (root[words[w]].value !== undefined) {
              found.push({ id: p.terms()[w].id, value: root[words[w]].value, length: 1 });
            }
          }
        }
      }
      return found
    };
    var _lookup = fastLookup;

    var _06Lookup = createCommonjsModule(function (module, exports) {
    // compare one term and one match
    // const doesMatch = function(term, str) {
    //   if (str === '') {
    //     return false
    //   }
    //   return term.reduced === str || term.implicit === str || term.root === str || term.text.toLowerCase() === str
    // }

    const isObject = function(obj) {
      return obj && Object.prototype.toString.call(obj) === '[object Object]'
    };

    /** lookup an array of words or phrases */
    exports.lookup = function(arr) {
      let values = [];
      //is it a {key:val} object?
      let isObj = isObject(arr);
      if (isObj === true) {
        arr = Object.keys(arr).map(k => {
          values.push(arr[k]);
          return k
        });
      }
      // support .lookup('foo')
      if (typeof arr === 'string') {
        arr = [arr];
      }

      //make sure we go fast.
      if (this._cache.set !== true) {
        this.cache();
      }

      let found = _lookup(arr, values, this);
      let p = this.list[0];
      // make object response
      if (isObj === true) {
        let byVal = {};
        found.forEach(o => {
          byVal[o.value] = byVal[o.value] || [];
          byVal[o.value].push(p.buildFrom(o.id, o.length));
        });
        Object.keys(byVal).forEach(k => {
          byVal[k] = this.buildFrom(byVal[k]);
        });
        return byVal
      }
      // otherwise, make array response:
      found = found.map(o => p.buildFrom(o.id, o.length));
      return this.buildFrom(found)
    };
    exports.lookUp = exports.lookup;
    });
    var _06Lookup_1 = _06Lookup.lookup;
    var _06Lookup_2 = _06Lookup.lookUp;

    /** freeze the current state of the document, for speed-purposes*/
    var cache$1 = function(options) {
      options = options || {};
      let words = {};
      let tags = {};
      this._cache.words = words;
      this._cache.tags = tags;
      this._cache.set = true;
      this.list.forEach((p, i) => {
        p.cache = p.cache || {};
        //p.terms get cached automatically
        let terms = p.terms();
        // cache all the terms
        terms.forEach(t => {
          if (words[t.reduced] && !words.hasOwnProperty(t.reduced)) {
            return //skip prototype words
          }
          words[t.reduced] = words[t.reduced] || [];
          words[t.reduced].push(i);

          Object.keys(t.tags).forEach(tag => {
            tags[tag] = tags[tag] || [];
            tags[tag].push(i);
          });

          // cache root-form on Term, too
          if (options.root) {
            t.setRoot(this.world);
            words[t.root] = true;
          }
        });
      });
      return this
    };

    /** un-freezes the current state of the document, so it may be transformed */
    var uncache = function() {
      this._cache = {};
      this.list.forEach(p => {
        p.cache = {};
      });
      // do parents too?
      this.parents().forEach(doc => {
        doc._cache = {};
        doc.list.forEach(p => {
          p.cache = {};
        });
      });
      return this
    };

    var _07Cache = {
    	cache: cache$1,
    	uncache: uncache
    };

    const titleCase$3 = str => {
      return str.charAt(0).toUpperCase() + str.substr(1)
    };

    /** substitute-in new content */
    var replaceWith = function (replace, options = {}) {
      if (!replace) {
        return this.delete()
      }
      //support old-style params
      if (options === true) {
        options = { keepTags: true };
      }
      if (options === false) {
        options = { keepTags: false };
      }
      options = options || {};

      // clear the cache
      this.uncache();
      // return this
      this.list.forEach(p => {
        let input = replace;
        // accept a function for replace
        if (typeof replace === 'function') {
          input = replace(p);
        }
        let newPhrases;
        // accept a Doc object to replace
        if (input && typeof input === 'object' && input.isA === 'Doc') {
          newPhrases = input.list;
          this.pool().merge(input.pool());
        } else if (typeof input === 'string') {
          //input is a string
          if (options.keepCase !== false && p.terms(0).isTitleCase()) {
            input = titleCase$3(input);
          }
          newPhrases = _01Tokenizer(input, this.world, this.pool());
          //tag the new phrases
          let tmpDoc = this.buildFrom(newPhrases);
          tmpDoc.tagger();
          newPhrases = tmpDoc.list;
        } else {
          return //don't even bother
        }

        // try to keep its old tags, if appropriate
        if (options.keepTags === true) {
          let oldTags = p.json({ terms: { tags: true } }).terms;
          newPhrases[0].terms().forEach((t, i) => {
            if (oldTags[i]) {
              t.tagSafe(oldTags[i].tags, 'keptTag', this.world);
            }
          });
        }
        p.replace(newPhrases[0], this); //Oneday: support multi-sentence replacements
      });
      return this
    };

    /** search and replace match with new content */
    var replace$1 = function (match, replace, options) {
      // if there's no 2nd param, use replaceWith
      if (replace === undefined) {
        return this.replaceWith(match, options)
      }
      this.match(match).replaceWith(replace, options);
      return this
    };

    var _01Replace = {
    	replaceWith: replaceWith,
    	replace: replace$1
    };

    var _02Insert = createCommonjsModule(function (module, exports) {
    // if it's empty, just create the phrase
    const makeNew = function (str, doc) {
      let phrase = _01Tokenizer(str, doc.world)[0]; //assume it's one sentence, for now
      let tmpDoc = doc.buildFrom([phrase]);
      tmpDoc.tagger();
      doc.list = tmpDoc.list;
      return doc
    };

    /** add these new terms to the end*/
    exports.append = function (str) {
      if (!str) {
        return this
      }
      // if it's empty, just create the phrase
      if (!this.found) {
        return makeNew(str, this)
      }
      // clear the cache
      this.uncache();
      //add it to end of every phrase
      this.list.forEach(p => {
        //build it
        let phrase = _01Tokenizer(str, this.world, this.pool())[0]; //assume it's one sentence, for now
        //tag it
        let tmpDoc = this.buildFrom([phrase]);
        tmpDoc.tagger();
        // push it onto the end
        p.append(phrase, this);
      });
      return this
    };
    exports.insertAfter = exports.append;
    exports.insertAt = exports.append;

    /** add these new terms to the front*/
    exports.prepend = function (str) {
      if (!str) {
        return this
      }
      // if it's empty, just create the phrase
      if (!this.found) {
        return makeNew(str, this)
      }
      // clear the cache
      this.uncache();
      //add it to start of every phrase
      this.list.forEach(p => {
        //build it
        let phrase = _01Tokenizer(str, this.world, this.pool())[0]; //assume it's one sentence, for now
        //tag it
        let tmpDoc = this.buildFrom([phrase]);
        tmpDoc.tagger();
        // add it to the start
        p.prepend(phrase, this);
      });
      return this
    };
    exports.insertBefore = exports.prepend;

    /** add these new things to the end*/
    exports.concat = function () {
      // clear the cache
      this.uncache();
      let list = this.list.slice(0);
      //repeat for any number of params
      for (let i = 0; i < arguments.length; i++) {
        let arg = arguments[i];
        //support a fresh string
        if (typeof arg === 'string') {
          let arr = _01Tokenizer(arg, this.world);
          //TODO: phrase.tagger()?
          list = list.concat(arr);
        } else if (arg.isA === 'Doc') {
          list = list.concat(arg.list);
        } else if (arg.isA === 'Phrase') {
          list.push(arg);
        }
      }
      return this.buildFrom(list)
    };

    /** fully remove these terms from the document */
    exports.delete = function (match) {
      // clear the cache
      this.uncache();
      let toRemove = this;
      if (match) {
        toRemove = this.match(match);
      }
      toRemove.list.forEach(phrase => phrase.delete(this));
      return this
    };
    // aliases
    exports.remove = exports.delete;
    });
    var _02Insert_1 = _02Insert.append;
    var _02Insert_2 = _02Insert.insertAfter;
    var _02Insert_3 = _02Insert.insertAt;
    var _02Insert_4 = _02Insert.prepend;
    var _02Insert_5 = _02Insert.insertBefore;
    var _02Insert_6 = _02Insert.concat;
    var _02Insert_7 = _02Insert.remove;

    const shouldTrim = {
      clean: true,
      reduced: true,
      root: true,
    };

    /** return the document as text */
    var text$3 = function(options) {
      options = options || {};
      //are we showing every phrase?
      let showFull = false;
      if (this.parents().length === 0) {
        showFull = true;
      }
      // cache roots, if necessary
      if (options === 'root' || (typeof options === 'object' && options.root)) {
        this.list.forEach(p => {
          p.terms().forEach(t => {
            if (t.root === null) {
              t.setRoot(this.world);
            }
          });
        });
      }

      let txt = this.list.reduce((str, p, i) => {
        const trimPre = !showFull && i === 0;
        const trimPost = !showFull && i === this.list.length - 1;
        return str + p.text(options, trimPre, trimPost)
      }, '');

      // clumsy final trim of leading/trailing whitespace
      if (shouldTrim[options] === true || options.reduced === true || options.clean === true || options.root === true) {
        txt = txt.trim();
      }
      return txt
    };

    var _01Text = {
    	text: text$3
    };

    // get all character startings in doc
    const termOffsets = function(doc) {
      let elapsed = 0;
      let index = 0;
      let offsets = {};
      doc.termList().forEach(term => {
        offsets[term.id] = {
          index: index,
          start: elapsed + term.pre.length,
          length: term.text.length,
        };
        elapsed += term.pre.length + term.text.length + term.post.length;
        index += 1;
      });
      return offsets
    };

    const calcOffset = function(doc, result, options) {
      // calculate offsets for each term
      let offsets = termOffsets(doc.all());
      // add index values
      if (options.terms.index || options.index) {
        result.forEach(o => {
          o.terms.forEach(t => {
            t.index = offsets[t.id].index;
          });
          o.index = o.terms[0].index;
        });
      }
      // add offset values
      if (options.terms.offset || options.offset) {
        result.forEach(o => {
          o.terms.forEach(t => {
            t.offset = offsets[t.id] || {};
          });
          // let len = o.terms.reduce((n, t, i) => {
          //   n += t.offset.length || 0
          //   //add whitespace, too
          //   console.log(t.post)
          //   return n
          // }, 0)

          // The offset information for the entire doc starts at (or just before)
          // the first term, and is as long as the whole text.  The code originally
          // copied the entire offset value from terms[0], but since we're now
          // overriding 2 of the three fields, it's cleaner to just create an all-
          // new object and not pretend it's "just" the same as terms[0].
          o.offset = {
            index: o.terms[0].offset.index,
            start: o.terms[0].offset.start - o.text.indexOf(o.terms[0].text),
            length: o.text.length
          };
        });
      }
    };
    var _offset = calcOffset;

    var _02Json = createCommonjsModule(function (module, exports) {
    const jsonDefaults = { text: true, terms: true, trim: true };

    //some options have dependents
    const setOptions = function(options) {
      options = Object.assign({}, jsonDefaults, options);

      if (options.unique) {
        options.reduced = true;
      }
      //offset calculation requires these options to be on
      if (options.offset) {
        options.text = true;
        if (!options.terms || options.terms === true) {
          options.terms = {};
        }
        options.terms.offset = true;
      }
      if (options.index || options.terms.index) {
        options.terms = options.terms === true ? {} : options.terms;
        options.terms.id = true;
      }
      return options
    };

    /** pull out desired metadata from the document */
    exports.json = function(options = {}) {
      //support json(3) format
      if (typeof options === 'number' && this.list[options]) {
        return this.list[options].json(jsonDefaults)
      }

      options = setOptions(options);

      // cache root strings beforehand, if necessary
      if (options.root === true) {
        this.list.forEach(p => {
          p.terms().forEach(t => {
            if (t.root === null) {
              t.setRoot(this.world);
            }
          });
        });
      }

      let result = this.list.map(p => {
        return p.json(options, this.world)
      });
      // add offset and index data for each term
      if (options.terms.offset || options.offset || options.terms.index || options.index) {
        _offset(this, result, options);
      }
      // add frequency #s
      if (options.frequency || options.freq || options.count) {
        let obj = {};
        this.list.forEach(p => {
          let str = p.text('reduced');
          obj[str] = obj[str] || 0;
          obj[str] += 1;
        });
        this.list.forEach((p, i) => {
          result[i].count = obj[p.text('reduced')];
        });
      }
      // remove duplicates
      if (options.unique) {
        let already = {};
        result = result.filter(o => {
          if (already[o.reduced] === true) {
            return false
          }
          already[o.reduced] = true;
          return true
        });
      }
      return result
    };

    //aliases
    exports.data = exports.json;
    });
    var _02Json_1 = _02Json.json;
    var _02Json_2 = _02Json.data;

    var _debug = createCommonjsModule(function (module) {
    // https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
    const reset = '\x1b[0m';

    const padEnd = function(str, width) {
      str = str.toString();
      while (str.length < width) {
        str += ' ';
      }
      return str
    };

    function isClientSide() {
      return typeof window !== 'undefined' && window.document
    }

    // some nice colors for client-side debug
    const css = {
      green: '#7f9c6c',
      red: '#914045',
      blue: '#6699cc',
      magenta: '#6D5685',
      cyan: '#2D85A8',
      yellow: '#e6d7b3',
      black: '#303b50',
    };

    const logClientSide = function(doc) {
      let tagset = doc.world.tags;
      doc.list.forEach(p => {
        console.log('\n%c"' + p.text() + '"', 'color: #e6d7b3;');
        let terms = p.terms();
        terms.forEach(t => {
          let tags = Object.keys(t.tags);
          let text = t.text || '-';
          if (t.implicit) {
            text = '[' + t.implicit + ']';
          }
          let word = "'" + text + "'";
          word = padEnd(word, 8);
          let found = tags.find(tag => tagset[tag] && tagset[tag].color);
          let color = 'steelblue';
          if (tagset[found]) {
            color = tagset[found].color;
            color = css[color];
          }
          console.log(`   ${word}  -  %c${tags.join(', ')}`, `color: ${color || 'steelblue'};`);
        });
      });
    };

    //cheaper than requiring chalk
    const cli = {
      green: function(str) {
        return '\x1b[32m' + str + reset
      },
      red: function(str) {
        return '\x1b[31m' + str + reset
      },
      blue: function(str) {
        return '\x1b[34m' + str + reset
      },
      magenta: function(str) {
        return '\x1b[35m' + str + reset
      },
      cyan: function(str) {
        return '\x1b[36m' + str + reset
      },
      yellow: function(str) {
        return '\x1b[33m' + str + reset
      },
      black: function(str) {
        return '\x1b[30m' + str + reset
      },
    };

    const tagString = function(tags, world) {
      tags = tags.map(tag => {
        if (!world.tags.hasOwnProperty(tag)) {
          return tag
        }
        const c = world.tags[tag].color || 'blue';
        return cli[c](tag)
      });
      return tags.join(', ')
    };

    //output some helpful stuff to the console
    const debug = function(doc) {
      if (isClientSide()) {
        logClientSide(doc);
        return doc
      }
      console.log(cli.blue('====='));
      doc.list.forEach(p => {
        console.log(cli.blue('  -----'));
        let terms = p.terms();
        terms.forEach(t => {
          let tags = Object.keys(t.tags);
          let text = t.text || '-';
          if (t.implicit) {
            text = '[' + t.implicit + ']';
          }
          {
            text = cli.yellow(text);
          }
          let word = "'" + text + "'";
          word = padEnd(word, 18);
          let str = cli.blue('  ｜ ') + word + '  - ' + tagString(tags, doc.world);
          console.log(str);
        });
      });
      console.log('');
      return doc
    };
    module.exports = debug;
    });

    const topk = function(doc) {
      let list = doc.json({ text: false, terms: false, reduced: true });
      // combine them
      let obj = {};
      list.forEach(o => {
        if (!obj[o.reduced]) {
          o.count = 0;
          obj[o.reduced] = o;
        }
        obj[o.reduced].count += 1;
      });
      let arr = Object.keys(obj).map(k => obj[k]);
      // sort them
      arr.sort((a, b) => {
        if (a.count > b.count) {
          return -1
        } else if (a.count < b.count) {
          return 1
        }
        return 0
      });
      return arr
    };
    var _topk = topk;

    /** pretty-print the current document and its tags */
    var debug_1 = function() {
      _debug(this);
      return this
    };

    /** some named output formats */
    var out = function(method) {
      if (method === 'text') {
        return this.text()
      }
      if (method === 'normal') {
        return this.text('normal')
      }
      if (method === 'json') {
        return this.json()
      }
      if (method === 'offset' || method === 'offsets') {
        return this.json({ offset: true })
      }
      if (method === 'array') {
        return this.json({ terms: false }).map(obj => obj.text)
      }
      if (method === 'freq' || method === 'frequency') {
        return _topk(this)
      }
      if (method === 'terms') {
        let list = [];
        this.json({ text: false, terms: { text: true } }).forEach(obj => {
          let terms = obj.terms.map(t => t.text);
          terms = terms.filter(t => t);
          list = list.concat(terms);
        });
        return list
      }
      if (method === 'tags') {
        return this.list.map(p => {
          return p.terms().reduce((h, t) => {
            h[t.clean || t.implicit] = Object.keys(t.tags);
            return h
          }, {})
        })
      }
      if (method === 'debug') {
        _debug(this);
        return this
      }
      return this.text()
    };

    var _03Out = {
    	debug: debug_1,
    	out: out
    };

    const methods$2 = {
      /** alphabetical order */
      alpha: (a, b) => {
        let left = a.text('clean');
        let right = b.text('clean');
        if (left < right) {
          return -1
        }
        if (left > right) {
          return 1
        }
        return 0
      },

      /** count the # of characters of each match */
      length: (a, b) => {
        let left = a.text().trim().length;
        let right = b.text().trim().length;
        if (left < right) {
          return 1
        }
        if (left > right) {
          return -1
        }
        return 0
      },

      /** count the # of terms in each match */
      wordCount: (a, b) => {
        let left = a.wordCount();
        let right = b.wordCount();
        if (left < right) {
          return 1
        }
        if (left > right) {
          return -1
        }
        return 0
      },
    };

    /** sort by # of duplicates in the document*/
    const byFreq = function(doc) {
      let counts = {};
      const options = {
        case: true,
        punctuation: false,
        whitespace: true,
        unicode: true,
      };
      doc.list.forEach(p => {
        let str = p.text(options);
        counts[str] = counts[str] || 0;
        counts[str] += 1;
      });
      // sort by freq
      doc.list.sort((a, b) => {
        let left = counts[a.text(options)];
        let right = counts[b.text(options)];
        if (left < right) {
          return 1
        }
        if (left > right) {
          return -1
        }
        return 0
      });
      return doc
    };

    // order results 'chronologically', or document-order
    const sortSequential = function(doc) {
      let order = {};
      doc.json({ terms: { offset: true } }).forEach(o => {
        order[o.terms[0].id] = o.terms[0].offset.start;
      });
      doc.list = doc.list.sort((a, b) => {
        if (order[a.start] > order[b.start]) {
          return 1
        } else if (order[a.start] < order[b.start]) {
          return -1
        }
        return 0
      });
      return doc
    };

    //aliases
    methods$2.alphabetical = methods$2.alpha;
    methods$2.wordcount = methods$2.wordCount;

    // aliases for sequential ordering
    const seqNames = {
      index: true,
      sequence: true,
      seq: true,
      sequential: true,
      chron: true,
      chronological: true,
    };

    /** re-arrange the order of the matches (in place) */
    var sort = function(input) {
      input = input || 'alpha';
      //do this one up-front
      if (input === 'freq' || input === 'frequency' || input === 'topk') {
        return byFreq(this)
      }
      if (seqNames.hasOwnProperty(input)) {
        return sortSequential(this)
      }

      input = methods$2[input] || input;
      // apply sort method on each phrase
      if (typeof input === 'function') {
        this.list = this.list.sort(input);
        return this
      }
      return this
    };

    /** reverse the order of the matches, but not the words */
    var reverse = function() {
      let list = [].concat(this.list);
      list = list.reverse();
      return this.buildFrom(list)
    };

    /** remove any duplicate matches */
    var unique$4 = function() {
      let list = [].concat(this.list);
      let obj = {};
      list = list.filter(p => {
        let str = p.text('reduced').trim();
        if (obj.hasOwnProperty(str) === true) {
          return false
        }
        obj[str] = true;
        return true
      });
      return this.buildFrom(list)
    };

    var _01Sort = {
    	sort: sort,
    	reverse: reverse,
    	unique: unique$4
    };

    const isPunct = /[\[\]{}⟨⟩:,،、‒–—―…‹›«»‐\-;\/⁄·*\•^†‡°¡¿※№÷×ºª%‰=‱¶§~|‖¦©℗®℠™¤₳฿]/g;
    const quotes = /['‘’“”"′″‴]+/g;

    const methods$3 = {
      // cleanup newlines and extra spaces
      whitespace: function(doc) {
        let termArr = doc.list.map(ts => ts.terms());
        termArr.forEach((terms, o) => {
          terms.forEach((t, i) => {
            // keep dashes between words
            if (t.hasDash() === true) {
              t.post = ' - ';
              return
            }
            // remove existing spaces
            t.pre = t.pre.replace(/\s/g, '');
            t.post = t.post.replace(/\s/g, '');
            //last word? ensure there's a next sentence.
            if (terms.length - 1 === i && !termArr[o + 1]) {
              return
            }
            // no extra spaces for contractions
            if (t.implicit && Boolean(t.text) === true) {
              return
            }
            // no extra spaces for hyphenated words
            if (t.hasHyphen() === true) {
              return
            }

            t.post += ' ';
          });
        });
      },

      punctuation: function(termList) {
        termList.forEach(t => {
          // space between hyphenated words
          if (t.hasHyphen() === true) {
            t.post = ' ';
          }
          t.pre = t.pre.replace(isPunct, '');
          t.post = t.post.replace(isPunct, '');
          // elipses
          t.post = t.post.replace(/\.\.\./, '');
          // only allow one exclamation
          if (/!/.test(t.post) === true) {
            t.post = t.post.replace(/!/g, '');
            t.post = '!' + t.post;
          }
          // only allow one question mark
          if (/\?/.test(t.post) === true) {
            t.post = t.post.replace(/[\?!]*/, '');
            t.post = '?' + t.post;
          }
        });
      },

      unicode: function(termList) {
        termList.forEach(t => {
          if (t.isImplicit() === true) {
            return
          }
          t.text = unicode_1(t.text);
        });
      },

      quotations: function(termList) {
        termList.forEach(t => {
          t.post = t.post.replace(quotes, '');
          t.pre = t.pre.replace(quotes, '');
        });
      },

      adverbs: function(doc) {
        doc
          .match('#Adverb')
          .not('(not|nary|seldom|never|barely|almost|basically|so)')
          .remove();
      },

      // remove the '.' from 'Mrs.' (safely)
      abbreviations: function(doc) {
        doc.list.forEach(ts => {
          let terms = ts.terms();
          terms.forEach((t, i) => {
            if (t.tags.Abbreviation === true && terms[i + 1]) {
              t.post = t.post.replace(/^\./, '');
            }
          });
        });
      },
    };
    var _methods = methods$3;

    const defaults = {
      // light
      whitespace: true,
      unicode: true,
      punctuation: true,
      emoji: true,
      acronyms: true,
      abbreviations: true,

      // medium
      case: false,
      contractions: false,
      parentheses: false,
      quotations: false,
      adverbs: false,

      // heavy (loose legibility)
      possessives: false,
      verbs: false,
      nouns: false,
      honorifics: false,

      // pronouns: true,
    };
    const mapping$1 = {
      light: {},
      medium: { case: true, contractions: true, parentheses: true, quotations: true, adverbs: true },
    };
    mapping$1.heavy = Object.assign({}, mapping$1.medium, { possessives: true, verbs: true, nouns: true, honorifics: true });

    /** common ways to clean-up the document, and reduce noise */
    var normalize = function(options) {
      options = options || {};
      // support named forms
      if (typeof options === 'string') {
        options = mapping$1[options] || {};
      }
      // set defaults
      options = Object.assign({}, defaults, options);
      // clear the cache
      this.uncache();

      let termList = this.termList();

      // lowercase things
      if (options.case) {
        this.toLowerCase();
      }

      //whitespace
      if (options.whitespace) {
        _methods.whitespace(this);
      }

      // unicode: é -> e
      if (options.unicode) {
        _methods.unicode(termList);
      }

      //punctuation - keep sentence punctation, quotes, parenths
      if (options.punctuation) {
        _methods.punctuation(termList);
      }

      // remove ':)'
      if (options.emoji) {
        this.remove('(#Emoji|#Emoticon)');
      }

      // 'f.b.i.' -> 'FBI'
      if (options.acronyms) {
        this.acronyms().strip();
        // .toUpperCase()
      }
      // remove period from abbreviations
      if (options.abbreviations) {
        _methods.abbreviations(this);
      }

      // --Medium methods--

      // `isn't` -> 'is not'
      if (options.contraction || options.contractions) {
        this.contractions().expand();
      }

      // '(word)' -> 'word'
      if (options.parentheses) {
        this.parentheses().unwrap();
      }
      // remove "" punctuation
      if (options.quotations || options.quotes) {
        _methods.quotations(termList);
      }

      // remove any un-necessary adverbs
      if (options.adverbs) {
        _methods.adverbs(this);
      }

      // --Heavy methods--

      // `cory hart's -> cory hart'
      if (options.possessive || options.possessives) {
        this.possessives().strip();
      }
      // 'he walked' -> 'he walk'
      if (options.verbs) {
        this.verbs().toInfinitive();
      }
      // 'three dogs' -> 'three dog'
      if (options.nouns || options.plurals) {
        this.nouns().toSingular();
      }
      // remove 'Mr.' from 'Mr John Smith'
      if (options.honorifics) {
        this.remove('#Honorific');
      }

      return this
    };

    var _02Normalize = {
    	normalize: normalize
    };

    var _03Split = createCommonjsModule(function (module, exports) {
    /** return a Document with three parts for every match
     * seperate everything before the word, as a new phrase
     */
    exports.splitOn = function(reg) {
      // if there's no match, split parent, instead
      if (!reg) {
        let parent = this.parent();
        return parent.splitOn(this)
      }
      //start looking for a match..
      let regs = syntax_1(reg);
      let matches = [];
      this.list.forEach(p => {
        let foundEm = p.match(regs);
        //no match here, add full sentence
        if (foundEm.length === 0) {
          matches.push(p);
          return
        }
        // we found something here.
        let carry = p;
        foundEm.forEach(found => {
          let parts = carry.splitOn(found);
          // add em in
          if (parts.before) {
            matches.push(parts.before);
          }
          if (parts.match) {
            matches.push(parts.match);
          }
          // start matching now on the end
          carry = parts.after;
        });
        // add that last part
        if (carry) {
          matches.push(carry);
        }
      });
      return this.buildFrom(matches)
    };

    /** return a Document with two parts for every match
     * seperate everything after the word, as a new phrase
     */
    exports.splitAfter = function(reg) {
      // if there's no match, split parent, instead
      if (!reg) {
        let parent = this.parent();
        return parent.splitAfter(this)
      }
      // start looking for our matches
      let regs = syntax_1(reg);
      let matches = [];
      this.list.forEach(p => {
        let foundEm = p.match(regs);
        //no match here, add full sentence
        if (foundEm.length === 0) {
          matches.push(p);
          return
        }
        // we found something here.
        let carry = p;
        foundEm.forEach(found => {
          let parts = carry.splitOn(found);
          // add em in
          if (parts.before && parts.match) {
            // merge these two together
            parts.before.length += parts.match.length;
            matches.push(parts.before);
          } else if (parts.match) {
            matches.push(parts.match);
          }
          // start matching now on the end
          carry = parts.after;
        });
        // add that last part
        if (carry) {
          matches.push(carry);
        }
      });
      return this.buildFrom(matches)
    };
    exports.split = exports.splitAfter; //i guess?

    /** return a Document with two parts for every match */
    exports.splitBefore = function(reg) {
      // if there's no match, split parent, instead
      if (!reg) {
        let parent = this.parent();
        return parent.splitBefore(this)
      }
      //start looking for a match..
      let regs = syntax_1(reg);
      let matches = [];
      this.list.forEach(p => {
        let foundEm = p.match(regs);
        //no match here, add full sentence
        if (foundEm.length === 0) {
          matches.push(p);
          return
        }
        // we found something here.
        let carry = p;
        foundEm.forEach(found => {
          let parts = carry.splitOn(found);
          // add before part in
          if (parts.before) {
            matches.push(parts.before);
          }
          // merge match+after
          if (parts.match && parts.after) {
            parts.match.length += parts.after.length;
          }
          // start matching now on the end
          carry = parts.match;
        });
        // add that last part
        if (carry) {
          matches.push(carry);
        }
      });
      return this.buildFrom(matches)
    };

    /** split a document into labeled sections */
    exports.segment = function(regs, options) {
      regs = regs || {};
      options = options || { text: true };
      let doc = this;
      let keys = Object.keys(regs);
      // split em
      keys.forEach(k => {
        doc = doc.splitOn(k);
      });
      //add labels for each section
      doc.list.forEach(p => {
        for (let i = 0; i < keys.length; i += 1) {
          if (p.has(keys[i])) {
            p.segment = regs[keys[i]];
            return
          }
        }
      });
      return doc.list.map(p => {
        let res = p.json(options);
        res.segment = p.segment || null;
        return res
      })
    };
    });
    var _03Split_1 = _03Split.splitOn;
    var _03Split_2 = _03Split.splitAfter;
    var _03Split_3 = _03Split.split;
    var _03Split_4 = _03Split.splitBefore;
    var _03Split_5 = _03Split.segment;

    const eachTerm = function(doc, fn) {
      let world = doc.world;
      doc.list.forEach(p => {
        p.terms().forEach(t => t[fn](world));
      });
      return doc
    };

    /** turn every letter of every term to lower-cse */
    var toLowerCase = function() {
      return eachTerm(this, 'toLowerCase')
    };

    /** turn every letter of every term to upper case */
    var toUpperCase = function() {
      return eachTerm(this, 'toUpperCase')
    };

    /** upper-case the first letter of each term */
    var toTitleCase = function() {
      return eachTerm(this, 'toTitleCase')
    };
    /** remove whitespace and title-case each term */
    var toCamelCase = function() {
      this.list.forEach(p => {
        //remove whitespace
        let terms = p.terms();
        terms.forEach((t, i) => {
          if (i !== 0) {
            t.toTitleCase();
          }
          if (i !== terms.length - 1) {
            t.post = '';
          }
        });
      });
      // this.tag('#CamelCase', 'toCamelCase')
      return this
    };

    var _04Case = {
    	toLowerCase: toLowerCase,
    	toUpperCase: toUpperCase,
    	toTitleCase: toTitleCase,
    	toCamelCase: toCamelCase
    };

    var _05Whitespace = createCommonjsModule(function (module, exports) {
    /** add this punctuation or whitespace before each match: */
    exports.pre = function(str, concat) {
      if (str === undefined) {
        return this.list[0].terms(0).pre
      }
      this.list.forEach(p => {
        let term = p.terms(0);
        if (concat === true) {
          term.pre += str;
        } else {
          term.pre = str;
        }
      });
      return this
    };

    /** add this punctuation or whitespace after each match: */
    exports.post = function(str, concat) {
      // return array of post strings
      if (str === undefined) {
        return this.list.map(p => {
          let terms = p.terms();
          let term = terms[terms.length - 1];
          return term.post
        })
      }
      // set post string on all ends
      this.list.forEach(p => {
        let terms = p.terms();
        let term = terms[terms.length - 1];
        if (concat === true) {
          term.post += str;
        } else {
          term.post = str;
        }
      });
      return this
    };

    /** remove start and end whitespace */
    exports.trim = function() {
      this.list = this.list.map(p => p.trim());
      return this
    };

    /** connect words with hyphen, and remove whitespace */
    exports.hyphenate = function() {
      this.list.forEach(p => {
        let terms = p.terms();
        //remove whitespace
        terms.forEach((t, i) => {
          if (i !== 0) {
            t.pre = '';
          }
          if (terms[i + 1]) {
            t.post = '-';
          }
        });
      });
      return this
    };

    /** remove hyphens between words, and set whitespace */
    exports.dehyphenate = function() {
      const hasHyphen = /(-|–|—)/;
      this.list.forEach(p => {
        let terms = p.terms();
        //remove whitespace
        terms.forEach(t => {
          if (hasHyphen.test(t.post)) {
            t.post = ' ';
          }
        });
      });
      return this
    };
    exports.deHyphenate = exports.dehyphenate;

    /** add quotations around these matches */
    exports.toQuotations = function(start, end) {
      start = start || `"`;
      end = end || `"`;
      this.list.forEach(p => {
        let terms = p.terms();
        terms[0].pre = start + terms[0].pre;
        let last = terms[terms.length - 1];
        last.post = end + last.post;
      });
      return this
    };
    exports.toQuotation = exports.toQuotations;

    /** add brackets around these matches */
    exports.toParentheses = function(start, end) {
      start = start || `(`;
      end = end || `)`;
      this.list.forEach(p => {
        let terms = p.terms();
        terms[0].pre = start + terms[0].pre;
        let last = terms[terms.length - 1];
        last.post = end + last.post;
      });
      return this
    };
    });
    var _05Whitespace_1 = _05Whitespace.pre;
    var _05Whitespace_2 = _05Whitespace.post;
    var _05Whitespace_3 = _05Whitespace.trim;
    var _05Whitespace_4 = _05Whitespace.hyphenate;
    var _05Whitespace_5 = _05Whitespace.dehyphenate;
    var _05Whitespace_6 = _05Whitespace.deHyphenate;
    var _05Whitespace_7 = _05Whitespace.toQuotations;
    var _05Whitespace_8 = _05Whitespace.toQuotation;
    var _05Whitespace_9 = _05Whitespace.toParentheses;

    /** make all phrases into one phrase */
    var join = function(str) {
      // clear the cache
      this.uncache();
      // make one large phrase - 'main'
      let main = this.list[0];
      let before = main.length;
      let removed = {};
      for (let i = 1; i < this.list.length; i++) {
        const p = this.list[i];
        removed[p.start] = true;
        let term = main.lastTerm();
        // add whitespace between them
        if (str) {
          term.post += str;
        }
        //  main -> p
        term.next = p.start;
        // main <- p
        p.terms(0).prev = term.id;
        main.length += p.length;
        main.cache = {};
      }

      // parents are bigger than than their children.
      // when we increase a child, we increase their parent too.
      let increase = main.length - before;
      this.parents().forEach(doc => {
        // increase length on each effected phrase
        doc.list.forEach(p => {
          let terms = p.terms();
          for (let i = 0; i < terms.length; i++) {
            if (terms[i].id === main.start) {
              p.length += increase;
              break
            }
          }
          p.cache = {};
        });
        // remove redundant phrases now
        doc.list = doc.list.filter(p => removed[p.start] !== true);
      });
      // return one major phrase
      return this.buildFrom([main])
    };

    var _06Join = {
    	join: join
    };

    const postPunct = /[,\)"';:\-–—\.…]/;
    // const irregulars = {
    //   'will not': `won't`,
    //   'i am': `i'm`,
    // }

    const setContraction = function(m, suffix) {
      if (!m.found) {
        return
      }
      let terms = m.termList();
      //avoid any problematic punctuation
      for (let i = 0; i < terms.length - 1; i++) {
        const t = terms[i];
        if (postPunct.test(t.post)) {
          return
        }
      }

      // set them as implict
      terms.forEach(t => {
        t.implicit = t.clean;
      });
      // perform the contraction
      terms[0].text += suffix;
      // clean-up the others
      terms.slice(1).forEach(t => {
        t.text = '';
      });
      for (let i = 0; i < terms.length - 1; i++) {
        const t = terms[i];
        t.post = t.post.replace(/ /, '');
      }
    };

    /** turn 'i am' into i'm */
    var contract = function() {
      let doc = this.not('@hasContraction');
      // we are -> we're
      let m = doc.match('(we|they|you) are');
      setContraction(m, `'re`);
      // they will -> they'll
      m = doc.match('(he|she|they|it|we|you) will');
      setContraction(m, `'ll`);
      // she is -> she's
      m = doc.match('(he|she|they|it|we) is');
      setContraction(m, `'s`);
      // spencer is -> spencer's
      m = doc.match('#Person is');
      setContraction(m, `'s`);
      // spencer would -> spencer'd
      m = doc.match('#Person would');
      setContraction(m, `'d`);
      // would not -> wouldn't
      m = doc.match('(is|was|had|would|should|could|do|does|have|has|can) not');
      setContraction(m, `n't`);
      // i have -> i've
      m = doc.match('(i|we|they) have');
      setContraction(m, `'ve`);
      // would have -> would've
      m = doc.match('(would|should|could) have');
      setContraction(m, `'ve`);
      // i am -> i'm
      m = doc.match('i am');
      setContraction(m, `'m`);
      // going to -> gonna
      m = doc.match('going to');
      return this
    };

    var _07Contract = {
    	contract: contract
    };

    var methods$4 = Object.assign(
      {},
      _01Utils$1,
      _02Accessors,
      _03Match,
      _04Tag,
      _05Loops,
      _06Lookup,
      _07Cache,

      _01Replace,
      _02Insert,

      _01Text,
      _02Json,
      _03Out,

      _01Sort,
      _02Normalize,
      _03Split,
      _04Case,
      _05Whitespace,
      _06Join,
      _07Contract
    );

    let methods$5 = {};

    // allow helper methods like .adjectives() and .adverbs()
    const arr = [
      ['terms', '.'],
      ['hyphenated', '@hasHyphen .'],
      ['adjectives', '#Adjective'],
      ['hashTags', '#HashTag'],
      ['emails', '#Email'],
      ['emoji', '#Emoji'],
      ['emoticons', '#Emoticon'],
      ['atMentions', '#AtMention'],
      ['urls', '#Url'],
      ['adverbs', '#Adverb'],
      ['pronouns', '#Pronoun'],
      ['conjunctions', '#Conjunction'],
      ['prepositions', '#Preposition'],
    ];
    arr.forEach(a => {
      methods$5[a[0]] = function(n) {
        let m = this.match(a[1]);
        if (typeof n === 'number') {
          m = m.get(n);
        }
        return m
      };
    });
    // aliases
    methods$5.emojis = methods$5.emoji;
    methods$5.atmentions = methods$5.atMentions;
    methods$5.words = methods$5.terms;

    /** return anything tagged as a phone number */
    methods$5.phoneNumbers = function(n) {
      let m = this.splitAfter('@hasComma');
      m = m.match('#PhoneNumber+');
      if (typeof n === 'number') {
        m = m.get(n);
      }
      return m
    };

    /** Deprecated: please use compromise-numbers plugin */
    methods$5.money = function(n) {
      let m = this.match('#Money #Currency?');
      if (typeof n === 'number') {
        m = m.get(n);
      }
      return m
    };

    /** return all cities, countries, addresses, and regions */
    methods$5.places = function(n) {
      // don't split 'paris, france'
      let keep = this.match('(#City && @hasComma) (#Region|#Country)');
      // but split the other commas
      let m = this.not(keep).splitAfter('@hasComma');
      // combine them back together
      m = m.concat(keep);
      m.sort('index');
      m = m.match('#Place+');
      if (typeof n === 'number') {
        m = m.get(n);
      }
      return m
    };

    /** return all schools, businesses and institutions */
    methods$5.organizations = function(n) {
      let m = this.clauses();
      m = m.match('#Organization+');
      if (typeof n === 'number') {
        m = m.get(n);
      }
      return m
    };

    //combine them with .topics() method
    methods$5.entities = function(n) {
      let r = this.clauses();
      // Find people, places, and organizations
      let yup = r.people();
      yup = yup.concat(r.places());
      yup = yup.concat(r.organizations());
      let ignore = ['someone', 'man', 'woman', 'mother', 'brother', 'sister', 'father'];
      yup = yup.not(ignore);
      //return them to normal ordering
      yup.sort('sequence');
      // yup.unique() //? not sure
      if (typeof n === 'number') {
        yup = yup.get(n);
      }
      return yup
    };
    //aliases
    methods$5.things = methods$5.entities;
    methods$5.topics = methods$5.entities;

    var _simple = methods$5;

    const underOver = /^(under|over)-?/;

    /** match a word-sequence, like 'super bowl' in the lexicon */
    const tryMultiple = function(terms, t, world) {
      let lex = world.words;
      //try a two-word version
      let txt = terms[t].reduced + ' ' + terms[t + 1].reduced;
      if (lex[txt] !== undefined && lex.hasOwnProperty(txt) === true) {
        terms[t].tag(lex[txt], 'lexicon-two', world);
        terms[t + 1].tag(lex[txt], 'lexicon-two', world);
        return 1
      }
      //try a three-word version?
      if (t + 2 < terms.length) {
        txt += ' ' + terms[t + 2].reduced;
        if (lex[txt] !== undefined && lex.hasOwnProperty(txt) === true) {
          terms[t].tag(lex[txt], 'lexicon-three', world);
          terms[t + 1].tag(lex[txt], 'lexicon-three', world);
          terms[t + 2].tag(lex[txt], 'lexicon-three', world);
          return 2
        }
      }
      //try a four-word version?
      if (t + 3 < terms.length) {
        txt += ' ' + terms[t + 3].reduced;
        if (lex[txt] !== undefined && lex.hasOwnProperty(txt) === true) {
          terms[t].tag(lex[txt], 'lexicon-four', world);
          terms[t + 1].tag(lex[txt], 'lexicon-four', world);
          terms[t + 2].tag(lex[txt], 'lexicon-four', world);
          terms[t + 3].tag(lex[txt], 'lexicon-four', world);
          return 3
        }
      }
      return 0
    };

    /** look at each word in our list of known-words */
    const checkLexicon = function(terms, world) {
      let lex = world.words;
      let hasCompound = world.hasCompound; // use reduced?
      //go through each term, and check the lexicon
      for (let t = 0; t < terms.length; t += 1) {
        let str = terms[t].clean;
        //is it the start of a compound word, like 'super bowl'?
        if (hasCompound[str] === true && t + 1 < terms.length) {
          let foundWords = tryMultiple(terms, t, world);
          if (foundWords > 0) {
            t += foundWords; //skip any already-found words
            continue
          }
        }
        //try one-word lexicon
        if (lex[str] !== undefined && lex.hasOwnProperty(str) === true) {
          terms[t].tag(lex[str], 'lexicon', world);
          continue
        }
        // look at reduced version of term, too
        if (str !== terms[t].reduced && lex.hasOwnProperty(terms[t].reduced) === true) {
          terms[t].tag(lex[terms[t].reduced], 'lexicon', world);
          continue
        }
        // prefix strip: try to match 'take' for 'undertake'
        if (underOver.test(str) === true) {
          let noPrefix = str.replace(underOver, '');
          if (lex.hasOwnProperty(noPrefix) === true) {
            terms[t].tag(lex[noPrefix], 'noprefix-lexicon', world);
          }
        }
      }
      return terms
    };
    var _01Lexicon = checkLexicon;

    const apostrophes = /[\'‘’‛‵′`´]$/;
    const perSec = /^(m|k|cm|km|m)\/(s|h|hr)$/; // '5 k/m'

    //
    const checkPunctuation = function(terms, i, world) {
      let term = terms[i];

      //check hyphenation
      // if (term.post.indexOf('-') !== -1 && terms[i + 1] && terms[i + 1].pre === '') {
      //   term.tag('Hyphenated', 'has-hyphen', world)
      // }
      // support 'head-over'
      // if (term.hasHyphen() === true) {
      //   console.log(term.tags)
      // }
      // console.log(term.hasHyphen(), term.text)

      //an end-tick (trailing apostrophe) - flanders', or Carlos'
      if (apostrophes.test(term.text)) {
        if (!apostrophes.test(term.pre) && !apostrophes.test(term.post) && term.clean.length > 2) {
          let endChar = term.clean[term.clean.length - 2];
          //flanders'
          if (endChar === 's') {
            term.tag(['Possessive', 'Noun'], 'end-tick', world);
            return
          }
          //chillin'
          if (endChar === 'n') {
            term.tag(['Gerund'], 'chillin', world);
          }
        }
      }
      // '5 km/s'
      if (perSec.test(term.text)) {
        term.tag('Unit', 'per-sec', world);
      }

      // 'NASA' is, but not 'i REALLY love it.'
      // if (term.tags.Noun === true && isAcronym(term, world)) {
      //   term.tag('Acronym', 'acronym-step', world)
      //   term.tag('Noun', 'acronym-infer', world)
      // } else if (!oneLetterWord.hasOwnProperty(term.text) && oneLetterAcronym.test(term.text)) {
      //   term.tag('Acronym', 'one-letter-acronym', world)
      //   term.tag('Noun', 'one-letter-infer', world)
      // }
    };
    var _02Punctuation$1 = checkPunctuation;

    //these are regexes applied to t.text, instead of t.clean
    // order matters.
    var startsWith = [
      //web tags
      [/^[\w\.]+@[\w\.]+\.[a-z]{2,3}$/, 'Email'], //not fancy
      [/^#[a-z0-9_\u00C0-\u00FF]{2,}$/, 'HashTag'],
      [/^@\w{2,}$/, 'AtMention'],
      [/^(https?:\/\/|www\.)\w+\.[a-z]{2,3}/, 'Url'], //with http/www
      [/^[\w./]+\.(com|net|gov|org|ly|edu|info|biz|ru|jp|de|in|uk|br)/, 'Url'], //http://mostpopularwebsites.net/top-level-domain

      //dates/times
      [/^[012]?[0-9](:[0-5][0-9])(:[0-5][0-9])$/, 'Time'], //4:32:32
      [/^[012]?[0-9](:[0-5][0-9])?(:[0-5][0-9])? ?(am|pm)$/, 'Time'], //4pm
      [/^[012]?[0-9](:[0-5][0-9])(:[0-5][0-9])? ?(am|pm)?$/, 'Time'], //4:00pm
      [/^[PMCE]ST$/, 'Time'], //PST, time zone abbrevs
      [/^utc ?[+-]?[0-9]+?$/, 'Time'], //UTC 8+
      [/^[a-z0-9]*? o\'?clock$/, 'Time'], //3 oclock
      [/^[0-9]{1,4}-[0-9]{1,2}-[0-9]{1,4}$/, 'Date'], // 03-02-89
      [/^[0-9]{1,4}\/[0-9]{1,2}\/[0-9]{1,4}$/, 'Date'], // 03/02/89
      [/^[0-9]{1,4}-[a-z]{2,9}-[0-9]{1,4}$/i, 'Date'], // 03-March-89

      //names
      [/^ma?c\'.*/, 'LastName'], //mc'adams
      [/^o\'[drlkn].*/, 'LastName'], //o'douggan
      [/^ma?cd[aeiou]/, 'LastName'], //macdonell - Last patterns https://en.wikipedia.org/wiki/List_of_family_name_affixes

      //slang things
      [/^(lol)+[sz]$/, 'Expression'], //lol
      [/^woo+a*?h?$/, 'Expression'], //whoaa, wooo
      [/^(un|de|re)\\-[a-z\u00C0-\u00FF]{2}/, 'Verb'],
      // [/^(over|under)[a-z]{2,}/, 'Adjective'],
      [/^[0-9]{1,4}\.[0-9]{1,2}\.[0-9]{1,4}$/, 'Date'], // 03-02-89

      //phone numbers
      [/^[0-9]{3}-[0-9]{4}$/, 'PhoneNumber'], //589-3809
      [/^(\+?[0-9][ -])?[0-9]{3}[ -]?[0-9]{3}-[0-9]{4}$/, 'PhoneNumber'], //632-589-3809

      //money
      // currency regex
      // /[\$\xA2-\xA5\u058F\u060B\u09F2\u09F3\u09FB\u0AF1\u0BF9\u0E3F\u17DB\u20A0-\u20BD\uA838\uFDFC\uFE69\uFF04\uFFE0\uFFE1\uFFE5\uFFE6]

      //like $5.30
      [
        /^[-+]?[\$\xA2-\xA5\u058F\u060B\u09F2\u09F3\u09FB\u0AF1\u0BF9\u0E3F\u17DB\u20A0-\u20BD\uA838\uFDFC\uFE69\uFF04\uFFE0\uFFE1\uFFE5\uFFE6][-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?(k|m|b|bn)?\+?$/,
        ['Money', 'Value'],
      ],
      //like 5.30$
      [
        /^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?[\$\xA2-\xA5\u058F\u060B\u09F2\u09F3\u09FB\u0AF1\u0BF9\u0E3F\u17DB\u20A0-\u20BD\uA838\uFDFC\uFE69\uFF04\uFFE0\uFFE1\uFFE5\uFFE6]\+?$/,
        ['Money', 'Value'],
      ],
      //like 400usd
      [/^[-+]?[0-9]([0-9,.])+?(usd|eur|jpy|gbp|cad|aud|chf|cny|hkd|nzd|kr|rub)$/i, ['Money', 'Value']],

      //numbers
      // 50 | -50 | 3.23  | 5,999.0  | 10+
      [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?\+?$/, ['Cardinal', 'NumericValue']],
      [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?(st|nd|rd|th)$/, ['Ordinal', 'NumericValue']],
      // .73th
      [/^\.[0-9]+\+?$/, ['Cardinal', 'NumericValue']],

      //percent
      [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?%\+?$/, ['Percent', 'Cardinal', 'NumericValue']], //7%  ..
      [/^\.[0-9]+%$/, ['Percent', 'Cardinal', 'NumericValue']], //.7%  ..
      //fraction
      [/^[0-9]{1,4}\/[0-9]{1,4}$/, 'Fraction'], //3/2ths
      //range
      [/^[0-9.]{1,2}[-–][0-9]{1,2}$/, ['Value', 'NumberRange']], //7-8
      [/^[0-9.]{1,4}(st|nd|rd|th)?[-–][0-9\.]{1,4}(st|nd|rd|th)?$/, 'NumberRange'], //5-7
      //with unit
      [/^[0-9.]+([a-z]{1,4})$/, 'Value'], //like 5tbsp
      //ordinal
      // [/^[0-9][0-9,.]*(st|nd|rd|r?th)$/, ['NumericValue', 'Ordinal']], //like 5th
      // [/^[0-9]+(st|nd|rd|th)$/, 'Ordinal'], //like 5th
    ];

    const romanNumeral = /^[IVXLCDM]{2,}$/;
    const romanNumValid = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/; //  https://stackoverflow.com/a/267405/168877

    //try each of the ^regexes in our list
    const checkRegex = function(term, world) {
      let str = term.text;
      // do them all!
      for (let r = 0; r < startsWith.length; r += 1) {
        if (startsWith[r][0].test(str) === true) {
          term.tagSafe(startsWith[r][1], 'prefix #' + r, world);
          break
        }
      }
      // do some more!
      //roman numberals - XVII
      if (term.text.length >= 2 && romanNumeral.test(str) && romanNumValid.test(str)) {
        term.tag('RomanNumeral', 'xvii', world);
      }
    };
    var _03Prefixes = checkRegex;

    //regex suffix patterns and their most common parts of speech,
    //built using wordnet, by spencer kelly.
    //this mapping shrinks-down the uglified build
    const Adj = 'Adjective';
    const Inf = 'Infinitive';
    const Pres = 'PresentTense';
    const Sing = 'Singular';
    const Past = 'PastTense';
    const Adverb = 'Adverb';
    const Exp = 'Expression';
    const Actor = 'Actor';
    const Verb = 'Verb';
    const Noun = 'Noun';
    const Last = 'LastName';
    //the order here matters.

    //regexes indexed by mandated last-character
    var endsWith$1 = {
      a: [
        [/.[aeiou]na$/, Noun],
        [/.[oau][wvl]ska$/, Last], //polish (female)
        [/.[^aeiou]ica$/, Sing],
        [/^([hyj]a)+$/, Exp], //hahah
      ],
      c: [[/.[^aeiou]ic$/, Adj]],
      d: [
        //==-ed==
        //double-consonant
        [/[aeiou](pp|ll|ss|ff|gg|tt|rr|bb|nn|mm)ed$/, Past], //popped, planned
        //double-vowel
        [/.[aeo]{2}[bdgmnprvz]ed$/, Past], //beeped, mooned, veered
        //-hed
        [/.[aeiou][sg]hed$/, Past], //stashed, sighed
        //-rd
        [/.[aeiou]red$/, Past], //stored
        [/.[aeiou]r?ried$/, Past], //buried
        //-led
        [/.[bcdgtr]led$/, Past], //startled, rumbled
        [/.[aoui]f?led$/, Past], //impaled, stifled
        //-sed
        [/.[iao]sed$/, Past], //franchised
        [/[aeiou]n?[cs]ed$/, Past], //laced, lanced
        //-med
        [/[aeiou][rl]?[mnf]ed$/, Past], //warmed, attained, engulfed
        //-ked
        [/[aeiou][ns]?c?ked$/, Past], //hooked, masked
        //-ged
        [/[aeiou][nl]?ged$/, Past], //engaged
        //-ted
        [/.[tdbwxz]ed$/, Past], //bribed, boxed
        [/[^aeiou][aeiou][tvx]ed$/, Past], //boxed
        //-ied
        [/.[cdlmnprstv]ied$/, Past], //rallied

        [/[^aeiou]ard$/, Sing], //card
        [/[aeiou][^aeiou]id$/, Adj],
        [/.[vrl]id$/, Adj],
      ],
      e: [
        [/.[lnr]ize$/, Inf],
        [/.[^aeiou]ise$/, Inf],
        [/.[aeiou]te$/, Inf],
        [/.[^aeiou][ai]ble$/, Adj],
        [/.[^aeiou]eable$/, Adj],
        [/.[ts]ive$/, Adj],
      ],
      h: [
        [/.[^aeiouf]ish$/, Adj],
        [/.v[iy]ch$/, Last], //east-europe
        [/^ug?h+$/, Exp], //uhh
        [/^uh[ -]?oh$/, Exp], //uhoh
      ],
      i: [
        [/.[oau][wvl]ski$/, Last], //polish (male)
      ],
      k: [
        [/^(k){2}$/, Exp], //kkkk
      ],
      l: [
        [/.[gl]ial$/, Adj],
        [/.[^aeiou]ful$/, Adj],
        [/.[nrtumcd]al$/, Adj],
        [/.[^aeiou][ei]al$/, Adj],
      ],
      m: [
        [/.[^aeiou]ium$/, Sing],
        [/[^aeiou]ism$/, Sing],
        [/^h*u*m+$/, Exp], //mmmmmmm / ummmm / huuuuuummmmmm
        [/^\d+ ?[ap]m$/, 'Date'],
      ],
      n: [
        [/.[lsrnpb]ian$/, Adj],
        [/[^aeiou]ician$/, Actor],
        [/[aeiou][ktrp]in$/, 'Gerund'], // 'cookin', 'hootin'
      ],
      o: [
        [/^no+$/, Exp], //noooo
        [/^(yo)+$/, Exp], //yoyo
        [/^woo+[pt]?$/, Exp], //woo
      ],
      r: [
        [/.[bdfklmst]ler$/, 'Noun'],
        [/.[ilk]er$/, 'Comparative'],
        [/[aeiou][pns]er$/, Sing],
        [/[^i]fer$/, Inf],
        [/.[^aeiou][ao]pher$/, Actor],
      ],
      t: [
        [/.[di]est$/, 'Superlative'],
        [/.[icldtgrv]ent$/, Adj],
        [/[aeiou].*ist$/, Adj],
        [/^[a-z]et$/, Verb],
      ],
      s: [
        [/.[rln]ates$/, Pres],
        [/.[^z]ens$/, Verb],
        [/.[lstrn]us$/, Sing],
        [/.[aeiou]sks$/, Pres], //masks
        [/.[aeiou]kes$/, Pres], //bakes
        [/[aeiou][^aeiou]is$/, Sing],
        [/[a-z]\'s$/, Noun],
        [/^yes+$/, Exp], //yessss
      ],
      v: [
        [/.[^aeiou][ai][kln]ov$/, Last], //east-europe
      ],
      y: [
        [/.[cts]hy$/, Adj],
        [/.[st]ty$/, Adj],
        [/.[gk]y$/, Adj],
        [/.[tnl]ary$/, Adj],
        [/.[oe]ry$/, Sing],
        [/[rdntkbhs]ly$/, Adverb],
        [/...lly$/, Adverb],
        [/[bszmp]{2}y$/, Adj],
        [/.(gg|bb|zz)ly$/, Adj],
        [/.[aeiou]my$/, Adj],
        [/[ea]{2}zy$/, Adj],
        [/.[^aeiou]ity$/, Sing],
      ],
    };

    //just a foolish lookup of known suffixes
    const Adj$1 = 'Adjective';
    const Inf$1 = 'Infinitive';
    const Pres$1 = 'PresentTense';
    const Sing$1 = 'Singular';
    const Past$1 = 'PastTense';
    const Avb = 'Adverb';
    const Plrl = 'Plural';
    const Actor$1 = 'Actor';
    const Vb = 'Verb';
    const Noun$1 = 'Noun';
    const Last$1 = 'LastName';
    const Modal = 'Modal';
    const Place = 'Place';

    // find any issues - https://observablehq.com/@spencermountain/suffix-word-lookup
    var suffixMap = [
      null, //0
      null, //1
      {
        //2-letter
        ea: Sing$1,
        ia: Noun$1,
        ic: Adj$1,
        ly: Avb,
        "'n": Vb,
        "'t": Vb,
      },
      {
        //3-letter
        oed: Past$1,
        ued: Past$1,
        xed: Past$1,

        ' so': Avb,
        "'ll": Modal,
        "'re": 'Copula',
        azy: Adj$1,
        end: Vb,
        ped: Past$1,
        ffy: Adj$1,
        ify: Inf$1,
        ing: 'Gerund', //likely to be converted to Adj after lexicon pass
        ize: Inf$1,
        lar: Adj$1,
        mum: Adj$1,
        nes: Pres$1,
        nny: Adj$1,
        oid: Adj$1,
        ous: Adj$1,
        que: Adj$1,
        rmy: Adj$1,
        rol: Sing$1,
        sis: Sing$1,
        zes: Pres$1,
      },
      {
        //4-letter
        amed: Past$1,
        aped: Past$1,
        ched: Past$1,
        lked: Past$1,
        nded: Past$1,
        cted: Past$1,
        dged: Past$1,

        akis: Last$1, //greek
        cede: Inf$1,
        chuk: Last$1, //east-europe
        czyk: Last$1, //polish (male)
        ects: Pres$1,
        ends: Vb,
        enko: Last$1, //east-europe
        ette: Sing$1,
        fies: Pres$1,
        fore: Avb,
        gate: Inf$1,
        gone: Adj$1,
        ices: Plrl,
        ints: Plrl,
        ines: Plrl,
        ions: Plrl,
        less: Avb,
        llen: Adj$1,
        made: Adj$1,
        nsen: Last$1, //norway
        oses: Pres$1,
        ould: Modal,
        some: Adj$1,
        sson: Last$1, //swedish male
        tage: Inf$1,
        teen: 'Value',
        tion: Sing$1,
        tive: Adj$1,
        tors: Noun$1,
        vice: Sing$1,
      },
      {
        //5-letter
        tized: Past$1,
        urned: Past$1,
        eased: Past$1,

        ances: Plrl,
        bound: Adj$1,
        ettes: Plrl,
        fully: Avb,
        ishes: Pres$1,
        ities: Plrl,
        marek: Last$1, //polish (male)
        nssen: Last$1, //norway
        ology: Noun$1,
        ports: Plrl,
        rough: Adj$1,
        tches: Pres$1,
        tieth: 'Ordinal',
        tures: Plrl,
        wards: Avb,
        where: Avb,
      },
      {
        //6-letter
        auskas: Last$1, //lithuania
        keeper: Actor$1,
        logist: Actor$1,
        teenth: 'Value',
      },
      {
        //7-letter
        opoulos: Last$1, //greek
        borough: Place, //Hillsborough
        sdottir: Last$1, //swedish female
      },
    ];

    const endRegexs = function (term, world) {
      let str = term.clean;
      let char = str[str.length - 1];
      if (endsWith$1.hasOwnProperty(char) === true) {
        let regs = endsWith$1[char];
        for (let r = 0; r < regs.length; r += 1) {
          if (regs[r][0].test(str) === true) {
            term.tagSafe(regs[r][1], `endReg ${char} #${r}`, world);
            break
          }
        }
      }
    };

    //sweep-through all suffixes
    const knownSuffixes = function (term, world) {
      const len = term.clean.length;
      let max = 7;
      if (len <= max) {
        max = len - 1;
      }
      for (let i = max; i > 1; i -= 1) {
        let str = term.clean.substr(len - i, len);
        if (suffixMap[str.length].hasOwnProperty(str) === true) {
          let tag = suffixMap[str.length][str];
          term.tagSafe(tag, 'suffix -' + str, world);
          break
        }
      }
    };

    //all-the-way-down!
    const checkRegex$1 = function (term, world) {
      knownSuffixes(term, world);
      endRegexs(term, world);
    };
    var _04Suffixes = checkRegex$1;

    //just some of the most common emoticons
    //faster than
    //http://stackoverflow.com/questions/28077049/regex-matching-emoticons
    var emoticons = {
      ':(': true,
      ':)': true,
      ':P': true,
      ':p': true,
      ':O': true,
      ':3': true,
      ':|': true,
      ':/': true,
      ':\\': true,
      ':$': true,
      ':*': true,
      ':@': true,
      ':-(': true,
      ':-)': true,
      ':-P': true,
      ':-p': true,
      ':-O': true,
      ':-3': true,
      ':-|': true,
      ':-/': true,
      ':-\\': true,
      ':-$': true,
      ':-*': true,
      ':-@': true,
      ':^(': true,
      ':^)': true,
      ':^P': true,
      ':^p': true,
      ':^O': true,
      ':^3': true,
      ':^|': true,
      ':^/': true,
      ':^\\': true,
      ':^$': true,
      ':^*': true,
      ':^@': true,
      '):': true,
      '(:': true,
      '$:': true,
      '*:': true,
      ')-:': true,
      '(-:': true,
      '$-:': true,
      '*-:': true,
      ')^:': true,
      '(^:': true,
      '$^:': true,
      '*^:': true,
      '<3': true,
      '</3': true,
      '<\\3': true,
    };

    //from https://www.regextester.com/106421
    const emojiReg = /^(\u00a9|\u00ae|[\u2319-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;

    //for us, there's three types -
    // * ;) - emoticons
    // * 🌵 - unicode emoji
    // * :smiling_face: - asci-represented emoji

    //test for forms like ':woman_tone2:‍:ear_of_rice:'
    //https://github.com/Kikobeats/emojis-keywords/blob/master/index.js
    const isCommaEmoji = raw => {
      if (raw.charAt(0) === ':') {
        //end comma can be last or second-last ':haircut_tone3:‍♀️'
        if (raw.match(/:.?$/) === null) {
          return false
        }
        //ensure no spaces
        if (raw.match(' ')) {
          return false
        }
        //reasonably sized
        if (raw.length > 35) {
          return false
        }
        return true
      }
      return false
    };

    //check against emoticon whitelist
    const isEmoticon = str => {
      str = str.replace(/^[:;]/, ':'); //normalize the 'eyes'
      return emoticons.hasOwnProperty(str)
    };

    const tagEmoji = (term, world) => {
      let raw = term.pre + term.text + term.post;
      raw = raw.trim();
      //dont double-up on ending periods
      raw = raw.replace(/[.!?,]$/, '');
      //test for :keyword: emojis
      if (isCommaEmoji(raw) === true) {
        term.tag('Emoji', 'comma-emoji', world);
        term.text = raw;
        term.pre = term.pre.replace(':', '');
        term.post = term.post.replace(':', '');
      }
      //test for unicode emojis
      if (term.text.match(emojiReg)) {
        term.tag('Emoji', 'unicode-emoji', world);
        term.text = raw;
      }
      //test for emoticon ':)' emojis
      if (isEmoticon(raw) === true) {
        term.tag('Emoticon', 'emoticon-emoji', world);
        term.text = raw;
      }
    };

    var _05Emoji = tagEmoji;

    const steps = {
      lexicon: _01Lexicon,
      punctuation: _02Punctuation$1,
      regex: _03Prefixes,
      suffix: _04Suffixes,
      emoji: _05Emoji,
    };

    //'lookups' look at a term by itself
    const lookups = function (doc, terms) {
      let world = doc.world;
      //our list of known-words
      steps.lexicon(terms, world);

      //try these other methods
      for (let i = 0; i < terms.length; i += 1) {
        let term = terms[i];
        //or maybe some helpful punctuation
        steps.punctuation(terms, i, world);
        //mostly prefix checks
        steps.regex(term, world);
        //maybe we can guess
        steps.suffix(term, world);
        //emoji and emoticons
        steps.emoji(term, world);
      }
      return doc
    };
    var _01Init = lookups;

    //markov-like stats about co-occurance, for hints about unknown terms
    //basically, a little-bit better than the noun-fallback
    //just top n-grams from nlp tags, generated from nlp-corpus

    //after this word, here's what happens usually
    let afterThisWord = {
      i: 'Verb', //44% //i walk..
      first: 'Noun', //50% //first principles..
      it: 'Verb', //33%
      there: 'Verb', //35%
      not: 'Verb', //33%
      because: 'Noun', //31%
      if: 'Noun', //32%
      but: 'Noun', //26%
      who: 'Verb', //40%
      this: 'Noun', //37%
      his: 'Noun', //48%
      when: 'Noun', //33%
      you: 'Verb', //35%
      very: 'Adjective', // 39%
      old: 'Noun', //51%
      never: 'Verb', //42%
      before: 'Noun', //28%
    };

    //in advance of this word, this is what happens usually
    let beforeThisWord = {
      there: 'Verb', //23% // be there
      me: 'Verb', //31% //see me
      man: 'Adjective', // 80% //quiet man
      only: 'Verb', //27% //sees only
      him: 'Verb', //32% //show him
      were: 'Noun', //48% //we were
      took: 'Noun', //38% //he took
      himself: 'Verb', //31% //see himself
      went: 'Noun', //43% //he went
      who: 'Noun', //47% //person who
      jr: 'Person',
    };

    //following this POS, this is likely
    let afterThisPOS = {
      Adjective: 'Noun', //36% //blue dress
      Possessive: 'Noun', //41% //his song
      Determiner: 'Noun', //47%
      Adverb: 'Verb', //20%
      Pronoun: 'Verb', //40%
      Value: 'Noun', //47%
      Ordinal: 'Noun', //53%
      Modal: 'Verb', //35%
      Superlative: 'Noun', //43%
      Demonym: 'Noun', //38%
      Honorific: 'Person', //
    };

    //in advance of this POS, this is likely
    let beforeThisPOS = {
      Copula: 'Noun', //44% //spencer is
      PastTense: 'Noun', //33% //spencer walked
      Conjunction: 'Noun', //36%
      Modal: 'Noun', //38%
      Pluperfect: 'Noun', //40%
      PerfectTense: 'Verb', //32%
    };
    var markov = {
      beforeThisWord: beforeThisWord,
      afterThisWord: afterThisWord,

      beforeThisPos: beforeThisPOS,
      afterThisPos: afterThisPOS,
    };

    const afterKeys = Object.keys(markov.afterThisPos);
    const beforeKeys = Object.keys(markov.beforeThisPos);

    const checkNeighbours = function(terms, world) {
      for (let i = 0; i < terms.length; i += 1) {
        let term = terms[i];
        //do we still need a tag?
        if (term.isKnown() === true) {
          continue
        }
        //ok, this term needs a tag.
        //look at previous word for clues..
        let lastTerm = terms[i - 1];
        if (lastTerm) {
          // 'foobar term'
          if (markov.afterThisWord.hasOwnProperty(lastTerm.clean) === true) {
            let tag = markov.afterThisWord[lastTerm.clean];
            term.tag(tag, 'after-' + lastTerm.clean, world);
            continue
          }
          // 'Tag term'
          // (look at previous POS tags for clues..)
          let foundTag = afterKeys.find(tag => lastTerm.tags[tag]);
          if (foundTag !== undefined) {
            let tag = markov.afterThisPos[foundTag];
            term.tag(tag, 'after-' + foundTag, world);
            continue
          }
        }

        //look at next word for clues..
        let nextTerm = terms[i + 1];
        if (nextTerm) {
          // 'term foobar'
          if (markov.beforeThisWord.hasOwnProperty(nextTerm.clean) === true) {
            let tag = markov.beforeThisWord[nextTerm.clean];
            term.tag(tag, 'before-' + nextTerm.clean, world);
            continue
          }
          // 'term Tag'
          // (look at next POS tags for clues..)
          let foundTag = beforeKeys.find(tag => nextTerm.tags[tag]);
          if (foundTag !== undefined) {
            let tag = markov.beforeThisPos[foundTag];
            term.tag(tag, 'before-' + foundTag, world);
            continue
          }
        }
      }
    };
    var _01Neighbours = checkNeighbours;

    const titleCase$4 = /^[A-Z][a-z'\u00C0-\u00FF]/;
    const hasNumber = /[0-9]/;

    /** look for any grammar signals based on capital/lowercase */
    const checkCase = function(doc) {
      let world = doc.world;
      doc.list.forEach(p => {
        let terms = p.terms();
        for (let i = 1; i < terms.length; i++) {
          const term = terms[i];
          if (titleCase$4.test(term.text) === true && hasNumber.test(term.text) === false) {
            term.tag('ProperNoun', 'titlecase-noun', world);
          }
        }
      });
    };
    var _02Case = checkCase;

    const hasPrefix = /^(re|un)-?[a-z\u00C0-\u00FF]/;
    const prefix = /^(re|un)-?/;

    /** check 'rewatch' in lexicon as 'watch' */
    const checkPrefix = function(terms, world) {
      let lex = world.words;
      terms.forEach(term => {
        // skip if we have a good tag already
        if (term.isKnown() === true) {
          return
        }
        //does it start with 'un|re'
        if (hasPrefix.test(term.clean) === true) {
          // look for the root word in the lexicon:
          let stem = term.clean.replace(prefix, '');
          if (stem && stem.length > 3 && lex[stem] !== undefined && lex.hasOwnProperty(stem) === true) {
            term.tag(lex[stem], 'stem-' + stem, world);
          }
        }
      });
    };
    var _03Stem = checkPrefix;

    //similar to plural/singularize rules, but not the same
    const isPlural = [
      /(^v)ies$/i,
      /ises$/i,
      /ives$/i,
      /(antenn|formul|nebul|vertebr|vit)ae$/i,
      /(octop|vir|radi|nucle|fung|cact|stimul)i$/i,
      /(buffal|tomat|tornad)oes$/i,
      /(analy|ba|diagno|parenthe|progno|synop|the)ses$/i,
      /(vert|ind|cort)ices$/i,
      /(matr|append)ices$/i,
      /(x|ch|ss|sh|s|z|o)es$/i,
      /is$/i,
      /men$/i,
      /news$/i,
      /.tia$/i,
      /(^f)ves$/i,
      /(lr)ves$/i,
      /(^aeiouy|qu)ies$/i,
      /(m|l)ice$/i,
      /(cris|ax|test)es$/i,
      /(alias|status)es$/i,
      /ics$/i,
    ];

    //similar to plural/singularize rules, but not the same
    const isSingular = [
      /(ax|test)is$/i,
      /(octop|vir|radi|nucle|fung|cact|stimul)us$/i,
      /(octop|vir)i$/i,
      /(rl)f$/i,
      /(alias|status)$/i,
      /(bu)s$/i,
      /(al|ad|at|er|et|ed|ad)o$/i,
      /(ti)um$/i,
      /(ti)a$/i,
      /sis$/i,
      /(?:(^f)fe|(lr)f)$/i,
      /hive$/i,
      /s[aeiou]+ns$/i, // sans, siens
      /(^aeiouy|qu)y$/i,
      /(x|ch|ss|sh|z)$/i,
      /(matr|vert|ind|cort)(ix|ex)$/i,
      /(m|l)ouse$/i,
      /(m|l)ice$/i,
      /(antenn|formul|nebul|vertebr|vit)a$/i,
      /.sis$/i,
      /^(?!talis|.*hu)(.*)man$/i,
    ];
    var isPlural_1 = {
      isSingular: isSingular,
      isPlural: isPlural,
    };

    //these tags don't have plurals
    const noPlurals = ['Uncountable', 'Pronoun', 'Place', 'Value', 'Person', 'Month', 'WeekDay', 'Holiday'];

    const notPlural = [/ss$/, /sis$/, /[^aeiou][uo]s$/, /'s$/];
    const notSingular = [/i$/, /ae$/];

    /** turn nouns into singular/plural */
    const checkPlural = function(t, world) {
      if (t.tags.Noun && !t.tags.Acronym) {
        let str = t.clean;
        //skip existing tags, fast
        if (t.tags.Singular || t.tags.Plural) {
          return
        }
        //too short
        if (str.length <= 3) {
          t.tag('Singular', 'short-singular', world);
          return
        }
        //is it impossible to be plural?
        if (noPlurals.find(tag => t.tags[tag])) {
          return
        }
        // isPlural suffix rules
        if (isPlural_1.isPlural.find(reg => reg.test(str))) {
          t.tag('Plural', 'plural-rules', world);
          return
        }
        // isSingular suffix rules
        if (isPlural_1.isSingular.find(reg => reg.test(str))) {
          t.tag('Singular', 'singular-rules', world);
          return
        }

        // finally, fallback 'looks plural' rules..
        if (/s$/.test(str) === true) {
          //avoid anything too sketchy to be plural
          if (notPlural.find(reg => reg.test(str))) {
            return
          }
          t.tag('Plural', 'plural-fallback', world);
          return
        }
        //avoid anything too sketchy to be singular
        if (notSingular.find(reg => reg.test(str))) {
          return
        }
        t.tag('Singular', 'singular-fallback', world);
      }
    };
    var _04Plurals = checkPlural;

    //nouns that also signal the title of an unknown organization
    //todo remove/normalize plural forms
    const orgWords = [
      'academy',
      'administration',
      'agence',
      'agences',
      'agencies',
      'agency',
      'airlines',
      'airways',
      'army',
      'assoc',
      'associates',
      'association',
      'assurance',
      'authority',
      'autorite',
      'aviation',
      'bank',
      'banque',
      'board',
      'boys',
      'brands',
      'brewery',
      'brotherhood',
      'brothers',
      'building society',
      'bureau',
      'cafe',
      'caisse',
      'capital',
      'care',
      'cathedral',
      'center',
      'central bank',
      'centre',
      'chemicals',
      'choir',
      'chronicle',
      'church',
      'circus',
      'clinic',
      'clinique',
      'club',
      'co',
      'coalition',
      'coffee',
      'collective',
      'college',
      'commission',
      'committee',
      'communications',
      'community',
      'company',
      'comprehensive',
      'computers',
      'confederation',
      'conference',
      'conseil',
      'consulting',
      'containers',
      'corporation',
      'corps',
      'corp',
      'council',
      'crew',
      'daily news',
      'data',
      'departement',
      'department',
      'department store',
      'departments',
      'design',
      'development',
      'directorate',
      'division',
      'drilling',
      'education',
      'eglise',
      'electric',
      'electricity',
      'energy',
      'ensemble',
      'enterprise',
      'enterprises',
      'entertainment',
      'estate',
      'etat',
      'evening news',
      'faculty',
      'federation',
      'financial',
      'fm',
      'foundation',
      'fund',
      'gas',
      'gazette',
      'girls',
      'government',
      'group',
      'guild',
      'health authority',
      'herald',
      'holdings',
      'hospital',
      'hotel',
      'hotels',
      'inc',
      'industries',
      'institut',
      'institute',
      'institute of technology',
      'institutes',
      'insurance',
      'international',
      'interstate',
      'investment',
      'investments',
      'investors',
      'journal',
      'laboratory',
      'labs',
      // 'law',
      'liberation army',
      'limited',
      'local authority',
      'local health authority',
      'machines',
      'magazine',
      'management',
      'marine',
      'marketing',
      'markets',
      'media',
      'memorial',
      'mercantile exchange',
      'ministere',
      'ministry',
      'military',
      'mobile',
      'motor',
      'motors',
      'musee',
      'museum',
      // 'network',
      'news',
      'news service',
      'observatory',
      'office',
      'oil',
      'optical',
      'orchestra',
      'organization',
      'partners',
      'partnership',
      // 'party',
      "people's party",
      'petrol',
      'petroleum',
      'pharmacare',
      'pharmaceutical',
      'pharmaceuticals',
      'pizza',
      'plc',
      'police',
      'polytechnic',
      'post',
      'power',
      'press',
      'productions',
      'quartet',
      'radio',
      'regional authority',
      'regional health authority',
      'reserve',
      'resources',
      'restaurant',
      'restaurants',
      'savings',
      'school',
      'securities',
      'service',
      'services',
      'social club',
      'societe',
      'society',
      'sons',
      'standard',
      'state police',
      'state university',
      'stock exchange',
      'subcommittee',
      'syndicat',
      'systems',
      'telecommunications',
      'telegraph',
      'television',
      'times',
      'tribunal',
      'tv',
      'union',
      'university',
      'utilities',
      'workers',
    ];

    var organizations = orgWords.reduce(function(h, str) {
      h[str] = 'Noun';
      return h
    }, {});

    //could this word be an organization
    const maybeOrg = function(t) {
      //must be a noun
      if (!t.tags.Noun) {
        return false
      }
      //can't be these things
      if (t.tags.Pronoun || t.tags.Comma || t.tags.Possessive) {
        return false
      }
      //must be one of these
      if (t.tags.Organization || t.tags.Acronym || t.tags.Place || t.titleCase()) {
        return true
      }
      return false
    };

    const tagOrgs = function(terms, world) {
      for (let i = 0; i < terms.length; i += 1) {
        let t = terms[i];
        if (organizations[t.clean] !== undefined && organizations.hasOwnProperty(t.clean) === true) {
          // look-backward - eg. 'Toronto University'
          let lastTerm = terms[i - 1];
          if (lastTerm !== undefined && maybeOrg(lastTerm) === true) {
            lastTerm.tagSafe('Organization', 'org-word-1', world);
            t.tagSafe('Organization', 'org-word-2', world);
            continue
          }
          //look-forward - eg. University of Toronto
          let nextTerm = terms[i + 1];
          if (nextTerm !== undefined && nextTerm.clean === 'of') {
            if (terms[i + 2] && maybeOrg(terms[i + 2])) {
              t.tagSafe('Organization', 'org-of-word-1', world);
              nextTerm.tagSafe('Organization', 'org-of-word-2', world);
              terms[i + 2].tagSafe('Organization', 'org-of-word-3', world);
              continue
            }
          }
        }
      }
    };
    var _05Organizations = tagOrgs;

    const oneLetterAcronym$1 = /^[A-Z]('s|,)?$/;
    const periodSeperated = /([A-Z]\.){2}[A-Z]?/i;

    const oneLetterWord = {
      I: true,
      A: true,
    };

    const isAcronym$2 = function(term, world) {
      let str = term.reduced;
      // a known acronym like fbi
      if (term.tags.Acronym) {
        return true
      }
      // if (term.tags.Adverb || term.tags.Verb || term.tags.Value || term.tags.Plural) {
      //   return false
      // }
      // known-words, like 'PIZZA' is not an acronym.
      if (world.words[str]) {
        return false
      }
      return term.isAcronym()
    };

    // F.B.I., NBC, - but not 'NO COLLUSION'
    const checkAcronym = function(terms, world) {
      terms.forEach(term => {
        //these are not acronyms
        if (term.tags.RomanNumeral === true) {
          return
        }
        //period-ones F.D.B.
        if (periodSeperated.test(term.text) === true) {
          term.tag('Acronym', 'period-acronym', world);
        }
        //non-period ones are harder
        if (term.isUpperCase() && isAcronym$2(term, world)) {
          term.tag('Acronym', 'acronym-step', world);
          term.tag('Noun', 'acronym-infer', world);
        } else if (!oneLetterWord.hasOwnProperty(term.text) && oneLetterAcronym$1.test(term.text)) {
          term.tag('Acronym', 'one-letter-acronym', world);
          term.tag('Noun', 'one-letter-infer', world);
        }
        //if it's a organization,
        if (term.tags.Organization && term.text.length <= 3) {
          term.tag('Acronym', 'acronym-org', world);
        }
        if (term.tags.Organization && term.isUpperCase() && term.text.length <= 6) {
          term.tag('Acronym', 'acronym-org-case', world);
        }
      });
    };
    var _06Acronyms = checkAcronym;

    const step = {
      neighbours: _01Neighbours,
      case: _02Case,
      stem: _03Stem,
      plural: _04Plurals,
      organizations: _05Organizations,
      acronyms: _06Acronyms,
    };
    //
    const fallbacks = function(doc, terms) {
      let world = doc.world;

      // if it's empty, consult it's neighbours, first
      step.neighbours(terms, world);

      // is there a case-sensitive clue?
      step.case(doc);

      // check 'rewatch' as 'watch'
      step.stem(terms, world);

      // ... fallback to a noun!
      terms.forEach(t => {
        if (t.isKnown() === false) {
          t.tag('Noun', 'noun-fallback', doc.world);
        }
      });

      // turn 'Foo University' into an Org
      step.organizations(terms, world);

      //turn 'FBD' into an acronym
      step.acronyms(terms, world);

      //are the nouns singular or plural?
      terms.forEach(t => {
        step.plural(t, doc.world);
      });

      return doc
    };
    var _02Fallbacks = fallbacks;

    const hasNegative = /n't$/;

    const irregulars$3 = {
      "won't": ['will', 'not'],
      wont: ['will', 'not'],
      "can't": ['can', 'not'],
      cant: ['can', 'not'],
      cannot: ['can', 'not'],
      "shan't": ['should', 'not'],
      dont: ['do', 'not'],
      dun: ['do', 'not'],
      // "ain't" is ambiguous for is/was
    };

    // either 'is not' or 'are not'
    const doAint = function(term, phrase) {
      let terms = phrase.terms();
      let index = terms.indexOf(term);
      let before = terms.slice(0, index);
      //look for the preceding noun
      let noun = before.find(t => {
        return t.tags.Noun
      });
      if (noun && noun.tags.Plural) {
        return ['are', 'not']
      }
      return ['is', 'not']
    };

    const checkNegative = function(term, phrase) {
      //check named-ones
      if (irregulars$3.hasOwnProperty(term.clean) === true) {
        return irregulars$3[term.clean]
      }
      //this word needs it's own logic:
      if (term.clean === `ain't` || term.clean === 'aint') {
        return doAint(term, phrase)
      }
      //try it normally
      if (hasNegative.test(term.clean) === true) {
        let main = term.clean.replace(hasNegative, '');
        return [main, 'not']
      }
      return null
    };
    var _01Negative = checkNegative;

    const contraction = /([a-z\u00C0-\u00FF]+)[\u0027\u0060\u00B4\u2018\u2019\u201A\u201B\u2032\u2035\u2039\u203A]([a-z]{1,2})$/i;

    //these ones don't seem to be ambiguous
    const easy = {
      ll: 'will',
      ve: 'have',
      re: 'are',
      m: 'am',
      "n't": 'not',
    };
    //
    const checkApostrophe = function(term) {
      let parts = term.text.match(contraction);
      if (parts === null) {
        return null
      }
      if (easy.hasOwnProperty(parts[2])) {
        return [parts[1], easy[parts[2]]]
      }
      return null
    };
    var _02Simple = checkApostrophe;

    const irregulars$4 = {
      wanna: ['want', 'to'],
      gonna: ['going', 'to'],
      im: ['i', 'am'],
      alot: ['a', 'lot'],
      ive: ['i', 'have'],
      imma: ['I', 'will'],

      "where'd": ['where', 'did'],
      whered: ['where', 'did'],
      "when'd": ['when', 'did'],
      whend: ['when', 'did'],
      // "how'd": ['how', 'did'], //'how would?'
      // "what'd": ['what', 'did'], //'what would?'
      howd: ['how', 'did'],
      whatd: ['what', 'did'],
      // "let's": ['let', 'us'], //too weird

      //multiple word contractions
      dunno: ['do', 'not', 'know'],
      brb: ['be', 'right', 'back'],
      gtg: ['got', 'to', 'go'],
      irl: ['in', 'real', 'life'],
      tbh: ['to', 'be', 'honest'],
      imo: ['in', 'my', 'opinion'],
      til: ['today', 'i', 'learned'],
      rn: ['right', 'now'],
      twas: ['it', 'was'],
      '@': ['at'],
    };

    //
    const checkIrregulars = function(term) {
      //check white-list
      if (irregulars$4.hasOwnProperty(term.clean)) {
        return irregulars$4[term.clean]
      }
      return null
    };
    var _03Irregulars = checkIrregulars;

    const hasApostropheS = /([a-z\u00C0-\u00FF]+)[\u0027\u0060\u00B4\u2018\u2019\u201A\u201B\u2032\u2035\u2039\u203A]s$/i;

    const banList = {
      that: true,
      there: true,
    };
    const isPossessive = (term, pool) => {
      // if we already know it
      if (term.tags.Possessive) {
        return true
      }
      //a pronoun can't be possessive - "he's house"
      if (term.tags.Pronoun || term.tags.QuestionWord) {
        return false
      }
      if (banList.hasOwnProperty(term.reduced)) {
        return false
      }
      //if end of sentence, it is possessive - "was spencer's"
      let nextTerm = pool.get(term.next);
      if (!nextTerm) {
        return true
      }
      //a gerund suggests 'is walking'
      if (nextTerm.tags.Verb) {
        //fix 'jamie's bite'
        if (nextTerm.tags.Infinitive) {
          return true
        }
        //fix 'spencer's runs'
        if (nextTerm.tags.PresentTense) {
          return true
        }
        return false
      }

      //spencer's house
      if (nextTerm.tags.Noun) {
        return true
      }
      //rocket's red glare
      let twoTerm = pool.get(nextTerm.next);
      if (twoTerm && twoTerm.tags.Noun && !twoTerm.tags.Pronoun) {
        return true
      }
      //othwerwise, an adjective suggests 'is good'
      if (nextTerm.tags.Adjective || nextTerm.tags.Adverb || nextTerm.tags.Verb) {
        return false
      }
      return false
    };

    const isHas = (term, phrase) => {
      let terms = phrase.terms();
      let index = terms.indexOf(term);
      let after = terms.slice(index + 1, index + 3);
      //look for a past-tense verb
      return after.find(t => {
        return t.tags.PastTense
      })
    };

    const checkPossessive = function (term, phrase, world) {
      //the rest of 's
      let found = term.text.match(hasApostropheS);
      if (found !== null) {
        //spencer's thing vs spencer-is
        if (isPossessive(term, phrase.pool) === true) {
          term.tag('#Possessive', 'isPossessive', world);
          return null
        }
        //'spencer is'
        if (found !== null) {
          if (isHas(term, phrase)) {
            return [found[1], 'has']
          }
          return [found[1], 'is']
        }
      }
      return null
    };
    var _04Possessive = checkPossessive;

    const hasPerfect = /[a-z\u00C0-\u00FF]'d$/;

    const useDid = {
      how: true,
      what: true,
    };

    /** split `i'd` into 'i had',  or 'i would'  */
    const checkPerfect = function(term, phrase) {
      if (hasPerfect.test(term.clean)) {
        let root = term.clean.replace(/'d$/, '');
        //look at the next few words
        let terms = phrase.terms();
        let index = terms.indexOf(term);
        let after = terms.slice(index + 1, index + 4);
        //is it before a past-tense verb? - 'i'd walked'
        for (let i = 0; i < after.length; i++) {
          let t = after[i];
          if (t.tags.Verb) {
            if (t.tags.PastTense) {
              return [root, 'had']
            }
            //what'd you see
            if (useDid[root] === true) {
              return [root, 'did']
            }
            return [root, 'would']
          }
        }
        //otherwise, 'i'd walk'
        return [root, 'would']
      }
      return null
    };
    var _05PerfectTense = checkPerfect;

    const isRange = /^([0-9]+)[-–—]([0-9]+)$/i;

    //split '2-4' into '2 to 4'
    const checkRange = function(term) {
      if (term.tags.PhoneNumber === true) {
        return null
      }
      let parts = term.text.match(isRange);
      if (parts !== null) {
        return [parts[1], 'to', parts[2]]
      }
      return null
    };
    var _06Ranges = checkRange;

    const contraction$1 = /^(l|c|d|j|m|n|qu|s|t)[\u0027\u0060\u00B4\u2018\u2019\u201A\u201B\u2032\u2035\u2039\u203A]([a-z\u00C0-\u00FF]+)$/i;
    // basic support for ungendered french contractions
    // not perfect, but better than nothing, to support matching on french text.

    const french = {
      l: 'le', // l'amour
      c: 'ce', // c'est
      d: 'de', // d'amerique
      j: 'je', // j'aime
      m: 'me', // m'appelle
      n: 'ne', // n'est
      qu: 'que', // qu'il
      s: 'se', // s'appelle
      t: 'tu', // t'aime
    };

    const checkFrench = function(term) {
      let parts = term.text.match(contraction$1);
      if (parts === null || french.hasOwnProperty(parts[1]) === false) {
        return null
      }
      let arr = [french[parts[1]], parts[2]];
      if (arr[0] && arr[1]) {
        return arr
      }
      return null
    };
    var _07French = checkFrench;

    const isNumber = /^[0-9]+$/;

    const createPhrase = function(found, doc) {
      //create phrase from ['would', 'not']
      let phrase = _01Tokenizer(found.join(' '), doc.world, doc.pool())[0];
      //tag it
      let terms = phrase.terms();
      _01Lexicon(terms, doc.world);
      //make these terms implicit
      terms.forEach(t => {
        t.implicit = t.text;
        t.text = '';
        t.clean = '';
        // remove whitespace for implicit terms
        t.pre = '';
        t.post = '';
        // tag number-ranges
        if (isNumber.test(t.implicit)) {
          t.tags.Number = true;
          t.tags.Cardinal = true;
        }
      });
      return phrase
    };

    const contractions = function(doc) {
      let world = doc.world;
      doc.list.forEach(p => {
        let terms = p.terms();
        for (let i = 0; i < terms.length; i += 1) {
          let term = terms[i];
          let found = _01Negative(term, p);
          found = found || _02Simple(term);
          found = found || _03Irregulars(term);
          found = found || _04Possessive(term, p, world);
          found = found || _05PerfectTense(term, p);
          found = found || _06Ranges(term);
          found = found || _07French(term);
          //add them in
          if (found !== null) {
            let newPhrase = createPhrase(found, doc);
            // keep tag NumberRange, if we had it
            if (p.has('#NumberRange') === true) {
              doc.buildFrom([newPhrase]).tag('NumberRange');
            }
            //set text as contraction
            let firstTerm = newPhrase.terms(0);
            firstTerm.text = term.text;
            //grab sub-phrase to remove
            let match = p.buildFrom(term.id, 1, doc.pool());
            match.replace(newPhrase, doc, true);
          }
        }
      });
      return doc
    };
    var _03Contractions = contractions;

    const hasWord = function (doc, word) {
      let arr = doc._cache.words[word] || [];
      arr = arr.map(i => doc.list[i]);
      return doc.buildFrom(arr)
    };
    const hasTag = function (doc, tag) {
      let arr = doc._cache.tags[tag] || [];
      arr = arr.map(i => doc.list[i]);
      return doc.buildFrom(arr)
    };

    //mostly pos-corections here
    const miscCorrection = function (doc) {
      //exactly like
      let m = hasWord(doc, 'like');
      m.match('#Adverb like')
        .notIf('(really|generally|typically|usually|sometimes|often) [like]')
        .tag('Adverb', 'adverb-like');

      //the orange.
      m = hasTag(doc, 'Adjective');
      m.match('#Determiner #Adjective$').notIf('(#Comparative|#Superlative)').terms(1).tag('Noun', 'the-adj-1');

      // Firstname x (dangerous)
      m = hasTag(doc, 'FirstName');
      m.match('#FirstName (#Noun|@titleCase)')
        .ifNo('^#Possessive')
        .ifNo('#Pronoun')
        .ifNo('@hasComma .')
        .lastTerm()
        .tag('#LastName', 'firstname-noun');

      //three trains / one train
      m = hasTag(doc, 'Value');
      m = m.match('#Value #PresentTense');
      if (m.found) {
        if (m.has('(one|1)') === true) {
          m.terms(1).tag('Singular', 'one-presentTense');
        } else {
          m.terms(1).tag('Plural', 'value-presentTense');
        }
      }

      // well i've been...
      doc.match('^(well|so|okay)').tag('Expression', 'well-');

      //been walking
      m = hasTag(doc, 'Gerund');
      m.match(`(be|been) (#Adverb|not)+? #Gerund`).not('#Verb$').tag('Auxiliary', 'be-walking');

      // directive verb - 'use reverse'
      doc
        .match('(try|use|attempt|build|make) #Verb')
        .ifNo('(@hasComma|#Negative|#Copula|will|be)')
        .lastTerm()
        .tag('#Noun', 'do-verb');

      //possessives
      //'her match' vs 'let her match'
      m = hasTag(doc, 'Possessive');
      m = m.match('#Possessive [#Infinitive]', 0);
      if (!m.lookBehind('(let|made|make|force|ask)').found) {
        m.tag('Noun', 'her-match');
      }

      return doc
    };

    var fixMisc = miscCorrection;

    const unique$5 = function(arr) {
      let obj = {};
      for (let i = 0; i < arr.length; i++) {
        obj[arr[i]] = true;
      }
      return Object.keys(obj)
    };
    var _unique = unique$5;

    // order matters
    const list = [
      // ==== Mutliple tags ====
      { match: 'too much', tag: 'Adverb Adjective', reason: 'bit-4' },
      // u r cool
      { match: 'u r', tag: 'Pronoun Copula', reason: 'u r' },
      //sometimes adverbs - 'pretty good','well above'
      {
        match: '#Copula (pretty|dead|full|well) (#Adjective|#Noun)',
        tag: '#Copula #Adverb #Adjective',
        reason: 'sometimes-adverb',
      },

      //walking is cool
      { match: '[#Gerund] #Adverb? not? #Copula', group: 0, tag: 'Activity', reason: 'gerund-copula' },
      //walking should be fun
      { match: '[#Gerund] #Modal', group: 0, tag: 'Activity', reason: 'gerund-modal' },

      //swear-words as non-expression POS
      { match: 'holy (shit|fuck|hell)', tag: 'Expression', reason: 'swears-expression' },
      //Aircraft designer
      { match: '#Noun #Actor', tag: 'Actor', reason: 'thing-doer' },
      { match: '#Conjunction [u]', group: 0, tag: 'Pronoun', reason: 'u-pronoun-2' },
      //'u' as pronoun
      { match: '[u] #Verb', group: 0, tag: 'Pronoun', reason: 'u-pronoun-1' },

      // ==== Determiners ====
      { match: '#Noun [(who|whom)]', group: 0, tag: 'Determiner', reason: 'captain-who' },
      //that car goes
      { match: 'that #Noun [#Verb]', group: 0, tag: 'Determiner', reason: 'that-determiner' },
      { match: 'a bit much', tag: 'Determiner Adverb Adjective', reason: 'bit-3' },

      // ==== Propositions ====
      //all students
      { match: '#Verb #Adverb? #Noun [(that|which)]', group: 0, tag: 'Preposition', reason: 'that-prep' },
      //work, which has been done.
      { match: '@hasComma [which] (#Pronoun|#Verb)', group: 0, tag: 'Preposition', reason: 'which-copula' },
      { match: 'just [like]', group: 0, tag: 'Preposition', reason: 'like-preposition' },
      //folks like her
      { match: '#Noun [like] #Noun', group: 0, tag: 'Preposition', reason: 'noun-like' },
      //fix for busted-up phrasalVerbs
      { match: '#Noun [#Particle]', group: 0, tag: 'Preposition', reason: 'repair-noPhrasal' },

      // ==== Conditions ====
      // had he survived,
      { match: '[had] #Noun+ #PastTense', group: 0, tag: 'Condition', reason: 'had-he' },
      // were he to survive
      { match: '[were] #Noun+ to #Infinitive', group: 0, tag: 'Condition', reason: 'were-he' },

      // ==== Questions ====
      //the word 'how'
      { match: '^how', tag: 'QuestionWord', reason: 'how-question' },
      { match: '[how] (#Determiner|#Copula|#Modal|#PastTense)', group: 0, tag: 'QuestionWord', reason: 'how-is' },
      // //the word 'which'
      { match: '^which', tag: 'QuestionWord', reason: 'which-question' },
      { match: '[which] . (#Noun)+ #Pronoun', group: 0, tag: 'QuestionWord', reason: 'which-question2' },
      // { match: 'which', tag: 'QuestionWord', reason: 'which-question3' },

      // ==== Conjunctions ====
      { match: '[so] #Noun', group: 0, tag: 'Conjunction', reason: 'so-conj' },
      //how he is driving
      {
        match: '[(who|what|where|why|how|when)] #Noun #Copula #Adverb? (#Verb|#Adjective)',
        group: 0,
        tag: 'Conjunction',
        reason: 'how-he-is-x',
      },
      {
        match: '[(who|what|where|why|how|when)] #Noun #Adverb? #Infinitive not? #Gerund',
        group: 0,
        tag: 'Conjunction',
        reason: 'when i go fishing',
      },
    ];

    var _01Misc = list;

    //Dates: 'june' or 'may'
    const dates = '(april|june|may|jan|august|eve)';

    let list$1 = [
      // ==== Holiday ====
      { match: '#Holiday (day|eve)', tag: 'Holiday', reason: 'holiday-day' }, // the captain who

      // ==== WeekDay ====
      // sun the 5th
      { match: '[sun] the #Ordinal', tag: 'WeekDay', reason: 'sun-the-5th' },
      //sun feb 2
      { match: '[sun] #Date', group: 0, tag: 'WeekDay', reason: 'sun-feb' },
      //1pm next sun
      { match: '#Date (on|this|next|last|during)? [sun]', group: 0, tag: 'WeekDay', reason: '1pm-sun' },
      //this sat
      { match: `(in|by|before|during|on|until|after|of|within|all) [sat]`, group: 0, tag: 'WeekDay', reason: 'sat' },
      //sat november
      { match: '[sat] #Date', group: 0, tag: 'WeekDay', reason: 'sat-feb' },

      // ==== Month ====
      //all march
      { match: `#Preposition [(march|may)]`, group: 0, tag: 'Month', reason: 'in-month' },
      //this march
      { match: `this [(march|may)]`, group: 0, tag: 'Month', reason: 'this-month' },
      { match: `next [(march|may)]`, group: 0, tag: 'Month', reason: 'this-month' },
      { match: `last [(march|may)]`, group: 0, tag: 'Month', reason: 'this-month' },
      // march 5th
      { match: `[(march|may)] the? #Value`, group: 0, tag: 'Month', reason: 'march-5th' },
      // 5th of march
      { match: `#Value of? [(march|may)]`, group: 0, tag: 'Month', reason: '5th-of-march' },
      // march and feb
      { match: `[(march|may)] .? #Date`, group: 0, tag: 'Month', reason: 'march-and-feb' },
      // feb to march
      { match: `#Date .? [(march|may)]`, group: 0, tag: 'Month', reason: 'feb-and-march' },
      //quickly march
      { match: `#Adverb [(march|may)]`, group: 0, tag: 'Verb', reason: 'quickly-march' },
      //march quickly
      { match: `[(march|may)] #Adverb`, group: 0, tag: 'Verb', reason: 'march-quickly' },

      //5th of March
      { match: '#Value of #Month', tag: 'Date', reason: 'value-of-month' },
      //5 March
      { match: '#Cardinal #Month', tag: 'Date', reason: 'cardinal-month' },
      //march 5 to 7
      { match: '#Month #Value to #Value', tag: 'Date', reason: 'value-to-value' },
      //march the 12th
      { match: '#Month the #Value', tag: 'Date', reason: 'month-the-value' },
      //june 7
      { match: '(#WeekDay|#Month) #Value', tag: 'Date', reason: 'date-value' },
      //7 june
      { match: '#Value (#WeekDay|#Month)', tag: 'Date', reason: 'value-date' },
      //may twenty five
      { match: '(#TextValue && #Date) #TextValue', tag: 'Date', reason: 'textvalue-date' },

      // in june
      { match: `in [${dates}]`, group: 0, tag: 'Date', reason: 'in-june' },
      { match: `during [${dates}]`, group: 0, tag: 'Date', reason: 'in-june' },
      { match: `on [${dates}]`, group: 0, tag: 'Date', reason: 'in-june' },
      { match: `by [${dates}]`, group: 0, tag: 'Date', reason: 'in-june' },
      { match: `before [${dates}]`, group: 0, tag: 'Date', reason: 'in-june' },
      { match: `#Date [${dates}]`, group: 0, tag: 'Date', reason: 'in-june' },
      // june 1992
      { match: `${dates} #Value`, tag: 'Date', reason: 'june-5th' },
      { match: `${dates} #Date`, tag: 'Date', reason: 'june-5th' },
      // June Smith
      { match: `${dates} #ProperNoun`, tag: 'Person', reason: 'june-smith', safe: true },
      // june m. Cooper
      { match: `${dates} #Acronym? (#ProperNoun && !#Month)`, tag: 'Person', reason: 'june-smith-jr' },
      // 'second'
      { match: `#Cardinal [second]`, tag: 'Unit', reason: 'one-second' },
    ];

    var _02Dates = list$1;

    var _03Noun = [
      // ==== Plural ====
      //there are reasons
      { match: 'there (are|were) #Adjective? [#PresentTense]', group: 0, tag: 'Plural', reason: 'there-are' },

      // ==== Singular ====
      //the sun
      { match: '#Determiner [sun]', group: 0, tag: 'Singular', reason: 'the-sun' },
      //did a 900, paid a 20
      { match: '#Verb (a|an) [#Value]', group: 0, tag: 'Singular', reason: 'did-a-value' },
      //'the can'
      { match: '#Determiner [(can|will|may)]', group: 0, tag: 'Singular', reason: 'the can' },
      // ==== Possessive ====
      //spencer kelly's
      { match: '#FirstName #Acronym? (#Possessive && #LastName)', tag: 'Possessive', reason: 'name-poss' },
      //Super Corp's fundraiser
      { match: '#Organization+ #Possessive', tag: 'Possessive', reason: 'org-possessive' },
      //Los Angeles's fundraiser
      { match: '#Place+ #Possessive', tag: 'Possessive', reason: 'place-possessive' },
      // assign all tasks
      { match: '#Verb (all|every|each|most|some|no) [#PresentTense]', group: 0, tag: 'Noun', reason: 'all-presentTense' },
      //big dreams, critical thinking
      { match: '(#Adjective && !all) [#PresentTense]', group: 0, tag: 'Noun', reason: 'adj-presentTense' },
      //his fine
      { match: '(his|her|its) [#Adjective]', group: 0, tag: 'Noun', reason: 'his-fine' },
      //some pressing issues
      { match: 'some [#Verb] #Plural', group: 0, tag: 'Noun', reason: 'determiner6' },
      //'more' is not always an adverb
      { match: 'more #Noun', tag: 'Noun', reason: 'more-noun' },
      { match: '(#Noun && @hasComma) #Noun (and|or) [#PresentTense]', group: 0, tag: 'Noun', reason: 'noun-list' }, //3 feet
      { match: '(right|rights) of .', tag: 'Noun', reason: 'right-of' }, // a bit
      { match: 'a [bit]', group: 0, tag: 'Noun', reason: 'bit-2' },

      //running-a-show
      { match: '#Gerund #Determiner [#Infinitive]', group: 0, tag: 'Noun', reason: 'running-a-show' },
      //the-only-reason
      { match: '#Determiner #Adverb [#Infinitive]', group: 0, tag: 'Noun', reason: 'the-reason' },
      //the nice swim
      { match: '(the|this|those|these) #Adjective [#Verb]', group: 0, tag: 'Noun', reason: 'the-adj-verb' },
      // the truly nice swim
      { match: '(the|this|those|these) #Adverb #Adjective [#Verb]', group: 0, tag: 'Noun', reason: 'determiner4' },
      //the orange is
      { match: '#Determiner [#Adjective] (#Copula|#PastTense|#Auxiliary)', group: 0, tag: 'Noun', reason: 'the-adj-2' },
      // a stream runs
      { match: '(the|this|a|an) [#Infinitive] #Adverb? #Verb', group: 0, tag: 'Noun', reason: 'determiner5' },
      //the test string
      { match: '#Determiner [#Infinitive] #Noun', group: 0, tag: 'Noun', reason: 'determiner7' },
      //by a bear.
      { match: '#Determiner #Adjective [#Infinitive]$', group: 0, tag: 'Noun', reason: 'a-inf' },
      //the wait to vote
      { match: '(the|this) [#Verb] #Preposition .', group: 0, tag: 'Noun', reason: 'determiner1' },
      //a sense of
      { match: '#Determiner [#Verb] of', group: 0, tag: 'Noun', reason: 'the-verb-of' },
      //the threat of force
      { match: '#Determiner #Noun of [#Verb]', group: 0, tag: 'Noun', reason: 'noun-of-noun' },
      //the western line
      {
        match: '#Determiner [(western|eastern|northern|southern|central)] #Noun',
        group: 0,
        tag: 'Noun',
        reason: 'western-line',
      },

      //her polling
      { match: '#Possessive [#Gerund]', group: 0, tag: 'Noun', reason: 'her-polling' },
      //her fines
      { match: '(his|her|its) [#PresentTense]', group: 0, tag: 'Noun', reason: 'its-polling' },

      //linear algebra
      {
        match: '(#Determiner|#Value) [(linear|binary|mobile|lexical|technical|computer|scientific|formal)] #Noun',
        group: 0,
        tag: 'Noun',
        reason: 'technical-noun',
      },
      // walk the walk
      { match: '(the|those|these) #Adjective? [#Infinitive]', group: 0, tag: 'Noun', reason: 'det-inf' },
      { match: '(the|those|these) #Adjective? [#PresentTense]', group: 0, tag: 'Noun', reason: 'det-pres' },
      { match: '(the|those|these) #Adjective? [#PastTense]', group: 0, tag: 'Noun', reason: 'det-past' },

      //air-flow
      { match: '(#Noun && @hasHyphen) #Verb', tag: 'Noun', reason: 'hyphen-verb' },
      //is no walk
      { match: 'is no [#Verb]', group: 0, tag: 'Noun', reason: 'is-no-verb' },
      //different views than
      { match: '[#Verb] than', group: 0, tag: 'Noun', reason: 'correction' },
      // goes to sleep
      { match: '(go|goes|went) to [#Infinitive]', group: 0, tag: 'Noun', reason: 'goes-to-verb' },
      //a great run
      { match: '(a|an) #Adjective [(#Infinitive|#PresentTense)]', tag: 'Noun', reason: 'a|an2' },
      //a tv show
      { match: '(a|an) #Noun [#Infinitive]', group: 0, tag: 'Noun', reason: 'a-noun-inf' },
      //do so
      { match: 'do [so]', group: 0, tag: 'Noun', reason: 'so-noun' },
      //is mark hughes
      { match: '#Copula [#Infinitive] #Noun', group: 0, tag: 'Noun', reason: 'is-pres-noun' },
      //
      // { match: '[#Infinitive] #Copula', group: 0, tag: 'Noun', reason: 'inf-copula' },
      //a close
      { match: '#Determiner #Adverb? [close]', group: 0, tag: 'Adjective', reason: 'a-close' },
      // what the hell
      { match: '#Determiner [(shit|damn|hell)]', group: 0, tag: 'Noun', reason: 'swears-noun' },
    ];

    const adjectives$1 = '(misty|rusty|dusty|rich|randy)';
    let list$2 = [
      // all fell apart
      { match: '[all] #Determiner? #Noun', group: 0, tag: 'Adjective', reason: 'all-noun' },
      // very rusty
      { match: `#Adverb [${adjectives$1}]`, group: 0, tag: 'Adjective', reason: 'really-rich' },
      // rusty smith
      { match: `${adjectives$1} #Person`, tag: 'Person', reason: 'randy-smith' },
      // rusty a. smith
      { match: `${adjectives$1} #Acronym? #ProperNoun`, tag: 'Person', reason: 'rusty-smith' },
      //sometimes not-adverbs
      { match: '#Copula [(just|alone)]$', group: 0, tag: 'Adjective', reason: 'not-adverb' },
      //jack is guarded
      { match: '#Singular is #Adverb? [#PastTense$]', group: 0, tag: 'Adjective', reason: 'is-filled' },
      // smoked poutine is
      { match: '[#PastTense] #Singular is', group: 0, tag: 'Adjective', reason: 'smoked-poutine' },
      // baked onions are
      { match: '[#PastTense] #Plural are', group: 0, tag: 'Adjective', reason: 'baked-onions' },
      //a staggering cost
      { match: '(a|an) [#Gerund]', group: 0, tag: 'Adjective', reason: 'a|an' },
      // is f*ed up
      { match: '#Copula [fucked up?]', tag: 'Adjective', reason: 'swears-adjective' },
      //jack seems guarded
      { match: '#Singular (seems|appears) #Adverb? [#PastTense$]', group: 0, tag: 'Adjective', reason: 'seems-filled' },
    ];

    var _04Adjective = list$2;

    var _05Adverb = [
      //still good
      { match: '[still] #Adjective', group: 0, tag: 'Adverb', reason: 'still-advb' },
      //still make
      { match: '[still] #Verb', group: 0, tag: 'Adverb', reason: 'still-verb' },
      // so hot
      { match: '[so] #Adjective', group: 0, tag: 'Adverb', reason: 'so-adv' },
      // all singing
      { match: '[all] #Verb', group: 0, tag: 'Adverb', reason: 'all-verb' },
      // sing like an angel
      { match: '#Verb [like]', group: 0, tag: 'Adverb', reason: 'verb-like' },
      //barely even walk
      { match: '(barely|hardly) even', tag: 'Adverb', reason: 'barely-even' },
      //cheering hard - dropped -ly's
      { match: '#PresentTense [(hard|quick|long|bright|slow)]', group: 0, tag: 'Adverb', reason: 'lazy-ly' },
      // much appreciated
      { match: '[much] #Adjective', group: 0, tag: 'Adverb', reason: 'bit-1' },
    ];

    var _06Value = [
      // ==== PhoneNumber ====
      //1 800 ...
      { match: '1 #Value #PhoneNumber', tag: 'PhoneNumber', reason: '1-800-Value' },
      //(454) 232-9873
      { match: '#NumericValue #PhoneNumber', tag: 'PhoneNumber', reason: '(800) PhoneNumber' },

      // ==== Currency ====
      // chinese yuan
      { match: '#Demonym #Currency', tag: 'Currency', reason: 'demonym-currency' },
      // ==== Ordinal ====
      { match: '[second] #Noun', group: 0, tag: 'Ordinal', reason: 'second-noun' },
      // ==== Unit ====
      //5 yan
      { match: '#Value+ [#Currency]', group: 0, tag: 'Unit', reason: '5-yan' },
      { match: '#Value [(foot|feet)]', group: 0, tag: 'Unit', reason: 'foot-unit' },

      //minus 7
      { match: '(minus|negative) #Value', tag: 'Value', reason: 'minus-value' },
      //5 kg.
      { match: '#Value [#Abbreviation]', group: 0, tag: 'Unit', reason: 'value-abbr' },
      { match: '#Value [k]', group: 0, tag: 'Unit', reason: 'value-k' },
      { match: '#Unit an hour', tag: 'Unit', reason: 'unit-an-hour' },
      //seven point five
      { match: '#Value (point|decimal) #Value', tag: 'Value', reason: 'value-point-value' },
      // ten bucks
      { match: '(#Value|a) [(buck|bucks|grand)]', group: 0, tag: 'Currency', reason: 'value-bucks' },
      //quarter million
      { match: '#Determiner [(half|quarter)] #Ordinal', group: 0, tag: 'Value', reason: 'half-ordinal' },
      { match: 'a #Value', tag: 'Value', reason: 'a-value' },

      // ==== Money ====
      { match: '[#Value+] #Currency', group: 0, tag: 'Money', reason: '15 usd' },
      // thousand and two
      {
        match: `(hundred|thousand|million|billion|trillion|quadrillion)+ and #Value`,
        tag: 'Value',
        reason: 'magnitude-and-value',
      },
      //'a/an' can mean 1 - "a hour"
      {
        match: '!once [(a|an)] (#Duration|hundred|thousand|million|billion|trillion)',
        group: 0,
        tag: 'Value',
        reason: 'a-is-one',
      },
    ];

    const verbs$1 = '(pat|wade|ollie|will|rob|buck|bob|mark|jack)';

    let list$3 = [
      // ==== Tense ====
      //he left
      { match: '#Noun #Adverb? [left]', group: 0, tag: 'PastTense', reason: 'left-verb' },
      //this rocks
      { match: '(this|that) [#Plural]', group: 0, tag: 'PresentTense', reason: 'this-verbs' },

      // ==== Auxiliary ====
      //was walking
      { match: `[#Copula (#Adverb|not)+?] (#Gerund|#PastTense)`, group: 0, tag: 'Auxiliary', reason: 'copula-walking' },
      //support a splattering of auxillaries before a verb
      { match: `[(has|had) (#Adverb|not)+?] #PastTense`, group: 0, tag: 'Auxiliary', reason: 'had-walked' },
      //would walk
      { match: `[#Adverb+? (#Modal|did)+ (#Adverb|not)+?] #Verb`, group: 0, tag: 'Auxiliary', reason: 'modal-verb' },
      //would have had
      {
        match: `[#Modal (#Adverb|not)+? have (#Adverb|not)+? had (#Adverb|not)+?] #Verb`,
        group: 0,
        tag: 'Auxiliary',
        reason: 'would-have',
      },
      //would be walking
      { match: `#Modal (#Adverb|not)+? be (#Adverb|not)+? #Verb`, group: 0, tag: 'Auxiliary', reason: 'would-be' },
      //had been walking
      {
        match: `(#Modal|had|has) (#Adverb|not)+? been (#Adverb|not)+? #Verb`,
        group: 0,
        tag: 'Auxiliary',
        reason: 'had-been',
      },
      //was walking
      { match: `[#Copula (#Adverb|not)+?] (#Gerund|#PastTense)`, group: 0, tag: 'Auxiliary', reason: 'copula-walking' },
      //support a splattering of auxillaries before a verb
      { match: `[(has|had) (#Adverb|not)+?] #PastTense`, group: 0, tag: 'Auxiliary', reason: 'had-walked' },
      // will walk
      { match: '[(do|does|will|have|had)] (not|#Adverb)? #Verb', group: 0, tag: 'Auxiliary', reason: 'have-had' },
      // about to go
      { match: '[about to] #Adverb? #Verb', group: 0, tag: ['Auxiliary', 'Verb'], reason: 'about-to' },
      //would be walking
      { match: `#Modal (#Adverb|not)+? be (#Adverb|not)+? #Verb`, group: 0, tag: 'Auxiliary', reason: 'would-be' },
      //would have had
      {
        match: `[#Modal (#Adverb|not)+? have (#Adverb|not)+? had (#Adverb|not)+?] #Verb`,
        group: 0,
        tag: 'Auxiliary',
        reason: 'would-have',
      },
      //had been walking
      {
        match: `(#Modal|had|has) (#Adverb|not)+? been (#Adverb|not)+? #Verb`,
        group: 0,
        tag: 'Auxiliary',
        reason: 'had-been',
      },

      // was being driven
      { match: '[(be|being|been)] #Participle', group: 0, tag: 'Auxiliary', reason: 'being-foo' },

      // ==== Phrasal ====
      //'foo-up'
      { match: '(#Verb && @hasHyphen) up', group: 0, tag: 'PhrasalVerb', reason: 'foo-up' },
      { match: '(#Verb && @hasHyphen) off', group: 0, tag: 'PhrasalVerb', reason: 'foo-off' },
      { match: '(#Verb && @hasHyphen) over', group: 0, tag: 'PhrasalVerb', reason: 'foo-over' },
      { match: '(#Verb && @hasHyphen) out', group: 0, tag: 'PhrasalVerb', reason: 'foo-out' },
      //fall over
      { match: '#PhrasalVerb [#PhrasalVerb]', group: 0, tag: 'Particle', reason: 'phrasal-particle' },

      // ==== Copula ====
      //will be running (not copula)
      { match: '[will #Adverb? not? #Adverb? be] #Gerund', group: 0, tag: 'Copula', reason: 'will-be-copula' },
      //for more complex forms, just tag 'be'
      { match: 'will #Adverb? not? #Adverb? [be] #Adjective', group: 0, tag: 'Copula', reason: 'be-copula' },

      // ==== Infinitive ====
      //march to
      { match: '[march] (up|down|back|to|toward)', group: 0, tag: 'Infinitive', reason: 'march-to' },
      //must march
      { match: '#Modal [march]', group: 0, tag: 'Infinitive', reason: 'must-march' },
      //let him glue
      {
        match: '(let|make|made) (him|her|it|#Person|#Place|#Organization)+ [#Singular] (a|an|the|it)',
        group: 0,
        tag: 'Infinitive',
        reason: 'let-him-glue',
      },

      //he quickly foo
      { match: '#Noun #Adverb [#Noun]', group: 0, tag: 'Verb', reason: 'quickly-foo' },
      //will secure our
      { match: 'will [#Adjective]', group: 0, tag: 'Verb', reason: 'will-adj' },
      //he disguised the thing
      { match: '#Pronoun [#Adjective] #Determiner #Adjective? #Noun', group: 0, tag: 'Verb', reason: 'he-adj-the' },

      //is eager to go
      { match: '#Copula [#Adjective to] #Verb', group: 0, tag: 'Verb', reason: 'adj-to' },
      // open the door
      { match: '[open] #Determiner', group: 0, tag: 'Infinitive', reason: 'open-the' },

      // would wade
      { match: `#Modal [${verbs$1}]`, group: 0, tag: 'Verb', reason: 'would-mark' },
      { match: `#Adverb [${verbs$1}]`, group: 0, tag: 'Verb', reason: 'really-mark' },
      // wade smith
      { match: `${verbs$1} #Person`, tag: 'Person', reason: 'rob-smith' },
      // wade m. Cooper
      { match: `${verbs$1} #Acronym? #ProperNoun`, tag: 'Person', reason: 'rob-a-smith' },

      // damn them
      { match: '[shit] (#Determiner|#Possessive|them)', group: 0, tag: 'Verb', reason: 'swear1-verb' },
      { match: '[damn] (#Determiner|#Possessive|them)', group: 0, tag: 'Verb', reason: 'swear2-verb' },
      { match: '[fuck] (#Determiner|#Possessive|them)', group: 0, tag: 'Verb', reason: 'swear3-verb' },
    ];

    var _07Verbs = list$3;

    const places = '(paris|alexandria|houston|kobe|salvador|sydney)';
    let list$4 = [
      // ==== Region ====
      //West Norforlk
      {
        match: '(west|north|south|east|western|northern|southern|eastern)+ #Place',

        tag: 'Region',
        reason: 'west-norfolk',
      },
      //some us-state acronyms (exlude: al, in, la, mo, hi, me, md, ok..)
      {
        match: '#City [(al|ak|az|ar|ca|ct|dc|fl|ga|id|il|nv|nh|nj|ny|oh|or|pa|sc|tn|tx|ut|vt|pr)]',
        group: 0,
        tag: 'Region',
        reason: 'us-state',
      },
      //Foo District
      {
        match: '#ProperNoun+ (district|region|province|county|prefecture|municipality|territory|burough|reservation)',
        tag: 'Region',
        reason: 'foo-district',
      },
      //District of Foo
      {
        match: '(district|region|province|municipality|territory|burough|state) of #ProperNoun',
        tag: 'Region',
        reason: 'district-of-Foo',
      },
      // in Foo California
      {
        match: 'in [#ProperNoun] #Place',
        group: 0,
        tag: 'Place',
        reason: 'propernoun-place',
      },

      // ==== Address ====
      {
        match: '#Value #Noun (st|street|rd|road|crescent|cr|way|tr|terrace|avenue|ave)',
        tag: 'Address',
        reason: 'address-st',
      },

      // in houston
      { match: `in [${places}]`, group: 0, tag: 'Place', reason: 'in-paris' },
      { match: `near [${places}]`, group: 0, tag: 'Place', reason: 'near-paris' },
      { match: `at [${places}]`, group: 0, tag: 'Place', reason: 'at-paris' },
      { match: `from [${places}]`, group: 0, tag: 'Place', reason: 'from-paris' },
      { match: `to [${places}]`, group: 0, tag: 'Place', reason: 'to-paris' },
      { match: `#Place [${places}]`, group: 0, tag: 'Place', reason: 'tokyo-paris' },
      // houston texas
      { match: `[${places}] #Place`, group: 0, tag: 'Place', reason: 'paris-france' },
    ];
    var _08Place = list$4;

    var _09Org = [
      //John & Joe's
      { match: '#Noun (&|n) #Noun', tag: 'Organization', reason: 'Noun-&-Noun' },
      // teachers union of Ontario
      { match: '#Organization of the? #ProperNoun', tag: 'Organization', reason: 'org-of-place', safe: true },
      //walmart USA
      { match: '#Organization #Country', tag: 'Organization', reason: 'org-country' },
      //organization
      { match: '#ProperNoun #Organization', tag: 'Organization', reason: 'titlecase-org' },
      //FitBit Inc
      { match: '#ProperNoun (ltd|co|inc|dept|assn|bros)', tag: 'Organization', reason: 'org-abbrv' },
      // the OCED
      { match: 'the [#Acronym]', group: 0, tag: 'Organization', reason: 'the-acronym', safe: true },
      // global trade union
      {
        match: '(world|global|international|national|#Demonym) #Organization',

        tag: 'Organization',
        reason: 'global-org',
      },
      // schools
      { match: '#Noun+ (public|private) school', tag: 'School', reason: 'noun-public-school' },
    ];

    const nouns$1 =
      '(rose|robin|dawn|ray|holly|bill|joy|viola|penny|sky|violet|daisy|melody|kelvin|hope|mercedes|olive|jewel|faith|van|charity|miles|lily|summer|dolly|rod|dick|cliff|lane|reed|kitty|art|jean|trinity)';

    const months = '(january|april|may|june|jan|sep)'; //summer|autumn

    let list$5 = [
      // ==== Honorific ====
      { match: '[(1st|2nd|first|second)] #Honorific', group: 0, tag: 'Honorific', reason: 'ordinal-honorific' },
      {
        match: '[(private|general|major|corporal|lord|lady|secretary|premier)] #Honorific? #Person',
        group: 0,
        tag: 'Honorific',
        reason: 'ambg-honorifics',
      },

      // ==== FirstNames ====
      //is foo Smith
      { match: '#Copula [(#Noun|#PresentTense)] #LastName', group: 0, tag: 'FirstName', reason: 'copula-noun-lastname' },
      //pope francis
      { match: '(lady|queen|sister) #ProperNoun', tag: 'FemaleName', reason: 'lady-titlecase', safe: true },
      { match: '(king|pope|father) #ProperNoun', tag: 'MaleName', reason: 'pope-titlecase', safe: true },
      //ambiguous-but-common firstnames
      {
        match: '[(will|may|april|june|said|rob|wade|ray|rusty|drew|miles|jack|chuck|randy|jan|pat|cliff|bill)] #LastName',
        group: 0,
        tag: 'FirstName',
        reason: 'maybe-lastname',
      },

      // ==== Nickname ====
      // Dwayne 'the rock' Johnson
      { match: '#FirstName [#Determiner #Noun] #LastName', group: 0, tag: 'NickName', reason: 'first-noun-last' },

      //my buddy
      { match: '#Possessive [#FirstName]', group: 0, tag: 'Person', reason: 'possessive-name' },
      { match: '#Acronym #ProperNoun', tag: 'Person', reason: 'acronym-titlecase', safe: true }, //ludwig van beethovan
      { match: '#Person (jr|sr|md)', tag: 'Person', reason: 'person-honorific' }, //peter II
      { match: '#Person #Person the? #RomanNumeral', tag: 'Person', reason: 'roman-numeral' }, //'Professor Fink', 'General McCarthy'
      { match: '#FirstName [/^[^aiurck]$/]', group: 0, tag: ['Acronym', 'Person'], reason: 'john-e' }, //Doctor john smith jr
      //general pearson
      { match: '#Honorific #Person', tag: 'Person', reason: 'honorific-person' },
      //remove single 'mr'
      { match: '#Honorific #Acronym', tag: 'Person', reason: 'Honorific-TitleCase' },
      //j.k Rowling
      { match: '#Noun van der? #Noun', tag: 'Person', reason: 'von der noun', safe: true },
      //king of spain
      { match: '(king|queen|prince|saint|lady) of? #Noun', tag: 'Person', reason: 'king-of-noun', safe: true },
      //Foo U Ford
      { match: '[#ProperNoun] #Person', group: 0, tag: 'Person', reason: 'proper-person', safe: true },
      // al sharpton
      { match: 'al (#Person|#ProperNoun)', tag: 'Person', reason: 'al-borlen', safe: true },
      //ferdinand de almar
      { match: '#FirstName de #Noun', tag: 'Person', reason: 'bill-de-noun' },
      //Osama bin Laden
      { match: '#FirstName (bin|al) #Noun', tag: 'Person', reason: 'bill-al-noun' },
      //John L. Foo
      { match: '#FirstName #Acronym #ProperNoun', tag: 'Person', reason: 'bill-acronym-title' },
      //Andrew Lloyd Webber
      { match: '#FirstName #FirstName #ProperNoun', tag: 'Person', reason: 'bill-firstname-title' },
      //Mr Foo
      { match: '#Honorific #FirstName? #ProperNoun', tag: 'Person', reason: 'dr-john-Title' },
      //peter the great
      { match: '#FirstName the #Adjective', tag: 'Person', reason: 'name-the-great' },
      //very common-but-ambiguous lastnames
      {
        match: '#FirstName (green|white|brown|hall|young|king|hill|cook|gray|price)',

        tag: 'Person',
        reason: 'bill-green',
      },
      // faith smith
      { match: `${nouns$1} #Person`, tag: 'Person', reason: 'ray-smith', safe: true },
      // faith m. Smith
      { match: `${nouns$1} #Acronym? #ProperNoun`, tag: 'Person', reason: 'ray-a-smith', safe: true },
      //give to april
      {
        match: `#Infinitive #Determiner? #Adjective? #Noun? (to|for) [${months}]`,
        group: 0,
        tag: 'Person',
        reason: 'ambig-person',
      },
      // remind june
      { match: `#Infinitive [${months}]`, group: 0, tag: 'Person', reason: 'infinitive-person' },
      // may waits for
      { match: `[${months}] #PresentTense for`, group: 0, tag: 'Person', reason: 'ambig-active-for' },
      // may waits to
      { match: `[${months}] #PresentTense to`, group: 0, tag: 'Person', reason: 'ambig-active-to' },
      // april will
      { match: `[${months}] #Modal`, group: 0, tag: 'Person', reason: 'ambig-modal' },
      // would april
      { match: `#Modal [${months}]`, group: 0, tag: 'Person', reason: 'modal-ambig' },
      // it is may
      { match: `#Copula [${months}]`, group: 0, tag: 'Person', reason: 'is-may' },
      // may is
      { match: `[${months}] #Copula`, group: 0, tag: 'Person', reason: 'may-is' },
      // with april
      { match: `that [${months}]`, group: 0, tag: 'Person', reason: 'that-month' },
      // with april
      { match: `with [${months}]`, group: 0, tag: 'Person', reason: 'with-month' },
      // for april
      { match: `for [${months}]`, group: 0, tag: 'Person', reason: 'for-month' },
      // this april
      { match: `this [${months}]`, group: 0, tag: 'Month', reason: 'this-may' }, //maybe not 'this'
      // next april
      { match: `next [${months}]`, group: 0, tag: 'Month', reason: 'next-may' },
      // last april
      { match: `last [${months}]`, group: 0, tag: 'Month', reason: 'last-may' },
      // wednesday april
      { match: `#Date [${months}]`, group: 0, tag: 'Month', reason: 'date-may' },
      // may 5th
      { match: `[${months}] the? #Value`, group: 0, tag: 'Month', reason: 'may-5th' },
      // 5th of may
      { match: `#Value of [${months}]`, group: 0, tag: 'Month', reason: '5th-of-may' },
      // dick van dyke
      { match: '#ProperNoun (van|al|bin) #ProperNoun', tag: 'Person', reason: 'title-van-title', safe: true },
      //jose de Sucre
      { match: '#ProperNoun (de|du) la? #ProperNoun', tag: 'Person', reason: 'title-de-title', safe: true },
      //Jani K. Smith
      { match: '#Singular #Acronym #LastName', tag: '#Person', reason: 'title-acro-noun', safe: true },
      //John Foo
      { match: '#FirstName (#Noun && #ProperNoun) #ProperNoun?', tag: 'Person', reason: 'firstname-titlecase' },
      //Joe K. Sombrero
      { match: '#FirstName #Acronym #Noun', tag: 'Person', reason: 'n-acro-noun', safe: true },
    ];
    var _10People = list$5;

    let matches = [];
    matches = matches.concat(_01Misc);
    matches = matches.concat(_02Dates);
    matches = matches.concat(_03Noun);
    matches = matches.concat(_04Adjective);
    matches = matches.concat(_05Adverb);
    matches = matches.concat(_06Value);
    matches = matches.concat(_07Verbs);
    matches = matches.concat(_08Place);
    matches = matches.concat(_09Org);
    matches = matches.concat(_10People);

    // cache the easier conditions up-front
    const cacheRequired$1 = function(reg) {
      let needTags = [];
      let needWords = [];
      reg.forEach(obj => {
        if (obj.optional === true || obj.negative === true) {
          return
        }
        if (obj.tag !== undefined) {
          needTags.push(obj.tag);
        }
        if (obj.word !== undefined) {
          needWords.push(obj.word);
        }
      });
      return { tags: _unique(needTags), words: _unique(needWords) }
    };

    const allLists = function(m) {
      let more = [];
      let lists = m.reg.filter(r => r.oneOf !== undefined);
      if (lists.length === 1) {
        let i = m.reg.findIndex(r => r.oneOf !== undefined);
        Object.keys(m.reg[i].oneOf).forEach(w => {
          let newM = Object.assign({}, m);
          newM.reg = newM.reg.slice(0);
          newM.reg[i] = Object.assign({}, newM.reg[i]);
          newM.reg[i].word = w;
          delete newM.reg[i].operator;
          delete newM.reg[i].oneOf;
          newM.reason += '-' + w;
          more.push(newM);
        });
      }
      return more
    };

    // parse them
    let all = [];
    matches.forEach(m => {
      m.reg = syntax_1(m.match);
      let enumerated = allLists(m);
      if (enumerated.length > 0) {
        all = all.concat(enumerated);
      } else {
        all.push(m);
      }
    });

    all.forEach(m => {
      m.required = cacheRequired$1(m.reg);
      return m
    });

    var matches_1 = all;

    // return intersection of array-of-arrays
    const hasEvery = function(chances) {
      if (chances.length === 0) {
        return []
      }
      let obj = {};
      chances.forEach(arr => {
        arr = _unique(arr);
        for (let i = 0; i < arr.length; i++) {
          obj[arr[i]] = obj[arr[i]] || 0;
          obj[arr[i]] += 1;
        }
      });
      let res = Object.keys(obj);
      res = res.filter(k => obj[k] === chances.length);
      res = res.map(num => Number(num));
      return res
    };

    const runner = function(doc) {
      //find phrases to try for each match
      matches_1.forEach(m => {
        let allChances = [];
        m.required.words.forEach(w => {
          allChances.push(doc._cache.words[w] || []);
        });
        m.required.tags.forEach(tag => {
          allChances.push(doc._cache.tags[tag] || []);
        });

        let worthIt = hasEvery(allChances);
        if (worthIt.length === 0) {
          return
        }

        let phrases = worthIt.map(index => doc.list[index]);
        let tryDoc = doc.buildFrom(phrases);
        // phrases getting tagged
        let match = tryDoc.match(m.reg, m.group);
        if (match.found) {
          if (m.safe === true) {
            match.tagSafe(m.tag, m.reason);
          } else {
            match.tag(m.tag, m.reason);
          }
        }
      });
    };
    var runner_1 = runner;

    // runner: 250ms
    // misc: 40ms

    //sequence of match-tag statements to correct mis-tags
    const corrections = function (doc) {
      runner_1(doc);
      fixMisc(doc);
      return doc
    };
    var _04Correction = corrections;

    /** POS-tag all terms in this document */
    const tagger = function(doc) {
      let terms = doc.termList();
      // check against any known-words
      doc = _01Init(doc, terms);
      // everything has gotta be something. ¯\_(:/)_/¯
      doc = _02Fallbacks(doc, terms);
      // support "didn't" & "spencer's"
      doc = _03Contractions(doc);
      //set our cache, to speed things up
      doc.cache();
      // wiggle-around the results, so they make more sense
      doc = _04Correction(doc);
      // remove our cache, as it's invalidated now
      doc.uncache();
      // run any user-given tagger functions
      doc.world.taggers.forEach(fn => {
        fn(doc);
      });
      return doc
    };
    var _02Tagger = tagger;

    const addMethod = function(Doc) {
      /**  */
      class Abbreviations extends Doc {
        stripPeriods() {
          this.termList().forEach(t => {
            if (t.tags.Abbreviation === true && t.next) {
              t.post = t.post.replace(/^\./, '');
            }
            let str = t.text.replace(/\./, '');
            t.set(str);
          });
          return this
        }
        addPeriods() {
          this.termList().forEach(t => {
            t.post = t.post.replace(/^\./, '');
            t.post = '.' + t.post;
          });
          return this
        }
      }
      Abbreviations.prototype.unwrap = Abbreviations.prototype.stripPeriods;

      Doc.prototype.abbreviations = function(n) {
        let match = this.match('#Abbreviation');
        if (typeof n === 'number') {
          match = match.get(n);
        }
        return new Abbreviations(match.list, this, this.world)
      };
      return Doc
    };
    var Abbreviations = addMethod;

    const hasPeriod = /\./;

    const addMethod$1 = function(Doc) {
      /**  */
      class Acronyms extends Doc {
        stripPeriods() {
          this.termList().forEach(t => {
            let str = t.text.replace(/\./g, '');
            t.set(str);
          });
          return this
        }
        addPeriods() {
          this.termList().forEach(t => {
            let str = t.text.replace(/\./g, '');
            str = str.split('').join('.');
            // don't add a end-period if there's a sentence-end one
            if (hasPeriod.test(t.post) === false) {
              str += '.';
            }
            t.set(str);
          });
          return this
        }
      }
      Acronyms.prototype.unwrap = Acronyms.prototype.stripPeriods;
      Acronyms.prototype.strip = Acronyms.prototype.stripPeriods;

      Doc.prototype.acronyms = function(n) {
        let match = this.match('#Acronym');
        if (typeof n === 'number') {
          match = match.get(n);
        }
        return new Acronyms(match.list, this, this.world)
      };
      return Doc
    };
    var Acronyms = addMethod$1;

    const addMethod$2 = function (Doc) {
      /** split into approximate sub-sentence phrases */
      Doc.prototype.clauses = function (n) {
        // an awkward way to disambiguate a comma use
        let commas = this.if('@hasComma')
          .notIf('@hasComma @hasComma') //fun, cool...
          .notIf('@hasComma . .? (and|or) .') //cool, and fun
          .notIf('(#City && @hasComma) #Country') //'toronto, canada'
          .notIf('(#WeekDay && @hasComma) #Date') //'tuesday, march 2nd'
          .notIf('(#Date && @hasComma) #Year') //'july 6, 1992'
          .notIf('@hasComma (too|also)$') //at end of sentence
          .match('@hasComma');
        let found = this.splitAfter(commas);

        let quotes = found.quotations();
        found = found.splitOn(quotes);

        let parentheses = found.parentheses();
        found = found.splitOn(parentheses);

        // it is cool and it is ..
        let conjunctions = found.if('#Copula #Adjective #Conjunction (#Pronoun|#Determiner) #Verb').match('#Conjunction');
        found = found.splitBefore(conjunctions);

        // if it is this then that
        let condition = found.if('if .{2,9} then .').match('then');
        found = found.splitBefore(condition);

        // misc clause partitions
        found = found.splitBefore('as well as .');
        found = found.splitBefore('such as .');
        found = found.splitBefore('in addition to .');

        // semicolons, dashes
        found = found.splitAfter('@hasSemicolon');
        found = found.splitAfter('@hasDash');

        // passive voice verb - '.. which was robbed is empty'
        // let passive = found.match('#Noun (which|that) (was|is) #Adverb? #PastTense #Adverb?')
        // if (passive.found) {
        //   found = found.splitAfter(passive)
        // }
        // //which the boy robbed
        // passive = found.match('#Noun (which|that) the? #Noun+ #Adverb? #PastTense #Adverb?')
        // if (passive.found) {
        //   found = found.splitAfter(passive)
        // }

        // does there appear to have relative/subordinate clause still?
        let tooLong = found.filter(d => d.wordCount() > 5 && d.match('#Verb+').length >= 2);
        if (tooLong.found) {
          let m = tooLong.splitAfter('#Noun .* #Verb .* #Noun+');
          found = found.splitOn(m.eq(0));
        }

        if (typeof n === 'number') {
          found = found.get(n);
        }
        return new Doc(found.list, this, this.world)
      };
      return Doc
    };
    var Clauses = addMethod$2;

    const addMethod$3 = function(Doc) {
      /**  */
      class Contractions extends Doc {
        constructor(list, from, world) {
          super(list, from, world);
          this.contracted = null;
        }
        /** turn didn't into 'did not' */
        expand() {
          this.list.forEach(p => {
            let terms = p.terms();
            //change the case?
            let isTitlecase = terms[0].isTitleCase();

            terms.forEach((t, i) => {
              //use the implicit text
              t.set(t.implicit || t.text);
              t.implicit = undefined;

              //add whitespace
              if (i < terms.length - 1 && t.post === '') {
                t.post += ' ';
              }
            });
            //set titlecase
            if (isTitlecase) {
              terms[0].toTitleCase();
            }
          });
          return this
        }
      }

      //find contractable, expanded-contractions
      // const findExpanded = r => {
      //   let remain = r.not('#Contraction')
      //   let m = remain.match('(#Noun|#QuestionWord) (#Copula|did|do|have|had|could|would|will)')
      //   m.concat(remain.match('(they|we|you|i) have'))
      //   m.concat(remain.match('i am'))
      //   m.concat(remain.match('(#Copula|#Modal|do|does|have|has|can|will) not'))
      //   return m
      // }

      Doc.prototype.contractions = function(n) {
        //find currently-contracted
        let found = this.match('@hasContraction+'); //(may want to split these up)
        //todo: split consecutive contractions
        if (typeof n === 'number') {
          found = found.get(n);
        }
        return new Contractions(found.list, this, this.world)
      };

      //aliases
      Doc.prototype.expanded = Doc.prototype.isExpanded;
      Doc.prototype.contracted = Doc.prototype.isContracted;
      return Doc
    };
    var Contractions = addMethod$3;

    const addMethod$4 = function(Doc) {
      //pull it apart..
      const parse = function(doc) {
        let things = doc
          .splitAfter('@hasComma')
          .splitOn('(and|or) not?')
          .not('(and|or) not?');
        let beforeLast = doc.match('[.] (and|or)', 0);
        return {
          things: things,
          conjunction: doc.match('(and|or) not?'),
          beforeLast: beforeLast,
          hasOxford: beforeLast.has('@hasComma'),
        }
      };

      /** cool, fun, and nice */
      class Lists extends Doc {
        /** coordinating conjunction */
        conjunctions() {
          return this.match('(and|or)')
        }
        /** split-up by list object */
        parts() {
          return this.splitAfter('@hasComma').splitOn('(and|or) not?')
        }
        /** remove the conjunction */
        items() {
          return parse(this).things
        }
        /** add a new unit to the list */
        add(str) {
          this.forEach(p => {
            let beforeLast = parse(p).beforeLast;
            beforeLast.append(str);
            //add a comma to it
            beforeLast.termList(0).addPunctuation(',');
          });
          return this
        }
        /** remove any matching unit from the list */
        remove(match) {
          return this.items()
            .if(match)
            .remove()
        }
        /** return only lists that use a serial comma */
        hasOxfordComma() {
          return this.filter(doc => parse(doc).hasOxford)
        }
        addOxfordComma() {
          let items = this.items();
          let needsComma = items.eq(items.length - 2);
          if (needsComma.found && needsComma.has('@hasComma') === false) {
            needsComma.post(', ');
          }
          return this
        }
        removeOxfordComma() {
          let items = this.items();
          let needsComma = items.eq(items.length - 2);
          if (needsComma.found && needsComma.has('@hasComma') === true) {
            needsComma.post(' ');
          }
          return this
        }
      }
      // aliases
      Lists.prototype.things = Lists.prototype.items;

      Doc.prototype.lists = function(n) {
        let m = this.if('@hasComma+ .? (and|or) not? .');

        // person-list
        let nounList = m
          .match('(#Noun|#Adjective|#Determiner|#Article)+ #Conjunction not? (#Article|#Determiner)? #Adjective? #Noun+')
          .if('#Noun');
        let adjList = m.match('(#Adjective|#Adverb)+ #Conjunction not? #Adverb? #Adjective+');
        let verbList = m.match('(#Verb|#Adverb)+ #Conjunction not? #Adverb? #Verb+');
        let result = nounList.concat(adjList);
        result = result.concat(verbList);
        result = result.if('@hasComma');

        if (typeof n === 'number') {
          result = m.get(n);
        }
        return new Lists(result.list, this, this.world)
      };
      return Doc
    };
    var Lists = addMethod$4;

    const noPlural =
      '(#Pronoun|#Place|#Value|#Person|#Uncountable|#Month|#WeekDay|#Holiday|#Possessive)';

    //certain words can't be plural, like 'peace'
    const hasPlural = function(doc) {
      if (doc.has('#Plural') === true) {
        return true
      }
      // these can't be plural
      if (doc.has(noPlural) === true) {
        return false
      }
      return true
    };

    var hasPlural_1 = hasPlural;

    //chooses an indefinite aricle 'a/an' for a word
    const irregulars$5 = {
      hour: 'an',
      heir: 'an',
      heirloom: 'an',
      honest: 'an',
      honour: 'an',
      honor: 'an',
      uber: 'an', //german u
    };
    //pronounced letters of acronyms that get a 'an'
    const an_acronyms = {
      a: true,
      e: true,
      f: true,
      h: true,
      i: true,
      l: true,
      m: true,
      n: true,
      o: true,
      r: true,
      s: true,
      x: true,
    };
    //'a' regexes
    const a_regexs = [
      /^onc?e/i, //'wu' sound of 'o'
      /^u[bcfhjkqrstn][aeiou]/i, // 'yu' sound for hard 'u'
      /^eul/i,
    ];

    const makeArticle = function(doc) {
      //no 'the john smith', but 'a london hotel'
      if (doc.has('#Person') || doc.has('#Place')) {
        return ''
      }
      //no a/an if it's plural
      if (doc.has('#Plural')) {
        return 'the'
      }
      let str = doc.text('normal').trim();
      //explicit irregular forms
      if (irregulars$5.hasOwnProperty(str)) {
        return irregulars$5[str]
      }
      //spelled-out acronyms
      let firstLetter = str.substr(0, 1);
      if (doc.has('^@isAcronym') && an_acronyms.hasOwnProperty(firstLetter)) {
        return 'an'
      }
      //'a' regexes
      for (let i = 0; i < a_regexs.length; i++) {
        if (a_regexs[i].test(str)) {
          return 'a'
        }
      }
      //basic vowel-startings
      if (/^[aeiou]/i.test(str)) {
        return 'an'
      }
      return 'a'
    };

    var getArticle = makeArticle;

    //similar to plural/singularize rules, but not the same
    const isPlural$1 = [
      /(antenn|formul|nebul|vertebr|vit)ae$/i,
      /(octop|vir|radi|nucle|fung|cact|stimul)i$/i,
      /men$/i,
      /.tia$/i,
      /(m|l)ice$/i,
    ];

    //similar to plural/singularize rules, but not the same
    const isSingular$1 = [
      /(ax|test)is$/i,
      /(octop|vir|radi|nucle|fung|cact|stimul)us$/i,
      /(octop|vir)i$/i,
      /(rl)f$/i,
      /(alias|status)$/i,
      /(bu)s$/i,
      /(al|ad|at|er|et|ed|ad)o$/i,
      /(ti)um$/i,
      /(ti)a$/i,
      /sis$/i,
      /(?:(^f)fe|(lr)f)$/i,
      /hive$/i,
      /(^aeiouy|qu)y$/i,
      /(x|ch|ss|sh|z)$/i,
      /(matr|vert|ind|cort)(ix|ex)$/i,
      /(m|l)ouse$/i,
      /(m|l)ice$/i,
      /(antenn|formul|nebul|vertebr|vit)a$/i,
      /.sis$/i,
      /^(?!talis|.*hu)(.*)man$/i,
    ];
    var _rules$2 = {
      isSingular: isSingular$1,
      isPlural: isPlural$1,
    };

    const endS = /s$/;
    // double-check this term, if it is not plural, or singular.
    // (this is a partial copy of ./tagger/fallbacks/plural)
    // fallback plural if it ends in an 's'.
    const isPlural$2 = function(str) {
      // isSingular suffix rules
      if (_rules$2.isSingular.find(reg => reg.test(str))) {
        return false
      }
      // does it end in an s?
      if (endS.test(str) === true) {
        return true
      }
      // is it a plural like 'fungi'?
      if (_rules$2.isPlural.find(reg => reg.test(str))) {
        return true
      }
      return null
    };
    var isPlural_1$1 = isPlural$2;

    const exceptions = {
      he: 'his',
      she: 'hers',
      they: 'theirs',
      we: 'ours',
      i: 'mine',
      you: 'yours',

      her: 'hers',
      their: 'theirs',
      our: 'ours',
      my: 'mine',
      your: 'yours',
    };

    // turn "David" to "David's"
    const toPossessive = function(doc) {
      let str = doc.text('text').trim();
      // exceptions
      if (exceptions.hasOwnProperty(str)) {
        doc.replaceWith(exceptions[str], true);
        doc.tag('Possessive', 'toPossessive');
        return
      }
      // flanders'
      if (/s$/.test(str)) {
        str += "'";
        doc.replaceWith(str, true);
        doc.tag('Possessive', 'toPossessive');
        return
      }
      //normal form:
      str += "'s";
      doc.replaceWith(str, true);
      doc.tag('Possessive', 'toPossessive');
      return
    };
    var toPossessive_1 = toPossessive;

    // .nouns() supports some noun-phrase-ish groupings
    // pull these apart, if necessary
    const parse$1 = function(doc) {
      let res = {
        main: doc,
      };
      //support 'mayor of chicago' as one noun-phrase
      if (doc.has('#Noun (of|by|for) .')) {
        let m = doc.splitAfter('[#Noun+]', 0);
        res.main = m.eq(0);
        res.post = m.eq(1);
      }
      return res
    };
    var parse_1 = parse$1;

    const methods$6 = {
      /** overload the original json with noun information */
      json: function (options) {
        let n = null;
        if (typeof options === 'number') {
          n = options;
          options = null;
        }
        options = options || { text: true, normal: true, trim: true, terms: true };
        let res = [];
        this.forEach((doc) => {
          let json = doc.json(options)[0];
          json.article = getArticle(doc);
          res.push(json);
        });
        if (n !== null) {
          return res[n]
        }
        return res
      },
      /** get all adjectives describing this noun*/
      adjectives: function () {
        let list = this.lookAhead('^(that|who|which)? (was|is|will)? be? #Adverb? #Adjective+');
        list = list.concat(this.lookBehind('#Adjective+ #Adverb?$'));
        list = list.match('#Adjective');
        return list.sort('index')
      },

      isPlural: function () {
        return this.if('#Plural') //assume tagger has run?
      },
      hasPlural: function () {
        return this.filter((d) => hasPlural_1(d))
      },
      toPlural: function (agree) {
        let toPlural = this.world.transforms.toPlural;
        this.forEach((doc) => {
          if (doc.has('#Plural') || hasPlural_1(doc) === false) {
            return
          }
          // double-check it isn't an un-tagged plural
          let main = parse_1(doc).main;
          let str = main.text('reduced');
          if (!main.has('#Singular') && isPlural_1$1(str) === true) {
            return
          }
          str = toPlural(str, this.world);
          main.replace(str).tag('#Plural');
          // 'an apple' -> 'apples'
          if (agree) {
            let an = main.lookBefore('(an|a) #Adjective?$').not('#Adjective');
            if (an.found === true) {
              an.remove();
            }
          }
        });
        return this
      },
      toSingular: function (agree) {
        let toSingular = this.world.transforms.toSingular;
        this.forEach((doc) => {
          if (doc.has('^#Singular+$') || hasPlural_1(doc) === false) {
            return
          }
          // double-check it isn't an un-tagged plural
          let main = parse_1(doc).main;
          let str = main.text('reduced');
          if (!main.has('#Plural') && isPlural_1$1(str) !== true) {
            return
          }
          str = toSingular(str, this.world);
          main.replace(str).tag('#Singular');
          // add an article
          if (agree) {
            // 'apples' -> 'an apple'
            let start = doc;
            let adj = doc.lookBefore('#Adjective');
            if (adj.found) {
              start = adj;
            }
            let article = getArticle(start);
            start.insertBefore(article);
          }
        });
        return this
      },
      toPossessive: function () {
        this.forEach((d) => {
          toPossessive_1(d);
        });
        return this
      },
    };
    var methods_1 = methods$6;

    const addMethod$5 = function(Doc) {
      /**  */
      class Nouns extends Doc {}
      // add-in our methods
      Object.assign(Nouns.prototype, methods_1);

      Doc.prototype.nouns = function(n) {
        // don't split 'paris, france'
        let keep = this.match('(#City && @hasComma) (#Region|#Country)');
        // but split the other commas
        let m = this.not(keep).splitAfter('@hasComma');
        // combine them back together
        m = m.concat(keep);

        m = m.match('#Noun+ (of|by)? the? #Noun+?');
        //nouns that we don't want in these results, for weird reasons
        m = m.not('#Pronoun');
        m = m.not('(there|these)');
        m = m.not('(#Month|#WeekDay)'); //allow Durations, Holidays
        // //allow possessives like "spencer's", but not generic ones like,
        m = m.not('(my|our|your|their|her|his)');
        m = m.not('(of|for|by|the)$');

        if (typeof n === 'number') {
          m = m.get(n);
        }
        return new Nouns(m.list, this, this.world)
      };
      return Doc
    };
    var Nouns = addMethod$5;

    const open = /\(/;
    const close = /\)/;

    const addMethod$6 = function(Doc) {
      /** anything between (these things) */
      class Parentheses extends Doc {
        /** remove the parentheses characters */
        unwrap() {
          this.list.forEach(p => {
            let first = p.terms(0);
            first.pre = first.pre.replace(open, '');
            let last = p.lastTerm();
            last.post = last.post.replace(close, '');
          });
          return this
        }
      }

      Doc.prototype.parentheses = function(n) {
        let list = [];
        this.list.forEach(p => {
          let terms = p.terms();
          //look for opening brackets
          for (let i = 0; i < terms.length; i += 1) {
            const t = terms[i];
            if (open.test(t.pre)) {
              //look for the closing bracket..
              for (let o = i; o < terms.length; o += 1) {
                if (close.test(terms[o].post)) {
                  let len = o - i + 1;
                  list.push(p.buildFrom(t.id, len));
                  i = o;
                  break
                }
              }
            }
          }
        });
        //support nth result
        if (typeof n === 'number') {
          if (list[n]) {
            list = [list[n]];
          } else {
            list = [];
          }
          return new Parentheses(list, this, this.world)
        }
        return new Parentheses(list, this, this.world)
      };

      return Doc
    };
    var Parentheses = addMethod$6;

    const addMethod$7 = function(Doc) {
      /**  */
      class Possessives extends Doc {
        constructor(list, from, world) {
          super(list, from, world);
          this.contracted = null;
        }
        /** turn didn't into 'did not' */
        strip() {
          this.list.forEach(p => {
            let terms = p.terms();
            terms.forEach(t => {
              let str = t.text.replace(/'s$/, '');
              t.set(str || t.text);
            });
          });
          return this
        }
      }

      //find contractable, expanded-contractions
      // const findExpanded = r => {
      //   let remain = r.not('#Contraction')
      //   let m = remain.match('(#Noun|#QuestionWord) (#Copula|did|do|have|had|could|would|will)')
      //   m.concat(remain.match('(they|we|you|i) have'))
      //   m.concat(remain.match('i am'))
      //   m.concat(remain.match('(#Copula|#Modal|do|does|have|has|can|will) not'))
      //   return m
      // }

      Doc.prototype.possessives = function(n) {
        //find currently-contracted
        let found = this.match('#Noun+? #Possessive');
        //todo: split consecutive contractions
        if (typeof n === 'number') {
          found = found.get(n);
        }
        return new Possessives(found.list, this, this.world)
      };
      return Doc
    };
    var Possessives = addMethod$7;

    const pairs = {
      '\u0022': '\u0022', // 'StraightDoubleQuotes'
      '\uFF02': '\uFF02', // 'StraightDoubleQuotesWide'
      '\u0027': '\u0027', // 'StraightSingleQuotes'
      '\u201C': '\u201D', // 'CommaDoubleQuotes'
      '\u2018': '\u2019', // 'CommaSingleQuotes'
      '\u201F': '\u201D', // 'CurlyDoubleQuotesReversed'
      '\u201B': '\u2019', // 'CurlySingleQuotesReversed'
      '\u201E': '\u201D', // 'LowCurlyDoubleQuotes'
      '\u2E42': '\u201D', // 'LowCurlyDoubleQuotesReversed'
      '\u201A': '\u2019', // 'LowCurlySingleQuotes'
      '\u00AB': '\u00BB', // 'AngleDoubleQuotes'
      '\u2039': '\u203A', // 'AngleSingleQuotes'
      // Prime 'non quotation'
      '\u2035': '\u2032', // 'PrimeSingleQuotes'
      '\u2036': '\u2033', // 'PrimeDoubleQuotes'
      '\u2037': '\u2034', // 'PrimeTripleQuotes'
      // Prime 'quotation' variation
      '\u301D': '\u301E', // 'PrimeDoubleQuotes'
      '\u0060': '\u00B4', // 'PrimeSingleQuotes'
      '\u301F': '\u301E', // 'LowPrimeDoubleQuotesReversed'
    };

    const hasOpen = RegExp('(' + Object.keys(pairs).join('|') + ')');

    const addMethod$8 = function(Doc) {
      /** "these things" */
      class Quotations extends Doc {
        /** remove the quote characters */
        unwrap() {
          return this
        }
      }

      Doc.prototype.quotations = function(n) {
        let list = [];
        this.list.forEach(p => {
          let terms = p.terms();
          //look for opening quotes
          for (let i = 0; i < terms.length; i += 1) {
            const t = terms[i];
            if (hasOpen.test(t.pre)) {
              let char = (t.pre.match(hasOpen) || [])[0];
              let want = pairs[char];
              // if (!want) {
              //   console.warn('missing quote char ' + char)
              // }
              //look for the closing bracket..
              for (let o = i; o < terms.length; o += 1) {
                if (terms[o].post.indexOf(want) !== -1) {
                  let len = o - i + 1;
                  list.push(p.buildFrom(t.id, len));
                  i = o;
                  break
                }
              }
            }
          }
        });
        //support nth result
        if (typeof n === 'number') {
          if (list[n]) {
            list = [list[n]];
          } else {
            list = [];
          }
          return new Quotations(list, this, this.world)
        }
        return new Quotations(list, this, this.world)
      };
      // alias
      Doc.prototype.quotes = Doc.prototype.quotations;

      return Doc
    };
    var Quotations = addMethod$8;

    // walked => walk  - turn a verb into it's root form
    const toInfinitive$1 = function (parsed, world) {
      let verb = parsed.verb;
      // console.log(parsed)
      // verb.debug()

      //1. if it's already infinitive
      let str = verb.text('normal');
      if (verb.has('#Infinitive')) {
        return str
      }

      // 2. world transform does the heavy-lifting
      let tense = null;
      if (verb.has('#PastTense')) {
        tense = 'PastTense';
      } else if (verb.has('#Gerund')) {
        tense = 'Gerund';
      } else if (verb.has('#PresentTense')) {
        tense = 'PresentTense';
      } else if (verb.has('#Participle')) {
        tense = 'Participle';
      } else if (verb.has('#Actor')) {
        tense = 'Actor';
      }
      return world.transforms.toInfinitive(str, world, tense)
    };
    var toInfinitive_1$1 = toInfinitive$1;

    // spencer walks -> singular
    // we walk -> plural

    // the most-recent noun-phrase, before this verb.
    const findNoun = function(vb) {
      let noun = vb.lookBehind('#Noun+').last();
      return noun
    };

    //sometimes you can tell if a verb is plural/singular, just by the verb
    // i am / we were
    // othertimes you need its subject 'we walk' vs 'i walk'
    const isPlural$3 = function(parsed) {
      let vb = parsed.verb;
      if (vb.has('(are|were|does)') || parsed.auxiliary.has('(are|were|does)')) {
        return true
      }
      if (vb.has('(is|am|do|was)') || parsed.auxiliary.has('(is|am|do|was)')) {
        return false
      }
      //consider its prior noun
      let noun = findNoun(vb);
      if (noun.has('(we|they|you)')) {
        return true
      }
      if (noun.has('#Plural')) {
        return true
      }
      if (noun.has('#Singular')) {
        return false
      }
      return null
    };
    var isPlural_1$2 = isPlural$3;

    // #Modal : would walk    -> 'would not walk'
    // #Copula : is           -> 'is not'
    // #PastTense : walked    -> did not walk
    // #PresentTense : walks  -> does not walk
    // #Gerund : walking:     -> not walking
    // #Infinitive : walk     -> do not walk

    const toNegative = function (parsed, world) {
      let vb = parsed.verb;
      // if it's already negative...
      if (parsed.negative.found) {
        return
      }

      // would walk -> would not walk
      if (parsed.auxiliary.found) {
        parsed.auxiliary.eq(0).append('not');
        // 'would not have' ➔ 'would not have'
        if (parsed.auxiliary.has('#Modal have not')) {
          parsed.auxiliary.replace('have not', 'not have');
        }
        return
      }
      // is walking -> is not walking
      if (vb.has('(#Copula|will|has|had|do)')) {
        vb.append('not');
        return
      }
      // walked -> did not walk
      if (vb.has('#PastTense')) {
        let inf = toInfinitive_1$1(parsed, world);
        vb.replaceWith(inf, true);
        vb.prepend('did not');
        return
      }
      // walks -> does not walk
      if (vb.has('#PresentTense')) {
        let inf = toInfinitive_1$1(parsed, world);
        vb.replaceWith(inf, true);
        if (isPlural_1$2(parsed)) {
          vb.prepend('do not');
        } else {
          vb.prepend('does not');
        }
        return
      }
      //walking -> not walking
      if (vb.has('#Gerund')) {
        let inf = toInfinitive_1$1(parsed, world);
        vb.replaceWith(inf, true);
        vb.prepend('not');
        return
      }

      //fallback 1:  walk -> does not walk
      if (isPlural_1$2(parsed)) {
        vb.prepend('does not');
        return
      }
      //fallback 2:  walk -> do not walk
      vb.prepend('do not');
      return
    };
    var toNegative_1 = toNegative;

    // turn 'would not really walk up' into parts
    const parseVerb = function (vb) {
      let parsed = {
        adverb: vb.match('#Adverb+'), // 'really'
        negative: vb.match('#Negative'), // 'not'
        auxiliary: vb.match('#Auxiliary+').not('(#Negative|#Adverb)'), // 'will' of 'will go'
        particle: vb.match('#Particle'), // 'up' of 'pull up'
        verb: vb.match('#Verb+').not('(#Adverb|#Negative|#Auxiliary|#Particle)'),
      };
      // fallback, if no verb found
      if (!parsed.verb.found) {
        // blank-everything
        Object.keys(parsed).forEach(k => {
          parsed[k] = parsed[k].not('.');
        });
        // it's all the verb
        parsed.verb = vb;
        return parsed
      }
      //
      if (parsed.adverb && parsed.adverb.found) {
        let match = parsed.adverb.text('reduced') + '$';
        if (vb.has(match)) {
          parsed.adverbAfter = true;
        }
      }
      return parsed
    };
    var parse$2 = parseVerb;

    /** too many special cases for is/was/will be*/
    const toBe = parsed => {
      let isI = false;
      let plural = isPlural_1$2(parsed);
      let isNegative = parsed.negative.found;
      //account for 'i is' -> 'i am' irregular
      // if (vb.parent && vb.parent.has('i #Adverb? #Copula')) {
      //   isI = true;
      // }

      // 'i look', not 'i looks'
      if (parsed.verb.lookBehind('(i|we) (#Adverb|#Verb)?$').found) {
        isI = true;
      }

      let obj = {
        PastTense: 'was',
        PresentTense: 'is',
        FutureTense: 'will be',
        Infinitive: 'is',
        Gerund: 'being',
        Actor: '',
        PerfectTense: 'been',
        Pluperfect: 'been',
      };
      //"i is" -> "i am"
      if (isI === true) {
        obj.PresentTense = 'am';
        obj.Infinitive = 'am';
      }
      if (plural) {
        obj.PastTense = 'were';
        obj.PresentTense = 'are';
        obj.Infinitive = 'are';
      }
      if (isNegative) {
        obj.PastTense += ' not';
        obj.PresentTense += ' not';
        obj.FutureTense = 'will not be';
        obj.Infinitive += ' not';
        obj.PerfectTense = 'not ' + obj.PerfectTense;
        obj.Pluperfect = 'not ' + obj.Pluperfect;
        obj.Gerund = 'not ' + obj.Gerund;
      }
      return obj
    };
    var toBe_1 = toBe;

    // 'may/could/should' -> 'may/could/should have'
    const doModal = function (parsed) {
      let str = parsed.verb.text();
      let res = {
        PastTense: str + ' have',
        PresentTense: str,
        FutureTense: str,
        Infinitive: str,
        // Gerund: ,
        // Actor: '',
        // PerfectTense: '',
        // Pluperfect: '',
      };
      return res
    };
    var doModal_1 = doModal;

    const conjugate$2 = function (parsed, world) {
      let verb = parsed.verb;

      //special handling of 'is', 'will be', etc.
      if (verb.has('#Copula') || (verb.out('normal') === 'be' && parsed.auxiliary.has('will'))) {
        return toBe_1(parsed)
      }

      // special handling of 'he could.'
      if (verb.has('#Modal')) {
        return doModal_1(parsed)
      }

      let hasHyphen = parsed.verb.termList(0).hasHyphen();

      let infinitive = toInfinitive_1$1(parsed, world);
      if (!infinitive) {
        return {}
      }
      let forms = world.transforms.conjugate(infinitive, world);
      forms.Infinitive = infinitive;

      // add particle to phrasal verbs ('fall over')
      if (parsed.particle.found) {
        let particle = parsed.particle.text();
        let space = hasHyphen === true ? '-' : ' ';
        Object.keys(forms).forEach(k => (forms[k] += space + particle));
      }
      //put the adverb at the end?
      // if (parsed.adverb.found) {
      // let adverb = parsed.adverb.text()
      // let space = hasHyphen === true ? '-' : ' '
      // if (parsed.adverbAfter === true) {
      //   Object.keys(forms).forEach(k => (forms[k] += space + adverb))
      // } else {
      //   Object.keys(forms).forEach(k => (forms[k] = adverb + space + forms[k]))
      // }
      // }

      //apply negative
      const isNegative = parsed.negative.found;
      if (isNegative) {
        forms.PastTense = 'did not ' + forms.Infinitive;
        forms.PresentTense = 'does not ' + forms.Infinitive;
        forms.Gerund = 'not ' + forms.Gerund;
      }
      //future Tense is pretty straightforward
      if (!forms.FutureTense) {
        if (isNegative) {
          forms.FutureTense = 'will not ' + forms.Infinitive;
        } else {
          forms.FutureTense = 'will ' + forms.Infinitive;
        }
      }
      if (isNegative) {
        forms.Infinitive = 'not ' + forms.Infinitive;
      }
      return forms
    };
    var conjugate_1$1 = conjugate$2;

    // 'i could drive' -> 'i could have driven'
    // if something is 'modal-ish' we are forced to use past-participle
    // ('i could drove' is wrong)
    const useParticiple = function (parsed) {
      if (parsed.auxiliary.has('(could|should|would|may|can|must)')) {
        return true
      }
      if (parsed.auxiliary.has('am .+? being')) {
        return true
      }
      if (parsed.auxiliary.has('had .+? been')) {
        return true
      }
      return false
    };

    // conjugate 'drive' ➔ 'have driven'
    const toParticiple = function (parsed, world) {
      //is it already a participle?
      if (parsed.auxiliary.has('(have|had)') && parsed.verb.has('#Participle')) {
        return
      }
      // try to swap the main verb to its participle form
      let obj = conjugate_1$1(parsed, world);
      let str = obj.Participle || obj.PastTense;
      if (str) {
        parsed.verb.replaceWith(str, false);
      }
      // 'am being driven' ➔ 'have been driven'
      if (parsed.auxiliary.has('am .+? being')) {
        parsed.auxiliary.remove('am');
        parsed.auxiliary.replace('being', 'have been');
      }

      // add a 'have'
      if (!parsed.auxiliary.has('have')) {
        parsed.auxiliary.append('have');
      }
      // tag it as a participle
      parsed.verb.tag('Participle', 'toParticiple');
      // turn 'i can swim' to -> 'i could swim'
      parsed.auxiliary.replace('can', 'could');
      //'must be' ➔ 'must have been'
      parsed.auxiliary.replace('be have', 'have been');
      //'not have' ➔ 'have not'
      parsed.auxiliary.replace('not have', 'have not');
      // ensure all new words are tagged right
      parsed.auxiliary.tag('Auxiliary');
    };

    var participle = {
      useParticiple: useParticiple,
      toParticiple: toParticiple,
    };

    const { toParticiple: toParticiple$1, useParticiple: useParticiple$1 } = participle;

    // remove any tense-information in auxiliary verbs
    const makeNeutral = function (parsed) {
      //remove tense-info from auxiliaries
      parsed.auxiliary.remove('(will|are|am|being)');
      parsed.auxiliary.remove('(did|does)');
      parsed.auxiliary.remove('(had|has|have)');
      //our conjugation includes the 'not' and the phrasal-verb particle
      parsed.particle.remove();
      parsed.negative.remove();
      return parsed
    };

    var methods$7 = {
      /** overload the original json with verb information */
      json: function (options) {
        let n = null;
        if (typeof options === 'number') {
          n = options;
          options = null;
        }
        options = options || { text: true, normal: true, trim: true, terms: true };
        let res = [];
        this.forEach(p => {
          let json = p.json(options)[0];
          let parsed = parse$2(p);
          json.parts = {};
          Object.keys(parsed).forEach(k => {
            if (parsed[k] && parsed[k].isA === 'Doc') {
              json.parts[k] = parsed[k].text('normal');
            } else {
              json.parts[k] = parsed[k];
            }
          });
          json.isNegative = p.has('#Negative');
          json.conjugations = conjugate_1$1(parsed, this.world);
          res.push(json);
        });
        if (n !== null) {
          return res[n]
        }
        return res
      },

      /** grab the adverbs describing these verbs */
      adverbs: function () {
        let list = [];
        // look at internal adverbs
        this.forEach(vb => {
          let advb = parse$2(vb).adverb;
          if (advb.found) {
            list = list.concat(advb.list);
          }
        });
        // look for leading adverbs
        let m = this.lookBehind('#Adverb+$');
        if (m.found) {
          list = m.list.concat(list);
        }
        // look for trailing adverbs
        m = this.lookAhead('^#Adverb+');
        if (m.found) {
          list = list.concat(m.list);
        }
        return this.buildFrom(list)
      },

      /// Verb Inflection
      /**return verbs like 'we walk' and not 'spencer walks' */
      isPlural: function () {
        let list = [];
        this.forEach(vb => {
          let parsed = parse$2(vb);
          if (isPlural_1$2(parsed, this.world) === true) {
            list.push(vb.list[0]);
          }
        });
        return this.buildFrom(list)
      },
      /** return verbs like 'spencer walks' and not 'we walk' */
      isSingular: function () {
        let list = [];
        this.forEach(vb => {
          let parsed = parse$2(vb);
          if (isPlural_1$2(parsed, this.world) === false) {
            list.push(vb.list[0]);
          }
        });
        return this.buildFrom(list)
      },

      /// Conjugation
      /** return all forms of this verb  */
      conjugate: function () {
        let result = [];
        this.forEach(vb => {
          let parsed = parse$2(vb);
          let forms = conjugate_1$1(parsed, this.world);
          result.push(forms);
        });
        return result
      },
      /** walk ➔ walked*/
      toPastTense: function () {
        this.forEach(vb => {
          let parsed = parse$2(vb);
          // should we support 'would swim' ➔ 'would have swam'
          if (useParticiple$1(parsed)) {
            toParticiple$1(parsed, this.world);
            return
          }
          let str = conjugate_1$1(parsed, this.world).PastTense;
          if (str) {
            parsed = makeNeutral(parsed);
            parsed.verb.replaceWith(str, false);
            // vb.tag('PastTense')
          }
        });
        return this
      },
      /** walk ➔ walks */
      toPresentTense: function () {
        this.forEach(vb => {
          let parsed = parse$2(vb);

          let obj = conjugate_1$1(parsed, this.world);
          let str = obj.PresentTense;
          // 'i look', not 'i looks'
          if (vb.lookBehind('(i|we) (#Adverb|#Verb)?$').found) {
            str = obj.Infinitive;
          }
          if (str) {
            //awkward support for present-participle form
            // -- should we support 'have been swimming' ➔ 'am swimming'
            if (parsed.auxiliary.has('(have|had) been')) {
              parsed.auxiliary.replace('(have|had) been', 'am being');
              if (obj.Particle) {
                str = obj.Particle || obj.PastTense;
              }
              return
            }
            parsed.verb.replaceWith(str, false);
            parsed.verb.tag('PresentTense');
            parsed = makeNeutral(parsed);
            // avoid 'he would walks'
            parsed.auxiliary.remove('#Modal');
          }
        });
        return this
      },
      /** walk ➔ will walk*/
      toFutureTense: function () {
        this.forEach(vb => {
          let parsed = parse$2(vb);
          // 'i should drive' is already future-enough
          if (useParticiple$1(parsed)) {
            return
          }
          let str = conjugate_1$1(parsed, this.world).FutureTense;
          if (str) {
            parsed = makeNeutral(parsed);
            // avoid 'he would will go'
            parsed.auxiliary.remove('#Modal');
            parsed.verb.replaceWith(str, false);
            parsed.verb.tag('FutureTense');
          }
        });
        return this
      },
      /** walks ➔ walk */
      toInfinitive: function () {
        this.forEach(vb => {
          let parsed = parse$2(vb);
          let str = conjugate_1$1(parsed, this.world).Infinitive;
          if (str) {
            vb.replaceWith(str, false);
            vb.tag('Infinitive');
          }
        });
        return this
      },
      /** walk ➔ walking */
      toGerund: function () {
        this.forEach(vb => {
          let parsed = parse$2(vb);
          let str = conjugate_1$1(parsed, this.world).Gerund;
          if (str) {
            vb.replaceWith(str, false);
            vb.tag('Gerund');
          }
        });
        return this
      },
      /** drive ➔ driven - naked past-participle if it exists, otherwise past-tense */
      toParticiple: function () {
        this.forEach(vb => {
          let parsed = parse$2(vb);
          let noAux = !parsed.auxiliary.found;
          toParticiple$1(parsed, this.world);
          // dirty trick to  ensure our new auxiliary is found
          if (noAux) {
            parsed.verb.prepend(parsed.auxiliary.text());
            parsed.auxiliary.remove();
          }
        });
        return this
      },

      /// Negation
      /** return only verbs with 'not'*/
      isNegative: function () {
        return this.if('#Negative')
      },
      /**  return only verbs without 'not'*/
      isPositive: function () {
        return this.ifNo('#Negative')
      },
      /** add a 'not' to these verbs */
      toNegative: function () {
        this.list.forEach(p => {
          let doc = this.buildFrom([p]);
          let parsed = parse$2(doc);
          toNegative_1(parsed, doc.world);
        });
        return this
      },
      /** remove 'not' from these verbs */
      toPositive: function () {
        let m = this.match('do not #Verb');
        if (m.found) {
          m.remove('do not');
        }
        return this.remove('#Negative')
      },
    };

    const addMethod$9 = function (Doc) {
      /**  */
      class Verbs extends Doc {}
      // add-in our methods
      Object.assign(Verbs.prototype, methods$7);

      // aliases
      Verbs.prototype.negate = Verbs.prototype.toNegative;

      Doc.prototype.verbs = function (n) {
        let match = this.match('(#Adverb|#Auxiliary|#Verb|#Negative|#Particle)+');
        // try to ignore leading and trailing adverbs
        match = match.not('^#Adverb+');
        match = match.not('#Adverb+$');
        // handle commas:
        // don't split 'really, really'
        let keep = match.match('(#Adverb && @hasComma) #Adverb');
        // // but split the other commas
        let m = match.not(keep).splitAfter('@hasComma');
        // // combine them back together
        m = m.concat(keep);
        m.sort('index');
        //handle slashes?

        //ensure there's actually a verb
        m = m.if('#Verb');

        // the reason he will is ...
        if (m.has('(is|was)$')) {
          m = m.splitBefore('(is|was)$');
        }

        //grab (n)th result
        if (typeof n === 'number') {
          m = m.get(n);
        }
        let vb = new Verbs(m.list, this, this.world);
        return vb
      };
      return Doc
    };
    var Verbs = addMethod$9;

    const addMethod$a = function(Doc) {
      /**  */
      class People extends Doc {
        // honorifics(){}
        // firstNames(){}
        // lastNames(){}
        // pronouns(){}
        // toPronoun(){}
        // fromPronoun(){}
      }

      Doc.prototype.people = function(n) {
        let match = this.splitAfter('@hasComma');
        match = match.match('#Person+');

        //grab (n)th result
        if (typeof n === 'number') {
          match = match.get(n);
        }
        return new People(match.list, this, this.world)
      };
      return Doc
    };
    var People = addMethod$a;

    const subclass = [
      Abbreviations,
      Acronyms,
      Clauses,
      Contractions,
      Lists,
      Nouns,
      Parentheses,
      Possessives,
      Quotations,
      Verbs,
      People,
    ];

    const extend = function(Doc) {
      // add basic methods
      Object.keys(_simple).forEach(k => (Doc.prototype[k] = _simple[k]));
      // add subclassed methods
      subclass.forEach(addFn => addFn(Doc));
      return Doc
    };
    var Subset = extend;

    const methods$8 = {
      misc: methods$4,
      selections: _simple,
    };




    /** a parsed text object */
    class Doc {
      constructor(list, from, world) {
        this.list = list;
        //quiet these properties in console.logs
        Object.defineProperty(this, 'from', {
          enumerable: false,
          value: from,
          writable: true,
        });
        //borrow some missing data from parent
        if (world === undefined && from !== undefined) {
          world = from.world;
        }
        //'world' getter
        Object.defineProperty(this, 'world', {
          enumerable: false,
          value: world,
          writable: true,
        });
        //fast-scans for our data
        Object.defineProperty(this, '_cache', {
          enumerable: false,
          writable: true,
          value: {},
        });
        //'found' getter
        Object.defineProperty(this, 'found', {
          get: () => this.list.length > 0,
        });
        //'length' getter
        Object.defineProperty(this, 'length', {
          get: () => this.list.length,
        });
        // this is way easier than .constructor.name...
        Object.defineProperty(this, 'isA', {
          get: () => 'Doc',
        });
      }

      /** run part-of-speech tagger on all results*/
      tagger() {
        return _02Tagger(this)
      }

      /** pool is stored on phrase objects */
      pool() {
        if (this.list.length > 0) {
          return this.list[0].pool
        }
        return this.all().list[0].pool
      }
    }

    /** create a new Document object */
    Doc.prototype.buildFrom = function(list) {
      list = list.map(p => p.clone(true));
      // new this.constructor()
      let doc = new Doc(list, this, this.world);
      return doc
    };

    /** create a new Document from plaintext. */
    Doc.prototype.fromText = function(str) {
      let list = _01Tokenizer(str, this.world, this.pool());
      return this.buildFrom(list)
    };

    Object.assign(Doc.prototype, methods$8.misc);
    Object.assign(Doc.prototype, methods$8.selections);

    //add sub-classes
    Subset(Doc);

    //aliases
    const aliases$1 = {
      untag: 'unTag',
      and: 'match',
      notIf: 'ifNo',
      only: 'if',
      onlyIf: 'if',
    };
    Object.keys(aliases$1).forEach(k => (Doc.prototype[k] = Doc.prototype[aliases$1[k]]));
    var Doc_1 = Doc;

    //for the tokenize-only build, we want to keep
    const smallTagger = function(doc) {
      let terms = doc.termList();
      _01Lexicon(terms, doc.world);
      return doc
    };
    var tiny = smallTagger;

    function instance$5(worldInstance) {
      //blast-out our word-lists, just once
      let world = worldInstance;

      /** parse and tag text into a compromise object  */
      const nlp = function (text = '', lexicon) {
        if (lexicon) {
          world.addWords(lexicon);
        }
        let list = _01Tokenizer(text, world);
        let doc = new Doc_1(list, null, world);
        doc.tagger();
        return doc
      };

      /** parse text into a compromise object, without running POS-tagging */
      nlp.tokenize = function (text = '', lexicon) {
        let w = world;
        if (lexicon) {
          w = w.clone();
          w.words = {};
          w.addWords(lexicon);
        }
        let list = _01Tokenizer(text, w);
        let doc = new Doc_1(list, null, w);
        if (lexicon) {
          tiny(doc);
        }
        return doc
      };

      /** mix in a compromise-plugin */
      nlp.extend = function (fn) {
        fn(Doc_1, world, this, Phrase_1, Term_1, Pool_1);
        return this
      };

      /** create a compromise Doc object from .json() results */
      nlp.fromJSON = function (json) {
        let list = fromJSON_1(json, world);
        return new Doc_1(list, null, world)
      };

      /** make a deep-copy of the library state */
      nlp.clone = function () {
        return instance$5(world.clone())
      };

      /** log our decision-making for debugging */
      nlp.verbose = function (bool = true) {
        world.verbose(bool);
        return this
      };
      /** grab currently-used World object */
      nlp.world = function () {
        return world
      };
      /** pre-parse any match statements */
      nlp.parseMatch = function (str) {
        return syntax_1(str)
      };

      /** current version of the library */
      nlp.version = _version;
      // alias
      nlp.import = nlp.load;

      return nlp
    }

    var src = instance$5(new World_1());

    const tens = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|fourty';
    const teens = 'eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen';

    // this is a bit of a mess
    const findNumbers = function(doc, n) {
      let match = doc.match('#Value+');

      //"50 83"
      if (match.has('#NumericValue #NumericValue')) {
        //a comma may mean two numbers
        if (match.has('#Value @hasComma #Value')) {
          match.splitAfter('@hasComma');
        } else {
          match = match.splitAfter('#NumericValue');
        }
      }
      //three-length
      if (match.has('#Value #Value #Value') && !match.has('#Multiple')) {
        //twenty-five-twenty
        if (match.has('(' + tens + ') #Cardinal #Cardinal')) {
          match = match.splitAfter('(' + tens + ') #Cardinal');
        }
      }

      //two-length ones
      if (match.has('#Value #Value')) {
        //june 21st 1992 is two seperate values
        if (match.has('#NumericValue #NumericValue')) {
          match = match.splitOn('#Year');
        }
        //sixty fifteen
        if (match.has('(' + tens + ') (' + teens + ')')) {
          match = match.splitAfter('(' + tens + ')');
        }
        //"72 82"
        let double = match.match('#Cardinal #Cardinal');
        if (double.found && !match.has('(point|decimal)')) {
          //not 'two hundred'
          if (!double.has('#Cardinal (#Multiple|point|decimal)')) {
            //one proper way, 'twenty one', or 'hundred one'
            if (!double.has('(' + tens + ') #Cardinal') && !double.has('#Multiple #Value')) {
              // double = double.firstTerm()
              double.terms().forEach(d => {
                match = match.splitOn(d);
              });
            }
          }
        }
        //seventh fifth
        if (match.match('#Ordinal #Ordinal').match('#TextValue').found && !match.has('#Multiple')) {
          //the one proper way, 'twenty first'
          if (!match.has('(' + tens + ') #Ordinal')) {
            match = match.splitAfter('#Ordinal');
          }
        }
        //fifth five
        if (match.has('#Ordinal #Cardinal')) {
          match = match.splitBefore('#Cardinal+');
        }
        //five 2017 (support '5 hundred', and 'twenty 5'
        if (match.has('#TextValue #NumericValue') && !match.has('(' + tens + '|#Multiple)')) {
          match = match.splitBefore('#NumericValue+');
        }
      }
      //5-8
      if (match.has('#NumberRange')) {
        match = match.splitAfter('#NumberRange');
      }
      //grab (n)th result
      if (typeof n === 'number') {
        match = match.get(n);
      }
      return match
    };
    var find$1 = findNumbers;

    //support global multipliers, like 'half-million' by doing 'million' then multiplying by 0.5
    const findModifiers = str => {
      const mults = [
        {
          reg: /^(minus|negative)[\s\-]/i,
          mult: -1,
        },
        {
          reg: /^(a\s)?half[\s\-](of\s)?/i,
          mult: 0.5,
        },
        //  {
        //   reg: /^(a\s)?quarter[\s\-]/i,
        //   mult: 0.25
        // }
      ];
      for (let i = 0; i < mults.length; i++) {
        if (mults[i].reg.test(str) === true) {
          return {
            amount: mults[i].mult,
            str: str.replace(mults[i].reg, ''),
          }
        }
      }
      return {
        amount: 1,
        str: str,
      }
    };

    var findModifiers_1 = findModifiers;

    var data = {
      ones: {
        zeroth: 0,
        first: 1,
        second: 2,
        third: 3,
        fourth: 4,
        fifth: 5,
        sixth: 6,
        seventh: 7,
        eighth: 8,
        ninth: 9,
        zero: 0,
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
      },
      teens: {
        tenth: 10,
        eleventh: 11,
        twelfth: 12,
        thirteenth: 13,
        fourteenth: 14,
        fifteenth: 15,
        sixteenth: 16,
        seventeenth: 17,
        eighteenth: 18,
        nineteenth: 19,
        ten: 10,
        eleven: 11,
        twelve: 12,
        thirteen: 13,
        fourteen: 14,
        fifteen: 15,
        sixteen: 16,
        seventeen: 17,
        eighteen: 18,
        nineteen: 19,
      },
      tens: {
        twentieth: 20,
        thirtieth: 30,
        fortieth: 40,
        fourtieth: 40,
        fiftieth: 50,
        sixtieth: 60,
        seventieth: 70,
        eightieth: 80,
        ninetieth: 90,
        twenty: 20,
        thirty: 30,
        forty: 40,
        fourty: 40,
        fifty: 50,
        sixty: 60,
        seventy: 70,
        eighty: 80,
        ninety: 90,
      },
      multiples: {
        hundredth: 100,
        thousandth: 1000,
        millionth: 1e6,
        billionth: 1e9,
        trillionth: 1e12,
        quadrillionth: 1e15,
        quintillionth: 1e18,
        sextillionth: 1e21,
        septillionth: 1e24,
        hundred: 100,
        thousand: 1000,
        million: 1e6,
        billion: 1e9,
        trillion: 1e12,
        quadrillion: 1e15,
        quintillion: 1e18,
        sextillion: 1e21,
        septillion: 1e24,
        grand: 1000,
      },
    };

    //prevent things like 'fifteen ten', and 'five sixty'
    const isValid = (w, has) => {
      if (data.ones.hasOwnProperty(w)) {
        if (has.ones || has.teens) {
          return false
        }
      } else if (data.teens.hasOwnProperty(w)) {
        if (has.ones || has.teens || has.tens) {
          return false
        }
      } else if (data.tens.hasOwnProperty(w)) {
        if (has.ones || has.teens || has.tens) {
          return false
        }
      }
      return true
    };
    var validate$1 = isValid;

    //concatenate into a string with leading '0.'
    const parseDecimals = function(arr) {
      let str = '0.';
      for (let i = 0; i < arr.length; i++) {
        let w = arr[i];
        if (data.ones.hasOwnProperty(w) === true) {
          str += data.ones[w];
        } else if (data.teens.hasOwnProperty(w) === true) {
          str += data.teens[w];
        } else if (data.tens.hasOwnProperty(w) === true) {
          str += data.tens[w];
        } else if (/^[0-9]$/.test(w) === true) {
          str += w;
        } else {
          return 0
        }
      }
      return parseFloat(str)
    };

    var parseDecimals_1 = parseDecimals;

    //parse a string like "4,200.1" into Number 4200.1
    const parseNumeric = str => {
      //remove ordinal - 'th/rd'
      str = str.replace(/1st$/, '1');
      str = str.replace(/2nd$/, '2');
      str = str.replace(/3rd$/, '3');
      str = str.replace(/([4567890])r?th$/, '$1');
      //remove prefixes
      str = str.replace(/^[$€¥£¢]/, '');
      //remove suffixes
      str = str.replace(/[%$€¥£¢]$/, '');
      //remove commas
      str = str.replace(/,/g, '');
      //split '5kg' from '5'
      str = str.replace(/([0-9])([a-z\u00C0-\u00FF]{1,2})$/, '$1');
      return str
    };

    var parseNumeric_1 = parseNumeric;

    const improperFraction = /^([0-9,\. ]+)\/([0-9,\. ]+)$/;

    //some numbers we know
    const casualForms = {
      // 'a few': 3,
      'a couple': 2,
      'a dozen': 12,
      'two dozen': 24,
      zero: 0,
    };

    // a 'section' is something like 'fifty-nine thousand'
    // turn a section into something we can add to - like 59000
    const section_sum = obj => {
      return Object.keys(obj).reduce((sum, k) => {
        sum += obj[k];
        return sum
      }, 0)
    };

    //turn a string into a number
    const parse$3 = function(str) {
      //convert some known-numbers
      if (casualForms.hasOwnProperty(str) === true) {
        return casualForms[str]
      }
      //'a/an' is 1
      if (str === 'a' || str === 'an') {
        return 1
      }
      const modifier = findModifiers_1(str);
      str = modifier.str;
      let last_mult = null;
      let has = {};
      let sum = 0;
      let isNegative = false;
      const terms = str.split(/[ -]/);
      for (let i = 0; i < terms.length; i++) {
        let w = terms[i];
        w = parseNumeric_1(w);
        if (!w || w === 'and') {
          continue
        }
        if (w === '-' || w === 'negative') {
          isNegative = true;
          continue
        }
        if (w.charAt(0) === '-') {
          isNegative = true;
          w = w.substr(1);
        }
        //decimal mode
        if (w === 'point') {
          sum += section_sum(has);
          sum += parseDecimals_1(terms.slice(i + 1, terms.length));
          sum *= modifier.amount;
          return sum
        }
        //improper fraction
        const fm = w.match(improperFraction);
        if (fm) {
          const num = parseFloat(fm[1].replace(/[, ]/g, ''));
          const denom = parseFloat(fm[2].replace(/[, ]/g, ''));
          if (denom) {
            sum += num / denom || 0;
          }
          continue
        }
        //prevent mismatched units, like 'seven eleven'
        if (validate$1(w, has) === false) {
          return null
        }
        //buildOut section, collect 'has' values
        if (/^[0-9\.]+$/.test(w)) {
          has['ones'] = parseFloat(w); //not technically right
        } else if (data.ones.hasOwnProperty(w) === true) {
          has['ones'] = data.ones[w];
        } else if (data.teens.hasOwnProperty(w) === true) {
          has['teens'] = data.teens[w];
        } else if (data.tens.hasOwnProperty(w) === true) {
          has['tens'] = data.tens[w];
        } else if (data.multiples.hasOwnProperty(w) === true) {
          let mult = data.multiples[w];

          //something has gone wrong : 'two hundred five hundred'
          if (mult === last_mult) {
            return null
          }
          //support 'hundred thousand'
          //this one is tricky..
          if (mult === 100 && terms[i + 1] !== undefined) {
            // has['hundreds']=
            const w2 = terms[i + 1];
            if (data.multiples[w2]) {
              mult *= data.multiples[w2]; //hundredThousand/hundredMillion
              i += 1;
            }
          }
          //natural order of things
          //five thousand, one hundred..
          if (last_mult === null || mult < last_mult) {
            sum += (section_sum(has) || 1) * mult;
            last_mult = mult;
            has = {};
          } else {
            //maybe hundred .. thousand
            sum += section_sum(has);
            last_mult = mult;
            sum = (sum || 1) * mult;
            has = {};
          }
        }
      }
      //dump the remaining has values
      sum += section_sum(has);
      //post-process add modifier
      sum *= modifier.amount;
      sum *= isNegative ? -1 : 1;
      //dont return 0, if it went straight-through
      if (sum === 0 && Object.keys(has).length === 0) {
        return null
      }
      return sum
    };

    var toNumber = parse$3;

    // get a numeric value from this phrase
    const parseNumber = function(p) {
      let str = p.text('reduced');
      // is it in '3,123' format?
      let hasComma = /[0-9],[0-9]/.test(p.text('text'));
      str = str.replace(/,/g, '');

      //parse a numeric-number (easy)
      let arr = str.split(/^([^0-9]*)([0-9.,]*)([^0-9]*)$/);
      if (arr && arr[2] && p.terms().length < 2) {
        let num = parseFloat(arr[2] || str);
        //ensure that num is an actual number
        if (typeof num !== 'number') {
          num = null;
        }
        // strip an ordinal off the suffix
        let suffix = arr[3] || '';
        if (suffix === 'st' || suffix === 'nd' || suffix === 'rd' || suffix === 'th') {
          suffix = '';
        }
        // support M for million, k for thousand
        if (suffix === 'm' || suffix === 'M') {
          num *= 1000000;
          suffix = '';
        }
        if (suffix === 'k' || suffix === 'k') {
          num *= 1000;
          suffix = '';
        }
        return {
          hasComma: hasComma,
          prefix: arr[1] || '',
          num: num,
          suffix: suffix,
        }
      }
      //parse a text-numer (harder)
      let num = toNumber(str);
      return {
        hasComma: hasComma,
        prefix: '',
        num: num,
        suffix: '',
      }
    };
    var parse$4 = parseNumber;

    // handle 'one bottle', 'two bottles'
    const agreeUnits = function(agree, val, obj) {
      if (agree === false) {
        return
      }
      let unit = val.lookAhead('^(#Unit|#Noun)');
      // don't do these
      if (unit.has('(#Address|#Money|#Percent)') || val.has('#Ordinal')) {
        return
      }
      if (obj.num === 1) {
        unit.nouns().toSingular();
      } else if (unit.has('#Singular')) {
        unit.nouns().toPlural();
      }
    };
    var _agreeUnits = agreeUnits;

    /**
     * turn big numbers, like 2.3e+22, into a string with a ton of trailing 0's
     * */
    const numToString = function(n) {
      if (n < 1000000) {
        return String(n)
      }
      let str;
      if (typeof n === 'number') {
        str = n.toFixed(0);
      } else {
        str = n;
      }
      if (str.indexOf('e+') === -1) {
        return str
      }
      return str
        .replace('.', '')
        .split('e+')
        .reduce(function(p, b) {
          return p + Array(b - p.length + 2).join(0)
        })
    };
    var _toString = numToString;

    /**
     * turns an integer/float into.ber, like 'fifty-five'
     */

    const tens_mapping = [
      ['ninety', 90],
      ['eighty', 80],
      ['seventy', 70],
      ['sixty', 60],
      ['fifty', 50],
      ['forty', 40],
      ['thirty', 30],
      ['twenty', 20],
    ];
    const ones_mapping = [
      '',
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
      'eleven',
      'twelve',
      'thirteen',
      'fourteen',
      'fifteen',
      'sixteen',
      'seventeen',
      'eighteen',
      'nineteen',
    ];

    const sequence = [
      [1e24, 'septillion'],
      [1e20, 'hundred sextillion'],
      [1e21, 'sextillion'],
      [1e20, 'hundred quintillion'],
      [1e18, 'quintillion'],
      [1e17, 'hundred quadrillion'],
      [1e15, 'quadrillion'],
      [1e14, 'hundred trillion'],
      [1e12, 'trillion'],
      [1e11, 'hundred billion'],
      [1e9, 'billion'],
      [1e8, 'hundred million'],
      [1e6, 'million'],
      [100000, 'hundred thousand'],
      [1000, 'thousand'],
      [100, 'hundred'],
      [1, 'one'],
    ];

    //turn number into an array of magnitudes, like [[5, million], [2, hundred]]
    const breakdown_magnitudes = function(num) {
      let working = num;
      let have = [];
      sequence.forEach(a => {
        if (num >= a[0]) {
          let howmany = Math.floor(working / a[0]);
          working -= howmany * a[0];
          if (howmany) {
            have.push({
              unit: a[1],
              count: howmany,
            });
          }
        }
      });
      return have
    };

    //turn numbers from 100-0 into their text
    const breakdown_hundred = function(num) {
      let arr = [];
      if (num > 100) {
        return arr //something bad happened..
      }
      for (let i = 0; i < tens_mapping.length; i++) {
        if (num >= tens_mapping[i][1]) {
          num -= tens_mapping[i][1];
          arr.push(tens_mapping[i][0]);
        }
      }
      //(hopefully) we should only have 20-0 now
      if (ones_mapping[num]) {
        arr.push(ones_mapping[num]);
      }
      return arr
    };

    /** print-out 'point eight nine'*/
    const handle_decimal = num => {
      const names = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
      let arr = [];
      //parse it out like a string, because js math is such shit
      let str = _toString(num);
      let decimal = str.match(/\.([0-9]+)/);
      if (!decimal || !decimal[0]) {
        return arr
      }
      arr.push('point');
      let decimals = decimal[0].split('');
      for (let i = 0; i < decimals.length; i++) {
        arr.push(names[decimals[i]]);
      }
      return arr
    };

    /** turns an integer into a textual number */
    const to_text = function(num) {
      // handle zero, quickly
      if (num === 0 || num === '0') {
        return 'zero' // no?
      }
      //big numbers, north of sextillion, aren't gonna work well..
      //keep them small..
      if (num > 1e21) {
        num = _toString(num);
      }
      let arr = [];
      //handle negative numbers
      if (num < 0) {
        arr.push('minus');
        num = Math.abs(num);
      }
      //break-down into units, counts
      let units = breakdown_magnitudes(num);
      //build-up the string from its components
      for (let i = 0; i < units.length; i++) {
        let unit_name = units[i].unit;
        if (unit_name === 'one') {
          unit_name = '';
          //put an 'and' in here
          if (arr.length > 1) {
            arr.push('and');
          }
        }
        arr = arr.concat(breakdown_hundred(units[i].count));
        arr.push(unit_name);
      }
      //also support decimals - 'point eight'
      arr = arr.concat(handle_decimal(num));
      //remove empties
      arr = arr.filter(s => s);
      if (arr.length === 0) {
        arr[0] = '';
      }
      return arr.join(' ')
    };

    var toText = to_text;

    /**
     * turn a number like 5 into an ordinal like 5th
     */
    const numOrdinal = function(num) {
      if (!num && num !== 0) {
        return null
      }
      //the teens are all 'th'
      let tens = num % 100;
      if (tens > 10 && tens < 20) {
        return String(num) + 'th'
      }
      //the rest of 'em
      const mapping = {
        0: 'th',
        1: 'st',
        2: 'nd',
        3: 'rd',
      };
      let str = _toString(num);
      let last = str.slice(str.length - 1, str.length);
      if (mapping[last]) {
        str += mapping[last];
      } else {
        str += 'th';
      }
      return str
    };

    var numOrdinal_1 = numOrdinal;

    // const toString = require('../_toString')

    const irregulars$6 = {
      one: 'first',
      two: 'second',
      three: 'third',
      five: 'fifth',
      eight: 'eighth',
      nine: 'ninth',
      twelve: 'twelfth',
      twenty: 'twentieth',
      thirty: 'thirtieth',
      forty: 'fortieth',
      fourty: 'fourtieth',
      fifty: 'fiftieth',
      sixty: 'sixtieth',
      seventy: 'seventieth',
      eighty: 'eightieth',
      ninety: 'ninetieth',
    };

    /**
     * convert a javascript number to 'twentieth' format
     * */
    const textOrdinal = num => {
      let words = toText(num).split(' ');
      //convert the last number to an ordinal
      let last = words[words.length - 1];
      if (irregulars$6.hasOwnProperty(last)) {
        words[words.length - 1] = irregulars$6[last];
      } else {
        words[words.length - 1] = last.replace(/y$/, 'i') + 'th';
      }
      return words.join(' ')
    };

    var textOrdinal_1 = textOrdinal;

    const prefixes = {
      '¢': 'cents',
      $: 'dollars',
      '£': 'pounds',
      '¥': 'yen',
      '€': 'euros',
      '₡': 'colón',
      '฿': 'baht',
      '₭': 'kip',
      '₩': 'won',
      '₹': 'rupees',
      '₽': 'ruble',
      '₺': 'liras',
    };
    const suffixes$2 = {
      '%': 'percent',
      s: 'seconds',
      cm: 'centimetres',
      km: 'kilometres',
    };
    var _symbols = {
      prefixes: prefixes,
      suffixes: suffixes$2,
    };

    const prefixes$1 = _symbols.prefixes;
    const suffixes$3 = _symbols.suffixes;

    const isCurrency = {
      usd: true,
      eur: true,
      jpy: true,
      gbp: true,
      cad: true,
      aud: true,
      chf: true,
      cny: true,
      hkd: true,
      nzd: true,
      kr: true,
      rub: true,
    };
    // convert $ to 'dollars', etc
    const prefixToText = function(obj) {
      // turn 5% to 'five percent'
      if (prefixes$1.hasOwnProperty(obj.prefix)) {
        obj.suffix += prefixes$1[obj.prefix];
        obj.prefix = '';
      }
      //turn 5km to 'five kilometres'
      if (suffixes$3.hasOwnProperty(obj.suffix)) {
        obj.suffix = suffixes$3[obj.suffix];
      }
      //uppercase lost case for 'USD', etc
      if (isCurrency.hasOwnProperty(obj.suffix)) {
        obj.suffix = obj.suffix.toUpperCase();
      }
      // add a space, if it exists
      if (obj.suffix) {
        obj.suffix = ' ' + obj.suffix;
      }
      return obj
    };

    //business-logic for converting a cardinal-number to other forms
    const makeNumber = function(obj, isText, isOrdinal) {
      let num = String(obj.num);
      if (isText) {
        obj = prefixToText(obj);
        if (isOrdinal) {
          //ordinal-text
          num = textOrdinal_1(num);
          return `${obj.prefix || ''}${num}${obj.suffix || ''}`
        }
        //cardinal-text
        num = toText(num);
        return `${obj.prefix || ''}${num}${obj.suffix || ''}`
      }
      //ordinal-number
      if (isOrdinal) {
        num = numOrdinal_1(num);
        // support '5th percent'
        obj = prefixToText(obj);
        return `${obj.prefix || ''}${num}${obj.suffix || ''}`
      }
      // support comma format
      if (obj.hasComma === true) {
        num = obj.num.toLocaleString();
      }
      // cardinal-number
      num = _toString(num); // support very large numbers
      return `${obj.prefix || ''}${num}${obj.suffix || ''}`
    };
    var makeNumber_1 = makeNumber;

    let methods$9 = {
      /** overloaded json method with additional number information */
      json: function (options) {
        let n = null;
        if (typeof options === 'number') {
          n = options;
          options = null;
        }
        options = options || { text: true, normal: true, trim: true, terms: true };
        let res = [];
        this.forEach((doc) => {
          let json = doc.json(options)[0];
          let obj = parse$4(doc);
          json.prefix = obj.prefix;
          json.number = obj.num;
          json.suffix = obj.suffix;
          json.cardinal = makeNumber_1(obj, false, false);
          json.ordinal = makeNumber_1(obj, false, true);
          json.textCardinal = makeNumber_1(obj, true, false);
          json.textOrdinal = makeNumber_1(obj, true, true);
          res.push(json);
        });
        if (n !== null) {
          return res[n]
        }
        return res
      },
      /** two of what? */
      units: function () {
        let m = this.lookAhead('(#Unit|#Noun)+');
        m = m.splitAfter('@hasComma').first();
        m = m.not('#Pronoun');
        return m.first()
      },
      /** return only ordinal numbers */
      isOrdinal: function () {
        return this.if('#Ordinal')
      },
      /** return only cardinal numbers*/
      isCardinal: function () {
        return this.if('#Cardinal')
      },
      /** convert to numeric form like '8' or '8th' */
      toNumber: function () {
        this.forEach((val) => {
          let obj = parse$4(val);
          if (obj.num === null) {
            return
          }
          let str = makeNumber_1(obj, false, val.has('#Ordinal'));
          val.replaceWith(str, true);
          val.tag('NumericValue');
        });
        return this
      },
      /** add commas, or nicer formatting for numbers */
      toLocaleString: function () {
        this.forEach((val) => {
          let obj = parse$4(val);
          if (obj.num === null) {
            return
          }
          obj.num = obj.num.toLocaleString();
          let str = makeNumber_1(obj, false, val.has('#Ordinal'));
          val.replaceWith(str, true);
        });
        return this
      },
      /** convert to text form - like 'eight' or 'eigth'*/
      toText: function () {
        this.forEach((val) => {
          let obj = parse$4(val);
          if (obj.num === null) {
            return
          }
          let str = makeNumber_1(obj, true, val.has('#Ordinal'));
          val.replaceWith(str, true);
          val.tag('TextValue');
        });
        return this
      },
      /** convert to cardinal form, like 'eight', or '8' */
      toCardinal: function (agree) {
        let m = this.if('#Ordinal');
        m.forEach((val) => {
          let obj = parse$4(val);
          if (obj.num === null) {
            return
          }
          let str = makeNumber_1(obj, val.has('#TextValue'), false);
          val.replaceWith(str, true);
          val.tag('Cardinal');
          // turn unit into plural -> 'seven beers'
          _agreeUnits(agree, val, obj);
        });
        return this
      },
      /** convert to ordinal form, like 'eighth', or '8th' */
      toOrdinal: function () {
        let m = this.if('#Cardinal');
        m.forEach((val) => {
          let obj = parse$4(val);
          if (obj.num === null) {
            return
          }
          let str = makeNumber_1(obj, val.has('#TextValue'), true);
          val.replaceWith(str, true);
          val.tag('Ordinal');
          // turn unit into singular -> 'seventh beer'
          let unit = this.lookAhead('^#Plural');
          if (unit.found) {
            unit.nouns().toSingular();
          }
        });
        return this
      },
      /** return only numbers that are == n */
      isEqual: function (n) {
        return this.filter((val) => {
          let num = parse$4(val).num;
          return num === n
        })
      },
      /** return only numbers that are > n*/
      greaterThan: function (n) {
        return this.filter((val) => {
          let num = parse$4(val).num;
          return num > n
        })
      },
      /** return only numbers that are < n*/
      lessThan: function (n) {
        return this.filter((val) => {
          let num = parse$4(val).num;
          return num < n
        })
      },
      /** return only numbers > min and < max */
      between: function (min, max) {
        return this.filter((val) => {
          let num = parse$4(val).num;
          return num > min && num < max
        })
      },
      /** set these number to n */
      set: function (n, agree) {
        if (n === undefined) {
          return this // don't bother
        }
        if (typeof n === 'string') {
          n = toNumber(n);
        }
        this.forEach((val) => {
          let obj = parse$4(val);
          obj.num = n;
          if (obj.num === null) {
            return
          }
          let str = makeNumber_1(obj, val.has('#TextValue'), val.has('#Ordinal'));
          val = val.not('#Currency');
          val.replaceWith(str, true);
          // handle plural/singular unit
          _agreeUnits(agree, val, obj);
        });
        return this
      },
      add: function (n, agree) {
        if (!n) {
          return this // don't bother
        }
        if (typeof n === 'string') {
          n = toNumber(n);
        }
        this.forEach((val) => {
          let obj = parse$4(val);

          if (obj.num === null) {
            return
          }
          obj.num += n;
          let str = makeNumber_1(obj, val.has('#TextValue'), val.has('#Ordinal'));
          val = val.not('#Currency');
          val.replaceWith(str, true);
          // handle plural/singular unit
          _agreeUnits(agree, val, obj);
        });
        return this
      },
      /** decrease each number by n*/
      subtract: function (n, agree) {
        return this.add(n * -1, agree)
      },
      /** increase each number by 1 */
      increment: function (agree) {
        this.add(1, agree);
        return this
      },
      /** decrease each number by 1 */
      decrement: function (agree) {
        this.add(-1, agree);
        return this
      },
      /** return things like CCXX*/
      romanNumerals: function (n) {
        let m = this.match('#RomanNumeral').numbers();
        if (typeof n === 'number') {
          m = m.get(n);
        }
        return m
      },
    };
    // aliases
    methods$9.toNice = methods$9.toLocaleString;
    methods$9.isBetween = methods$9.between;
    methods$9.minus = methods$9.subtract;
    methods$9.plus = methods$9.add;
    methods$9.equals = methods$9.isEqual;

    var methods_1$1 = methods$9;

    const multiples =
      '(hundred|thousand|million|billion|trillion|quadrillion|quintillion|sextillion|septillion)';

    // improved tagging for numbers
    const tagger$1 = function (doc) {
      doc.match(multiples).tag('#Multiple');
      //  in the 400s
      doc.match('the [/[0-9]+s$/]').tag('#Plural');
      //half a million
      doc.match('half a? #Value').tag('Value', 'half-a-value'); //(quarter not ready)
      //five and a half
      doc.match('#Value and a (half|quarter)').tag('Value', 'value-and-a-half');
      //one hundred and seven dollars
      doc.match('#Money and #Money #Currency?').tag('Money', 'money-and-money');
      // doc.debug()
      // $5.032 is invalid money
      doc
        .match('#Money')
        .not('#TextValue')
        .match('/\\.[0-9]{3}$/')
        .unTag('#Money', 'three-decimal money');
    };
    var tagger_1 = tagger$1;

    var tags$1 = {
      Fraction: {
        isA: 'Value',
      },
      Multiple: {
        isA: 'Value',
      },
    };

    /** adds .numbers() method */
    const plugin = function (Doc, world) {
      // add tags to our tagset
      world.addTags(tags$1);

      // additional tagging before running the number-parser
      world.postProcess(tagger_1);

      /** a list of number values, and their units */
      class Numbers extends Doc {}
      //aliases
      Object.assign(Numbers.prototype, methods_1$1);

      class Money extends Numbers {}
      class Fraction extends Numbers {}

      const docMethods = {
        /** find all numbers and values */
        numbers: function (n) {
          let m = find$1(this, n);
          return new Numbers(m.list, this, this.world)
        },
        /** numbers that are percentages*/
        percentages: function (n) {
          let m = find$1(this, n);
          m = m.if('/%$/');
          return new Numbers(m.list, this, this.world)
        },
        /** number + currency pair */
        money: function (n) {
          // let nums = findNumbers(this, n)
          let m = this.match('#Money+ #Currency?');
          // m = m.concat(nums.hasAfter('#Currency')) //'5 dollars'
          return new Money(m.list, this, this.world)
        },
        fractions: function (n) {
          let nums = find$1(this, n);
          let m = nums.if('#Fraction'); //2/3
          return new Fraction(m.list, this, this.world)
        },
      };
      // aliases
      docMethods.values = docMethods.numbers;
      docMethods.percents = docMethods.percentages;

      Object.assign(Doc.prototype, docMethods);

      return Doc
    };
    var src$1 = plugin;

    /* drafts/percentage/Post.svelte generated by Svelte v3.22.3 */
    const file$5 = "drafts/percentage/Post.svelte";

    // (52:4) <Scale height={800}>
    function create_default_slot(ctx) {
    	let t;
    	let current;

    	const thing0 = new Thing({
    			props: {
    				color: "blue",
    				value: /*aNum*/ ctx[3],
    				label: /*a*/ ctx[1] || 0
    			},
    			$$inline: true
    		});

    	const thing1 = new Thing({
    			props: {
    				color: "green",
    				value: /*bNum*/ ctx[4],
    				label: /*b*/ ctx[2] || 0
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(thing0.$$.fragment);
    			t = space();
    			create_component(thing1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(thing0, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(thing1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const thing0_changes = {};
    			if (dirty & /*aNum*/ 8) thing0_changes.value = /*aNum*/ ctx[3];
    			if (dirty & /*a*/ 2) thing0_changes.label = /*a*/ ctx[1] || 0;
    			thing0.$set(thing0_changes);
    			const thing1_changes = {};
    			if (dirty & /*bNum*/ 16) thing1_changes.value = /*bNum*/ ctx[4];
    			if (dirty & /*b*/ 4) thing1_changes.label = /*b*/ ctx[2] || 0;
    			thing1.$set(thing1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(thing0.$$.fragment, local);
    			transition_in(thing1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(thing0.$$.fragment, local);
    			transition_out(thing1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(thing0, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(thing1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(52:4) <Scale height={800}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div5;
    	let t0;
    	let div4;
    	let div0;
    	let t2;
    	let div3;
    	let div1;
    	let updating_text;
    	let t3;
    	let t4;
    	let t5;
    	let div2;
    	let updating_text_1;
    	let t6;
    	let t7;
    	let t8;
    	let t9;
    	let current;
    	const head = new Head({ props: { num: "20" }, $$inline: true });

    	function text0_text_binding(value) {
    		/*text0_text_binding*/ ctx[6].call(null, value);
    	}

    	let text0_props = {};

    	if (/*a*/ ctx[1] !== void 0) {
    		text0_props.text = /*a*/ ctx[1];
    	}

    	const text0 = new Text({ props: text0_props, $$inline: true });
    	binding_callbacks.push(() => bind(text0, "text", text0_text_binding));

    	function text1_text_binding(value) {
    		/*text1_text_binding*/ ctx[7].call(null, value);
    	}

    	let text1_props = {};

    	if (/*b*/ ctx[2] !== void 0) {
    		text1_props.text = /*b*/ ctx[2];
    	}

    	const text1 = new Text({ props: text1_props, $$inline: true });
    	binding_callbacks.push(() => bind(text1, "text", text1_text_binding));

    	const scale = new Scale({
    			props: {
    				height: 800,
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const foot = new Foot({
    			props: { title: /*title*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			create_component(head.$$.fragment);
    			t0 = space();
    			div4 = element("div");
    			div0 = element("div");
    			div0.textContent = "percentages:";
    			t2 = space();
    			div3 = element("div");
    			div1 = element("div");
    			create_component(text0.$$.fragment);
    			t3 = space();
    			t4 = text(/*aNum*/ ctx[3]);
    			t5 = space();
    			div2 = element("div");
    			create_component(text1.$$.fragment);
    			t6 = space();
    			t7 = text(/*bNum*/ ctx[4]);
    			t8 = space();
    			create_component(scale.$$.fragment);
    			t9 = space();
    			create_component(foot.$$.fragment);
    			add_location(div0, file$5, 40, 4, 917);
    			attr_dev(div1, "class", "col");
    			add_location(div1, file$5, 42, 6, 973);
    			attr_dev(div2, "class", "col");
    			add_location(div2, file$5, 46, 6, 1056);
    			attr_dev(div3, "class", "textRow svelte-ok8rje");
    			add_location(div3, file$5, 41, 4, 945);
    			attr_dev(div4, "class", "m3 svelte-ok8rje");
    			add_location(div4, file$5, 39, 2, 896);
    			add_location(div5, file$5, 37, 0, 868);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			mount_component(head, div5, null);
    			append_dev(div5, t0);
    			append_dev(div5, div4);
    			append_dev(div4, div0);
    			append_dev(div4, t2);
    			append_dev(div4, div3);
    			append_dev(div3, div1);
    			mount_component(text0, div1, null);
    			append_dev(div1, t3);
    			append_dev(div1, t4);
    			append_dev(div3, t5);
    			append_dev(div3, div2);
    			mount_component(text1, div2, null);
    			append_dev(div2, t6);
    			append_dev(div2, t7);
    			append_dev(div4, t8);
    			mount_component(scale, div4, null);
    			append_dev(div5, t9);
    			mount_component(foot, div5, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const text0_changes = {};

    			if (!updating_text && dirty & /*a*/ 2) {
    				updating_text = true;
    				text0_changes.text = /*a*/ ctx[1];
    				add_flush_callback(() => updating_text = false);
    			}

    			text0.$set(text0_changes);
    			if (!current || dirty & /*aNum*/ 8) set_data_dev(t4, /*aNum*/ ctx[3]);
    			const text1_changes = {};

    			if (!updating_text_1 && dirty & /*b*/ 4) {
    				updating_text_1 = true;
    				text1_changes.text = /*b*/ ctx[2];
    				add_flush_callback(() => updating_text_1 = false);
    			}

    			text1.$set(text1_changes);
    			if (!current || dirty & /*bNum*/ 16) set_data_dev(t7, /*bNum*/ ctx[4]);
    			const scale_changes = {};

    			if (dirty & /*$$scope, bNum, b, aNum, a*/ 286) {
    				scale_changes.$$scope = { dirty, ctx };
    			}

    			scale.$set(scale_changes);
    			const foot_changes = {};
    			if (dirty & /*title*/ 1) foot_changes.title = /*title*/ ctx[0];
    			foot.$set(foot_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(head.$$.fragment, local);
    			transition_in(text0.$$.fragment, local);
    			transition_in(text1.$$.fragment, local);
    			transition_in(scale.$$.fragment, local);
    			transition_in(foot.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(head.$$.fragment, local);
    			transition_out(text0.$$.fragment, local);
    			transition_out(text1.$$.fragment, local);
    			transition_out(scale.$$.fragment, local);
    			transition_out(foot.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			destroy_component(head);
    			destroy_component(text0);
    			destroy_component(text1);
    			destroy_component(scale);
    			destroy_component(foot);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	src.extend(src$1);
    	let { title = "" } = $$props;
    	let { sub = "" } = $$props;
    	let a = "forty seven";
    	let b = "fourteen";
    	const writable_props = ["title", "sub"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Post", $$slots, []);

    	function text0_text_binding(value) {
    		a = value;
    		$$invalidate(1, a);
    	}

    	function text1_text_binding(value) {
    		b = value;
    		$$invalidate(2, b);
    	}

    	$$self.$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(5, sub = $$props.sub);
    	};

    	$$self.$capture_state = () => ({
    		Head,
    		Foot,
    		Scale,
    		Thing,
    		Text,
    		nlp: src,
    		nlpNumbers: src$1,
    		title,
    		sub,
    		a,
    		b,
    		aNum,
    		bNum
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("sub" in $$props) $$invalidate(5, sub = $$props.sub);
    		if ("a" in $$props) $$invalidate(1, a = $$props.a);
    		if ("b" in $$props) $$invalidate(2, b = $$props.b);
    		if ("aNum" in $$props) $$invalidate(3, aNum = $$props.aNum);
    		if ("bNum" in $$props) $$invalidate(4, bNum = $$props.bNum);
    	};

    	let aNum;
    	let bNum;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*a*/ 2) {
    			 $$invalidate(3, aNum = src(a).values().json(0).number);
    		}

    		if ($$self.$$.dirty & /*b*/ 4) {
    			 $$invalidate(4, bNum = src(b).values().json(0).number);
    		}
    	};

    	return [title, a, b, aNum, bNum, sub, text0_text_binding, text1_text_binding];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$5, safe_not_equal, { title: 0, sub: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$5.name
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
