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
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
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
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
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
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error(`Cannot have duplicate keys in a keyed each`);
            }
            keys.add(key);
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
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
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

    const MSEC_IN_HOUR = 60 * 60 * 1000;

    //convert our local date syntax a javascript UTC date
    const toUtc = (dstChange, offset, year) => {
      const [month, rest] = dstChange.split('/');
      const [day, hour] = rest.split(':');
      return Date.UTC(year, month - 1, day, hour) - offset * MSEC_IN_HOUR
    };

    // compare epoch with dst change events (in utc)
    const inSummerTime = (epoch, start, end, summerOffset, winterOffset) => {
      const year = new Date(epoch).getUTCFullYear();
      const startUtc = toUtc(start, winterOffset, year);
      const endUtc = toUtc(end, summerOffset, year);
      // simple number comparison now
      return epoch >= startUtc && epoch < endUtc
    };

    // this method avoids having to do a full dst-calculation on every operation
    // it reproduces some things in ./index.js, but speeds up spacetime considerably
    const quickOffset = s => {
      let zones = s.timezones;
      let obj = zones[s.tz];
      if (obj === undefined) {
        console.warn("Warning: couldn't find timezone " + s.tz);
        return 0
      }
      if (obj.dst === undefined) {
        return obj.offset
      }

      //get our two possible offsets
      let jul = obj.offset;
      let dec = obj.offset + 1; // assume it's the same for now
      if (obj.hem === 'n') {
        dec = jul - 1;
      }
      let split = obj.dst.split('->');
      let inSummer = inSummerTime(s.epoch, split[0], split[1], jul, dec);
      if (inSummer === true) {
        return jul
      }
      return dec
    };

    var data = {
      "9|s": "2/dili,2/jayapura",
      "9|n": "2/chita,2/khandyga,2/pyongyang,2/seoul,2/tokyo,11/palau,japan,rok",
      "9.5|s|04/03:03->10/02:02": "4/adelaide,4/broken_hill,4/south,4/yancowinna",
      "9.5|s": "4/darwin,4/north",
      "8|s|03/08:01->10/04:00": "12/casey",
      "8|s": "2/kuala_lumpur,2/makassar,2/singapore,4/perth,2/ujung_pandang,4/west,singapore",
      "8|n": "2/brunei,2/choibalsan,2/hong_kong,2/irkutsk,2/kuching,2/macau,2/manila,2/shanghai,2/taipei,2/ulaanbaatar,2/chongqing,2/chungking,2/harbin,2/macao,2/ulan_bator,hongkong,prc,roc",
      "8.75|s": "4/eucla",
      "7|s": "12/davis,2/jakarta,9/christmas",
      "7|n": "2/bangkok,2/barnaul,2/hovd,2/krasnoyarsk,2/novokuznetsk,2/novosibirsk,2/phnom_penh,2/pontianak,2/ho_chi_minh,2/tomsk,2/vientiane,2/saigon",
      "6|s": "12/vostok",
      "6|n": "2/almaty,2/bishkek,2/dhaka,2/omsk,2/qyzylorda,2/qostanay,2/thimphu,2/urumqi,9/chagos,2/dacca,2/kashgar,2/thimbu",
      "6.5|n": "2/yangon,9/cocos,2/rangoon",
      "5|s": "12/mawson,9/kerguelen",
      "5|n": "2/aqtau,2/aqtobe,2/ashgabat,2/atyrau,2/dushanbe,2/karachi,2/oral,2/samarkand,2/tashkent,2/yekaterinburg,9/maldives,2/ashkhabad",
      "5.75|n": "2/katmandu,2/kathmandu",
      "5.5|n": "2/kolkata,2/colombo,2/calcutta",
      "4|s": "9/reunion",
      "4|n": "2/baku,2/dubai,2/muscat,2/tbilisi,2/yerevan,8/astrakhan,8/samara,8/saratov,8/ulyanovsk,8/volgograd,2/volgograd,9/mahe,9/mauritius",
      "4.5|n|03/22:00->09/21:24": "2/tehran,iran",
      "4.5|n": "2/kabul",
      "3|s": "12/syowa,9/antananarivo",
      "3|n|03/27:03->10/30:04": "2/famagusta,2/nicosia,8/athens,8/bucharest,8/helsinki,8/kiev,8/mariehamn,8/riga,8/sofia,8/tallinn,8/uzhgorod,8/vilnius,8/zaporozhye,8/nicosia",
      "3|n|03/27:02->10/30:03": "8/chisinau,8/tiraspol",
      "3|n|03/27:00->10/29:24": "2/beirut",
      "3|n|03/26:00->10/28:01": "2/gaza,2/hebron",
      "3|n|03/25:02->10/30:02": "2/jerusalem,2/tel_aviv,israel",
      "3|n|03/25:00->10/27:24": "2/damascus",
      "3|n|02/25:00->10/28:01": "2/amman",
      "3|n": "0/addis_ababa,0/asmara,0/asmera,0/dar_es_salaam,0/djibouti,0/juba,0/kampala,0/mogadishu,0/nairobi,2/aden,2/baghdad,2/bahrain,2/kuwait,2/qatar,2/riyadh,8/istanbul,8/kirov,8/minsk,8/moscow,8/simferopol,9/comoro,9/mayotte,2/istanbul,turkey,w-su",
      "2|s|03/27:02->10/30:02": "12/troll",
      "2|s": "0/gaborone,0/harare,0/johannesburg,0/lubumbashi,0/lusaka,0/maputo,0/maseru,0/mbabane",
      "2|n|03/27:02->10/30:03": "0/ceuta,arctic/longyearbyen,8/amsterdam,8/andorra,8/belgrade,8/berlin,8/bratislava,8/brussels,8/budapest,8/busingen,8/copenhagen,8/gibraltar,8/ljubljana,8/luxembourg,8/madrid,8/malta,8/monaco,8/oslo,8/paris,8/podgorica,8/prague,8/rome,8/san_marino,8/sarajevo,8/skopje,8/stockholm,8/tirane,8/vaduz,8/vatican,8/vienna,8/warsaw,8/zagreb,8/zurich,3/jan_mayen,poland",
      "2|n": "0/blantyre,0/bujumbura,0/cairo,0/khartoum,0/kigali,0/tripoli,8/kaliningrad,egypt,libya",
      "1|s": "0/brazzaville,0/kinshasa,0/luanda,0/windhoek",
      "1|n|03/27:03->05/08:02": "0/casablanca,0/el_aaiun",
      "1|n|03/27:01->10/30:02": "3/canary,3/faroe,3/madeira,8/dublin,8/guernsey,8/isle_of_man,8/jersey,8/lisbon,8/london,3/faeroe,eire,8/belfast,gb-eire,gb,portugal",
      "1|n": "0/algiers,0/bangui,0/douala,0/lagos,0/libreville,0/malabo,0/ndjamena,0/niamey,0/porto-novo,0/tunis",
      "14|n": "11/kiritimati",
      "13|s|04/04:04->09/26:03": "11/apia",
      "13|s|01/15:02->11/05:03": "11/tongatapu",
      "13|n": "11/enderbury,11/fakaofo",
      "12|s|04/03:03->09/25:02": "12/mcmurdo,11/auckland,12/south_pole,nz",
      "12|s|01/17:03->11/14:02": "11/fiji",
      "12|n": "2/anadyr,2/kamchatka,2/srednekolymsk,11/funafuti,11/kwajalein,11/majuro,11/nauru,11/tarawa,11/wake,11/wallis,kwajalein",
      "12.75|s|04/03:03->04/03:02": "11/chatham,nz-chat",
      "11|s|04/03:03->10/02:02": "12/macquarie",
      "11|s": "11/bougainville",
      "11|n": "2/magadan,2/sakhalin,11/efate,11/guadalcanal,11/kosrae,11/noumea,11/pohnpei,11/ponape",
      "11.5|n|04/03:03->10/02:02": "11/norfolk",
      "10|s|04/03:03->10/02:02": "4/currie,4/hobart,4/melbourne,4/sydney,4/act,4/canberra,4/nsw,4/tasmania,4/victoria",
      "10|s": "12/dumontdurville,4/brisbane,4/lindeman,11/port_moresby,4/queensland",
      "10|n": "2/ust-nera,2/vladivostok,2/yakutsk,11/guam,11/saipan,11/chuuk,11/truk,11/yap",
      "10.5|s|04/03:01->10/02:02": "4/lord_howe,4/lhi",
      "0|n|03/27:00->10/30:01": "1/scoresbysund,3/azores",
      "0|n": "0/abidjan,0/accra,0/bamako,0/banjul,0/bissau,0/conakry,0/dakar,0/freetown,0/lome,0/monrovia,0/nouakchott,0/ouagadougou,0/sao_tome,1/danmarkshavn,3/reykjavik,3/st_helena,13/gmt,13/utc,0/timbuktu,13/greenwich,13/uct,13/universal,13/zulu,gmt-0,gmt+0,gmt0,greenwich,iceland,uct,universal,utc,zulu",
      "-9|n|03/13:02->11/06:02": "1/adak,1/atka,us/aleutian",
      "-9|n": "11/gambier",
      "-9.5|n": "11/marquesas",
      "-8|n|03/13:02->11/06:02": "1/anchorage,1/juneau,1/metlakatla,1/nome,1/sitka,1/yakutat,us/alaska",
      "-8|n": "11/pitcairn",
      "-7|n|03/13:02->11/06:02": "1/los_angeles,1/santa_isabel,1/tijuana,1/vancouver,1/ensenada,6/pacific,10/bajanorte,us/pacific-new,us/pacific",
      "-7|n|03/08:02->11/01:01": "1/dawson,1/whitehorse,6/yukon",
      "-7|n": "1/creston,1/dawson_creek,1/fort_nelson,1/hermosillo,1/phoenix,us/arizona",
      "-6|s|04/02:22->09/03:22": "11/easter,7/easterisland",
      "-6|n|04/03:02->10/30:02": "1/chihuahua,1/mazatlan,10/bajasur",
      "-6|n|03/13:02->11/06:02": "1/boise,1/cambridge_bay,1/denver,1/edmonton,1/inuvik,1/ojinaga,1/yellowknife,1/shiprock,6/mountain,navajo,us/mountain",
      "-6|n": "1/belize,1/costa_rica,1/el_salvador,1/guatemala,1/managua,1/regina,1/swift_current,1/tegucigalpa,11/galapagos,6/east-saskatchewan,6/saskatchewan",
      "-5|s": "1/lima,1/rio_branco,1/porto_acre,5/acre",
      "-5|n|04/03:02->10/30:02": "1/bahia_banderas,1/merida,1/mexico_city,1/monterrey,10/general",
      "-5|n|03/13:02->11/06:02": "1/chicago,1/matamoros,1/menominee,1/rainy_river,1/rankin_inlet,1/resolute,1/winnipeg,1/indiana/knox,1/indiana/tell_city,1/north_dakota/beulah,1/north_dakota/center,1/north_dakota/new_salem,1/knox_in,6/central,us/central,us/indiana-starke",
      "-5|n|03/12:03->11/05:01": "1/north_dakota",
      "-5|n": "1/bogota,1/cancun,1/cayman,1/coral_harbour,1/eirunepe,1/guayaquil,1/jamaica,1/panama,1/atikokan,jamaica",
      "-4|s|05/13:23->08/13:01": "12/palmer",
      "-4|s|04/02:24->09/04:00": "1/santiago,7/continental",
      "-4|s|03/26:24->10/02:00": "1/asuncion",
      "-4|s|02/16:24->11/03:00": "1/campo_grande,1/cuiaba",
      "-4|s": "1/la_paz,1/manaus,5/west",
      "-4|n|03/13:02->11/06:02": "1/detroit,1/grand_turk,1/indianapolis,1/iqaluit,1/louisville,1/montreal,1/nassau,1/new_york,1/nipigon,1/pangnirtung,1/port-au-prince,1/thunder_bay,1/toronto,1/indiana/marengo,1/indiana/petersburg,1/indiana/vevay,1/indiana/vincennes,1/indiana/winamac,1/kentucky/monticello,1/fort_wayne,1/indiana/indianapolis,1/kentucky/louisville,6/eastern,us/east-indiana,us/eastern,us/michigan",
      "-4|n|03/13:00->11/06:01": "1/havana,cuba",
      "-4|n|03/12:03->11/05:01": "1/indiana,1/kentucky",
      "-4|n": "1/anguilla,1/antigua,1/aruba,1/barbados,1/blanc-sablon,1/boa_vista,1/caracas,1/curacao,1/dominica,1/grenada,1/guadeloupe,1/guyana,1/kralendijk,1/lower_princes,1/marigot,1/martinique,1/montserrat,1/port_of_spain,1/porto_velho,1/puerto_rico,1/santo_domingo,1/st_barthelemy,1/st_kitts,1/st_lucia,1/st_thomas,1/st_vincent,1/tortola,1/virgin",
      "-3|s": "1/argentina,1/buenos_aires,1/catamarca,1/cordoba,1/fortaleza,1/jujuy,1/mendoza,1/montevideo,1/punta_arenas,1/sao_paulo,12/rothera,3/stanley,1/argentina/la_rioja,1/argentina/rio_gallegos,1/argentina/salta,1/argentina/san_juan,1/argentina/san_luis,1/argentina/tucuman,1/argentina/ushuaia,1/argentina/comodrivadavia,1/argentina/buenos_aires,1/argentina/catamarca,1/argentina/cordoba,1/argentina/jujuy,1/argentina/mendoza,1/argentina/rosario,1/rosario,5/east",
      "-3|n|03/13:02->11/06:02": "1/glace_bay,1/goose_bay,1/halifax,1/moncton,1/thule,3/bermuda,6/atlantic",
      "-3|n": "1/araguaina,1/bahia,1/belem,1/cayenne,1/maceio,1/paramaribo,1/recife,1/santarem",
      "-2|n|03/26:22->10/29:23": "1/nuuk,1/godthab",
      "-2|n|03/13:02->11/06:02": "1/miquelon",
      "-2|n": "1/noronha,3/south_georgia,5/denoronha",
      "-2.5|n|03/13:02->11/06:02": "1/st_johns,6/newfoundland",
      "-1|n": "3/cape_verde",
      "-11|n": "11/midway,11/niue,11/pago_pago,11/samoa,us/samoa",
      "-10|n": "11/honolulu,11/johnston,11/rarotonga,11/tahiti,us/hawaii"
    };

    //prefixes for iana names..
    var prefixes = [
      'africa',
      'america',
      'asia',
      'atlantic',
      'australia',
      'brazil',
      'canada',
      'chile',
      'europe',
      'indian',
      'mexico',
      'pacific',
      'antarctica',
      'etc'
    ];

    let all = {};
    Object.keys(data).forEach((k) => {
      let split = k.split('|');
      let obj = {
        offset: Number(split[0]),
        hem: split[1]
      };
      if (split[2]) {
        obj.dst = split[2];
      }
      let names = data[k].split(',');
      names.forEach((str) => {
        str = str.replace(/(^[0-9]+)\//, (before, num) => {
          num = Number(num);
          return prefixes[num] + '/'
        });
        all[str] = obj;
      });
    });

    all.utc = {
      offset: 0,
      hem: 'n' //default to northern hemisphere - (sorry!)
    };

    //add etc/gmt+n
    for (let i = -14; i <= 14; i += 0.5) {
      let num = i;
      if (num > 0) {
        num = '+' + num;
      }
      let name = 'etc/gmt' + num;
      all[name] = {
        offset: i * -1, //they're negative!
        hem: 'n' //(sorry)
      };
      name = 'utc/gmt' + num; //this one too, why not.
      all[name] = {
        offset: i * -1,
        hem: 'n'
      };
    }

    //find the implicit iana code for this machine.
    //safely query the Intl object
    //based on - https://bitbucket.org/pellepim/jstimezonedetect/src
    const fallbackTZ = 'utc'; //

    //this Intl object is not supported often, yet
    const safeIntl = () => {
      if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat === 'undefined') {
        return null
      }
      let format = Intl.DateTimeFormat();
      if (typeof format === 'undefined' || typeof format.resolvedOptions === 'undefined') {
        return null
      }
      let timezone = format.resolvedOptions().timeZone;
      if (!timezone) {
        return null
      }
      return timezone.toLowerCase()
    };

    const guessTz = () => {
      let timezone = safeIntl();
      if (timezone === null) {
        return fallbackTZ
      }
      return timezone
    };

    const isOffset = /(\-?[0-9]+)h(rs)?/i;
    const isNumber = /(\-?[0-9]+)/;
    const utcOffset = /utc([\-+]?[0-9]+)/i;
    const gmtOffset = /gmt([\-+]?[0-9]+)/i;

    const toIana = function (num) {
      num = Number(num);
      if (num >= -13 && num <= 13) {
        num = num * -1; //it's opposite!
        num = (num > 0 ? '+' : '') + num; //add plus sign
        return 'etc/gmt' + num
      }
      return null
    };

    const parseOffset = function (tz) {
      // '+5hrs'
      let m = tz.match(isOffset);
      if (m !== null) {
        return toIana(m[1])
      }
      // 'utc+5'
      m = tz.match(utcOffset);
      if (m !== null) {
        return toIana(m[1])
      }
      // 'GMT-5' (not opposite)
      m = tz.match(gmtOffset);
      if (m !== null) {
        let num = Number(m[1]) * -1;
        return toIana(num)
      }
      // '+5'
      m = tz.match(isNumber);
      if (m !== null) {
        return toIana(m[1])
      }
      return null
    };

    const local = guessTz();

    //add all the city names by themselves
    const cities = Object.keys(all).reduce((h, k) => {
      let city = k.split('/')[1] || '';
      city = city.replace(/_/g, ' ');
      h[city] = k;
      return h
    }, {});

    //try to match these against iana form
    const normalize = (tz) => {
      tz = tz.replace(/ time/g, '');
      tz = tz.replace(/ (standard|daylight|summer)/g, '');
      tz = tz.replace(/\b(east|west|north|south)ern/g, '$1');
      tz = tz.replace(/\b(africa|america|australia)n/g, '$1');
      tz = tz.replace(/\beuropean/g, 'europe');
      tz = tz.replace(/\islands/g, 'island');
      return tz
    };

    // try our best to reconcile the timzone to this given string
    const lookupTz = (str, zones) => {
      if (!str) {
        return local
      }
      if (typeof str !== 'string') {
        console.error("Timezone must be a string - recieved: '", str, "'\n");
      }
      let tz = str.trim();
      // let split = str.split('/')
      //support long timezones like 'America/Argentina/Rio_Gallegos'
      // if (split.length > 2 && zones.hasOwnProperty(tz) === false) {
      //   tz = split[0] + '/' + split[1]
      // }
      tz = tz.toLowerCase();
      if (zones.hasOwnProperty(tz) === true) {
        return tz
      }
      //lookup more loosely..
      tz = normalize(tz);
      if (zones.hasOwnProperty(tz) === true) {
        return tz
      }
      //try city-names
      if (cities.hasOwnProperty(tz) === true) {
        return cities[tz]
      }
      // //try to parse '-5h'
      if (/[0-9]/.test(tz) === true) {
        let id = parseOffset(tz);
        if (id) {
          return id
        }
      }

      throw new Error(
        "Spacetime: Cannot find timezone named: '" + str + "'. Please enter an IANA timezone id."
      )
    };

    //git:blame @JuliasCaesar https://www.timeanddate.com/date/leapyear.html
    function isLeapYear(year) { return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 }
    // unsurprisingly-nasty `typeof date` call
    function isDate(d) { return Object.prototype.toString.call(d) === '[object Date]' && !isNaN(d.valueOf()) }
    function isArray(input) { return Object.prototype.toString.call(input) === '[object Array]' }
    function isObject(input) { return Object.prototype.toString.call(input) === '[object Object]' }
    function isBoolean(input) { return Object.prototype.toString.call(input) === '[object Boolean]' }

    function zeroPad(str, len = 2) {
      let pad = '0';
      str = str + '';
      return str.length >= len ? str : new Array(len - str.length + 1).join(pad) + str
    }

    function titleCase(str) {
      if (!str) {
        return ''
      }
      return str[0].toUpperCase() + str.substr(1)
    }

    function ordinal(i) {
      let j = i % 10;
      let k = i % 100;
      if (j === 1 && k !== 11) {
        return i + 'st'
      }
      if (j === 2 && k !== 12) {
        return i + 'nd'
      }
      if (j === 3 && k !== 13) {
        return i + 'rd'
      }
      return i + 'th'
    }

    //strip 'st' off '1st'..
    function toCardinal(str) {
      str = String(str);
      str = str.replace(/([0-9])(st|nd|rd|th)$/i, '$1');
      return parseInt(str, 10)
    }

    //used mostly for cleanup of unit names, like 'months'
    function normalize$1(str = '') {
      str = str.toLowerCase().trim();
      str = str.replace(/ies$/, 'y'); //'centuries'
      str = str.replace(/s$/, '');
      str = str.replace(/-/g, '');
      if (str === 'day' || str === 'days') {
        return 'date'
      }
      if (str === 'min' || str === 'mins') {
        return 'minute'
      }
      return str
    }

    function getEpoch(tmp) {
      //support epoch
      if (typeof tmp === 'number') {
        return tmp
      }
      //suport date objects
      if (isDate(tmp)) {
        return tmp.getTime()
      }
      if (tmp.epoch) {
        return tmp.epoch
      }
      return null
    }

    //make sure this input is a spacetime obj
    function beADate(d, s) {
      if (isObject(d) === false) {
        return s.clone().set(d)
      }
      return d
    }

    function formatTimezone(offset, delimiter = '') {
      const sign = offset > 0 ? '+' : '-';
      const absOffset = Math.abs(offset);
      const hours = zeroPad(parseInt('' + absOffset, 10));
      const minutes = zeroPad((absOffset % 1) * 60);
      return `${sign}${hours}${delimiter}${minutes}`
    }

    const defaults = {
      year: new Date().getFullYear(),
      month: 0,
      date: 1
    };

    //support [2016, 03, 01] format
    const parseArray = (s, arr, today) => {
      if (arr.length === 0) {
        return s
      }
      let order = ['year', 'month', 'date', 'hour', 'minute', 'second', 'millisecond'];
      for (let i = 0; i < order.length; i++) {
        let num = arr[i] || today[order[i]] || defaults[order[i]] || 0;
        s = s[order[i]](num);
      }
      return s
    };

    //support {year:2016, month:3} format
    const parseObject = (s, obj, today) => {
      // if obj is empty, do nothing
      if (Object.keys(obj).length === 0) {
        return s
      }
      obj = Object.assign({}, defaults, today, obj);
      let keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        let unit = keys[i];
        //make sure we have this method
        if (s[unit] === undefined || typeof s[unit] !== 'function') {
          continue
        }
        //make sure the value is a number
        if (obj[unit] === null || obj[unit] === undefined || obj[unit] === '') {
          continue
        }
        let num = obj[unit] || today[unit] || defaults[unit] || 0;
        s = s[unit](num);
      }
      return s
    };

    // this may seem like an arbitrary number, but it's 'within jan 1970'
    // this is only really ambiguous until 2054 or so
    const parseNumber = function (s, input) {
      const minimumEpoch = 2500000000;
      // if the given epoch is really small, they've probably given seconds and not milliseconds
      // anything below this number is likely (but not necessarily) a mistaken input.
      if (input > 0 && input < minimumEpoch && s.silent === false) {
        console.warn('  - Warning: You are setting the date to January 1970.');
        console.warn('       -   did input seconds instead of milliseconds?');
      }
      s.epoch = input;
      return s
    };

    var fns = {
      parseArray,
      parseObject,
      parseNumber
    };

    // pull in 'today' data for the baseline moment
    const getNow = function (s) {
      s.epoch = Date.now();
      Object.keys(s._today || {}).forEach((k) => {
        if (typeof s[k] === 'function') {
          s = s[k](s._today[k]);
        }
      });
      return s
    };

    const dates = {
      now: (s) => {
        return getNow(s)
      },
      today: (s) => {
        return getNow(s)
      },
      tonight: (s) => {
        s = getNow(s);
        s = s.hour(18); //6pm
        return s
      },
      tomorrow: (s) => {
        s = getNow(s);
        s = s.add(1, 'day');
        s = s.startOf('day');
        return s
      },
      yesterday: (s) => {
        s = getNow(s);
        s = s.subtract(1, 'day');
        s = s.startOf('day');
        return s
      },
      christmas: (s) => {
        let year = getNow(s).year();
        s = s.set([year, 11, 25, 18, 0, 0]); // Dec 25
        return s
      },
      'new years': (s) => {
        let year = getNow(s).year();
        s = s.set([year, 11, 31, 18, 0, 0]); // Dec 31
        return s
      }
    };
    dates['new years eve'] = dates['new years'];

    //little cleanup..
    const normalize$2 = function (str) {
      // remove all day-names
      str = str.replace(/\b(mon|tues?|wed|wednes|thur?s?|fri|sat|satur|sun)(day)?\b/i, '');
      //remove ordinal ending
      str = str.replace(/([0-9])(th|rd|st|nd)/, '$1');
      str = str.replace(/,/g, '');
      str = str.replace(/ +/g, ' ').trim();
      return str
    };

    let o = {
      millisecond: 1
    };
    o.second = 1000;
    o.minute = 60000;
    o.hour = 3.6e6; // dst is supported post-hoc
    o.day = 8.64e7; //
    o.date = o.day;
    o.month = 8.64e7 * 29.5; //(average)
    o.week = 6.048e8;
    o.year = 3.154e10; // leap-years are supported post-hoc
    //add plurals
    Object.keys(o).forEach(k => {
      o[k + 's'] = o[k];
    });

    //basically, step-forward/backward until js Date object says we're there.
    const walk = (s, n, fn, unit, previous) => {
      let current = s.d[fn]();
      if (current === n) {
        return //already there
      }
      let startUnit = previous === null ? null : s.d[previous]();
      let original = s.epoch;
      //try to get it as close as we can
      let diff = n - current;
      s.epoch += o[unit] * diff;
      //DST edge-case: if we are going many days, be a little conservative
      // console.log(unit, diff)
      if (unit === 'day') {
        // s.epoch -= ms.minute
        //but don't push it over a month
        if (Math.abs(diff) > 28 && n < 28) {
          s.epoch += o.hour;
        }
      }
      // 1st time: oops, did we change previous unit? revert it.
      if (previous !== null && startUnit !== s.d[previous]()) {
        // console.warn('spacetime warning: missed setting ' + unit)
        s.epoch = original;
        // s.epoch += ms[unit] * diff * 0.89 // maybe try and make it close...?
      }
      //repair it if we've gone too far or something
      //(go by half-steps, just in case)
      const halfStep = o[unit] / 2;
      while (s.d[fn]() < n) {
        s.epoch += halfStep;
      }

      while (s.d[fn]() > n) {
        s.epoch -= halfStep;
      }
      // 2nd time: did we change previous unit? revert it.
      if (previous !== null && startUnit !== s.d[previous]()) {
        // console.warn('spacetime warning: missed setting ' + unit)
        s.epoch = original;
      }
    };
    //find the desired date by a increment/check while loop
    const units = {
      year: {
        valid: (n) => n > -4000 && n < 4000,
        walkTo: (s, n) => walk(s, n, 'getFullYear', 'year', null)
      },
      month: {
        valid: (n) => n >= 0 && n <= 11,
        walkTo: (s, n) => {
          let d = s.d;
          let current = d.getMonth();
          let original = s.epoch;
          let startUnit = d.getFullYear();
          if (current === n) {
            return
          }
          //try to get it as close as we can..
          let diff = n - current;
          s.epoch += o.day * (diff * 28); //special case
          //oops, did we change the year? revert it.
          if (startUnit !== s.d.getFullYear()) {
            s.epoch = original;
          }
          //increment by day
          while (s.d.getMonth() < n) {
            s.epoch += o.day;
          }
          while (s.d.getMonth() > n) {
            s.epoch -= o.day;
          }
        }
      },
      date: {
        valid: (n) => n > 0 && n <= 31,
        walkTo: (s, n) => walk(s, n, 'getDate', 'day', 'getMonth')
      },
      hour: {
        valid: (n) => n >= 0 && n < 24,
        walkTo: (s, n) => walk(s, n, 'getHours', 'hour', 'getDate')
      },
      minute: {
        valid: (n) => n >= 0 && n < 60,
        walkTo: (s, n) => walk(s, n, 'getMinutes', 'minute', 'getHours')
      },
      second: {
        valid: (n) => n >= 0 && n < 60,
        walkTo: (s, n) => {
          //do this one directly
          s.epoch = s.seconds(n).epoch;
        }
      },
      millisecond: {
        valid: (n) => n >= 0 && n < 1000,
        walkTo: (s, n) => {
          //do this one directly
          s.epoch = s.milliseconds(n).epoch;
        }
      }
    };

    const walkTo = (s, wants) => {
      let keys = Object.keys(units);
      let old = s.clone();
      for (let i = 0; i < keys.length; i++) {
        let k = keys[i];
        let n = wants[k];
        if (n === undefined) {
          n = old[k]();
        }
        if (typeof n === 'string') {
          n = parseInt(n, 10);
        }
        //make-sure it's valid
        if (!units[k].valid(n)) {
          s.epoch = null;
          if (s.silent === false) {
            console.warn('invalid ' + k + ': ' + n);
          }
          return
        }
        units[k].walkTo(s, n);
      }
      return
    };

    const monthLengths = [
      31, // January - 31 days
      28, // February - 28 days in a common year and 29 days in leap years
      31, // March - 31 days
      30, // April - 30 days
      31, // May - 31 days
      30, // June - 30 days
      31, // July - 31 days
      31, // August - 31 days
      30, // September - 30 days
      31, // October - 31 days
      30, // November - 30 days
      31 // December - 31 days
    ];

    // 28 - feb
    // 30 - april, june, sept, nov
    // 31 - jan, march, may, july, aug, oct, dec

    let shortMonths = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec'
    ];
    let longMonths = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december'
    ];

    function buildMapping() {
      const obj = {
        sep: 8 //support this format
      };
      for (let i = 0; i < shortMonths.length; i++) {
        obj[shortMonths[i]] = i;
      }
      for (let i = 0; i < longMonths.length; i++) {
        obj[longMonths[i]] = i;
      }
      return obj
    }

    function short() { return shortMonths }
    function long() { return longMonths }
    function mapping() { return buildMapping() }
    function set(i18n) {
      shortMonths = i18n.short || shortMonths;
      longMonths = i18n.long || longMonths;
    }

    //pull-apart ISO offsets, like "+0100"
    const parseOffset$1 = (s, offset) => {
      if (!offset) {
        return s
      }

      // according to ISO8601, tz could be hh:mm, hhmm or hh
      // so need few more steps before the calculation.
      let num = 0;

      // for (+-)hh:mm
      if (/^[\+-]?[0-9]{2}:[0-9]{2}$/.test(offset)) {
        //support "+01:00"
        if (/:00/.test(offset) === true) {
          offset = offset.replace(/:00/, '');
        }
        //support "+01:30"
        if (/:30/.test(offset) === true) {
          offset = offset.replace(/:30/, '.5');
        }
      }

      // for (+-)hhmm
      if (/^[\+-]?[0-9]{4}$/.test(offset)) {
        offset = offset.replace(/30$/, '.5');
      }
      num = parseFloat(offset);

      //divide by 100 or 10 - , "+0100", "+01"
      if (Math.abs(num) > 100) {
        num = num / 100;
      }
      //this is a fancy-move
      if (num === 0 || offset === 'Z' || offset === 'z') {
        s.tz = 'etc/gmt';
        return s
      }
      //okay, try to match it to a utc timezone
      //remember - this is opposite! a -5 offset maps to Etc/GMT+5  ¯\_(:/)_/¯
      //https://askubuntu.com/questions/519550/why-is-the-8-timezone-called-gmt-8-in-the-filesystem
      num *= -1;

      if (num >= 0) {
        num = '+' + num;
      }
      let tz = 'etc/gmt' + num;
      let zones = s.timezones;

      if (zones[tz]) {
        // log a warning if we're over-writing a given timezone?
        // console.log('changing timezone to: ' + tz)
        s.tz = tz;
      }
      return s
    };

    // truncate any sub-millisecond values
    const parseMs = function (str = '') {
      str = String(str);
      //js does not support sub-millisecond values 
      // so truncate these - 2021-11-02T19:55:30.087772
      if (str.length > 3) {
        str = str.substr(0, 3);
      } else if (str.length === 1) {
        // assume ms are zero-padded on the left
        // but maybe not on the right.
        // turn '.10' into '.100'
        str = str + '00';
      } else if (str.length === 2) {
        str = str + '0';
      }
      return Number(str) || 0
    };

    const parseTime = (s, str = '') => {
      // remove all whitespace
      str = str.replace(/^\s+/, '').toLowerCase();
      //formal time format - 04:30.23
      let arr = str.match(/([0-9]{1,2}):([0-9]{1,2}):?([0-9]{1,2})?[:\.]?([0-9]{1,4})?/);
      if (arr !== null) {
        //validate it a little
        let h = Number(arr[1]);
        if (h < 0 || h > 24) {
          return s.startOf('day')
        }
        let m = Number(arr[2]); //don't accept '5:3pm'
        if (arr[2].length < 2 || m < 0 || m > 59) {
          return s.startOf('day')
        }
        s = s.hour(h);
        s = s.minute(m);
        s = s.seconds(arr[3] || 0);
        s = s.millisecond(parseMs(arr[4]));
        //parse-out am/pm
        let ampm = str.match(/[\b0-9] ?(am|pm)\b/);
        if (ampm !== null && ampm[1]) {
          s = s.ampm(ampm[1]);
        }
        return s
      }

      //try an informal form - 5pm (no minutes)
      arr = str.match(/([0-9]+) ?(am|pm)/);
      if (arr !== null && arr[1]) {
        let h = Number(arr[1]);
        //validate it a little..
        if (h > 12 || h < 1) {
          return s.startOf('day')
        }
        s = s.hour(arr[1] || 0);
        s = s.ampm(arr[2]);
        s = s.startOf('hour');
        return s
      }

      //no time info found, use start-of-day
      s = s.startOf('day');
      return s
    };

    let months = mapping();

    //given a month, return whether day number exists in it
    const validate = (obj) => {
      //invalid values
      if (monthLengths.hasOwnProperty(obj.month) !== true) {
        return false
      }
      //support leap-year in february
      if (obj.month === 1) {
        if (isLeapYear(obj.year) && obj.date <= 29) {
          return true
        } else {
          return obj.date <= 28
        }
      }
      //is this date too-big for this month?
      let max = monthLengths[obj.month] || 0;
      if (obj.date <= max) {
        return true
      }
      return false
    };

    const parseYear = (str = '', today) => {
      str = str.trim();
      // parse '86 shorthand
      if (/^'[0-9][0-9]$/.test(str) === true) {
        let num = Number(str.replace(/'/, ''));
        if (num > 50) {
          return 1900 + num
        }
        return 2000 + num
      }
      let year = parseInt(str, 10);
      // use a given year from options.today
      if (!year && today) {
        year = today.year;
      }
      // fallback to this year
      year = year || new Date().getFullYear();
      return year
    };

    const parseMonth = function (str) {
      str = str.toLowerCase().trim();
      if (str === 'sept') {
        return months.sep
      }
      return months[str]
    };

    var ymd = [
      // =====
      //  y-m-d
      // =====
      //iso-this 1998-05-30T22:00:00:000Z, iso-that 2017-04-03T08:00:00-0700
      {
        reg: /^(\-?0?0?[0-9]{3,4})-([0-9]{1,2})-([0-9]{1,2})[T| ]([0-9.:]+)(Z|[0-9\-\+:]+)?$/i,
        parse: (s, m) => {
          let obj = {
            year: m[1],
            month: parseInt(m[2], 10) - 1,
            date: m[3]
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          parseOffset$1(s, m[5]);
          walkTo(s, obj);
          s = parseTime(s, m[4]);
          return s
        }
      },
      //short-iso "2015-03-25" or "2015/03/25" or "2015/03/25 12:26:14 PM"
      {
        reg: /^([0-9]{4})[\-\/\. ]([0-9]{1,2})[\-\/\. ]([0-9]{1,2})( [0-9]{1,2}(:[0-9]{0,2})?(:[0-9]{0,3})? ?(am|pm)?)?$/i,
        parse: (s, m) => {
          let obj = {
            year: m[1],
            month: parseInt(m[2], 10) - 1,
            date: parseInt(m[3], 10)
          };
          if (obj.month >= 12) {
            //support yyyy/dd/mm (weird, but ok)
            obj.date = parseInt(m[2], 10);
            obj.month = parseInt(m[3], 10) - 1;
          }
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, m[4]);
          return s
        }
      },

      //text-month "2015-feb-25"
      {
        reg: /^([0-9]{4})[\-\/\. ]([a-z]+)[\-\/\. ]([0-9]{1,2})( [0-9]{1,2}(:[0-9]{0,2})?(:[0-9]{0,3})? ?(am|pm)?)?$/i,
        parse: (s, m) => {
          let obj = {
            year: parseYear(m[1], s._today),
            month: parseMonth(m[2]),
            date: toCardinal(m[3] || '')
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, m[4]);
          return s
        }
      }
    ];

    var mdy = [
      // =====
      //  m-d-y
      // =====
      //mm/dd/yyyy - uk/canada "6/28/2019, 12:26:14 PM"
      {
        reg: /^([0-9]{1,2})[\-\/.]([0-9]{1,2})[\-\/.]?([0-9]{4})?( [0-9]{1,2}:[0-9]{2}:?[0-9]{0,2}? ?(am|pm|gmt))?$/i,
        parse: (s, arr) => {
          let month = parseInt(arr[1], 10) - 1;
          let date = parseInt(arr[2], 10);
          //support dd/mm/yyy
          if (s.british || month >= 12) {
            date = parseInt(arr[1], 10);
            month = parseInt(arr[2], 10) - 1;
          }
          let obj = {
            date,
            month,
            year: parseYear(arr[3], s._today) || new Date().getFullYear()
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, arr[4]);
          return s
        }
      },
      //alt short format - "feb-25-2015"
      {
        reg: /^([a-z]+)[\-\/\. ]([0-9]{1,2})[\-\/\. ]?([0-9]{4}|'[0-9]{2})?( [0-9]{1,2}(:[0-9]{0,2})?(:[0-9]{0,3})? ?(am|pm)?)?$/i,
        parse: (s, arr) => {
          let obj = {
            year: parseYear(arr[3], s._today),
            month: parseMonth(arr[1]),
            date: toCardinal(arr[2] || '')
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, arr[4]);
          return s
        }
      },

      //Long "Mar 25 2015"
      //February 22, 2017 15:30:00
      {
        reg: /^([a-z]+) ([0-9]{1,2})( [0-9]{4})?( ([0-9:]+( ?am| ?pm| ?gmt)?))?$/i,
        parse: (s, arr) => {
          let obj = {
            year: parseYear(arr[3], s._today),
            month: parseMonth(arr[1]),
            date: toCardinal(arr[2] || '')
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, arr[4]);
          return s
        }
      },
      // 'Sun Mar 14 15:09:48 +0000 2021'
      {
        reg: /^([a-z]+) ([0-9]{1,2})( [0-9:]+)?( \+[0-9]{4})?( [0-9]{4})?$/i,
        parse: (s, arr) => {
          let obj = {
            year: parseYear(arr[5], s._today),
            month: parseMonth(arr[1]),
            date: toCardinal(arr[2] || '')
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, arr[3]);
          return s
        }
      }
    ];

    var dmy = [
      // =====
      //  d-m-y
      // =====
      //common british format - "25-feb-2015"
      {
        reg: /^([0-9]{1,2})[\-\/]([a-z]+)[\-\/]?([0-9]{4})?$/i,
        parse: (s, m) => {
          let obj = {
            year: parseYear(m[3], s._today),
            month: parseMonth(m[2]),
            date: toCardinal(m[1] || '')
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, m[4]);
          return s
        }
      },
      // "25 Mar 2015"
      {
        reg: /^([0-9]{1,2})( [a-z]+)( [0-9]{4}| '[0-9]{2})? ?([0-9]{1,2}:[0-9]{2}:?[0-9]{0,2}? ?(am|pm|gmt))?$/i,
        parse: (s, m) => {
          let obj = {
            year: parseYear(m[3], s._today),
            month: parseMonth(m[2]),
            date: toCardinal(m[1])
          };
          if (!obj.month || validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, m[4]);
          return s
        }
      },
      // 01-jan-2020
      {
        reg: /^([0-9]{1,2})[\. -/]([a-z]+)[\. -/]([0-9]{4})?( [0-9]{1,2}(:[0-9]{0,2})?(:[0-9]{0,3})? ?(am|pm)?)?$/i,
        parse: (s, m) => {
          let obj = {
            date: Number(m[1]),
            month: parseMonth(m[2]),
            year: Number(m[3])
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = s.startOf('day');
          s = parseTime(s, m[4]);
          return s
        }
      }
    ];

    var misc = [
      // =====
      // no dates
      // =====

      // '2012-06' month-only
      {
        reg: /^([0-9]{4})[\-\/]([0-9]{2})$/i,
        parse: (s, m) => {
          let obj = {
            year: m[1],
            month: parseInt(m[2], 10) - 1,
            date: 1
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, m[4]);
          return s
        }
      },

      //February 2017 (implied date)
      {
        reg: /^([a-z]+) ([0-9]{4})$/i,
        parse: (s, arr) => {
          let obj = {
            year: parseYear(arr[2], s._today),
            month: parseMonth(arr[1]),
            date: s._today.date || 1
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s, arr[4]);
          return s
        }
      },

      {
        // 'q2 2002'
        reg: /^(q[0-9])( of)?( [0-9]{4})?/i,
        parse: (s, arr) => {
          let quarter = arr[1] || '';
          s = s.quarter(quarter);
          let year = arr[3] || '';
          if (year) {
            year = year.trim();
            s = s.year(year);
          }
          return s
        }
      },
      {
        // 'summer 2002'
        reg: /^(spring|summer|winter|fall|autumn)( of)?( [0-9]{4})?/i,
        parse: (s, arr) => {
          let season = arr[1] || '';
          s = s.season(season);
          let year = arr[3] || '';
          if (year) {
            year = year.trim();
            s = s.year(year);
          }
          return s
        }
      },
      {
        // '200bc'
        reg: /^[0-9,]+ ?b\.?c\.?$/i,
        parse: (s, arr) => {
          let str = arr[0] || '';
          //make year-negative
          str = str.replace(/^([0-9,]+) ?b\.?c\.?$/i, '-$1');
          let d = new Date();
          let obj = {
            year: parseInt(str.trim(), 10),
            month: d.getMonth(),
            date: d.getDate()
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s);
          return s
        }
      },
      {
        // '200ad'
        reg: /^[0-9,]+ ?(a\.?d\.?|c\.?e\.?)$/i,
        parse: (s, arr) => {
          let str = arr[0] || '';
          //remove commas
          str = str.replace(/,/g, '');
          let d = new Date();
          let obj = {
            year: parseInt(str.trim(), 10),
            month: d.getMonth(),
            date: d.getDate()
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s);
          return s
        }
      },
      {
        // '1992'
        reg: /^[0-9]{4}( ?a\.?d\.?)?$/i,
        parse: (s, arr) => {
          let today = s._today;
          // using today's date, but a new month is awkward.
          if (today.month && !today.date) {
            today.date = 1;
          }
          let d = new Date();
          let obj = {
            year: parseYear(arr[0], today),
            month: today.month || d.getMonth(),
            date: today.date || d.getDate()
          };
          if (validate(obj) === false) {
            s.epoch = null;
            return s
          }
          walkTo(s, obj);
          s = parseTime(s);
          return s
        }
      }
    ];

    var parsers = [].concat(ymd, mdy, dmy, misc);

    const parseString = function (s, input, givenTz) {
      // let parsers = s.parsers || []
      //try each text-parse template, use the first good result
      for (let i = 0; i < parsers.length; i++) {
        let m = input.match(parsers[i].reg);
        if (m) {
          // console.log(parsers[i].reg)
          let res = parsers[i].parse(s, m, givenTz);
          if (res !== null && res.isValid()) {
            return res
          }
        }
      }
      if (s.silent === false) {
        console.warn("Warning: couldn't parse date-string: '" + input + "'");
      }
      s.epoch = null;
      return s
    };

    const { parseArray: parseArray$1, parseObject: parseObject$1, parseNumber: parseNumber$1 } = fns;
    //we have to actually parse these inputs ourselves
    //  -  can't use built-in js parser ;(
    //=========================================
    // ISO Date	  "2015-03-25"
    // Short Date	"03/25/2015" or "2015/03/25"
    // Long Date	"Mar 25 2015" or "25 Mar 2015"
    // Full Date	"Wednesday March 25 2015"
    //=========================================

    const defaults$1 = {
      year: new Date().getFullYear(),
      month: 0,
      date: 1
    };

    //find the epoch from different input styles
    const parseInput = (s, input) => {
      let today = s._today || defaults$1;
      //if we've been given a epoch number, it's easy
      if (typeof input === 'number') {
        return parseNumber$1(s, input)
      }
      //set tmp time
      s.epoch = Date.now();
      // overwrite tmp time with 'today' value, if exists
      if (s._today && isObject(s._today) && Object.keys(s._today).length > 0) {
        let res = parseObject$1(s, today, defaults$1);
        if (res.isValid()) {
          s.epoch = res.epoch;
        }
      }
      // null input means 'now'
      if (input === null || input === undefined || input === '') {
        return s //k, we're good.
      }
      //support input of Date() object
      if (isDate(input) === true) {
        s.epoch = input.getTime();
        return s
      }
      //support [2016, 03, 01] format
      if (isArray(input) === true) {
        s = parseArray$1(s, input, today);
        return s
      }
      //support {year:2016, month:3} format
      if (isObject(input) === true) {
        //support spacetime object as input
        if (input.epoch) {
          s.epoch = input.epoch;
          s.tz = input.tz;
          return s
        }
        s = parseObject$1(s, input, today);
        return s
      }
      //input as a string..
      if (typeof input !== 'string') {
        return s
      }
      //little cleanup..
      input = normalize$2(input);
      //try some known-words, like 'now'
      if (dates.hasOwnProperty(input) === true) {
        s = dates[input](s);
        return s
      }
      //try each text-parse template, use the first good result
      return parseString(s, input)
    };

    let shortDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let longDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    function short$1() { return shortDays }
    function long$1() { return longDays }
    function set$1(i18n) {
      shortDays = i18n.short || shortDays;
      longDays = i18n.long || longDays;
    }
    const aliases = {
      mo: 1,
      tu: 2,
      we: 3,
      th: 4,
      fr: 5,
      sa: 6,
      su: 7,
      tues: 2,
      weds: 3,
      wedn: 3,
      thur: 4,
      thurs: 4
    };

    let titleCaseEnabled = true;

    function useTitleCase() {
      return titleCaseEnabled
    }

    function set$2(val) {
      titleCaseEnabled = val;
    }

    // create the timezone offset part of an iso timestamp
    // it's kind of nuts how involved this is
    // "+01:00", "+0100", or simply "+01"
    const isoOffset = s => {
      let offset = s.timezone().current.offset;
      return !offset ? 'Z' : formatTimezone(offset, ':')
    };

    const applyCaseFormat = (str) => {
      if (useTitleCase()) {
        return titleCase(str)
      }
      return str
    };

    // iso-year padding
    const padYear = (num) => {
      if (num >= 0) {
        return zeroPad(num, 4)
      } else {
        num = Math.abs(num);
        return '-' + zeroPad(num, 4)
      }
    };

    const format = {
      day: (s) => applyCaseFormat(s.dayName()),
      'day-short': (s) => applyCaseFormat(short$1()[s.day()]),
      'day-number': (s) => s.day(),
      'day-ordinal': (s) => ordinal(s.day()),
      'day-pad': (s) => zeroPad(s.day()),

      date: (s) => s.date(),
      'date-ordinal': (s) => ordinal(s.date()),
      'date-pad': (s) => zeroPad(s.date()),

      month: (s) => applyCaseFormat(s.monthName()),
      'month-short': (s) => applyCaseFormat(short()[s.month()]),
      'month-number': (s) => s.month(),
      'month-ordinal': (s) => ordinal(s.month()),
      'month-pad': (s) => zeroPad(s.month()),
      'iso-month': (s) => zeroPad(s.month() + 1), //1-based months

      year: (s) => {
        let year = s.year();
        if (year > 0) {
          return year
        }
        year = Math.abs(year);
        return year + ' BC'
      },
      'year-short': (s) => {
        let year = s.year();
        if (year > 0) {
          return `'${String(s.year()).substr(2, 4)}`
        }
        year = Math.abs(year);
        return year + ' BC'
      },
      'iso-year': (s) => {
        let year = s.year();
        let isNegative = year < 0;
        let str = zeroPad(Math.abs(year), 4); //0-padded
        if (isNegative) {
          //negative years are for some reason 6-digits ('-00008')
          str = zeroPad(str, 6);
          str = '-' + str;
        }
        return str
      },

      time: (s) => s.time(),
      'time-24': (s) => `${s.hour24()}:${zeroPad(s.minute())}`,

      hour: (s) => s.hour12(),
      'hour-pad': (s) => zeroPad(s.hour12()),
      'hour-24': (s) => s.hour24(),
      'hour-24-pad': (s) => zeroPad(s.hour24()),

      minute: (s) => s.minute(),
      'minute-pad': (s) => zeroPad(s.minute()),
      second: (s) => s.second(),
      'second-pad': (s) => zeroPad(s.second()),
      millisecond: (s) => s.millisecond(),
      'millisecond-pad': (s) => zeroPad(s.millisecond(), 3),

      ampm: (s) => s.ampm(),
      quarter: (s) => 'Q' + s.quarter(),
      season: (s) => s.season(),
      era: (s) => s.era(),
      json: (s) => s.json(),
      timezone: (s) => s.timezone().name,
      offset: (s) => isoOffset(s),

      numeric: (s) => `${s.year()}/${zeroPad(s.month() + 1)}/${zeroPad(s.date())}`, // yyyy/mm/dd
      'numeric-us': (s) => `${zeroPad(s.month() + 1)}/${zeroPad(s.date())}/${s.year()}`, // mm/dd/yyyy
      'numeric-uk': (s) => `${zeroPad(s.date())}/${zeroPad(s.month() + 1)}/${s.year()}`, //dd/mm/yyyy
      'mm/dd': (s) => `${zeroPad(s.month() + 1)}/${zeroPad(s.date())}`, //mm/dd

      // ... https://en.wikipedia.org/wiki/ISO_8601 ;(((
      iso: (s) => {
        let year = s.format('iso-year');
        let month = zeroPad(s.month() + 1); //1-based months
        let date = zeroPad(s.date());
        let hour = zeroPad(s.h24());
        let minute = zeroPad(s.minute());
        let second = zeroPad(s.second());
        let ms = zeroPad(s.millisecond(), 3);
        let offset = isoOffset(s);
        return `${year}-${month}-${date}T${hour}:${minute}:${second}.${ms}${offset}` //2018-03-09T08:50:00.000-05:00
      },
      'iso-short': (s) => {
        let month = zeroPad(s.month() + 1); //1-based months
        let date = zeroPad(s.date());
        let year = padYear(s.year());
        return `${year}-${month}-${date}` //2017-02-15
      },
      'iso-utc': (s) => {
        return new Date(s.epoch).toISOString() //2017-03-08T19:45:28.367Z
      },

      //i made these up
      nice: (s) => `${short()[s.month()]} ${ordinal(s.date())}, ${s.time()}`,
      'nice-24': (s) =>
        `${short()[s.month()]} ${ordinal(s.date())}, ${s.hour24()}:${zeroPad(
      s.minute()
    )}`,
      'nice-year': (s) => `${short()[s.month()]} ${ordinal(s.date())}, ${s.year()}`,
      'nice-day': (s) =>
        `${short$1()[s.day()]} ${applyCaseFormat(short()[s.month()])} ${ordinal(
      s.date()
    )}`,
      'nice-full': (s) =>
        `${s.dayName()} ${applyCaseFormat(s.monthName())} ${ordinal(s.date())}, ${s.time()}`,
      'nice-full-24': (s) =>
        `${s.dayName()} ${applyCaseFormat(s.monthName())} ${ordinal(
      s.date()
    )}, ${s.hour24()}:${zeroPad(s.minute())}`
    };
    //aliases
    const aliases$1 = {
      'day-name': 'day',
      'month-name': 'month',
      'iso 8601': 'iso',
      'time-h24': 'time-24',
      'time-12': 'time',
      'time-h12': 'time',
      tz: 'timezone',
      'day-num': 'day-number',
      'month-num': 'month-number',
      'month-iso': 'iso-month',
      'year-iso': 'iso-year',
      'nice-short': 'nice',
      'nice-short-24': 'nice-24',
      mdy: 'numeric-us',
      dmy: 'numeric-uk',
      ymd: 'numeric',
      'yyyy/mm/dd': 'numeric',
      'mm/dd/yyyy': 'numeric-us',
      'dd/mm/yyyy': 'numeric-us',
      'little-endian': 'numeric-uk',
      'big-endian': 'numeric',
      'day-nice': 'nice-day'
    };
    Object.keys(aliases$1).forEach((k) => (format[k] = format[aliases$1[k]]));

    const printFormat = (s, str = '') => {
      //don't print anything if it's an invalid date
      if (s.isValid() !== true) {
        return ''
      }
      //support .format('month')
      if (format.hasOwnProperty(str)) {
        let out = format[str](s) || '';
        if (str !== 'json') {
          out = String(out);
          if (str !== 'ampm') {
            out = applyCaseFormat(out);
          }
        }
        return out
      }
      //support '{hour}:{minute}' notation
      if (str.indexOf('{') !== -1) {
        let sections = /\{(.+?)\}/g;
        str = str.replace(sections, (_, fmt) => {
          fmt = fmt.toLowerCase().trim();
          if (format.hasOwnProperty(fmt)) {
            let out = String(format[fmt](s));
            if (fmt !== 'ampm') {
              return applyCaseFormat(out)
            }
            return out
          }
          return ''
        });
        return str
      }

      return s.format('iso-short')
    };

    //parse this insane unix-time-templating thing, from the 19th century
    //http://unicode.org/reports/tr35/tr35-25.html#Date_Format_Patterns

    //time-symbols we support
    const mapping$1 = {
      G: (s) => s.era(),
      GG: (s) => s.era(),
      GGG: (s) => s.era(),
      GGGG: (s) => (s.era() === 'AD' ? 'Anno Domini' : 'Before Christ'),
      //year
      y: (s) => s.year(),
      yy: (s) => {
        //last two chars
        return zeroPad(Number(String(s.year()).substr(2, 4)))
      },
      yyy: (s) => s.year(),
      yyyy: (s) => s.year(),
      yyyyy: (s) => '0' + s.year(),
      // u: (s) => {},//extended non-gregorian years

      //quarter
      Q: (s) => s.quarter(),
      QQ: (s) => s.quarter(),
      QQQ: (s) => s.quarter(),
      QQQQ: (s) => s.quarter(),

      //month
      M: (s) => s.month() + 1,
      MM: (s) => zeroPad(s.month() + 1),
      MMM: (s) => s.format('month-short'),
      MMMM: (s) => s.format('month'),

      //week
      w: (s) => s.week(),
      ww: (s) => zeroPad(s.week()),
      //week of month
      // W: (s) => s.week(),

      //date of month
      d: (s) => s.date(),
      dd: (s) => zeroPad(s.date()),
      //date of year
      D: (s) => s.dayOfYear(),
      DD: (s) => zeroPad(s.dayOfYear()),
      DDD: (s) => zeroPad(s.dayOfYear(), 3),

      // F: (s) => {},//date of week in month
      // g: (s) => {},//modified julian day

      //day
      E: (s) => s.format('day-short'),
      EE: (s) => s.format('day-short'),
      EEE: (s) => s.format('day-short'),
      EEEE: (s) => s.format('day'),
      EEEEE: (s) => s.format('day')[0],
      e: (s) => s.day(),
      ee: (s) => s.day(),
      eee: (s) => s.format('day-short'),
      eeee: (s) => s.format('day'),
      eeeee: (s) => s.format('day')[0],

      //am/pm
      a: (s) => s.ampm().toUpperCase(),
      aa: (s) => s.ampm().toUpperCase(),
      aaa: (s) => s.ampm().toUpperCase(),
      aaaa: (s) => s.ampm().toUpperCase(),

      //hour
      h: (s) => s.h12(),
      hh: (s) => zeroPad(s.h12()),
      H: (s) => s.hour(),
      HH: (s) => zeroPad(s.hour()),
      // j: (s) => {},//weird hour format

      m: (s) => s.minute(),
      mm: (s) => zeroPad(s.minute()),
      s: (s) => s.second(),
      ss: (s) => zeroPad(s.second()),

      //milliseconds
      SSS: (s) => zeroPad(s.millisecond(), 3),
      //milliseconds in the day
      A: (s) => s.epoch - s.startOf('day').epoch,
      //timezone
      z: (s) => s.timezone().name,
      zz: (s) => s.timezone().name,
      zzz: (s) => s.timezone().name,
      zzzz: (s) => s.timezone().name,
      Z: (s) => formatTimezone(s.timezone().current.offset),
      ZZ: (s) => formatTimezone(s.timezone().current.offset),
      ZZZ: (s) => formatTimezone(s.timezone().current.offset),
      ZZZZ: (s) => formatTimezone(s.timezone().current.offset, ':')
    };

    const addAlias = (char, to, n) => {
      let name = char;
      let toName = to;
      for (let i = 0; i < n; i += 1) {
        mapping$1[name] = mapping$1[toName];
        name += char;
        toName += to;
      }
    };
    addAlias('q', 'Q', 4);
    addAlias('L', 'M', 4);
    addAlias('Y', 'y', 4);
    addAlias('c', 'e', 4);
    addAlias('k', 'H', 2);
    addAlias('K', 'h', 2);
    addAlias('S', 's', 2);
    addAlias('v', 'z', 4);
    addAlias('V', 'Z', 4);

    // support unix-style escaping with ' character
    const escapeChars = function (arr) {
      for (let i = 0; i < arr.length; i += 1) {
        if (arr[i] === `'`) {
          // greedy-search for next apostrophe
          for (let o = i + 1; o < arr.length; o += 1) {
            if (arr[o]) {
              arr[i] += arr[o];
            }
            if (arr[o] === `'`) {
              arr[o] = null;
              break
            }
            arr[o] = null;
          }
        }
      }
      return arr.filter((ch) => ch)
    };

    //combine consecutive chars, like 'yyyy' as one.
    const combineRepeated = function (arr) {
      for (let i = 0; i < arr.length; i += 1) {
        let c = arr[i];
        // greedy-forward
        for (let o = i + 1; o < arr.length; o += 1) {
          if (arr[o] === c) {
            arr[i] += arr[o];
            arr[o] = null;
          } else {
            break
          }
        }
      }
      // '' means one apostrophe
      arr = arr.filter((ch) => ch);
      arr = arr.map((str) => {
        if (str === `''`) {
          str = `'`;
        }
        return str
      });
      return arr
    };

    const unixFmt = (s, str) => {
      let arr = str.split('');
      // support character escaping
      arr = escapeChars(arr);
      //combine 'yyyy' as string.
      arr = combineRepeated(arr);
      return arr.reduce((txt, c) => {
        if (mapping$1[c] !== undefined) {
          txt += mapping$1[c](s) || '';
        } else {
          // 'unescape'
          if (/^'.{1,}'$/.test(c)) {
            c = c.replace(/'/g, '');
          }
          txt += c;
        }
        return txt
      }, '')
    };

    const units$1 = ['year', 'season', 'quarter', 'month', 'week', 'day', 'quarterHour', 'hour', 'minute'];

    const doUnit = function (s, k) {
      let start = s.clone().startOf(k);
      let end = s.clone().endOf(k);
      let duration = end.epoch - start.epoch;
      let percent = (s.epoch - start.epoch) / duration;
      return parseFloat(percent.toFixed(2))
    };

    //how far it is along, from 0-1
    const progress = (s, unit) => {
      if (unit) {
        unit = normalize$1(unit);
        return doUnit(s, unit)
      }
      let obj = {};
      units$1.forEach(k => {
        obj[k] = doUnit(s, k);
      });
      return obj
    };

    //round to either current, or +1 of this unit
    const nearest = (s, unit) => {
      //how far have we gone?
      let prog = s.progress();
      unit = normalize$1(unit);
      //fix camel-case for this one
      if (unit === 'quarterhour') {
        unit = 'quarterHour';
      }
      if (prog[unit] !== undefined) {
        // go forward one?
        if (prog[unit] > 0.5) {
          s = s.add(1, unit);
        }
        // go to start
        s = s.startOf(unit);
      } else if (s.silent === false) {
        console.warn("no known unit '" + unit + "'");
      }
      return s
    };

    //increment until dates are the same
    const climb = (a, b, unit) => {
      let i = 0;
      a = a.clone();
      while (a.isBefore(b)) {
        //do proper, expensive increment to catch all-the-tricks
        a = a.add(1, unit);
        i += 1;
      }
      //oops, we went too-far..
      if (a.isAfter(b, unit)) {
        i -= 1;
      }
      return i
    };

    // do a thurough +=1 on the unit, until they match
    // for speed-reasons, only used on day, month, week.
    const diffOne = (a, b, unit) => {
      if (a.isBefore(b)) {
        return climb(a, b, unit)
      } else {
        return climb(b, a, unit) * -1 //reverse it
      }
    };

    // don't do anything too fancy here.
    // 2020 - 2019 may be 1 year, or 0 years
    // - '1 year difference' means 366 days during a leap year
    const fastYear = (a, b) => {
      let years = b.year() - a.year();
      // should we decrement it by 1?
      a = a.year(b.year());
      if (a.isAfter(b)) {
        years -= 1;
      }
      return years
    };

    // use a waterfall-method for computing a diff of any 'pre-knowable' units
    // compute years, then compute months, etc..
    // ... then ms-math for any very-small units
    const diff = function (a, b) {
      // an hour is always the same # of milliseconds
      // so these units can be 'pre-calculated'
      let msDiff = b.epoch - a.epoch;
      let obj = {
        milliseconds: msDiff,
        seconds: parseInt(msDiff / 1000, 10)
      };
      obj.minutes = parseInt(obj.seconds / 60, 10);
      obj.hours = parseInt(obj.minutes / 60, 10);

      //do the year
      let tmp = a.clone();
      obj.years = fastYear(tmp, b);
      tmp = a.add(obj.years, 'year');

      //there's always 12 months in a year...
      obj.months = obj.years * 12;
      tmp = a.add(obj.months, 'month');
      obj.months += diffOne(tmp, b, 'month');

      // there's always atleast 52 weeks in a year..
      // (month * 4) isn't as close
      obj.weeks = obj.years * 52;
      tmp = a.add(obj.weeks, 'week');
      obj.weeks += diffOne(tmp, b, 'week');

      // there's always atleast 7 days in a week
      obj.days = obj.weeks * 7;
      tmp = a.add(obj.days, 'day');
      obj.days += diffOne(tmp, b, 'day');

      return obj
    };

    const reverseDiff = function (obj) {
      Object.keys(obj).forEach((k) => {
        obj[k] *= -1;
      });
      return obj
    };

    // this method counts a total # of each unit, between a, b.
    // '1 month' means 28 days in february
    // '1 year' means 366 days in a leap year
    const main = function (a, b, unit) {
      b = beADate(b, a);
      //reverse values, if necessary
      let reversed = false;
      if (a.isAfter(b)) {
        let tmp = a;
        a = b;
        b = tmp;
        reversed = true;
      }
      //compute them all (i know!)
      let obj = diff(a, b);
      if (reversed) {
        obj = reverseDiff(obj);
      }
      //return just the requested unit
      if (unit) {
        //make sure it's plural-form
        unit = normalize$1(unit);
        if (/s$/.test(unit) !== true) {
          unit += 's';
        }
        if (unit === 'dates') {
          unit = 'days';
        }
        return obj[unit]
      }
      return obj
    };

    /*
    ISO 8601 duration format
    // https://en.wikipedia.org/wiki/ISO_8601#Durations
    "P3Y6M4DT12H30M5S"
    P the start of the duration representation.
    Y the number of years.
    M the number of months.
    W the number of weeks.
    D the number of days.
    T of the representation.
    H the number of hours.
    M the number of minutes.
    S the number of seconds.
    */

    const fmt = (n) => Math.abs(n) || 0;

    const toISO = function (diff) {
      let iso = 'P';
      iso += fmt(diff.years) + 'Y';
      iso += fmt(diff.months) + 'M';
      iso += fmt(diff.days) + 'DT';
      iso += fmt(diff.hours) + 'H';
      iso += fmt(diff.minutes) + 'M';
      iso += fmt(diff.seconds) + 'S';
      return iso
    };

    //get number of hours/minutes... between the two dates
    function getDiff(a, b) {
      const isBefore = a.isBefore(b);
      const later = isBefore ? b : a;
      let earlier = isBefore ? a : b;
      earlier = earlier.clone();
      const diff = {
        years: 0,
        months: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
      };
      Object.keys(diff).forEach((unit) => {
        if (earlier.isSame(later, unit)) {
          return
        }
        let max = earlier.diff(later, unit);
        earlier = earlier.add(max, unit);
        diff[unit] = max;
      });
      //reverse it, if necessary
      if (isBefore) {
        Object.keys(diff).forEach((u) => {
          if (diff[u] !== 0) {
            diff[u] *= -1;
          }
        });
      }
      return diff
    }

    //our conceptual 'break-points' for each unit
    const qualifiers = {
      months: {
        almost: 10,
        over: 4
      },
      days: {
        almost: 25,
        over: 10
      },
      hours: {
        almost: 20,
        over: 8
      },
      minutes: {
        almost: 50,
        over: 20
      },
      seconds: {
        almost: 50,
        over: 20
      }
    };

    // Expects a plural unit arg
    function pluralize(value, unit) {
      if (value === 1) {
        unit = unit.slice(0, -1);
      }
      return value + ' ' + unit
    }

    const toSoft = function (diff) {
      let rounded = null;
      let qualified = null;
      let abbreviated = [];
      let englishValues = [];
      //go through each value and create its text-representation
      Object.keys(diff).forEach((unit, i, units) => {
        const value = Math.abs(diff[unit]);
        if (value === 0) {
          return
        }
        abbreviated.push(value + unit[0]);
        const englishValue = pluralize(value, unit);
        englishValues.push(englishValue);
        if (!rounded) {
          rounded = qualified = englishValue;
          if (i > 4) {
            return
          }
          //is it a 'almost' something, etc?
          const nextUnit = units[i + 1];
          const nextValue = Math.abs(diff[nextUnit]);
          if (nextValue > qualifiers[nextUnit].almost) {
            rounded = pluralize(value + 1, unit);
            qualified = 'almost ' + rounded;
          } else if (nextValue > qualifiers[nextUnit].over) {
            qualified = 'over ' + englishValue;
          }
        }
      });
      return { qualified, rounded, abbreviated, englishValues }
    };

    //by spencermountain + Shaun Grady

    //create the human-readable diff between the two dates
    const since = (start, end) => {
      end = beADate(end, start);
      const diff = getDiff(start, end);
      const isNow = Object.keys(diff).every((u) => !diff[u]);
      if (isNow === true) {
        return {
          diff,
          rounded: 'now',
          qualified: 'now',
          precise: 'now',
          abbreviated: [],
          iso: 'P0Y0M0DT0H0M0S',
          direction: 'present',
        }
      }
      let precise;
      let direction = 'future';

      let { rounded, qualified, englishValues, abbreviated } = toSoft(diff);

      //make them into a string
      precise = englishValues.splice(0, 2).join(', ');
      //handle before/after logic
      if (start.isAfter(end) === true) {
        rounded += ' ago';
        qualified += ' ago';
        precise += ' ago';
        direction = 'past';
      } else {
        rounded = 'in ' + rounded;
        qualified = 'in ' + qualified;
        precise = 'in ' + precise;
      }
      // https://en.wikipedia.org/wiki/ISO_8601#Durations
      // P[n]Y[n]M[n]DT[n]H[n]M[n]S 
      let iso = toISO(diff);
      return {
        diff,
        rounded,
        qualified,
        precise,
        abbreviated,
        iso,
        direction,
      }
    };

    //https://www.timeanddate.com/calendar/aboutseasons.html
    // Spring - from March 1 to May 31;
    // Summer - from June 1 to August 31;
    // Fall (autumn) - from September 1 to November 30; and,
    // Winter - from December 1 to February 28 (February 29 in a leap year).
    const north = [
      ['spring', 2, 1],
      ['summer', 5, 1],
      ['fall', 8, 1],
      ['autumn', 8, 1],
      ['winter', 11, 1] //dec 1
    ];
    const south = [
      ['fall', 2, 1],
      ['autumn', 2, 1],
      ['winter', 5, 1],
      ['spring', 8, 1],
      ['summer', 11, 1] //dec 1
    ];

    var seasons = { north, south };

    var quarters = [
      null,
      [0, 1], //jan 1
      [3, 1], //apr 1
      [6, 1], //july 1
      [9, 1] //oct 1
    ];

    const units$2 = {
      minute: (s) => {
        walkTo(s, {
          second: 0,
          millisecond: 0
        });
        return s
      },
      quarterhour: (s) => {
        let minute = s.minutes();
        if (minute >= 45) {
          s = s.minutes(45);
        } else if (minute >= 30) {
          s = s.minutes(30);
        } else if (minute >= 15) {
          s = s.minutes(15);
        } else {
          s = s.minutes(0);
        }
        walkTo(s, {
          second: 0,
          millisecond: 0
        });
        return s
      },
      hour: (s) => {
        walkTo(s, {
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s
      },
      day: (s) => {
        walkTo(s, {
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s
      },
      week: (s) => {
        let original = s.clone();
        s = s.day(s._weekStart); //monday
        if (s.isAfter(original)) {
          s = s.subtract(1, 'week');
        }
        walkTo(s, {
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s
      },
      month: (s) => {
        walkTo(s, {
          date: 1,
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s
      },
      quarter: (s) => {
        let q = s.quarter();
        if (quarters[q]) {
          walkTo(s, {
            month: quarters[q][0],
            date: quarters[q][1],
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0
          });
        }
        return s
      },
      season: (s) => {
        let current = s.season();
        let hem = 'north';
        if (s.hemisphere() === 'South') {
          hem = 'south';
        }
        for (let i = 0; i < seasons[hem].length; i++) {
          if (seasons[hem][i][0] === current) {
            //winter goes between years
            let year = s.year();
            if (current === 'winter' && s.month() < 3) {
              year -= 1;
            }
            walkTo(s, {
              year,
              month: seasons[hem][i][1],
              date: seasons[hem][i][2],
              hour: 0,
              minute: 0,
              second: 0,
              millisecond: 0
            });
            return s
          }
        }
        return s
      },
      year: (s) => {
        walkTo(s, {
          month: 0,
          date: 1,
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        return s
      },
      decade: (s) => {
        s = s.startOf('year');
        let year = s.year();
        let decade = parseInt(year / 10, 10) * 10;
        s = s.year(decade);
        return s
      },
      century: (s) => {
        s = s.startOf('year');
        let year = s.year();
        // near 0AD goes '-1 | +1'
        let decade = parseInt(year / 100, 10) * 100;
        s = s.year(decade);
        return s
      }
    };
    units$2.date = units$2.day;

    const startOf = (a, unit) => {
      let s = a.clone();
      unit = normalize$1(unit);
      if (units$2[unit]) {
        return units$2[unit](s)
      }
      if (unit === 'summer' || unit === 'winter') {
        s = s.season(unit);
        return units$2.season(s)
      }
      return s
    };

    //piggy-backs off startOf
    const endOf = (a, unit) => {
      let s = a.clone();
      unit = normalize$1(unit);
      if (units$2[unit]) {
        // go to beginning, go to next one, step back 1ms
        s = units$2[unit](s); // startof
        s = s.add(1, unit);
        s = s.subtract(1, 'millisecond');
        return s
      }
      return s
    };

    //is it 'wednesday'?
    const isDay = function (unit) {
      if (short$1().find((s) => s === unit)) {
        return true
      }
      if (long$1().find((s) => s === unit)) {
        return true
      }
      return false
    };

    // return a list of the weeks/months/days between a -> b
    // returns spacetime objects in the timezone of the input
    const every = function (start, unit, end) {
      if (!unit || !end) {
        return []
      }
      //cleanup unit param
      unit = normalize$1(unit);
      //cleanup to param
      end = start.clone().set(end);
      //swap them, if they're backwards
      if (start.isAfter(end)) {
        let tmp = start;
        start = end;
        end = tmp;
      }

      //support 'every wednesday'
      let d = start.clone();
      if (isDay(unit)) {
        d = d.next(unit);
        unit = 'week';
      } else {
        let first = d.startOf(unit);
        if (first.isBefore(start)) {
          d = d.next(unit);
        }
      }
      //okay, actually start doing it
      let result = [];
      while (d.isBefore(end)) {
        result.push(d);
        d = d.add(1, unit);
      }
      return result
    };

    const parseDst = dst => {
      if (!dst) {
        return []
      }
      return dst.split('->')
    };

    const titleCase$1 = str => {
      str = str[0].toUpperCase() + str.substr(1);
      str = str.replace(/\/gmt/, '/GMT');
      str = str.replace(/[\/_]([a-z])/gi, s => {
        return s.toUpperCase()
      });
      return str
    };

    //get metadata about this timezone
    const timezone = s => {
      let zones = s.timezones;
      let tz = s.tz;
      if (zones.hasOwnProperty(tz) === false) {
        tz = lookupTz(s.tz, zones);
      }
      if (tz === null) {
        if (s.silent === false) {
          console.warn("Warn: could not find given or local timezone - '" + s.tz + "'");
        }
        return {
          current: {
            epochShift: 0
          }
        }
      }
      let found = zones[tz];
      let result = {
        name: titleCase$1(tz),
        hasDst: Boolean(found.dst),
        default_offset: found.offset,
        //do north-hemisphere version as default (sorry!)
        hemisphere: found.hem === 's' ? 'South' : 'North',
        current: {}
      };

      if (result.hasDst) {
        let arr = parseDst(found.dst);
        result.change = {
          start: arr[0],
          back: arr[1]
        };
      }
      //find the offsets for summer/winter times
      //(these variable names are north-centric)
      let summer = found.offset; // (july)
      let winter = summer; // (january) assume it's the same for now
      if (result.hasDst === true) {
        if (result.hemisphere === 'North') {
          winter = summer - 1;
        } else {
          //southern hemisphere
          winter = found.offset + 1;
        }
      }

      //find out which offset to use right now
      //use 'summer' time july-time
      if (result.hasDst === false) {
        result.current.offset = summer;
        result.current.isDST = false;
      } else if (inSummerTime(s.epoch, result.change.start, result.change.back, summer, winter) === true) {
        result.current.offset = summer;
        result.current.isDST = result.hemisphere === 'North'; //dst 'on' in winter in north
      } else {
        //use 'winter' january-time
        result.current.offset = winter;
        result.current.isDST = result.hemisphere === 'South'; //dst 'on' in summer in south
      }
      return result
    };

    const units$3 = [
      'century',
      'decade',
      'year',
      'month',
      'date',
      'day',
      'hour',
      'minute',
      'second',
      'millisecond'
    ];

    //the spacetime instance methods (also, the API)
    const methods = {
      set: function (input, tz) {
        let s = this.clone();
        s = parseInput(s, input);
        if (tz) {
          this.tz = lookupTz(tz);
        }
        return s
      },
      timezone: function () {
        return timezone(this)
      },
      isDST: function () {
        return timezone(this).current.isDST
      },
      hasDST: function () {
        return timezone(this).hasDst
      },
      offset: function () {
        return timezone(this).current.offset * 60
      },
      hemisphere: function () {
        return timezone(this).hemisphere
      },
      format: function (fmt) {
        return printFormat(this, fmt)
      },
      unixFmt: function (fmt) {
        return unixFmt(this, fmt)
      },
      startOf: function (unit) {
        return startOf(this, unit)
      },
      endOf: function (unit) {
        return endOf(this, unit)
      },
      leapYear: function () {
        let year = this.year();
        return isLeapYear(year)
      },
      progress: function (unit) {
        return progress(this, unit)
      },
      nearest: function (unit) {
        return nearest(this, unit)
      },
      diff: function (d, unit) {
        return main(this, d, unit)
      },
      since: function (d) {
        if (!d) {
          d = this.clone().set();
        }
        return since(this, d)
      },
      next: function (unit) {
        let s = this.add(1, unit);
        return s.startOf(unit)
      },
      //the start of the previous year/week/century
      last: function (unit) {
        let s = this.subtract(1, unit);
        return s.startOf(unit)
      },
      isValid: function () {
        //null/undefined epochs
        if (!this.epoch && this.epoch !== 0) {
          return false
        }
        return !isNaN(this.d.getTime())
      },
      //travel to this timezone
      goto: function (tz) {
        let s = this.clone();
        s.tz = lookupTz(tz, s.timezones); //science!
        return s
      },
      //get each week/month/day between a -> b
      every: function (unit, to) {
        // allow swapping these params:
        if (typeof unit === 'object' && typeof to === 'string') {
          let tmp = to;
          to = unit;
          unit = tmp;
        }
        return every(this, unit, to)
      },
      isAwake: function () {
        let hour = this.hour();
        //10pm -> 8am
        if (hour < 8 || hour > 22) {
          return false
        }
        return true
      },
      isAsleep: function () {
        return !this.isAwake()
      },
      daysInMonth: function () {
        switch (this.month()) {
          case 0:
            return 31
          case 1:
            return this.leapYear() ? 29 : 28
          case 2:
            return 31
          case 3:
            return 30
          case 4:
            return 31
          case 5:
            return 30
          case 6:
            return 31
          case 7:
            return 31
          case 8:
            return 30
          case 9:
            return 31
          case 10:
            return 30
          case 11:
            return 31
          default:
            throw new Error('Invalid Month state.')
        }
      },
      //pretty-printing
      log: function () {
        console.log('');
        console.log(printFormat(this, 'nice-short'));
        return this
      },
      logYear: function () {
        console.log('');
        console.log(printFormat(this, 'full-short'));
        return this
      },
      json: function () {
        return units$3.reduce((h, unit) => {
          h[unit] = this[unit]();
          return h
        }, {})
      },
      debug: function () {
        let tz = this.timezone();
        let date = this.format('MM') + ' ' + this.format('date-ordinal') + ' ' + this.year();
        date += '\n     - ' + this.format('time');
        console.log('\n\n', date + '\n     - ' + tz.name + ' (' + tz.current.offset + ')');
        return this
      },
      //alias of 'since' but opposite - like moment.js
      from: function (d) {
        d = this.clone().set(d);
        return d.since(this)
      },
      fromNow: function () {
        let d = this.clone().set(Date.now());
        return d.since(this)
      },
      weekStart: function (input) {
        //accept a number directly
        if (typeof input === 'number') {
          this._weekStart = input;
          return this
        }
        if (typeof input === 'string') {
          // accept 'wednesday'
          input = input.toLowerCase().trim();
          let num = short$1().indexOf(input);
          if (num === -1) {
            num = long$1().indexOf(input);
          }
          if (num === -1) {
            num = 1; //go back to default
          }
          this._weekStart = num;
        } else {
          console.warn('Spacetime Error: Cannot understand .weekStart() input:', input);
        }
        return this
      }
    };
    // aliases
    methods.inDST = methods.isDST;
    methods.round = methods.nearest;
    methods.each = methods.every;

    // javascript setX methods like setDate() can't be used because of the local bias

    const validate$1 = (n) => {
      //handle number as a string
      if (typeof n === 'string') {
        n = parseInt(n, 10);
      }
      return n
    };

    const order = ['year', 'month', 'date', 'hour', 'minute', 'second', 'millisecond'];

    //reduce hostile micro-changes when moving dates by millisecond
    const confirm = (s, tmp, unit) => {
      let n = order.indexOf(unit);
      let arr = order.slice(n, order.length);
      for (let i = 0; i < arr.length; i++) {
        let want = tmp[arr[i]]();
        s[arr[i]](want);
      }
      return s
    };

    // allow specifying setter direction
    const fwdBkwd = function (s, old, goFwd, unit) {
      if (goFwd === true && s.isBefore(old)) {
        s = s.add(1, unit);
      } else if (goFwd === false && s.isAfter(old)) {
        s = s.minus(1, unit);
      }
      return s
    };

    const milliseconds = function (s, n) {
      n = validate$1(n);
      let current = s.millisecond();
      let diff = current - n; //milliseconds to shift by
      return s.epoch - diff
    };

    const seconds = function (s, n, goFwd) {
      n = validate$1(n);
      let old = s.clone();
      let diff = s.second() - n;
      let shift = diff * o.second;
      s.epoch = s.epoch - shift;
      s = fwdBkwd(s, old, goFwd, 'minute'); // specify direction
      return s.epoch
    };

    const minutes = function (s, n, goFwd) {
      n = validate$1(n);
      let old = s.clone();
      let diff = s.minute() - n;
      let shift = diff * o.minute;
      s.epoch -= shift;
      confirm(s, old, 'second');
      s = fwdBkwd(s, old, goFwd, 'hour'); // specify direction
      return s.epoch
    };

    const hours = function (s, n, goFwd) {
      n = validate$1(n);
      if (n >= 24) {
        n = 24;
      } else if (n < 0) {
        n = 0;
      }
      let old = s.clone();
      let diff = s.hour() - n;
      let shift = diff * o.hour;
      s.epoch -= shift;
      // oops, did we change the day?
      if (s.date() !== old.date()) {
        s = old.clone();
        if (diff > 1) {
          diff -= 1;
        }
        if (diff < 1) {
          diff += 1;
        }
        shift = diff * o.hour;
        s.epoch -= shift;
      }
      walkTo(s, {
        hour: n
      });
      confirm(s, old, 'minute');
      s = fwdBkwd(s, old, goFwd, 'day'); // specify direction
      return s.epoch
    };

    const time = function (s, str, goFwd) {
      let m = str.match(/([0-9]{1,2})[:h]([0-9]{1,2})(:[0-9]{1,2})? ?(am|pm)?/);
      if (!m) {
        //fallback to support just '2am'
        m = str.match(/([0-9]{1,2}) ?(am|pm)/);
        if (!m) {
          return s.epoch
        }
        m.splice(2, 0, '0'); //add implicit 0 minutes
        m.splice(3, 0, ''); //add implicit seconds
      }
      let h24 = false;
      let hour = parseInt(m[1], 10);
      let minute = parseInt(m[2], 10);
      if (minute >= 60) {
        minute = 59;
      }
      if (hour > 12) {
        h24 = true;
      }
      //make the hour into proper 24h time
      if (h24 === false) {
        if (m[4] === 'am' && hour === 12) {
          //12am is midnight
          hour = 0;
        }
        if (m[4] === 'pm' && hour < 12) {
          //12pm is noon
          hour += 12;
        }
      }
      // handle seconds
      m[3] = m[3] || '';
      m[3] = m[3].replace(/:/, '');
      let sec = parseInt(m[3], 10) || 0;
      let old = s.clone();
      s = s.hour(hour);
      s = s.minute(minute);
      s = s.second(sec);
      s = s.millisecond(0);
      s = fwdBkwd(s, old, goFwd, 'day'); // specify direction
      return s.epoch
    };

    const date = function (s, n, goFwd) {
      n = validate$1(n);
      //avoid setting february 31st
      if (n > 28) {
        let month = s.month();
        let max = monthLengths[month];
        // support leap day in february
        if (month === 1 && n === 29 && isLeapYear(s.year())) {
          max = 29;
        }
        if (n > max) {
          n = max;
        }
      }
      //avoid setting < 0
      if (n <= 0) {
        n = 1;
      }
      let old = s.clone();
      walkTo(s, {
        date: n
      });
      s = fwdBkwd(s, old, goFwd, 'month'); // specify direction
      return s.epoch
    };

    const month = function (s, n, goFwd) {
      if (typeof n === 'string') {
        n = mapping()[n.toLowerCase()];
      }
      n = validate$1(n);
      //don't go past december
      if (n >= 12) {
        n = 11;
      }
      if (n <= 0) {
        n = 0;
      }

      let d = s.date();
      //there's no 30th of february, etc.
      if (d > monthLengths[n]) {
        //make it as close as we can..
        d = monthLengths[n];
      }
      let old = s.clone();
      walkTo(s, {
        month: n,
        d
      });
      s = fwdBkwd(s, old, goFwd, 'year'); // specify direction
      return s.epoch
    };

    const year = function (s, n) {
      // support '97
      if (typeof n === 'string' && /^'[0-9]{2}$/.test(n)) {
        n = n.replace(/'/, '').trim();
        n = Number(n);
        // '89 is 1989
        if (n > 30) {
          //change this in 10y
          n = 1900 + n;
        } else {
          // '12 is 2012
          n = 2000 + n;
        }
      }
      n = validate$1(n);
      walkTo(s, {
        year: n
      });
      return s.epoch
    };

    const week = function (s, n, goFwd) {
      let old = s.clone();
      n = validate$1(n);
      s = s.month(0);
      s = s.date(1);
      s = s.day('monday');
      //first week starts first Thurs in Jan
      // so mon dec 28th is 1st week
      // so mon dec 29th is not the week
      if (s.monthName() === 'december' && s.date() >= 28) {
        s = s.add(1, 'week');
      }
      n -= 1; //1-based
      s = s.add(n, 'weeks');
      s = fwdBkwd(s, old, goFwd, 'year'); // specify direction
      return s.epoch
    };

    const dayOfYear = function (s, n, goFwd) {
      n = validate$1(n);
      let old = s.clone();
      n -= 1; //days are 1-based
      if (n <= 0) {
        n = 0;
      } else if (n >= 365) {
        n = 364;
      }
      s = s.startOf('year');
      s = s.add(n, 'day');
      confirm(s, old, 'hour');
      s = fwdBkwd(s, old, goFwd, 'year'); // specify direction
      return s.epoch
    };

    let morning = 'am';
    let evening = 'pm';

    function am() { return morning }
    function pm() { return evening }
    function set$3(i18n) {
        morning = i18n.am || morning;
        evening = i18n.pm || evening;
    }

    const methods$1 = {
      millisecond: function (num) {
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = milliseconds(s, num);
          return s
        }
        return this.d.getMilliseconds()
      },
      second: function (num, goFwd) {
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = seconds(s, num, goFwd);
          return s
        }
        return this.d.getSeconds()
      },
      minute: function (num, goFwd) {
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = minutes(s, num, goFwd);
          return s
        }
        return this.d.getMinutes()
      },
      hour: function (num, goFwd) {
        let d = this.d;
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = hours(s, num, goFwd);
          return s
        }
        return d.getHours()
      },

      //'3:30' is 3.5
      hourFloat: function (num, goFwd) {
        if (num !== undefined) {
          let s = this.clone();
          let minute = num % 1;
          minute = minute * 60;
          let hour = parseInt(num, 10);
          s.epoch = hours(s, hour, goFwd);
          s.epoch = minutes(s, minute, goFwd);
          return s
        }
        let d = this.d;
        let hour = d.getHours();
        let minute = d.getMinutes();
        minute = minute / 60;
        return hour + minute
      },

      // hour in 12h format
      hour12: function (str, goFwd) {
        let d = this.d;
        if (str !== undefined) {
          let s = this.clone();
          str = '' + str;
          let m = str.match(/^([0-9]+)(am|pm)$/);
          if (m) {
            let hour = parseInt(m[1], 10);
            if (m[2] === 'pm') {
              hour += 12;
            }
            s.epoch = hours(s, hour, goFwd);
          }
          return s
        }
        //get the hour
        let hour12 = d.getHours();
        if (hour12 > 12) {
          hour12 = hour12 - 12;
        }
        if (hour12 === 0) {
          hour12 = 12;
        }
        return hour12
      },

      //some ambiguity here with 12/24h
      time: function (str, goFwd) {
        if (str !== undefined) {
          let s = this.clone();
          str = str.toLowerCase().trim();
          s.epoch = time(s, str, goFwd);
          return s
        }
        return `${this.h12()}:${zeroPad(this.minute())}${this.ampm()}`
      },

      // either 'am' or 'pm'
      ampm: function (input, goFwd) {
        // let which = 'am'
        let which = am();
        let hour = this.hour();
        if (hour >= 12) {
          // which = 'pm'
          which = pm();
        }
        if (typeof input !== 'string') {
          return which
        }
        //okay, we're doing a setter
        let s = this.clone();
        input = input.toLowerCase().trim();
        //ampm should never change the day
        // - so use `.hour(n)` instead of `.minus(12,'hour')`
        if (hour >= 12 && input === 'am') {
          //noon is 12pm
          hour -= 12;
          return s.hour(hour, goFwd)
        }
        if (hour < 12 && input === 'pm') {
          hour += 12;
          return s.hour(hour, goFwd)
        }
        return s
      },

      //some hard-coded times of day, like 'noon'
      dayTime: function (str, goFwd) {
        if (str !== undefined) {
          const times = {
            morning: '7:00am',
            breakfast: '7:00am',
            noon: '12:00am',
            lunch: '12:00pm',
            afternoon: '2:00pm',
            evening: '6:00pm',
            dinner: '6:00pm',
            night: '11:00pm',
            midnight: '23:59pm'
          };
          let s = this.clone();
          str = str || '';
          str = str.toLowerCase();
          if (times.hasOwnProperty(str) === true) {
            s = s.time(times[str], goFwd);
          }
          return s
        }
        let h = this.hour();
        if (h < 6) {
          return 'night'
        }
        if (h < 12) {
          //until noon
          return 'morning'
        }
        if (h < 17) {
          //until 5pm
          return 'afternoon'
        }
        if (h < 22) {
          //until 10pm
          return 'evening'
        }
        return 'night'
      },

      //parse a proper iso string
      iso: function (num) {
        if (num !== undefined) {
          return this.set(num)
        }
        return this.format('iso')
      }
    };

    const methods$2 = {
      // # day in the month
      date: function (num, goFwd) {
        if (num !== undefined) {
          let s = this.clone();
          num = parseInt(num, 10);
          if (num) {
            s.epoch = date(s, num, goFwd);
          }
          return s
        }
        return this.d.getDate()
      },

      //like 'wednesday' (hard!)
      day: function (input, goFwd) {
        if (input === undefined) {
          return this.d.getDay()
        }
        let original = this.clone();
        let want = input;
        // accept 'wednesday'
        if (typeof input === 'string') {
          input = input.toLowerCase();
          if (aliases.hasOwnProperty(input)) {
            want = aliases[input];
          } else {
            want = short$1().indexOf(input);
            if (want === -1) {
              want = long$1().indexOf(input);
            }
          }
        }
        //move approx
        let day = this.d.getDay();
        let diff = day - want;
        if (goFwd === true && diff > 0) {
          diff = diff - 7;
        }
        if (goFwd === false && diff < 0) {
          diff = diff + 7;
        }
        let s = this.subtract(diff, 'days');
        //tighten it back up
        walkTo(s, {
          hour: original.hour(),
          minute: original.minute(),
          second: original.second()
        });
        return s
      },

      //these are helpful name-wrappers
      dayName: function (input, goFwd) {
        if (input === undefined) {
          return long$1()[this.day()]
        }
        let s = this.clone();
        s = s.day(input, goFwd);
        return s
      }
    };

    const clearMinutes = (s) => {
      s = s.minute(0);
      s = s.second(0);
      s = s.millisecond(1);
      return s
    };

    const methods$3 = {
      // day 0-366
      dayOfYear: function (num, goFwd) {
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = dayOfYear(s, num, goFwd);
          return s
        }
        //days since newyears - jan 1st is 1, jan 2nd is 2...
        let sum = 0;
        let month = this.d.getMonth();
        let tmp;
        //count the num days in each month
        for (let i = 1; i <= month; i++) {
          tmp = new Date();
          tmp.setDate(1);
          tmp.setFullYear(this.d.getFullYear()); //the year matters, because leap-years
          tmp.setHours(1);
          tmp.setMinutes(1);
          tmp.setMonth(i);
          tmp.setHours(-2); //the last day of the month
          sum += tmp.getDate();
        }
        return sum + this.d.getDate()
      },

      //since the start of the year
      week: function (num, goFwd) {
        // week-setter
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = week(this, num, goFwd);
          s = clearMinutes(s);
          return s
        }
        //find-out which week it is
        let tmp = this.clone();
        tmp = tmp.month(0);
        tmp = tmp.date(1);
        tmp = clearMinutes(tmp);
        tmp = tmp.day('monday');
        //don't go into last-year
        if (tmp.monthName() === 'december' && tmp.date() >= 28) {
          tmp = tmp.add(1, 'week');
        }
        // is first monday the 1st?
        let toAdd = 1;
        if (tmp.date() === 1) {
          toAdd = 0;
        }
        tmp = tmp.minus(1, 'second');
        const thisOne = this.epoch;
        //if the week technically hasn't started yet
        if (tmp.epoch > thisOne) {
          return 1
        }
        //speed it up, if we can
        let i = 0;
        let skipWeeks = this.month() * 4;
        tmp.epoch += o.week * skipWeeks;
        i += skipWeeks;
        for (; i <= 52; i++) {
          if (tmp.epoch > thisOne) {
            return i + toAdd
          }
          tmp = tmp.add(1, 'week');
        }
        return 52
      },
      //either name or number
      month: function (input, goFwd) {
        if (input !== undefined) {
          let s = this.clone();
          s.epoch = month(s, input, goFwd);
          return s
        }
        return this.d.getMonth()
      },
      //'january'
      monthName: function (input, goFwd) {
        if (input !== undefined) {
          let s = this.clone();
          s = s.month(input, goFwd);
          return s
        }
        return long()[this.month()]
      },

      //q1, q2, q3, q4
      quarter: function (num, goFwd) {
        if (num !== undefined) {
          if (typeof num === 'string') {
            num = num.replace(/^q/i, '');
            num = parseInt(num, 10);
          }
          if (quarters[num]) {
            let s = this.clone();
            let month = quarters[num][0];
            s = s.month(month, goFwd);
            s = s.date(1, goFwd);
            s = s.startOf('day');
            return s
          }
        }
        let month = this.d.getMonth();
        for (let i = 1; i < quarters.length; i++) {
          if (month < quarters[i][0]) {
            return i - 1
          }
        }
        return 4
      },

      //spring, summer, winter, fall
      season: function (input, goFwd) {
        let hem = 'north';
        if (this.hemisphere() === 'South') {
          hem = 'south';
        }
        if (input !== undefined) {
          let s = this.clone();
          for (let i = 0; i < seasons[hem].length; i++) {
            if (input === seasons[hem][i][0]) {
              s = s.month(seasons[hem][i][1], goFwd);
              s = s.date(1);
              s = s.startOf('day');
            }
          }
          return s
        }
        let month = this.d.getMonth();
        for (let i = 0; i < seasons[hem].length - 1; i++) {
          if (month >= seasons[hem][i][1] && month < seasons[hem][i + 1][1]) {
            return seasons[hem][i][0]
          }
        }
        return 'winter'
      },

      //the year number
      year: function (num) {
        if (num !== undefined) {
          let s = this.clone();
          s.epoch = year(s, num);
          return s
        }
        return this.d.getFullYear()
      },

      //bc/ad years
      era: function (str) {
        if (str !== undefined) {
          let s = this.clone();
          str = str.toLowerCase();
          //TODO: there is no year-0AD i think. may have off-by-1 error here
          let year$1 = s.d.getFullYear();
          //make '1992' into 1992bc..
          if (str === 'bc' && year$1 > 0) {
            s.epoch = year(s, year$1 * -1);
          }
          //make '1992bc' into '1992'
          if (str === 'ad' && year$1 < 0) {
            s.epoch = year(s, year$1 * -1);
          }
          return s
        }
        if (this.d.getFullYear() < 0) {
          return 'BC'
        }
        return 'AD'
      },

      // 2019 -> 2010
      decade: function (input) {
        if (input !== undefined) {
          input = String(input);
          input = input.replace(/([0-9])'?s$/, '$1'); //1950's
          input = input.replace(/([0-9])(th|rd|st|nd)/, '$1'); //fix ordinals
          if (!input) {
            console.warn('Spacetime: Invalid decade input');
            return this
          }
          // assume 20th century?? for '70s'.
          if (input.length === 2 && /[0-9][0-9]/.test(input)) {
            input = '19' + input;
          }
          let year = Number(input);
          if (isNaN(year)) {
            return this
          }
          // round it down to the decade
          year = Math.floor(year / 10) * 10;
          return this.year(year) //.startOf('decade')
        }
        return this.startOf('decade').year()
      },
      // 1950 -> 19+1
      century: function (input) {
        if (input !== undefined) {
          if (typeof input === 'string') {
            input = input.replace(/([0-9])(th|rd|st|nd)/, '$1'); //fix ordinals
            input = input.replace(/([0-9]+) ?(b\.?c\.?|a\.?d\.?)/i, (a, b, c) => {
              if (c.match(/b\.?c\.?/i)) {
                b = '-' + b;
              }
              return b
            });
            input = input.replace(/c$/, ''); //20thC
          }
          let year = Number(input);
          if (isNaN(input)) {
            console.warn('Spacetime: Invalid century input');
            return this
          }
          // there is no century 0
          if (year === 0) {
            year = 1;
          }
          if (year >= 0) {
            year = (year - 1) * 100;
          } else {
            year = (year + 1) * 100;
          }
          return this.year(year)
        }
        // century getter
        let num = this.startOf('century').year();
        num = Math.floor(num / 100);
        if (num < 0) {
          return num - 1
        }
        return num + 1
      },
      // 2019 -> 2+1
      millenium: function (input) {
        if (input !== undefined) {
          if (typeof input === 'string') {
            input = input.replace(/([0-9])(th|rd|st|nd)/, '$1'); //fix ordinals
            input = Number(input);
            if (isNaN(input)) {
              console.warn('Spacetime: Invalid millenium input');
              return this
            }
          }
          if (input > 0) {
            input -= 1;
          }
          let year = input * 1000;
          // there is no year 0
          if (year === 0) {
            year = 1;
          }
          return this.year(year)
        }
        // get the current millenium
        let num = Math.floor(this.year() / 1000);
        if (num >= 0) {
          num += 1;
        }
        return num
      }
    };

    const methods$4 = Object.assign({}, methods$1, methods$2, methods$3);

    //aliases
    methods$4.milliseconds = methods$4.millisecond;
    methods$4.seconds = methods$4.second;
    methods$4.minutes = methods$4.minute;
    methods$4.hours = methods$4.hour;
    methods$4.hour24 = methods$4.hour;
    methods$4.h12 = methods$4.hour12;
    methods$4.h24 = methods$4.hour24;
    methods$4.days = methods$4.day;

    const addMethods = Space => {
      //hook the methods into prototype
      Object.keys(methods$4).forEach(k => {
        Space.prototype[k] = methods$4[k];
      });
    };

    const getMonthLength = function (month, year) {
      if (month === 1 && isLeapYear(year)) {
        return 29
      }
      return monthLengths[month]
    };

    //month is the one thing we 'model/compute'
    //- because ms-shifting can be off by enough
    const rollMonth = (want, old) => {
      //increment year
      if (want.month > 0) {
        let years = parseInt(want.month / 12, 10);
        want.year = old.year() + years;
        want.month = want.month % 12;
      } else if (want.month < 0) {
        let m = Math.abs(want.month);
        let years = parseInt(m / 12, 10);
        if (m % 12 !== 0) {
          years += 1;
        }
        want.year = old.year() - years;
        //ignore extras
        want.month = want.month % 12;
        want.month = want.month + 12;
        if (want.month === 12) {
          want.month = 0;
        }
      }
      return want
    };

    // briefly support day=-2 (this does not need to be perfect.)
    const rollDaysDown = (want, old, sum) => {
      want.year = old.year();
      want.month = old.month();
      let date = old.date();
      want.date = date - Math.abs(sum);
      while (want.date < 1) {
        want.month -= 1;
        if (want.month < 0) {
          want.month = 11;
          want.year -= 1;
        }
        let max = getMonthLength(want.month, want.year);
        want.date += max;
      }
      return want
    };

    // briefly support day=33 (this does not need to be perfect.)
    const rollDaysUp = (want, old, sum) => {
      let year = old.year();
      let month = old.month();
      let max = getMonthLength(month, year);
      while (sum > max) {
        sum -= max;
        month += 1;
        if (month >= 12) {
          month -= 12;
          year += 1;
        }
        max = getMonthLength(month, year);
      }
      want.month = month;
      want.date = sum;
      return want
    };

    const months$1 = rollMonth;
    const days = rollDaysUp;
    const daysBack = rollDaysDown;

    // this logic is a bit of a mess,
    // but briefly:
    // millisecond-math, and some post-processing covers most-things
    // we 'model' the calendar here only a little bit
    // and that usually works-out...

    const order$1 = ['millisecond', 'second', 'minute', 'hour', 'date', 'month'];
    let keep = {
      second: order$1.slice(0, 1),
      minute: order$1.slice(0, 2),
      quarterhour: order$1.slice(0, 2),
      hour: order$1.slice(0, 3),
      date: order$1.slice(0, 4),
      month: order$1.slice(0, 4),
      quarter: order$1.slice(0, 4),
      season: order$1.slice(0, 4),
      year: order$1,
      decade: order$1,
      century: order$1
    };
    keep.week = keep.hour;
    keep.season = keep.date;
    keep.quarter = keep.date;

    // Units need to be dst adjuested
    const dstAwareUnits = {
      year: true,
      quarter: true,
      season: true,
      month: true,
      week: true,
      date: true
    };

    const keepDate = {
      month: true,
      quarter: true,
      season: true,
      year: true
    };

    const addMethods$1 = (SpaceTime) => {
      SpaceTime.prototype.add = function (num, unit) {
        let s = this.clone();

        if (!unit || num === 0) {
          return s //don't bother
        }
        let old = this.clone();
        unit = normalize$1(unit);
        if (unit === 'millisecond') {
          s.epoch += num;
          return s
        }
        // support 'fortnight' alias
        if (unit === 'fortnight') {
          num *= 2;
          unit = 'week';
        }
        //move forward by the estimated milliseconds (rough)
        if (o[unit]) {
          s.epoch += o[unit] * num;
        } else if (unit === 'week' || unit === 'weekend') {
          s.epoch += o.day * (num * 7);
        } else if (unit === 'quarter' || unit === 'season') {
          s.epoch += o.month * (num * 3);
        } else if (unit === 'quarterhour') {
          s.epoch += o.minute * 15 * num;
        }
        //now ensure our milliseconds/etc are in-line
        let want = {};
        if (keep[unit]) {
          keep[unit].forEach((u) => {
            want[u] = old[u]();
          });
        }

        if (dstAwareUnits[unit]) {
          const diff = old.timezone().current.offset - s.timezone().current.offset;
          s.epoch += diff * 3600 * 1000;
        }

        //ensure month/year has ticked-over
        if (unit === 'month') {
          want.month = old.month() + num;
          //month is the one unit we 'model' directly
          want = months$1(want, old);
        }
        //support coercing a week, too
        if (unit === 'week') {
          let sum = old.date() + num * 7;
          if (sum <= 28 && sum > 1) {
            want.date = sum;
          }
        }
        if (unit === 'weekend' && s.dayName() !== 'saturday') {
          s = s.day('saturday', true); //ensure it's saturday
        }
        //support 25-hour day-changes on dst-changes
        else if (unit === 'date') {
          if (num < 0) {
            want = daysBack(want, old, num);
          } else {
            //specify a naive date number, if it's easy to do...
            let sum = old.date() + num;
            // ok, model this one too
            want = days(want, old, sum);
          }
          //manually punt it if we haven't moved at all..
          if (num !== 0 && old.isSame(s, 'day')) {
            want.date = old.date() + num;
          }
        }
        // ensure a quarter is 3 months over
        else if (unit === 'quarter') {
          want.month = old.month() + num * 3;
          want.year = old.year();
          // handle rollover
          if (want.month < 0) {
            let years = Math.floor(want.month / 12);
            let remainder = want.month + Math.abs(years) * 12;
            want.month = remainder;
            want.year += years;
          } else if (want.month >= 12) {
            let years = Math.floor(want.month / 12);
            want.month = want.month % 12;
            want.year += years;
          }
          want.date = old.date();
        }
        //ensure year has changed (leap-years)
        else if (unit === 'year') {
          let wantYear = old.year() + num;
          let haveYear = s.year();
          if (haveYear < wantYear) {
            let toAdd = Math.floor(num / 4) || 1; //approx num of leap-days
            s.epoch += Math.abs(o.day * toAdd);
          } else if (haveYear > wantYear) {
            let toAdd = Math.floor(num / 4) || 1; //approx num of leap-days
            s.epoch += o.day * toAdd;
          }
        }
        //these are easier
        else if (unit === 'decade') {
          want.year = s.year() + 10;
        } else if (unit === 'century') {
          want.year = s.year() + 100;
        }
        //keep current date, unless the month doesn't have it.
        if (keepDate[unit]) {
          let max = monthLengths[want.month];
          want.date = old.date();
          if (want.date > max) {
            want.date = max;
          }
        }
        if (Object.keys(want).length > 1) {
          walkTo(s, want);
        }
        return s
      };

      //subtract is only add *-1
      SpaceTime.prototype.subtract = function (num, unit) {
        let s = this.clone();
        return s.add(num * -1, unit)
      };
      //add aliases
      SpaceTime.prototype.minus = SpaceTime.prototype.subtract;
      SpaceTime.prototype.plus = SpaceTime.prototype.add;
    };

    //make a string, for easy comparison between dates
    const print = {
      millisecond: (s) => {
        return s.epoch
      },
      second: (s) => {
        return [s.year(), s.month(), s.date(), s.hour(), s.minute(), s.second()].join('-')
      },
      minute: (s) => {
        return [s.year(), s.month(), s.date(), s.hour(), s.minute()].join('-')
      },
      hour: (s) => {
        return [s.year(), s.month(), s.date(), s.hour()].join('-')
      },
      day: (s) => {
        return [s.year(), s.month(), s.date()].join('-')
      },
      week: (s) => {
        return [s.year(), s.week()].join('-')
      },
      month: (s) => {
        return [s.year(), s.month()].join('-')
      },
      quarter: (s) => {
        return [s.year(), s.quarter()].join('-')
      },
      year: (s) => {
        return s.year()
      }
    };
    print.date = print.day;

    const addMethods$2 = (SpaceTime) => {
      SpaceTime.prototype.isSame = function (b, unit, tzAware = true) {
        let a = this;
        if (!unit) {
          return null
        }
        // support swapped params
        if (typeof b === 'string' && typeof unit === 'object') {
          let tmp = b;
          b = unit;
          unit = tmp;
        }
        if (typeof b === 'string' || typeof b === 'number') {
          b = new SpaceTime(b, this.timezone.name);
        }
        //support 'seconds' aswell as 'second'
        unit = unit.replace(/s$/, '');

        // make them the same timezone for proper comparison
        if (tzAware === true && a.tz !== b.tz) {
          b = b.clone();
          b.tz = a.tz;
        }
        if (print[unit]) {
          return print[unit](a) === print[unit](b)
        }
        return null
      };
    };

    const addMethods$3 = SpaceTime => {
      const methods = {
        isAfter: function (d) {
          d = beADate(d, this);
          let epoch = getEpoch(d);
          if (epoch === null) {
            return null
          }
          return this.epoch > epoch
        },
        isBefore: function (d) {
          d = beADate(d, this);
          let epoch = getEpoch(d);
          if (epoch === null) {
            return null
          }
          return this.epoch < epoch
        },
        isEqual: function (d) {
          d = beADate(d, this);
          let epoch = getEpoch(d);
          if (epoch === null) {
            return null
          }
          return this.epoch === epoch
        },
        isBetween: function (start, end, isInclusive = false) {
          start = beADate(start, this);
          end = beADate(end, this);
          let startEpoch = getEpoch(start);
          if (startEpoch === null) {
            return null
          }
          let endEpoch = getEpoch(end);
          if (endEpoch === null) {
            return null
          }
          if (isInclusive) {
            return this.isBetween(start, end) || this.isEqual(start) || this.isEqual(end);
          }
          return startEpoch < this.epoch && this.epoch < endEpoch
        }
      };

      //hook them into proto
      Object.keys(methods).forEach(k => {
        SpaceTime.prototype[k] = methods[k];
      });
    };

    const addMethods$4 = SpaceTime => {
      const methods = {
        i18n: data => {
          //change the day names
          if (isObject(data.days)) {
            set$1(data.days);
          }
          //change the month names
          if (isObject(data.months)) {
            set(data.months);
          }

          // change the the display style of the month / day names
          if (isBoolean(data.useTitleCase)) {
            set$2(data.useTitleCase);
          }

          //change am and pm strings
          if (isObject(data.ampm)) {
            set$3(data.ampm);
          }
        }
      };

      //hook them into proto
      Object.keys(methods).forEach(k => {
        SpaceTime.prototype[k] = methods[k];
      });
    };

    let timezones = all;
    //fake timezone-support, for fakers (es5 class)
    const SpaceTime = function (input, tz, options = {}) {
      //the holy moment
      this.epoch = null;
      //the shift for the given timezone
      this.tz = lookupTz(tz, timezones);
      //whether to output warnings to console
      this.silent = typeof options.silent !== 'undefined' ? options.silent : true;
      // favour british interpretation of 02/02/2018, etc
      this.british = options.dmy || options.british;

      //does the week start on sunday, or monday:
      this._weekStart = 1; //default to monday
      if (options.weekStart !== undefined) {
        this._weekStart = options.weekStart;
      }
      // the reference today date object, (for testing)
      this._today = {};
      if (options.today !== undefined) {
        this._today = options.today;
      }
      // dunno if this is a good idea, or not
      // Object.defineProperty(this, 'parsers', {
      //   enumerable: false,
      //   writable: true,
      //   value: parsers
      // })
      //add getter/setters
      Object.defineProperty(this, 'd', {
        //return a js date object
        get: function () {
          let offset = quickOffset(this);
          //every computer is somewhere- get this computer's built-in offset
          let bias = new Date(this.epoch).getTimezoneOffset() || 0;
          //movement
          let shift = bias + offset * 60; //in minutes
          shift = shift * 60 * 1000; //in ms
          //remove this computer's offset
          let epoch = this.epoch + shift;
          let d = new Date(epoch);
          return d
        }
      });
      //add this data on the object, to allow adding new timezones
      Object.defineProperty(this, 'timezones', {
        get: () => timezones,
        set: (obj) => {
          timezones = obj;
          return obj
        }
      });
      //parse the various formats
      let tmp = parseInput(this, input);
      this.epoch = tmp.epoch;
    };

    //(add instance methods to prototype)
    Object.keys(methods).forEach((k) => {
      SpaceTime.prototype[k] = methods[k];
    });

    // ¯\_(ツ)_/¯
    SpaceTime.prototype.clone = function () {
      return new SpaceTime(this.epoch, this.tz, {
        silent: this.silent,
        weekStart: this._weekStart,
        today: this._today,
        parsers: this.parsers
      })
    };

    /**
     * @deprecated use toNativeDate()
     * @returns native date object at the same epoch
     */
    SpaceTime.prototype.toLocalDate = function () {
      return this.toNativeDate()
    };

    /**
     * @returns native date object at the same epoch
     */
    SpaceTime.prototype.toNativeDate = function () {
      return new Date(this.epoch)
    };

    //append more methods
    addMethods(SpaceTime);
    addMethods$1(SpaceTime);
    addMethods$2(SpaceTime);
    addMethods$3(SpaceTime);
    addMethods$4(SpaceTime);

    // const timezones = require('../data');

    const whereIts = (a, b) => {
      let start = new SpaceTime(null);
      let end = new SpaceTime(null);
      start = start.time(a);
      //if b is undefined, use as 'within one hour'
      if (b) {
        end = end.time(b);
      } else {
        end = start.add(59, 'minutes');
      }

      let startHour = start.hour();
      let endHour = end.hour();
      let tzs = Object.keys(start.timezones).filter((tz) => {
        if (tz.indexOf('/') === -1) {
          return false
        }
        let m = new SpaceTime(null, tz);
        let hour = m.hour();
        //do 'calendar-compare' not real-time-compare
        if (hour >= startHour && hour <= endHour) {
          //test minutes too, if applicable
          if (hour === startHour && m.minute() < start.minute()) {
            return false
          }
          if (hour === endHour && m.minute() > end.minute()) {
            return false
          }
          return true
        }
        return false
      });
      return tzs
    };

    var version = '7.1.2';

    const main$1 = (input, tz, options) => new SpaceTime(input, tz, options);

    // set all properties of a given 'today' object
    const setToday = function (s) {
      let today = s._today || {};
      Object.keys(today).forEach((k) => {
        s = s[k](today[k]);
      });
      return s
    };

    //some helper functions on the main method
    main$1.now = (tz, options) => {
      let s = new SpaceTime(new Date().getTime(), tz, options);
      s = setToday(s);
      return s
    };
    main$1.today = (tz, options) => {
      let s = new SpaceTime(new Date().getTime(), tz, options);
      s = setToday(s);
      return s.startOf('day')
    };
    main$1.tomorrow = (tz, options) => {
      let s = new SpaceTime(new Date().getTime(), tz, options);
      s = setToday(s);
      return s.add(1, 'day').startOf('day')
    };
    main$1.yesterday = (tz, options) => {
      let s = new SpaceTime(new Date().getTime(), tz, options);
      s = setToday(s);
      return s.subtract(1, 'day').startOf('day')
    };
    main$1.extend = function (obj = {}) {
      Object.keys(obj).forEach((k) => {
        SpaceTime.prototype[k] = obj[k];
      });
      return this
    };
    main$1.timezones = function () {
      let s = new SpaceTime();
      return s.timezones
    };
    main$1.max = function (tz, options) {
      let s = new SpaceTime(null, tz, options);
      s.epoch = 8640000000000000;
      return s
    };
    main$1.min = function (tz, options) {
      let s = new SpaceTime(null, tz, options);
      s.epoch = -8640000000000000;
      return s
    };

    //find tz by time
    main$1.whereIts = whereIts;
    main$1.version = version;

    //aliases:
    main$1.plugin = main$1.extend;

    const getSunSet = function (d, lat) {
      d = d.time('3pm');
      // find sunset time
      for (let i = 0; i < 100; i += 1) {
        d = d.add(5, 'minute');
        d = d.in([lat, 0]);
        if (d.sunPosition().altitude < 0) {
          break
        }
      }
      return d
    };

    const getSunRise = function (d, lat) {
      d = d.time('3am');
      // find sunset time
      for (let i = 0; i < 100; i += 1) {
        d = d.add(5, 'minute');
        d = d.in([lat, 0]);
        if (d.sunPosition().altitude > 0) {
          break
        }
      }
      return d
    };

    const calcYear = function (lat) {
      let s = main$1();
      let weeks = [];
      s = s.startOf('year');
      let hours = s.every('week', s.endOf('year'));
      hours.forEach((d, i) => {
        d = d.in([lat, 0]);
        let set = getSunSet(d, lat);
        let rise = getSunRise(d, lat);
        set = set.in([lat, 0]);

        weeks.push({
          id: i,
          date: set.format('{month-short} {date}'),
          time: set.time(),
          sunset: set.sunPosition().azimuth,
          sunrise: rise.sunPosition().azimuth,
        });
      });
      return weeks
    };

    /* spencermountain/spacetime-daylight 1.4.0 MIT */
    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by rollup-plugin-commonjs');
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var suncalc = createCommonjsModule(function (module, exports) {
    /*
     (c) 2011-2015, Vladimir Agafonkin
     SunCalc is a JavaScript library for calculating sun/moon position and light phases.
     https://github.com/mourner/suncalc
    */

    (function () {
    // shortcuts for easier to read formulas

    var PI   = Math.PI,
        sin  = Math.sin,
        cos  = Math.cos,
        tan  = Math.tan,
        asin = Math.asin,
        atan = Math.atan2,
        acos = Math.acos,
        rad  = PI / 180;

    // sun calculations are based on http://aa.quae.nl/en/reken/zonpositie.html formulas


    // date/time constants and conversions

    var dayMs = 1000 * 60 * 60 * 24,
        J1970 = 2440588,
        J2000 = 2451545;

    function toJulian(date) { return date.valueOf() / dayMs - 0.5 + J1970; }
    function fromJulian(j)  { return new Date((j + 0.5 - J1970) * dayMs); }
    function toDays(date)   { return toJulian(date) - J2000; }


    // general calculations for position

    var e = rad * 23.4397; // obliquity of the Earth

    function rightAscension(l, b) { return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l)); }
    function declination(l, b)    { return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l)); }

    function azimuth(H, phi, dec)  { return atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi)); }
    function altitude(H, phi, dec) { return asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H)); }

    function siderealTime(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }

    function astroRefraction(h) {
        if (h < 0) // the following formula works for positive altitudes only.
            h = 0; // if h = -0.08901179 a div/0 would occur.

        // formula 16.4 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
        // 1.02 / tan(h + 10.26 / (h + 5.10)) h in degrees, result in arc minutes -> converted to rad:
        return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
    }

    // general sun calculations

    function solarMeanAnomaly(d) { return rad * (357.5291 + 0.98560028 * d); }

    function eclipticLongitude(M) {

        var C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)), // equation of center
            P = rad * 102.9372; // perihelion of the Earth

        return M + C + P + PI;
    }

    function sunCoords(d) {

        var M = solarMeanAnomaly(d),
            L = eclipticLongitude(M);

        return {
            dec: declination(L, 0),
            ra: rightAscension(L, 0)
        };
    }


    var SunCalc = {};


    // calculates sun position for a given date and latitude/longitude

    SunCalc.getPosition = function (date, lat, lng) {

        var lw  = rad * -lng,
            phi = rad * lat,
            d   = toDays(date),

            c  = sunCoords(d),
            H  = siderealTime(d, lw) - c.ra;

        return {
            azimuth: azimuth(H, phi, c.dec),
            altitude: altitude(H, phi, c.dec)
        };
    };


    // sun times configuration (angle, morning name, evening name)

    var times = SunCalc.times = [
        [-0.833, 'sunrise',       'sunset'      ],
        [  -0.3, 'sunriseEnd',    'sunsetStart' ],
        [    -6, 'dawn',          'dusk'        ],
        [   -12, 'nauticalDawn',  'nauticalDusk'],
        [   -18, 'nightEnd',      'night'       ],
        [     6, 'goldenHourEnd', 'goldenHour'  ]
    ];

    // adds a custom time to the times config

    SunCalc.addTime = function (angle, riseName, setName) {
        times.push([angle, riseName, setName]);
    };


    // calculations for sun times

    var J0 = 0.0009;

    function julianCycle(d, lw) { return Math.round(d - J0 - lw / (2 * PI)); }

    function approxTransit(Ht, lw, n) { return J0 + (Ht + lw) / (2 * PI) + n; }
    function solarTransitJ(ds, M, L)  { return J2000 + ds + 0.0053 * sin(M) - 0.0069 * sin(2 * L); }

    function hourAngle(h, phi, d) { return acos((sin(h) - sin(phi) * sin(d)) / (cos(phi) * cos(d))); }

    // returns set time for the given sun altitude
    function getSetJ(h, lw, phi, dec, n, M, L) {

        var w = hourAngle(h, phi, dec),
            a = approxTransit(w, lw, n);
        return solarTransitJ(a, M, L);
    }


    // calculates sun times for a given date and latitude/longitude

    SunCalc.getTimes = function (date, lat, lng) {

        var lw = rad * -lng,
            phi = rad * lat,

            d = toDays(date),
            n = julianCycle(d, lw),
            ds = approxTransit(0, lw, n),

            M = solarMeanAnomaly(ds),
            L = eclipticLongitude(M),
            dec = declination(L, 0),

            Jnoon = solarTransitJ(ds, M, L),

            i, len, time, Jset, Jrise;


        var result = {
            solarNoon: fromJulian(Jnoon),
            nadir: fromJulian(Jnoon - 0.5)
        };

        for (i = 0, len = times.length; i < len; i += 1) {
            time = times[i];

            Jset = getSetJ(time[0] * rad, lw, phi, dec, n, M, L);
            Jrise = Jnoon - (Jset - Jnoon);

            result[time[1]] = fromJulian(Jrise);
            result[time[2]] = fromJulian(Jset);
        }

        return result;
    };


    // moon calculations, based on http://aa.quae.nl/en/reken/hemelpositie.html formulas

    function moonCoords(d) { // geocentric ecliptic coordinates of the moon

        var L = rad * (218.316 + 13.176396 * d), // ecliptic longitude
            M = rad * (134.963 + 13.064993 * d), // mean anomaly
            F = rad * (93.272 + 13.229350 * d),  // mean distance

            l  = L + rad * 6.289 * sin(M), // longitude
            b  = rad * 5.128 * sin(F),     // latitude
            dt = 385001 - 20905 * cos(M);  // distance to the moon in km

        return {
            ra: rightAscension(l, b),
            dec: declination(l, b),
            dist: dt
        };
    }

    SunCalc.getMoonPosition = function (date, lat, lng) {

        var lw  = rad * -lng,
            phi = rad * lat,
            d   = toDays(date),

            c = moonCoords(d),
            H = siderealTime(d, lw) - c.ra,
            h = altitude(H, phi, c.dec),
            // formula 14.1 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
            pa = atan(sin(H), tan(phi) * cos(c.dec) - sin(c.dec) * cos(H));

        h = h + astroRefraction(h); // altitude correction for refraction

        return {
            azimuth: azimuth(H, phi, c.dec),
            altitude: h,
            distance: c.dist,
            parallacticAngle: pa
        };
    };


    // calculations for illumination parameters of the moon,
    // based on http://idlastro.gsfc.nasa.gov/ftp/pro/astro/mphase.pro formulas and
    // Chapter 48 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.

    SunCalc.getMoonIllumination = function (date) {

        var d = toDays(date || new Date()),
            s = sunCoords(d),
            m = moonCoords(d),

            sdist = 149598000, // distance from Earth to Sun in km

            phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra)),
            inc = atan(sdist * sin(phi), m.dist - sdist * cos(phi)),
            angle = atan(cos(s.dec) * sin(s.ra - m.ra), sin(s.dec) * cos(m.dec) -
                    cos(s.dec) * sin(m.dec) * cos(s.ra - m.ra));

        return {
            fraction: (1 + cos(inc)) / 2,
            phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / Math.PI,
            angle: angle
        };
    };


    function hoursLater(date, h) {
        return new Date(date.valueOf() + h * dayMs / 24);
    }

    // calculations for moon rise/set times are based on http://www.stargazing.net/kepler/moonrise.html article

    SunCalc.getMoonTimes = function (date, lat, lng, inUTC) {
        var t = new Date(date);
        if (inUTC) t.setUTCHours(0, 0, 0, 0);
        else t.setHours(0, 0, 0, 0);

        var hc = 0.133 * rad,
            h0 = SunCalc.getMoonPosition(t, lat, lng).altitude - hc,
            h1, h2, rise, set, a, b, xe, ye, d, roots, x1, x2, dx;

        // go in 2-hour chunks, each time seeing if a 3-point quadratic curve crosses zero (which means rise or set)
        for (var i = 1; i <= 24; i += 2) {
            h1 = SunCalc.getMoonPosition(hoursLater(t, i), lat, lng).altitude - hc;
            h2 = SunCalc.getMoonPosition(hoursLater(t, i + 1), lat, lng).altitude - hc;

            a = (h0 + h2) / 2 - h1;
            b = (h2 - h0) / 2;
            xe = -b / (2 * a);
            ye = (a * xe + b) * xe + h1;
            d = b * b - 4 * a * h1;
            roots = 0;

            if (d >= 0) {
                dx = Math.sqrt(d) / (Math.abs(a) * 2);
                x1 = xe - dx;
                x2 = xe + dx;
                if (Math.abs(x1) <= 1) roots++;
                if (Math.abs(x2) <= 1) roots++;
                if (x1 < -1) x1 = x2;
            }

            if (roots === 1) {
                if (h0 < 0) rise = i + x1;
                else set = i + x1;

            } else if (roots === 2) {
                rise = i + (ye < 0 ? x2 : x1);
                set = i + (ye < 0 ? x1 : x2);
            }

            if (rise && set) break;

            h0 = h2;
        }

        var result = {};

        if (rise) result.rise = hoursLater(t, rise);
        if (set) result.set = hoursLater(t, set);

        if (!rise && !set) result[ye > 0 ? 'alwaysUp' : 'alwaysDown'] = true;

        return result;
    };


    // export as Node module / AMD module / browser variable
    module.exports = SunCalc;

    }());
    });

    var spacetimeGeo = createCommonjsModule(function (module, exports) {
    /* spacetime-geo v1.2.0
       github.com/spencermountain/spacetime-geo
       MIT
    */

    (function(f){{module.exports=f();}})(function(){return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof commonjsRequire&&commonjsRequire;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t);}return n[i].exports}for(var u="function"==typeof commonjsRequire&&commonjsRequire,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(_dereq_,module,exports){
    function tzlookup(Y,W){var T="XIXHXHXGXGXQXQXPXPXOXOXN##U6U6UW#$U%U%U%U%U%XFXEXEXRXRXVXVXWXWXXXXXYXYXZXZY#Y#Y$Y$Y%Y%XSXSXTXTXUXIXHXHXGXGXQXQVAVA#%#&V'#'U6#(#)U%U%U%U%U%#*U%XEXEVLVLVLVLYGYGYGYG#+W=W=W=W=W=W=Y$X+X+X+X+X+XTXUVPUQ#,T*T*#-VAVA#.#/#0#1#2U6U6UWU%U%U%U%U%#3VLVLXEYH#4#5#6YGYGYG#7X.#8W=W=W=#9X,X,#:#;#<#=#>VPVP#?#@#AT*T*#B#C#D#E#F#GV'#H#I#JUWU%U%U%U%X6X6#K#LYH#M#N#O#PYG#Q#R#SX.#T#UW=W=#V#WX,#X#Y#Z$#$$$%$&T)$'$(T*T*$)$*$+TW$,$-$.$/$0$1$2$3U%U%XJXJXF$4$5$6$7$8$9$:YG$;$<$=$>$?$@$A$BW3$C$D$E$F$G$HW8$IT)T)T)XHXGXGXQV=$J$K$L$M$N$O$P$Q$R$SV2XKXJXJXFY4$T$U$V$W$X$Y$Z%#%$%%VN%&%'%(%)%*%+%,%-%.%/%0W8XTT)XIXHXHXGXGXQXQU>%1%2%3TL%4%5%6%7U-XKXKX0X0XF%8%9%:%;%<%=%>%?%@%A%B%C%DX(%E%F%GWU%H%I%J%KXSXTXTXUXIXHXHXGXGXQXQU>%L%M%NTL%OUPXMX1XLXKXKXJX0X5%P%QS0%R%S%T%U%V%W%X%Y%Z&#WUWUWUWUWU&$&%X%XSXSXTXTXU&&ZDZDXGXGXQXQXP&'&(&)&*&+&,UOXLXLXKXKXJXJ&-&.&/S0&0T&&1&2WQ&3&4&5&6&7&8&9&:&;&<&=X%X%XSX%XTXTXUXIZDZDZDXGXQXQXPUI&>&?&@&A&B&C&DXLXKXKXJX3&E&F&G&H&I&J&K&L&M&N&OWEW<W<&P&Q&R&S&T&UY%X%ZUXSXTZYXUXIXHXHXGXGXQXQXPXPXOXO&V&W&X&Y&Z'#XKXKXJX3'$'%'&'''(')'*'+','-VMXXW<'.XZ'/'0'1'2WDZPZ9'3'4ZH'5XUXIXHZEZEXGXQXQXPXPXOXOZ@'6'7'8'9':';XKXJXJXF'<'='>'?'@'A'B'C'DXXXXZ1W'XZ'E'F'G'H'I'JW5Z9'K'L'MZWZ<Z<XHZEXGXQXQXPXPXOXOZ@'N'O'PUB'Q'R'S'TXJXFXFXESQ'U'V'W'X'YXWZ0XX'ZXYXZXZW4(#($(%W5(&ZS('ZB((()(*(+ZTZE(,(-XQXPXPXOXOXNU=U=(.(/(0(1(2(3XJXFX8XEXESN(4(5(6(7(8Z2XXZ+XYXZZ-Y#(9(:(;(<(=(>(?ZB(@(A(BZLZT(CZV(DXQXPXPXOXOXNXNU=(E(F(G(H(IXJXJXFXFX8XE(J(K(L(M(NZ*(OZ2XYXYXZXZY#Y#XCXC(P(QX;X;ZN(RZ>(SXHXHZVZVZA(TZQXPZ:XOXNXNV,(U(V(WV.V.XJXJXFXFXEXET((X(Y(ZZ*Z*XXXXXYXYXZXZY#Y#XCXC)#)$)%)&XT)'XUZ6XHXHXGXGXQXQXPXPXOXOXNXNV,)()))*V.XKXJXJXFX8XEXEXRSE)+SEXWXWXXXXXYXYXZXZY#Y#XC),)-).)/XDXAZ6Z6Z8XHXHXGXGXQXQXPXPXOXOXNXNV,)0)1T.XKXKXJXJXFX8XEXEXRXRXVXVXWXWXXXXXYZ/XZXZY#Y#Y$Y$Y%)2)3XDXTZ6Z6XIXHXHXGXGXQXQXPXPXOXOXNXN)4)5)6X9XKXKXJXJXFXFXEXEXRXRXVSESEZ/Z/XXZ/XYXZXZY#Y#Y$Y$Y%Y%XSXSXTZ6Z6XIXHXHXGXGXQXQXPXPXOXOXNXNV&)7)8X9XKX7X7X7XFXFXEXEXRXRXVXVXWXWXXXXXYXYXZXZY#Y#Y$Y$Y%Y%XSXSVEZ6XUXIXHXHXGXGXQXQXPXPXOXOXNXNVHVH)9):T9T9XJXJXFXFXEXEXRXRVIVIVIVI);VFVFVC)<VKVBVBVBVDVDVDVDVD)=VGXUXIXHXHXGXGXQXQXPXPXOXOXNXNVHVHT9T9T9T9)>VH)?Y&)@VJVJVJ)AVIVIVI)BVFVF)C)DVK)E)F)G)H)I)J)K)L)MVGVGVGVGVGVGXGXQXQXPXPXOXOXNXNVHVHT9T9T9T9)NVH)OY&)PVJVJVJ)QVIVIVI)RVFVF)S)TVKVKVK)UXCXCXCXCXC)VVGVGVGVGVGVGVGVGVGVGVGVGVGVGVG)W)X)Y)Z*#*$*%*&*'*(*)***+*,*-*.*/*0*1*2*3*4*5*6*7*8*9*:*;*<*=*>*?VGVGXNXNV'*?XLXLUWU%*>TF*?TFTFV'TFV'V'*>V'*?U6*?V8V8*?U%V8*@U%U%U%*@XYW=YGXYXHT*UQT*XQXQ*>*?VAVA*?*@*@TF*ATFTF*ATFTF*AV'TFTFV'*A*B*C*CTRV/XFVLVLYH*CYHYH*C*DXVXV*DYGYGX.YG*D*DW=X.*EW=*E*F*GX,X+X,*GX+X+X+*G*G*HWWWW*HWWWWWWXTXTWW*HVPVPVPUQ*GUQUQUQUQT*UQT**FV>*GV>*GVAV>*HVAVA*HVAVA*HVAVA*H*IVAVATFV'VAV'V'*HV'*IU6U6U6*IU6U6*IU6X6XFXFX4XEXEX4Y@YH*GYH*HYUYUYU*H*HY7Y7*I*IYGYGYGYGYG*IYGYGYG*I*J*J*KX.X.X.X.*K*L*LW=*MW=*MX,*N*OX,X,*OX,X,*OX,*P*P*QW;*R*RWW*SWB*S*TWBWB*T*UWB*VVPVPW8*VVPVP*VVPUQUQT)UQ*UT*UQT**U*VXQV0*VV=*WV=*W*XV=*Y*YV)*ZV)V)V?*ZV?V?*ZV?V?V'*ZV;+#U6+#U6V;V;+#V;V;+#U&+$U&XLXLU&V2Y@Y@XF+#Y@Y@+#Y@XEYHY@+#+#+$+%+&YU+&+'+(+(+)+*++YGYG++YG+++,+-+.+.X.+/X.X.X.+/+0X.+0+1+2+2+3+4+5+5+6+7+8W=W=W=+8+8+9W3W3W3+9+:W%X,X,+:+;X,+;X,X+X+X+X++;X+WBWRXSWB+:XSW8W8W8W8T)V=+9+:+;+;+<+=+>+>V)TTTTV)V?+>+?V?V?TL+?V;V;+?+@+@V;V;V;V;V;V;+@V;+@+A+B+BV2+CV2+C+DYIYI+D+EYI+F+F+G+H+I+I+J+K+L+L+M+N+O+O+P+Q+R+R+S+T+U+U+V+W+X+X+Y+ZVR+Z,#,$,%VN,%VNVN,%,&,'X(,',(,)W2X',),*X',*,+X'X',+,,W&,-,-,.WUWU,.,/,0,1X+,1X+,2WRXSWRX)WW,1,2WW,2,3U>,4,4TTTTTTTT,4TTTL,4,5,6,7,7,8UPUP,8UPUPUP,8U-XLXLXF,8XFY>,8,9,:YB,:,;YBYB,;,<YMYM,<,=YM,>,>,?,@,A,A,BY9Y9,B,CY9,D,D,E,F,G,G,HVS,I,I,J,K,L,L,M,N,O,O,P,QX(X(,QWUWU,Q,RWUWU,R,SWUWUWU,SWU,T,TX+,UY%X+X%X%X%,TX)XSXSU>,T,U,V,VTT,W,X,XTL,YTLTL,YTL,ZXF,ZXFS:,Z-#S:-$-$-%-&-'YMY*T&T&Y*-&-'S9-'-(S9-)-)-*-+-,-,X#--X#---.X#X#-.-/-0-1-1-2-3-4-4-5-6-7WUWTWUWT-6X%X%X%ZJZDXIZDV:-5XPUF-5-6UF-7-7-8-9-:TLTL-:UHTL-:UH-;-;UO-<UOXFX2XFSA-;-<-=SZS0S0-=->->T&-?-@-@S9-AS9S9-AS9-B-B-CWQ-DX#-D-E-F-FW9-GW9-G-H-IW<W<-IW<W<-I-JW<-K-K-L-M-N-NWU-O-PWUWU-PWUWUWU-P-QWUX%-QX%UI-QUIXO-Q-RUIUIUIUHUI-R-RU.-SV7-S-T-U-V-VV--W-XV<T+-X-YXF-YX3-Z-ZSZ.#SZ.#S2.$S2.$.%S2SY.%SYSYSYSX.%SXSX.%SH.&SH.&SHSH.'.'WQ.(.)WQWQ.)VM.)WE.*WEW<.*W<XZ.*X-X-X-.*.+.,.-.-WU..././WXWU.0.0Y$WDY$XN.0XNXN.0UAXNTNTDTDUV.0TD.0.1TITI.1TI.2T?XLU,XLXF.1XFS5.1.2.3.4.4.5.6.7.7.8.9SK.9.:SK.;.;SX.<.=SHSH.=.>SH.>.?S/.?.@S/.A.A.BSUSUW<W<W<.BW<.BW<.C.C.D.E.F.FW0W0W0W0WD.FWDZCXSZ9Z9XSXSZ9ZRZHZH.DZHTNXNZ@XN.CTD.DTDTD.DTD.ETI.E.F.G.G.H.I.J.JXKT@T@SB.JXFXFS-.JXEXE.JSKXET%.JS@.K.L.L.M.NSJ.N.O.P.QSF.Q.R.SS/.SSWSU.SSUSUXWW<.SXZW4.S.TW4.UW4W4W4.U.U.V.WWCWD.WWC.XY%ZP.X.YZ9ZRXSZRZRZFXTXTZHZHXTZWZ@U=XNU=.U.V.WU=.W.X.Y.Z.ZV+/#V+T@/#T@/$U#U#U#/$XJURU#URSL/#SL/$/$/%/&/'/'/(SO/)/)/*S>S>/*/+/,XWXYZ1Z+Z+W4/+W4/,/,WC/-WCWCW5WC/-W5/-W5/.ZSZ7ZS/.ZKZWXTXTZWZWZ?Z?Z?Z=ZZ/,/,ZT/-ZTZEXGZVZVZIZIZVZV/+/,U=/-/-/.U</////0TPTP/0/1/2/3/3/4T=/5/5XJT=XJSN/5SNSNSO/5/6/7/7S>/8/9S>Z.SR/9Z0Z0/9Z*/9W4Y#Y#/9WCY$Y$WC/9XCXC/9/:/;X>/;/<X>X;/<ZSX;XSZS/<ZSZSZBXT/<ZBXUZ?XUZ>Z>ZX/;ZXZVZV/;ZVZVZVZV/;U=/;U=/<U<U</</=/=/>/?/@/@V./AV.V./AV.V.XR/AXRT(/ASNT(/B/B/CSC/D/D/E/FSRSRZ*XWZ*XXZ2Z4Z2/DX>/EX>X>X;/EX;Z;Z;ZN/EZXZXZ6XIZAZQXQXQXMV,V,/C/C/D/ET0/E/F/G/HT(/H/I/J/J/KSE/L/LSR/MXV/MX>/NX:X>X;X:/NX;X;/N/OX;XS/OXSZNZNZMXTV,/NV,/O/O/P/Q/R/R/S/T/USE/USESEXC/UXCXC/UX:Y%X:X:/UX:/VXDXD/V/W/W/X/YT/T5/Y/ZT5Y%/ZY%Y%/Z0#X@X@XMV,XMV&/Z0#0$0%0%XLT4X9V&0%XMV&T90%XLXLV&V&T9T90$T9T9T9XXXX0$VFXZXZVCVKXTXT0#VGXJXJ0#VHXF0#VH0$0$SE0%SE0%VI0&VI0&VF0'VF0'VC0(VCVCVKVCVK0'0(VKVK0(0)VKVK0)0*0+XC0+0,XCXC0,0-XCXC0-0.XCXC0.0/XCXC0/00XCXC00VG01VG01VH02VHVH02VH0303SE04SE04VI05VI05VF06VF06VC07VCVCVKVCVK06XC07XC07VG08VG08VHVGVGVHVHVGVGT9T9VGVGT9T9VGVGT9T9VGVGT9T9VGVG03VHVGVGVHVHVGVGVH02VGVGY&Y&VGVG01SEVGVGVJVJVGVGVJVJVGVGVJVJVGVG0.VIVGVGVIVIVGVGVIVIVGVGVIVIVGVG0+VFVGVGVFVFVGVGVFVFVGVG0)VCVGVGVCVKVGVGVKVKVGVGVKVKVGVGVKVKVGVG0%XCVGVGXCXCVGVGXCXCVGVGXCXCVGVGXCXCVGVGXCXCVGVG/XVGVGVGXNXNV'U6XOXOVATFVATFVATFV'U6V'U6V'U6V'U6U6U6U6V8UWUWU%U%V8U%V8U%U%U%U%TRT*V>T*V>V>VAV>VAVAVATFTFVAVATFTFVATFVATFVATFTFTFV'V'TFTFV'V'TFTFV'U6V'U6V'V'TFV'V'U6V'U6TRTRU%TRYHYHYUYUYHYHY7Y7YHYHY7YG/@YGYGYGYGX./@X.X.W=X.X.X.W=X.X.W=X,W=X,W=W=W=X,W=X,X,X,X,X+X,X+X+X+X+WWX+X+X+WWX+X+WWWWX+XSWWWWWWVPVPVPVPVPVPUQT*V>T*V>T*V>T*V>V>VAV>V>V>VAV>V>VAVAV>VATFTFVAVATFTFVAVATFTFVATFV'U6T<T<V'U6V'U6U6U6U6V;U6U6V;V;YHYH/(YUYUYU/(YUYU/(/)/*YUY7/*Y7Y7Y7/*/+YGYG/+YGYGYGYG/+YGYGYGX.YGYGX.X.YGYGX.X./(X.X.X.X.X.X./(X.X./(X.W=W=X.W=X.W=X.W=W=X,W=X,W=W3W3W3X,X,W3X,X,X,X,/#X+X+X,W;X,.ZX,W;X+X+W;W;WWWWW;X)W;X)X+X+WWWWX)WWX)WBX+X+WWWWWWWBWWWWWBWBWWVPWBWBVPVPWBW8WBW8W8W8W8VPW8W8VPVPW8VPUQT*XHXHT*V@XQXQV=U8U8V0.KV=V0V=V0V0V=V=TZTZV=V=TZTZTSTSV=TSV=V=TWV)TWV)TWV)TW.FV).FV).GV'V'V?V'V'U6V'U6V;U6V;V;V;V;U6V;V;U6V;V;UWV;V;V;V;V;U&U&Y4.@Y4Y4.@Y@.A.BXEXEY'.BYH.B.C.D.DYU.EYU.E.FY,Y,.F.GY,.H.H.IYU.J.J.KZ&Z&.K.LZ&Z&.LYV.M.N.N.O.PYG.P.Q.R.S.S.TYEYE.TYG.U.VYGY=YG.V.V.W.X.Y.Y.Z/#/$YG/$/%/&/&X./'/(/(X./)X.X.X./)WOX.X.WOVNX.X.WIWI/'/(VNVNWIWIVNVN/'X&/(/)X&X&/)X&/)WHVN/*WHWHVY/*X&X&X&/*X&W=X&W=/)/*/+/,WG/,/-/.W=/.W=W=W=W=/.W3W=W=W3W3W3X,W%W%W3W3W3W%W%X,W%/+X,X,/+X,X,X+X+X+X+WRX+WRWBWBW8W8V=V=/(V=V=U>XPU>/'U>U>U>V=/'/(/)TWTW/)/*U>U>U>/*TTTTU>TTTWV)TWV)TT/(TTTTTLTL/(TL/(TLTL/)/)TU/*/+V;V;/+/,V;U6V;V;V;/+/,/-V;TBV;TB/,UKUK/-U-U-U-/-TB/-V2V2V2V2U$UJ/,Y@Y@/-Y@Y@/-/././/YI/0/0/1/2/3YI/3YI/4Y,Y,/4Y,Y,/4/5/6/6/7/8/9/9/:/;/</<Z&/=/>Z&Z&/>/?/?/@/A/B/B/C/D/E/E/F/GY</G/HY<Y</H/IY/Y//I/JY//K/K/LY<Y</LYG/M/NY<Y<Y</N/N/O/P/QYGYG/Q/R/R/S/TZ%/T/UYGYG/U/VYGYG/VYQZ%/W/W/XWJWJ/X/YYG/ZVTVTVT/Z/ZX.WJVR/Z0#VRVRVTVR0#0$X.WOVRWOWOVNWOWOVRVRWPWPVNVNWPWPVY/XVNVNVYVYVNVNVYW=VYVYVNVN/VX(W=W=W2W2W=W=W2W2W2W2X(W2W3W3X'X'W2X'X'X'W3W3/QX'/QW%W%W%W%W%W&W&W%W%/P/QW&WUWUWU/PWUWUWUWUWUWU/PX,X,/PX,/PX+X+X+WU/PWUWU/PWU/Q/RX+WRX+WRX+WRX+/QWWW8WWWWX)WWX)X)U>/OU>U>TETE/O/PU>/PU>TT/PTT/QTT/QTLTLTLTL/QTL/RTUTU/R/STL/STL/T/TUP/UUPV;/U/V/W/W/XUPUP/XUPUPUP/XU-XLXLYBYBYB/XYBYB/XYBYB/XYB/Y/YYB/ZYBYIYI/Z0#YI0#YIYI0#YM0$0%0%0&YMYM0&0'0(0)0)0*0+0,0,0-Y*Y*0-0.0/0000010203Y*03Y*04Y9Y904Y9XVYRY9Y9YR03Y9Y9YG03Y904YGYG0405Y905Y906YGYG0607VQVQVWVQ06070809VWVW09XWVQVQVSVQWSWSWS08VSVS0809WSWP09WSWPWPWSVNVS08VS09WS090:0;0;VN0<0=VNVN0=0>0>0?0@0A0A0BW,W,VNVN0B0CVNX(X(X(0BX(X(X(X(W2WUWUX'X'WUWUX'X'WUX'X'X'X'0?X'WU0?WUWUWUWU0?0?0@WM0AWU0A0B0CWMWM0CWTX%0CX%X%0C0D0E0FU>0FXPV:0FUYV:U/0FTT0G0HUY0H0I0JTTTTUU0JTT0JTTTLTT0JTLTL0JUP0KUP0KUP0LUPXFY>XFS:0K0LS:S:YB0L0M0NS:0NS0S00NT'0OT'YM0OT'YC0OT'S0T&0OT&T&T&0O0PY*XVT&T&T&S9Y9Y9XV0O0O0P0Q0R0R0S0TVO0T0UW(0V0V0WVUVUVOVUWQ0WVUVUWQVU0VX#0WX#0W0XVU0Y0YX#X#X#X#0YX#X#0YVS0Z1#1#1$W7W7W7W71$W7W7W7W71$1$1%W71&1&1'1(1)1)1*W9W9W91*W91+X(X(W9W<X(WUWUWU1)W<W<W<WUWUW<WUWTWT1(1)V:1)UFUFU/U/1)U/TM1)TM1*UFULUF1*1*UE1+1,1,TL1-1.ULUL1.UI1.1/10UL10XNULXN10UPXNUPXNUPU.U.UPUPUP1/UP1/10UOX2S:1011S:S:SA11SASASASZSZS0SZS2S0S0S2S0S0T&S0T&S0T&S0S0T&T&SYT&T&1+T&S9T&S9T&S91*1+1,WQS91,S9S91,1-WQWQ1-X#1.X#1.1/WQWQX#X#1/X#1/10W+1111X#WEWE11W9X#12X#W9WEXXW9W9W9111112W<W<W912W<W<12W:W<1313WU1415WUWU15161617W<18WUWU18W<W<WU18X-18191:W<1:X-X-X-WUWUX-WU19WU1:WUWUWUWU1:WUWU1:WUWUWU1:1;WU1;WU1<1<1=WXX%UF1=XOUI1=UIUIUIUI1=UIUIUI1=UIU*UH1=1>TH1>TAU*V7U.U.TKTKU.UOU.U.XMXMV7TDU71;U7XMUOU'U.UZUZ1:XMXMV-1:XMXMV%1:XLTI1:T,UN1;1;SASASZXFSZS=1;SASZSZSZSZSZS=SZSZS2SZS2SZS2SZS2S0S0S2S2S0S0S016S0SYSYSYSXT&SXSXT&SHSXSHSXSHSXSH12SHSHSHSHSHSH1212WQSHWQ12WQS1S1WQ1213VMWQWQVMVMWQWQWQWEWEWEVMWEW<10W<XZW)10XZX-X-101112X*VXX*X*11VX12VX1213VX14VX14VX1515W0X*16WUWUW0WU15WUY$Y$Y$WDWUWD14WDWDWD14U*XNXN1415TYUAUVTDUVTDXMXM1415TD15TD16XL16TIU(TI16TITIS=16S=17S=17S5S<S2S2S217S<S<17SBS<1718S<S2S2S21818T#T#T#1819S-S-T#191:S.1:SYT#SY1:SY1;SK1;T$1<1=SYSYSK1=SYSXSK1=SK1=1>S@SXSX1>SX1>SXSX1?SXSXS3S3SHSHS3SFSH1=SFSFSH1=SHS/SHSFSFSF1<1=S/S/1=VM1>1?S/SUS/S/VMVMVMSUVMVMSUSU1<W'1=W'W<XZW<X-XZX-W<VXX-VXX-1;1;1<1=WK1=VXVXVXWKWKVXW0WK1<WK1=WDWDW0Y$ZHZGZHZGUVUVTDXMXMTDU+U+TD19TDTDTDTDTDUBTIU,TITCTITIUBUBTCTCUBTCU,15U,UXUXUXUXTJU,U,TCV+UXTJV+T@XKXK12XKSV12SVSV12S.13S.1314S.XESK1415S@SQS@SL15S@S@SLS7S3S3S314S3S3SJS3S@S7S713S3S313SOSFSFSO1313SOSOSOSOSOSO13S/S/SFS/12SG13SGSGSW13SWS/S/S/SUS/SUSUSUW<W4W4W4VX10W4W>10W>W>W>10W>1112W4W?12WLY$W?1213W?WD13W?W?WCWLWCWD12WCWCWCWCWCW5W5ZPW5W5ZPY%W5W5U+U+1/10U+U+10U=U=10U=U=TDTDU=U=TDUBTDUBU=U=U=TXTXUBTXUBUBV+UBUBUBV+UBV+T@U#T@U#1)U#1*U#U#U#1*U#SL1*S7S71*1+1,1-S71-S7SJSJSJSJSO1,SJSNSJ1,SOSJSOSJSOSOSOSO1+SO1,SO1,SOSO1,SG1-S>1-SWS>1.SWSW1.SWSUSUSWXW1-1.S>S>1.WLWLWLW4WLW4W4WLWLWL1-WLWCW4W4WCW5WCW5W5Y%W5ZSW5ZSW5ZSZ7Z7Z7ZBZZXIZZZ5Z=XHZOXHZOXHZ5ZO1%V*U=U=V*TXV*1%U=U<U=U<UB1$U<V$V$UBV$TPV$1#U<U<UBV+TPTPV+V+TPTPT@T@TPT-T-U#T-U#TPT-TPV.T-0V0WT=U#U#T=T=0V0W0X0YT=0YT=T=0Y0ZU@U@SNSNSN0ZSOSOSOSPSNSPSPSP0X0YSPSP0Y0ZSPSPSP0ZSP1#1#SR1$SRZ.Z.XWZ3Z3Z*Z3Z*W4W4Z,Y#W40YY$Y$WCW*WCW*W5W5Y%X>W5Y%X>Y%Y%X>XCX>Y%W5X>Y%W5ZSY%X;ZSZSX;XSZBZBZSXSZBZBZ;Z;Z>Z>Z>ZXZTXGXGZVZVZVZVZAU=U<0MU<V,0MV,0NU<U<U<0NU<T;0NT;TPTPU<TGTPTPTGTGT;0LT;TGTGTG0LTG0LV.V.V.0LV.0MV.0MT=0NT=SNSNT(T(SNSN0MT(T(SCT(SCSPSPSC0LSP0L0MSDSDSD0M0NSDSRSDSD0MSRSRSRSD0M0NSRXCX>XCX>XCX>XCX>X>0LX>X>Z;XTZNZNV,T/0K0LT10LT50M0MT;T0T00M0N0O0PT;T;0P0Q0Q0R0SV.T0T;T00S0S0T0UV.T(SCT(SCT(T(T(SET(SESESESCSCSC0R0RSESESESESE0R0SSESR0SSR0SSESESEXCX>XCX>XCX:XCX:X:X;X:XDX;X;XDXDX;X;XD0OX;X;0O0P0PT60Q0R0RT30S0TT2T0T70TT0T0T00TT70TT5T50T0U0VT.T00V0W0X0XV.UM0Y0Y0ZT.T.UMUMT.XL0YSESESEXCXCXCX?0XX:X?Y%X:XDX:0XX:0XX:0YXDXDXB0YXDXD0YXDV,V,V,0Y0YT5T5T5V,0YV,V,T.T.0YT.T/0YT/T/X:0YY%Y%XBXBX=0YXBXBX@X@V,0XV,T40X0YT4T4V&T4V&V&T4T40XT40XT/T4T4V&T9V&V&XLX9T9XLT9T9V&T9VIVFVIVFVDVGVDVGXJXJT9VHXFXFVHY&VHY&VHY&Y&SEY&SEY&SEY&SEVJVIVJVIVJVIVJVIVIVFVIVFVIVFVIVFVFVCVFVCVFVCVFVCVBVBVKVKVBVBVKVKVBVBVKVKVBVBVKVKVBVBVKXCVBVBXCXCVKXCVKXCVDVDXCXCVDVDXCXCVDVDXCXCVDVDXCXCVDVDXCXCVDVDXCXCVDVDXCXCVDVDXCXCVDVDXCXCVDVDXCXCVDVGXCVGXCVGXCVGT9VHT9VHT9VHT9VHVHY&VHY&VHY&VHY&Y&SEY&SEY&SEY&SEVJVIVJVIVJVIVJVIVIVFVIVFVIVFVIVFVFVCVFVCVFVCVFVCVKXCVKXCVKXCVKXCXCVGXCVGXCVGXCVGXMVHVGVHT9VHT9VHVHY&VHY&Y&SEY&SEVJVIVJVIVIVFVIVFVFVCVFVCVKXCVKXCXCVGXCVGYHYH/TYGYGX.YGYGYHYHYH/SYH/SYHYU/SY7Y7Y7XRY7/SYDY7Y7/SY7YU/SY7Y7Y7Y7/S/TY7/TYGYGYGYG/TYGYGYG/TY=YGX.X.X.X.X./S/TX.X.X&X&X,X,/SW3X,W;X,X,V=V=U8V=TWV)TWV)V)V?V)V?V)/OV)V)Y4Y4Y4/OY@Y@/OY@/O/PY4Y4Y8/PY@Y@Y'Y,Y'/PYHYHYH/PYHY3Y3Y3Y3/OY3Y3/OYUYUYUYUYUY3YUY3Y3/N/OY3Y3/O/PY3/PY3Y3YUYU/P/QY,/QY,/RYUYDYUYUYDY7YVYV/P/QYL/R/RYUY3Z&YUXRZ&Z&XRY;/QY;/QZ$Y;/RY7/RYVYVYLYLYL/RYL/RYLYL/R/SYVYG/SYGYGYG/SYGYL/TZ$Z$/TZ$Z$Z$Z$/T/T/UZ&/V/V/WYEYE/WYEYEYE/WYEYEYEYGYGYEYGYE/VYEYEYGYG/VYG/VY=/WYG/WY=Y=Y=Y=Y=Y=/WY=Y=YGY=Y=YN/VYNYGYGYG/VYGYGYG/VYG/VYGYGYXYXYX/V/V/W/X/Y/Y/ZYNYNYN/ZYN0#Y=X.0#X.YN0#0$0%X.X.0%X.0%0&0'0(0(X.X.X.X.0(X.WOX.X.VNVNX.WIVN0'0'0(0)X&WIX&WIWHX&X&WHWHX&X&WHX&WHWHWIWHWH0%VN0&0&WHVYVYX&X&X&0&WH0&WHWH0&WG0'WGWH0'VYVYVY0'VYVY0'0(W=W=0(WGVYWGWGW=WGW=W=0'W=W30'W3W3W3X,X,WUWUX,X,WUWUV=V=0%0&0&U>U>U>TWTWV=TWV=V=0%0&V=V=0&TOTWTW0&TWTWTWTW0&U>U>U>0&TLTL0&US0&TLTTTL0&TLTLTLTL0&TLTL0&V;TUTU0&TUTLTL0&TU0'0(TU0(TUTU0(V;TU0)V;V;UP0)V;UPV;UPUP0(UP0)V;V;UKUKUKU-UKU-U-0'U-U-U&V20'V2Y4Y4XEY@Y@Y@YIYIY@0%YI0&Y@Y@YIYIY@Y@Y@0%Y@Y'0%0&YI0&YIYIY'Y'0&0'0'0(0)Y,0)0*YIYI0*Y,0+0,YIYIYI0,0,0-YI0.Y,Y,0.Y,Y,0.0/00Y,00Y,0101YK02YK02Y,0304Y,Y,04050506YM070708YMYMY,08090:0:0;Z#Z#YM0;YMYM0;0<0=0>Z&Z&0>Z&YK0>0?0@0@0A0B0CZ&Z&0C0DZ&Z&0D0EZ#0EZ#0F0FY-0G0H0H0I0J0K0KY00L0M0M0NY0Y00N0OY00P0P0Q0RY+0RY/0SY/0S0TZ&0U0U0VY<Y<0V0WY<Y<0WYEY<Y<YEYEY<Y<0V0WY/Y/Y<0WY/Y/0W0XY/0Y0YY<Y20Z0Z1#1$1%1%1&1'Y<1'Y<Y<Y<YGYGY<1'Y<1'Y<Y<1'1(Y<Y<Y<1(YRYRY<1(1)1*1*Y<Z(1+1+1,YRYRZ(1,YRYG1,1-Y<Y<YGYG1-YGYG1-1.1/1/101112Z%Z%YGZ%Y<Y<111212YGYGYGYG12YG13Z%1314YG14YQ151616YQWJWJYQ16YQWJ16X.WJWJ1617YGYGWJWJY)17Y)Y)YGY)VTVTVQVQX.X.15WJX.X.X.15X.X.15X.1516VQVQ16VQVQVQVYVY16VYX(X(16X(X'16X'X'W3W316W%16W%WU1717WUWUWUW%WUWUWUWU16WUWU16X,WUWUX,X+X+X+WUX+WUWUX+X+WUWUWUWU13WU13X+14X+WRWRX%14U>TETETETETEU>U>TETETTTT11TTTTTTTETTTETETETE10TT10TLTLTLTL10TLTUTLTUTL10TUTU10TUTU101112121314U014151617U017U018U01819UPV;V;V;1919V;1:UP1:1;UPUPV;V;1;1<V;1<UPUP1<UPUPUP1<U-XLU-YBYB1<1=YBYB1=1>YIYI1>YI1>1?YBYB1?YB1@YB1@YBYBYB1@1AYBYB1A1BYBYBYI1BYI1C1CYM1DYMYIYIYI1D1DYM1EYMYMYMYM1EZ'Z'YMZ'1D1EZ'Z'YPYP1EYPZ'Z'YMYM1D1EYMYJ1EY+YPY+Y+1EY+1F1F1G1H1IY+1I1JYSYWYWY*Y*1I1JY*Y*1JY/1K1LY/Y/1L1MYTYT1M1NYTYT1NYT1N1O1P1QY/Y/1QXVYTYT1QY9YTXVY9Y9Y*1PY*Y*Y*Y*Y*1P1PY91QY9YRYGXVXVYGYG1PYGWZWZY9Y9WZWZWZ1OWZ1OWZWZ1OX/1P1QY91QY91R1RYG1SWZYGYG1S1T1TVW1U1VVWVWVW1V1V1WX#X#1W1XX#X#1XXW1YX#1Y1ZVSVSVSVSX#1ZVSVS1Z2#WSWS2#WSWSWS2#2$VS2$VSVSWSWYWS2$2$2%VSVSWSWSVSWS2$VN2%VNVNVNVN2%VNVN2%2&2&2'2(W#2(2)W#W#WY2)2*2+2+2,2-2.2.W,2/W,W,W,2/W72/2021W#W#W#W#X(20W#W#W#W#20W#W#W#W#X(X(X'X'WUWUX'WUWUWUWUWUWU2-WU2-2.WM2.WMWMWMWMWM2.2/WU2/WUWUWUWU2/WM2/20WMWM20WT21WTX%X)X%X)U>U>U>2020TTUYUYU>20U>U>UYUY20UYU>U>2021U>U>2122TT22UYTTUY22UYUYUY22UY23UY23UYUYU/23U/U/2324U/U/24TTTMUUTTTLTLTLTLTL23TL2324TL252526TLUPTL26TL27TL27TL2828YBYB29YBYB29YBYBYBS0S02829S:S:29S02:S0S0S0S:S0S0T'29T'29T'2:T'YMYMYCYCT'T'S0T'28T&T&T&Y*28Y*29Y9Y9292:2:2;WFWFY9Y92;Y9Y92;2<2=2=W(WFVZW(W(2=W(XV2=W62>2>W(2?2@2@2AS9W62AY9W(W(2A2BW(W(W(2BW(2C2C2D2EVU2EVUVUVUWQ2EWQWQ2EX#2F2GVU2G2HX#VU2HVUVUX#X#2HX#2HX#VU2IX#2IX#X#X#2IX#X#2I2JX#2KX#W72KW72KW7W7W7VS2KW7W7W72KW7W7X#2KX#X#W7W7W7W9W72JW7W72JW7W7W7W7W72J2KW,W,2KW9W7W9W9W92JW9W9W9W9W9W9W<W7W7W72I2IW92JW92J2KW92LW92L2M2NW<W<2NW<WT2NWTX%2NX%X%X%V:U/V:V:UFU/UFUFTMUUTMTMTMTMTM2KUFULUFUF2JTLTMUETM2J2K2LUEULULULTLTL2KTLUL2KULULTLTL2KTLULUIULUIULUL2JULUL2JULUL2JULUIUL2JXNUEXN2JUPXNXNUPUOUPUOUPUOUPUOUPU.U.U.X2SASASAS:S:SASASAS0SASZ2DS9T&S9S9VO2D2EVOWQWQWQS9WQS9S9WQWQS9WQVUVUWQWQW@2AWQ2BX#X#WQX#WQWQWQ2AWQ2AWQWQ2AWN2B2CX#X#2CX#WNX#W+W+X#2BW+2CW+2CW+WE2CX#2DXXX#2DX#2EX#W9X#W92DW<W<W<W92DW92E2EW<W<W<W9W<W9W9W<2DW<2EW<2EW<W<W:WUW:W:W:W:W<W<W:W:2CW:2CW:W:2DW<X$2D2EW<W<W<2E2E2F2GW)2GW)W<W)X$X$2GW<W<W<W<2GW<W<W)2GW<W<2GW<W)2GW)2HW<X-W<X-X-WU2GWU2GWUX-X-WUWUWU2GWUWUVXWUWUWUWU2FWUWU2FWUWUWU2FWUWUWXY$WXWUWX2EWXWXY$2EX%UFUFUF2EUFUI2EUIUI2EUIUIUHUHUIU*UHTH2DTHUH2DUHTHUH2DU*TAU7UZU7U7UZV-XMV-V-V%XMXM2AV<V5V52AV1U;2BU)U)TVUDXFSAXF2A2AS=S=S=S0SYSYSYS92@SHSHSHS1SHS1XWWQSHWQSHSHS1S1WQWQVM2=WQ2=VMVMW<W)W<W)W)X-2<X-WUWUX-X*X-X-VXVX2:X*VXVXVXVXX-VXX-29X-VXX*29VXVXVXX*VX29VX29VXVXWUWUVXVXVXVXY#WU27VXX*VX27W0X*W0WU27WUWUWXWXWXWDUI26XNXNU*V7TYTYV7V72526TI26TITITQU;26TITDTITITITITI25TIUDUDV6V4V#V#24TIS=S=242525S=S5S5S=S2S=S2S2S2S<S2XF23XFSBS<S2S<S-SBS<22SVS2T#S2T#S2S2S2T#S2S2S-S-T#T#2/T#S.2/S.S.S-S.S-2/SYSY2/SYSYSYSY2/2/SKSKSK2/T$SMT$S.2/S.SMT$SKT$SK2.SKSKSKSKS@SK2.2.S@2/SXSK2/SKS@SXSX2/SX2/SX20SXSXSXSXS3SHSHSHSFSHS1SHS/S/2-S/S/2-S1S/S/S1VMS1S1S/2,S/S?VMVM2,XWW<W<2,W'W<W'W'W'VXVX2+Y#VXVXVXWK2*VXWKWKVX2*VXVXX-2*X-VXX*W0WKW0WKW0W0W0TITITD2(U,XLU,UXTJXKTJT@SV2&SVSV2&S.S-S.2&S.XES.2&2'2(2)2)SK2*SKSKSKS@S@SKS@2)2*SQSQSLSLS3S3S32)S7SJS7SJ2(S3SOSOSFSF2(SOSOSOSJSOSOSOSO2'SOSGSO2'2'SGSGSGSG2'2(SWVXVXW>2(VXVXVXW>W>W>2'W>W42'W4W42'W4W4W4WL2'WLWLY$W$W?2'2'W?W?W?W?W?WC2'WDWDWDWCXMU+U=U+U+U+2%U+U+U+2%U=U=U+U=U=T@U#T@2$T-U#T-U#U#U#U#2#SLS7SLS7S71Z2#2$S7S7SJ2$SN2$XRSN2$SNSNSNS7SJSJSJ2#SJSJSJSJSJSJSOSO1ZSO2#2#2$SO2%SOS8SO2%SGSG2%S>2%S>S8S>2%SW2&2'S>SWS>S>SWSW2&SWS>SWS>S>SWXW2%XWWLWLW4WLWLWC2$WCU=V*U=U=V*V*V*U<UBUBUB1ZV$V$V$1ZT-T=T-T=1YV.V.V.U#V(1YT=V(V(T=1Y1YT=T=T=T=1YT=U@T=1YT=T=1Y1Z2#2$V(V(2$XJSNSNSN2$SO2$SP2%SPSP2%SOSOS>SPSPS>S>2$S>SPSPSP2$2$2%SR2&S6SRS6SRS6SR2%S6WCWC2%WCU=U=2%2&2&U<V,U<V,U<V,U<U<U<2%U<U<U<2%T;2%TGTGTGTGTG2%TG2%V.V.V.TGV.TG2%2%V.V.V.T=T=V.2%V.T=V.V.2$SNT(T(SPSPSC2$SPSPSPSDSPSDSDSDSC1ZSCSCSDSDSC1ZSRS6SR1Z1ZSRSDSRSDSD1ZSDX>X;X>X;V,V,V,T6T2T2T6T2T1T5T1T51VT5T5T5T51VT5T5T/T/T/1VT8T01VT0T21VT2T21VT0T/T0T0T0T01V1VT;1WT;1WTGT;TGTGV.V.V.T;T;T;1VT0T0T01VT;T01V1WT0V.V.V.1VV.V.V.SC1VSE1WSC1WSCSESE1WSE1X1XSESSSESESESE1XSESTSESEX;X;XDXDX;X;XDXD1U1VXDXDV,T6V,T6V,T6V,T31TT3T3T3V,T3V,T3V,T3T51ST3T31ST51ST01TT0T0T0T01TT7T0T71TT01T1UT.1UT.T.T.1UT.T.T.1U1V1WUMT01W1X1Y1YUMUMUM1YV.UM1Z1Z2#UMV.T.2#T.T.2#UMT.2$SE2$SESEXCXCX?2$2$XDXDXDXB2$XBXBXBXB2$XB2$2%XBXB2%XBXBXBV,2%V,2&2&T5T5T5V,T5V,T/T.T.2%T.T5T5T/T/2$XBXBXBX=XSX@X@V,2#V,T4T/T/T42#T/T/2#2$T4T4V&T4T/T/T4T4YHYH1Z2#YHYHYHYUYUYUYH1ZYUY7Y7Y7YUYDYUYDYDY7YDY7YUY7Y7Y7Y7Y7Y71VY7Y7YGYGY7Y7YGYGYGYGY7YG1SY=Y=Y=1S1TX&X&X&1TX&X&X,X,X,W3V?V?V)V?Y4Y4Y41R1RY@Y@1S1S1TY4Y4Y@Y@Y4Y4Y8Y8Y@Y@1R1S1T1UYH1UYUYUY3YUY3Y3YHYU1TYUY,1TY,Y,1TY3Y,1UY3Y31UY,Y3Y3Y31U1UYUY31VYUYUY,Y,Y3Y3Y,Y3Z&Z&1TZ&1TZ&1U1VXRYVYLYLYVYVYLYLYLYLYL1TYUYUY3YUZ&Y;Z&Z&Z$1RZ$Z$Y;Z$Y;Y;Y7Y7YVYVYLYL1PYLYL1PYLYLYVYGYVYVYGYGYV1OYGYG1OYGYVYVYLYLYLYGYLYLZ$Z$Y;Z$Z$Z$Z$YEZ&1KZ&Z&Z$Z$1KYE1KYEZ&YEZ$1KYEYE1KYEYEYEYLYLZ$YEYEYGYEYEYEYGYE1IYEYGYGYG1HY=Y=Y=Y=Y=YGYGYGYGY=1GY=Y=Y=1GY=Y=Y=1GYGYGYG1GYGYGYX1GYGYX1GYX1G1HYQYN1H1IYGYGYN1IYGYGYGYGYG1IYGYGYG1IYXYX1IYNYXYN1IYNYNYNYN1IYNX.X.X.Y=Y=1HYNYNX.YNYNYNYN1G1HYN1HYN1IX.X.1IX.1IYGYGYGYN1IYG1JYGYGYG1JX.X.1JX.X.1JX.X.X.1JX.WOVN1JVNVNX.X.X.1JX.X.X&X&X.1IX&X&WHWH1IWHVYVYVN1IVYWHVYVYX&X&X&WGX&WHWHWHWGWG1FWGWHWGWHWGWHVYVYVYVY1DVYVYWGWGWGW=W=W=1CW=WGWG1CWGW=1CW=W3W=W=1CW3V=V=V=1CV=V=1C1DV=1DU>U>V=V=U>U>V=V=U>1CV=V=1CU>TWTWTTTTTWTWTTTTU>TEU>1ATT1ATTTT1A1BTLTL1BTLTLTLTL1BTLTLV;1BV;V;1BTU1C1DTUTUUGTU1CUG1D1ETUTUTLTLTU1DTUTU1DV;TUV;V;V;TUTU1CUKUPUKUP1CUPUKUP1CUPUPU-U-U-1CTBTBTBV2Y@Y@Y61B1BY6YI1CY@Y@1CYIYI1CYI1D1D1E1FY.YI1FYIYI1F1GY.Y.1G1HY.Y.Y'Y'1H1I1I1J1KY,1K1L1M1N1NY.YI1OY.Y.1OY.Y.Y,1O1P1P1QYIYI1QY,1R1S1S1TZ)Z)YI1T1U1V1VZ)1WZ)1W1X1Y1ZY,Y,1Z2#Y,2#Y,2$Y,Y,Y,2$Y,2$2%2&2&2'2(YKY,YKY,Y,2'YKYKYKYKYKY,YK2&Y,2'Y,2'2(Z)Z)2(2)Z)Z)2)2*2+Z#2+Y,Z#2,Z)Z)Z)2,Z)Z)2,2-YM2-YMYMZ)2-2.2/2/YMYMYMY,Y,Y,2/2/202122Z#22Z#Z#22Z#Z#Z#2223Z#Z#2324YMYM242526272728Y?Y?2829Z'Z'Y?Y?Z'Z'Z&Z&2829YKZ&YKYKYKYKYK28YKYK282929Z&YKYKZ&Z&292:YKYK2:2;YK2;2<Y-2<2=Y-Y-Z&Z&Y-Y-2<2=Y-Y-2=Z&Y-Y-Z#2=Z#Z#Z#2=2>2?2?Y-2@2AY02AY0Y02A2BY0Y0Y?2BY?Y?2B2CZ'Z'2C2DZ'Z'Z'Z'2D2EY0Y0Y02EZ'Z'Z'2EZ'2E2F2GY-Y-2G2HY-2H2I2J2J2KY0Y02K2LY0Y0Y0Y/2LY/Y0Y02L2MY0Y02M2N2NY+2OY+Y02OY/2PY/Y/Y+2PZ&2PZ&Z&2PYEYEYE2PY<Z&2QYEYE2QY<YEYEY<Y<Z&Z&2PY<2PY<Y<Y<YEYEY<YEYYYY2OYYYYY<2O2PY<Y<Y<2PY<Y<Y/Y/Y<2OY2Y2Y2Y2Y/2OY<Y<2O2P2PY<Y22QY2Y2Y22QY22QY<Y<2QY<2R2SY<Y<2SY/YEYEYE2SYEYEY<Y<2R2SY<Y<YGY<Y<Y<YGYGY<Y<Y<2QY<Y<2Q2RY<Y<2RY<Y<Y<Y<Y<Y<2RY<Y<2R2SY<2SY<Y<2SZ(Z(Z(Y<Y<Z(Y<Z(Y<Z(Y<Y<Y<2QY<Z(Z(Y<Z(Z(Y<XVXVYGYGY<2OYGYGY<YGY<2NY<YGYGYGYGYQYGYG2MZ%2M2NZ%Z%YQ2NYQYQ2NYQYQYQYQYQZ%2NYQYQZ%Z%Y<2MY<Y<2MYGYGYGY<2M2N2O2OZ%Z%Z%YG2OYGYGZ%Z%Z%YG2NYGYGYG2NYQYQYQYQYQ2N2OYQYQ2OYQZ%WJ2OWJYNYNYQYQYNYNYN2N2N2OYGY)Y)WJY)Y)Y)VTY)Y)WJ2MWJWJX.X.VRVR2LX.VRX.VTVTVT2LVTVT2L2MVTVT2MVQVYVYVNVNX(X(2LX(2L2MX'X'2MW%W%W%W%W%W&W%2L2MWUWUW%W%2MWUWU2MWUWU2MX,X,X,WUWUWUX+WUWUWUX+2KX+X+X+WRWRX%X%2JTT2KTTTT2KTTTTTTTTTT2KTLTUTLTU2J2KTL2L2LTUU0U0TUTU2L2MTU2MUPUP2MV;UPUPTLTLTLU0TLU0U0U0TL2KTL2LTLU0TL2LU0U0U5U0TL2KTLTL2KU22LTLU0UPU0UPU02KU02LU0UPUPUP2K2LUPUPV;V;V;2L2LV;V;V;V;UPUPUPV;V;V;UPV;2JUPUPV;V;UPUPV;V;UPUP2HUPUPUP2HUPUPUPUPUKUPUKYB2GY>Y>Y>2GY>Y>2G2HY>Y>YBYB2HYBYIYI2HYIYB2HYBYBYIYIYBYBY>2GY>2HY>2HY>YBY>2HY>YBYIYIYBYBYIYIYB2GYIYI2G2HYIYI2H2I2IYM2J2KYI2KYIYIYMYM2KYM2KYMYIXRYIYIYI2K2KYMYIYMYIYMYIXR2JYMYMYMZ'2JZ'Z'YPYP2JYPYPYPZ'2JZ'2JZ'Z'2J2K2L2M2M2N2O2PY/Y/Y+Y+Y+2OY+Y+YJYJYJ2OYJ2OYW2PYJ2PXRYWYWYWYW2PY+Y+2PY+2P2QYSYS2Q2RYWY*2RY*Y*Y*2RY/Y/Y/2R2S2TYTY/Y/YTYTY/2SYTYT2S2TYTYTYSYTYSYTYTYTYTY*YTYT2RYTY/Y/2RY/Y/Y/2RY/2RYTYTYTYT2RYTYT2R2SYTYT2SY92TY9Y*Y*Y*Y9Y*2SY*Y*Y*Y9Y9Y92RY9Y*Y*YGYGYG2RWZWZY9WZYGYGWZWZY92PY92QY92QY9Y92Q2R2SX#2SX#X#X#Y9X#Y9X#YGYGWZYGWZWZ2QWZYGYG2QYGYG2QYGVWX/VWX/VWX/X/2PX/VWVWX/VWVWVW2OVW2O2PX#X#2P2QX#X#2QX#X#X#X#VWX#2QVWVW2QVWX#VWX#X#WSWSVSVSWSWS2O2PVSVSX#X#VSVS2OVSVSVS2OVS2OWS2PWSVS2PVSVSWSWSVSWSVS2OVSVSWSWYWS2O2O2PVS2QWSWS2QWSVNVN2QVNWP2QWPVNVNVNVN2QVNVN2QWYWYW#W#W#2PVNW#W#VNVNW#W#W#W#2O2PVNW#W#W#W#2OW#W#2O2P2QWYWYWY2Q2R2R2S2TW,WY2T2U2V2V2W2X2Y2Y2ZW#3#3#3$W#W#W,3$WS3%WS3%WSW,W,W,3%W,3%3&3'3(3(3)3*3+3+3,W#W#3,3-W#W#VNVNW#W#3,WUWMWMWUWU3,WMWU3,3-WMWU3-WMWMWMWMWM3-3-3.3/WTWUWUWU3/WUWUWU3/WU3/WMWM3/X+WMX+WMWMWM3/3/30WTWTU>U>U>30U>TTU>UYU>3/U>3030UYUYUYU>30XPV:3031V:V:V:31V:V:V:31V:U/TTTT31TT31TTUYUYTTTTUYTTUYTTUY30UYTTUYTTUYUYU/3/UYUYU/U/UYTT3.U/3.3/UUUU3/TLTLTLTL3/TLTLUPUP3/30TLUPTLUPTLTLTL3/3/UPUPUPUPUP3/UP3/UP30UP30UPTLUPTLUPUPUP3/YBYBYBYBYBS:3/3/YB30S:S:30S:S:S:S0S:30S0S030S030S0S0S0S030S031S0S0S031S031T'T'T'T&31T&Y9Y93132Y*32Y*Y*32Y9Y*XV32Y9Y*Y9WFW-WFWFW-31WF32Y9Y9W-W-Y9Y93132Y932333434W(W(W(W-W-34WF34353637VZVZ373838393:W/3:W(3;W(3;3<VOVOW(W(VOVOW.3;S93<3<3=W63>Y9Y93>3?Y9Y9Y9W(Y93>W(W(W(W(W(3>W(3>VUVU3>Y9W(W(3>3?VUVU3?VUVUVU3?3@VUVUWQVUWQWQX#X#3?X#3?X#VU3@X#X#3@X#3@X#X#X#VU3@3A3B3BX#3CX#3CX#VU3DVUVUVU3D3DX#3E3FVSX#X#X#3EVSX#X#VSVSVS3EVSVS3EVS3EVSX#VSX#X#X#W7VSVSW7W73C3DW7W7W73DW7W7W7W7X#3DW,3DW7W73DW7W7W7W7W7W73DW7W73D3EW7W93EW9W7W9W9W9W73DW7W7W73D3E3F3FW9W9W9W93FW93G3GW<3HW<W93HW9W9W93H3I3JW93JW93K3KW<W<W<W<W<3KW<WTWTWT3KWTY%X%Y%TMTMULULUU3IUUUUULUEUL3ITM3ITMUL3IULULULUE3IULUEUETLUE3ITLTLUE3IULUL3IUL3I3JUEUEUIULUI3J3JTLUEUETL3JXNUPT&S9T&3JS9S9S93J3JWQWQWQW@3JW@W@W@W@WQ3JWQWQWQ3JWQ3JWQWQVVWN3JWNWNWNWQWNWNWNW+W+X#X#WEX#X#3GW+3HW+W+W+WE3G3HWEWEWEX#3HX#3HXXWEWE3HW7X#3IX#3IX#X#W9W9W9W<W9W9W93HW9W<W<W<3GW<W<W<W<W<3GW:3GW:W<W<W<W:W<W<3F3GW<W<W:3GW:W:W:W:3GW:W<W<3GW<X$X$W<W<W<W<W<3FW)W)3F3G3GW<W)W)3G3H3IW)3I3JW<W)X$X$W<W<W<W<W<X-W)3HW)W)3HW<W)W<W)W)3HW<W)W<W)W)X-WUWUWU3FWUX-X-WUWUVXVXWUWUWU3EWUWU3EWUWUWU3EWUWUWXWXWXWXY$WXX%UFUFT>3CUFUFUIUIUI3BUIUIUH3BUH3CUHUH3CTHTH3CTHTAV%3CV%V5T+T+T+3CV3T,3CT,XFSASA3CSZSZ3CS=S9S9SHSH3BWQVMVMWQWQVMVM3AX-W)X-X-3AVXVXVXVXX-VXX*X*3@3AVX3AVXVXVX3AVXVXVXVXX*VXW0W0X*W03?3@WUWUUI3@UIU*TYV7TYV7V7V7V7UAT:T:3>T:3>TQTITITDTDTD3>3>V#TITIS=S=3>S4S=3>3?3@S=S=S=3@S<S<XFSBSBSBSBSVS-T#S-S-T#3=S.S.3=S.S.S.T#SYT#T#SYSYSKSKSYSKSKSKSMT#SM3:SMT$SMT$SYSKSKSKSK38SKS@SKS@SKS@37S@S@S@SKS@SKS@36SXSXSXSXSX36SX36SXSXSXS1S1S/S/S1S1S/S/S1S1S?S?S?S?33SUW<W<W<W'32VXVXVXVXVXWKWKVXWKVXWKX-VXX-VXTITITD3/3/S-S-S-S-S-S-S.S-S-S-S.S.3-S.3.SMSMSM3.S.3.S.S.3.3/30SMT$T$T$30T$30T$XESKSKXRSQS@S@SQS@S33.S3S3S3S33.S33.SOSOSOSOSOSO3.3.SG3/SGSOSO3/SGSGSWSWSW3.3/SGSWW>VXW>W>W>W>W43.W43.W4W4W>3.W43/W?W?WLW?W?3.W?W?Y$W?W$3.W?W?WCWCU+U+U=U+U+U+U+U=U#U#3+U#U#U#U#3+S7S7S73+S73+XRSNSNSJ3+SJ3+SJSJSJ3+SJSNSN3+SJSNSNS7S73+SJSOSGSO3+SO3+3,SISOSOSO3,SISISI3,S8S83,S8SOS>SOS>3+S>SISISI3+3,3-3-SWSWSWS>3-S>S>3-SWS>SWSWSW3-SW3-S>S>S>3-WCWCWCUB3-V$V$V$V$V$3-V.3-V.V.V(V(T=3-V(V(3-U@T=3-T=T=3-U@T=U@T=U@T=T=V(U#3,V(3,U#V(V(V(V(3,V(V(V(V(U@3+V(U@U@SN3+SNSOSOSO3+SOSP3+SPSP3+SO3,3-S>S>SP3-SPS6S6S6SPSPSP3,S6S6S63,SR3,SR3-S63-SRSRW4WCW4WCU=U=U=3,U=V,V,V,V,U<V,V,U<U<3*T5U<U<T5T53)TGTGTGTGTGTG3)TPTP3)V.TGV.3)V.TG3)TGV.V.T=T=T=SNSNT(T(SD3'SCSDSCSDSCSDSDSDSE3&S6S63&SRSD3&SDSDSDSD3&SDT53&T5T5T5T;T53&T/3&T/T/T83&T8T0T/T/T2T/T/T03%3&T0T0T03&T;T;3&T;3&3'T;T;T;3'T;TGT;3'T;T0T03'3(V.3(T0T0T0T0T0V.V.T0V.3'V.SC3'3(SESCSESESESCSCSC3'SESESE3'3'SSSSSSSESESSSSSESE3&ST3&XDXDXDXD3&XDXDT3T6T3T3T53%T53&T3T33&3'3'3(T73)T7T0T7T0T0T0T03(T0T0T5T5T0T03'T.T0T.T5T.T03&T.T.T5T.T5T.T03%3&UMUM3&UMUM3&UM3'UMT03'T03(T0T03(T0T03(T0UM3(UMUMUMV.V.V.3(V.V.UMUMUMV.UMUMV.V.3&V.3&UMT.T.UMUM3&UMUMUMT.T.3%SSSESEXCX:X?X:X:3$X:XDXD3$XBXBX:XB3$XBXDXD3$XBXDXDXBXBXD3#XB3$V,T5V,T5V,T5V,T5T5T5V,T5T5T.T52Y2YXBX:XBV,V,V,T/T42XT4T42XT4T4T4T42XT4T4YHYH2XYGYHYH2X2YYHYUYUYUY7Y7YGYGYGY=Y=Y=2V2WX.X&2W2XX&X&2XX.X&X&Y42X2YY@Y4Y42YY@Y@Y@2YY@Y@Y42YY4Y42YY4Y4Y'2YY'Y'2YY,2ZY,Y'Y'Y'2Z2ZY,3#Y,YH3#YUYUYHYH3#YHY3Y3Y,Y,Y3Y3Y,2ZY,2ZY,Y,2ZY,Y,Y,Y3Y3Y,Y,Y32YY3Y32YYUYUYUY,Z&Y,Z&Y,2X2Y2Z2ZZ&Y,Y,Z&Z&2ZZ&YLYL2Z3#YLZ$Z$Z$YLYL2ZYLYVYV2Z3#YV3#YVYG3#YGYGYGZ&Z$Z&Z&Z&YEZ&YEZ&YEZ&Z&Z$Z$YEYEYEZ$YEYEYE2VYEYE2V2WYGYGY=YGY=Y=Y=Y=YNYNYNYN2UYN2UYGYXYXYGYGYXYXYG2TYGYGYXYNYX2TYNYN2TYNYG2TYGYG2TYNYGYGYNYN2TYGYGYGYNYNYGYGYG2SYXYNYNYNYN2RYNYNYN2R2SX.Y=Y=YNYNYN2RYNYG2RYNYNYNYNYN2RX.2RX.YNYNX.X.2RX.YNYGYGYGYN2QX.X.2QX.X.X.YGYGYG2Q2QX.2RX.2RYGX.2SX.X.2SX.WIWIVNWIX.X.2R2SX.X&X&X&WHWHWHVYVYVYVNVYWHWGWHWHWGWGVYWG2NW=W=W=WGWGVYWG2MW=W3W3W=W32MW3V=2MV=U>2M2NU>U>2NV=U>U>U>U>2NU>2NV=U>U>V=V=U>U>2MTETETETLTLTTTTUT2LUTUTTLTLUTTLV?2KTLTLTLTUTL2KV;V;2K2LTUTUUGTUTL2KTLTLUG2KTLTL2KUGTLUGTLTLTL2KUGTU2KTLV;V;TU2KV;V;2KV;UKUK2KUKUPUK2KUKUPUKUP2K2KU$U$U$Y6YIY6YIY6Y6Y62JY:Y:YIYIY@2IY@YIY.Y.2IY.2IY.YI2JY.2JY.Y.2JY'2K2LY.Y.2L2M2M2NYI2OY'Y'2O2P2P2QY.Y.2Q2RY.Y.Y'Y'2R2SY'2SY'2T2T2U2VY,2V2WY'2X2XY,2YY,2YY,Y,Y,Y'Y'2Y2Z2ZY,3#Y,3#3$3%3&Y,Y,3&Y,Y.Y.3&3'Y.Y.YIYI3&Y.YI3'Y.YA3'3(Y,Y,YAY,3'3(YIYI3(3)YIYIY,Y,3)Y,3)3*YIYI3*YIYIYIYIYIYI3*YIYIZ)YIYIZ)Z)3)YI3)YI3*3*YI3+YIZ)Z)3+Z)YIZ)YI3+YI3+YI3,3,YM3-YMYIYI3-3.YMYM3.YM3.3/YIYI3/Y,303131Z&32Z&32Z&33Z&Y,Y,3334Y,Y,Y,34Y,3435YK3536YKYKY,Y,Y,YKY,35YKYK35YKY,YK35YKYKYKYI35YI3636Y,37Y,3738393:3:3;3<Z)3<3=Z)Z)3=3>Z)Z)3>Y,3?3@Y,Y,Z#Y,3?Z#Z)Z)Y,Y,Y,Z#Z#Z#Z#3>3>YM3?YMZ)Z)YM3?Z)YM3?YM3?YMYMYMZ)Z)3?3@3@YMYMYM3@3AYMYMZ)YM3AYM3A3BY,3CY,Y,Y,3CY,Y,Z#Z#Z#Z#Z#YMZ#Z#YMYMY,3@Z#Z#Y,3@3AZ#YKYKZ#Z#YKZ#Z#Z#YMZ#YMYMZ#Z#YMYMZ#Z#YMYMZ#Z#3<3=YMY?YM3=Y?Y?3=Y?Z#Z#3=Z#Z#Z#Z#Y?YM3<3=3>3>Y?3?3@YKZ&YKYKZ&Z&3?Z&YKYKZ#YKYKYK3>YKYKYK3>3?Z&Z&YKYK3>3?YKYK3?Z&3@3AYKYK3A3BYKYK3BY-YKYKY-Y-YK3AY-Y-Z&Z&Y-Y-3@Z&Y-Y-Z&Z&Y-Y-Z&Z&Y-Y-Z&Z&Y-Y-Z#3=Z#Z#3=3>Z#Y0Z#Z#Z#3>3>Y03?Y03?Y-Y-Y-3?Y-3@3AY-Y-3AY-Y03AY0Y03A3BY0Y03B3CY0Y03CZ#Y?Y?3C3DY?3E3EY03FY0Y?Y?Y?Z'3EZ'Z'Z'Z'Z'YPZ'Z'Z'YPYPY0Y03CY0Z'Z'YPZ'Y0Z'Z'Z'Z'Z'3A3BZ'Z'Z'3BY-Y-3BY03BY0Y0Y0Y-Y-Y-3B3BY0Y0Y03BY0Y0Y0Y-Y-Y0Y0Y-Y-Y0Y0Y-Y-3@3A3A3B3C3DY03D3EY/Y0Y0Y03EY03EY03F3FY0Y+Y+Y03F3G3HZ'Y+Z'Y+Z'Y+Z'3GY0Y03GY/3GY/Y/Y/Y/Y/Y+3GZ&YEZ&3GYEYE3GYEZ&Y<Z&Y<Y<Y<Z&Y<YE3EY<Y<Z&Z&Z&3EZ&Z&Z&Y<YYYYY03DYYYYY/3DYYYY3DYYY<Y<Y/Y/Y<Y<3CY<3CY2Y/Y/3CY<Y2Y2Y<Y<Y23C3CY<3DY<Y<Y<3DY<Y23DY2Y2Y23DY23EY2Y23EY23EY<Y/Y/3E3F3GY/3GY/Y/Y/YEY<Y<Y<3FYEY<Y<YEY<Y<Y<Y<YGY<Y<YGYGY<Y<3CYG3DY<YGYGYG3DY<Y<Y<3DY<Y<Y<Z(Y<Y<Z(Z(Y<Y<3B3CY<Z(3CZ(Y<Y<YRYRYGY<Y<Y<Y<YGY<3AYG3AZ%Z%YGYG3AYGYQYQZ%YQ3@3AYQYQ3AYQYQYQ3AZ%Z%Z%Y<Y<Y<YG3@3AYGYGYGYG3AYGY<Y<Y<3A3AYGYGYGYG3AZ%Z%YGZ%YGYGZ%Z%YGYGYG3?YQYQZ%YQZ%YQYQYQYQZ%YQYQ3=YQZ%Z%WJWJ3<X.X.X.Z%Z%Y)Y)3;3<Y)Y)WJ3<WJWJX.X.3<X.VTVTVT3<VTVT3<VQVT3<VQVQ3<VQVQVQ3<X(3=X(W3W33=X'W3W33=X'W3W%W%W%3<3=WUWU3=WUWUWUW%W%W%WUWUX,WU3<X,X,3<X,WUWUWU3<U>TTU>3<U>3<U>TTTETETTTTTTTLTLTLTUTUTU3:TUTUTU3:3:U0U1U0TUTU3:3;TUTUTU3;TUV;3;V;TUTU3;3<TU3<3=UP3=U0TLU03=U03>U03>U53?U5TLU3TLTLU5U5TL3>TL3>TLTLUPUP3>UP3>UPUPUPU9U9U93>3>3?3@3AV;UP3AUP3AV;3BV;3B3C3D3EV;V;3E3F3FUPUPUPYB3F3GY>YBYBY>3GYBYB3GY>YBYBY>Y>Y>3FY>3G3GYI3HYBYBYIYBYBY>YBY>YBY>YBY>YBYBYBY>YBYBYB3DYB3D3EYBYB3EYI3FYBYIYI3FYB3F3GYBYBYIYBYBYB3F3GYIYIYIYMYIYIYMYM3FYMYIYIYI3FYMYM3FYM3FYM3GYMYIYIYI3GYIYMYIYI3F3GYMYMZ'YPZ'Z'Z'YPZ'3FYPYP3FYPZ'3FZ'Z'YPYP3F3GYPYJYPYJZ'3FZ'Z'3FYJZ'YJZ'3FYP3G3GY+3HY+YP3HYPYPY+Y+YPY+Y+3GY+3HYJYJ3HYWY+Y+3HY+Y+Y+3H3I3IYW3JYWYW3JYWYWY+Y+3JYSY+3JYSYS3JYSYSYSYSYSYWYSYSYS3I3JYSYSY*Y*Y/Y/3IY/YT3IYTYT3IY/YTYTYTYTY+Y+Y/Y/YT3HY/Y/3HY/3H3I3JYTYTYTY*Y*Y/Y/Y/3IY/Y/3IY/YT3IYTYTYTY/YTYTY/Y/YT3HY/Y/3HY/YTYTYT3HY*3HY*3IY*3IY*Y*Y9Y9Y*Y93HWZWZWZWZX/3HX/Y9X/X/X/X/X/Y93GX/X/3G3HX/X/3HX/Y9Y9Y93HX#X#Y9X#WZWZWZVWVWYGVW3FYGYGYGVWX/X/3EVW3EVWX#X#3EVWX#X#VWVW3EVWX/X/VWX/3DVWX/X#VWX#X#X#VWVW3CVWVWVW3CVWWSWSVS3CWSWS3CWSVSVSX#X#VSVS3BVSWSWS3BWSVSWSVS3B3BWSVSWSVS3BVSVSWS3BWS3CWSWSVS3CWSWS3CWSVS3CVSVS3CWSVSVSVNVNWP3C3CVNVNVNVNVN3C3D3DWY3EWYVNVN3E3FW#W#3F3GW#W#3GW#3G3HW#W#VNVN3H3I3IWYWYWYVNWYWYWY3H3IW,W,WYWY3I3J3J3KWYWY3K3LW,W,WYW,3LW,WYWYWY3LW,3LW,W,3LW,W,W,WYWY3L3MWY3MWYWYW,3M3N3O3OWYWY3P3P3QW#W#3QW,W#W#W#W#W,W,W,3P3Q3R3R3SW#3TW,W,3TW,WSW,3TW,3TW,WSWSW,W,3TW,3TWYWYWY3T3UWYWYWYWY3UWYWYWYWY3U3UW#WY3VW#W#3V3W3W3X3YW#3Y3ZW#W#W#3ZW#W#3Z4#W#W#VNVN4#4$VNVN4$4%WUWUWU4%WUWUWUWM4$4%4&WMWU4&WUWM4&WMWMWMWM4&WTWTWMWMWM4&4&4'WTWT4'WTWTWTWU4'WUWUWUWM4'WM4'WUWMWMWUWU4'X+WMWMWM4'WT4'WTWT4'WTWTWT4'UYU>UYU>UYU>4'4'4(U>UYUYUYU>UYU>U>V:V:U>U>4&4'U>U>V:V:4&4'V:V:4'4(4)UY4)TTTTTTUYTTUYTT4(TTUYTT4(U/U/U/4(U/U/U/UU4(UUUU4(TT4)TT4)TLTLTLTL4)TLTLTL4)TLU:4)UPU:UPTL4)TLUPTLUP4)UPUPUP4)UPUPUP4)4*TLUP4*UP4*UPTLUPYBYB4*YBYBYBS:S:YBYBYB4)YB4)S:S:S:S:S:4)4)4*S:4+S0S04+S04+S0S:S0S0T'S0S0S0T'S0T'S0S0S0T'S0T'T'T'T'T&T'T&4&Y9Y9Y9Y9Y94&Y9Y*4&Y*Y*Y*Y9Y*XVY9Y9Y94%W-W-4%W-4%4&WFWFY9Y9W(W(Y9Y94%Y9Y9Y9Y94%W(4%W(W(Y9W(W(W(W(W(4$W(4$WFWFWFVZ4$VZVZ4$4%VZVZVZVZVZ4%VZVZ4%W(W6VZW6W6VZ4$W6W6W6W6W64$W6W64$4%W64%W64&VZ4&4'W(4'W(W6W(4'4(VO4)W(W(4)W(W6W6W.4)4)W6W6W6W6W6W6W/4(W/W/VOW6VOW64(Y9Y9W(W(4'Y9W(W(Y9Y9Y94'W(4'W(W(W(VU4'VUY9Y94'Y9Y9Y9W(4'Y9Y9VUVU4&VUVUVUY9Y9VU4&Y9Y94&VUX#X#4&X#VUX#VU4&X#X#VUVUX#X#VUX#4$X#VUX#4$X#X#X#VU4$VU4%4%X#4&X#X#X#VUX#4%X#VUVUX#X#VU4%VUX#VUVUVUX#VUVUVUX#VUX#VU3Z4#VU4#X#4$X#X#VSX#X#VSVS4#4$VSVS4$4%4%4&X#VSVSVSVSW7VSVSW7W74$WS4%4&X#W7X#X#4%W,4&4'4'W7W7W7W7W74'W9W7W7W9W9W74&W9W9W9W9W7W9W7W7W74%4%4&W7W74&4'4(W9W7W9W9W94'W9W9W9W94'W9W9W94'W9W9W<W<4'W<W<W<W9W<4&W<4'W9W<W<4'W<W9W9W94'W<W<4'W<W9W9W94'W94'W9W<W9W<W<W<W9W<W<W<WTWTWTX%TLTL4$TLUEUEULUETMTMTM4#TM4#TM4$UETLUE4$UE4$UEUETLTL4$TLULUL4$UI4$4%UEUETLTLUE4%UIULUIULTLTL4$UETL4$UPUPS9S9T&S9S94#S9WQ4#WQWQWQ4#4$W@VU4$WQWQWQWQVV4$VV4$VVWQVVVVWNWNWNW+WEW+4#W+4#W+W+W+4#W+WE4#WEWEWE4#W+W+W+4#W+4$WEW7W74$W9W9W94$W94$W9X#W9W9W9W94$W9W<4$W<W<W<W<4$W<4$W<W<W<4$W<W<4$W:W<W:4$WUW:W:W:W:4$W<W<4$W<W)W<4$W<W<W<4$W<W<W)W)W<W)W)W<W)W)W<W<3ZW)3Z4#W)W)W)W)4#W)W<4#W<W<4#W)W<W)W<W<W)W)W<W<W)W)3Y3Z4#4$X-WUX-4$WUWU4$4%WUWU4%WUWUWU4%4&UFUF4&UIULUL4&UIUHTH4&TH4&THTHTHUHTHTHTHTHTHTA4%V5V<V54%4%4&4'4(V3V3V3T,SA4'SASZSZSZS=4'WQWQ4'WQW)W)W)X-4&X*VXVXX*X*VX4&X*X*4&VXX*X*4&4'VXX*4'X*WU4'4(WU4(W14)4*4*U*UIU*T:T:TI4*TQTQTITI4)TITDTIV#V#TITIS4S4S44(S=S=4(S4S44(S=S=S4S=S=S=S=S=S5S54&4'S.S.S-S.4'S.SMT$SMT$S@4&S@S@SKS@SKS@4%SXSXSXS@SX4%SXS@4%SXS@4%SUSUSUX-VXX-VXTDTDTD4$S-S-SVS-S.SM4#SM4#SM4$SMSMT$SMT$S.SMS.S.SMSM3Z4#SM4#4$4%S.SMS.S.T$T$T$4$T$4$T$T$S3S3S34$S3S3S34$SFSFSOSFSO4#SOSGSGSG4#SG4#SGSOSGSOSOSOSGSGSGSG3Z3ZSW4#SWW>W>W4W4W>W>W4W>W>W>3Y3Z3Z4#W4W4W?W$W?W?W$W?3ZW$U#U#T-3ZU#U#V(U#S7S7SNS7S7S7S7SNSNSJSNSJSJ3VSJSJ3VSJ3W3XSJSJSNSN3W3X3YSJ3YSG3ZSGSGSGSG3ZSO3Z4#SISO4#SO4$SI4$SISI4$S8SOS8SGSG4$SISISISI4$4$S8S84%S>4%S>S>SGSWSGSWSWSWS>4$SWSW4$SW4$SWS>SWSWS>S>S>WLWC4#WCUBV$V$V$V$3ZV$TPV.T-V.V.V(V(3Y3ZV(V(3Z4#4#4$T=T=T=4$T=T=V(U#V(V(U#U#U#4#V(V(U@4#V(V(4#V(SNSOSNSO3ZSOSPSO3ZSOSPSPSOSOSPSOSPSPSP3YSOSOSPSOS>S>SP3XSP3XSPSPS6S63XS63XS6SR3YSR3YSRSRS6S63YS6U=3YV,V,3YT1T1T5U<U<U<3YTGTG3YTGTPTPTP3YTGTGV.V.TG3XTGV.3XSPSDSDSESDSESES63WSRS6SD3WSDSDSDSD3WSE3WT1T5T5T03WT0T0T8T8T/T8T8T0T8T0T/3UT/T/3UT0T/T0T0T0T03UT;T;T03UT03UT0T03UT;T;T;3UTGT;TG3U3VT;3W3WV.V.V.3WV.V.V.T;3WT0T03WV.V.V.SCSC3WSESCSCSC3WSCSESESESESE3V3WSE3WSE3XSESTSTSTX;X;X;XD3V3WXDXDT3T33WT33W3XT5T53XT3T53YT3T33YT3T73YT7T7T0T03YT0T7T0T7T03X3YT.T.3YT0T.T.T03YT.T.3YV.3ZUMT0UMT0UMV.V.3Y3ZT0UM3ZUM3ZUMUMUMT0T0T03ZT03ZT0T03ZT0T.4#T0T0T0UMUMUM3ZUMV.V.3Z4#V.V.4#V.T0T0T.T.3ZUMT.UM3ZSSSESSX<X<XDX<XDXD3YXDX:XBX:XBXB3XXBXBXDXD3X3Y3YXBXBXBT53YT5T5X:XBX:XB3X3YT4T43Y3ZT4T4T43ZT4T4YHYGYGYGYHYHYGYGYHYHYGYGX.3WX.X.3WX.X&X&X.X.3W3XX.X.X&X&X.X.X&3WY43WY@Y@Y43WY@Y@Y43WY@Y@Y@Y@3WY@Y43WY4Y4Y@Y@3WY@Y'3WY'Y'Y,Y,Y'Y,Y'Y,Y'Y,3UY'Y,Y,Y'Y,3UY,3UY,Y,Y,YHYUYUYUYHYH3T3UY3Y3Y33UY,3UY,Y,3UY,Y,Y,3UYUY33VY3YUY3Y3Y,Z&Y,Z&Y,Y,Y,3T3TZ&3UZ&3UZ&Y,Y,Z&Z&3UZ&3U3VZ$Z$YLYLZ$Z$YLYLZ$Z$YL3TYLYL3TYV3UYVYVYGYVYVYGYG3TYGYEYGYEYEY=Y=YGYGY=Y=YGYGY=YNY=Y=YGYGYGYXYXYXYGYXYXYNYXYXYNYN3MYNYGY=YGYGY=Y=YGYGYNYGYGYGYGYGYGYNYXYNYNYNYNX.3HX.YN3HYNX.YNYNYN3HYNYN3H3IYNYN3I3J3JX.YNYNX.X.3JX.3JX.X.X.YG3JYGYGYG3JYG3KYGYG3KX.3KX.X.X.3K3LYGYG3LYGX.X.3LX.WOWOX.3LX.X.3L3MX&X&3M3NW=W=W=W=W=3N3NW3W3W3V=V=V=3NV=V=3NV=V=V=V=3NV=V=3NV=V=U>V=U>V=V=3M3NU>TETETEUT3MUTUTV?V?3M3NUGUG3NUGV;V9V;3NV93N3OV;UGUGTLTLTUTUUGUG3MUG3NTLTL3NTLTL3NTU3OTLV;V;TUTUV;V;3NTUUKUK3N3OUPUPUP3OUK3OUPUPU-U$U$U$Y6Y6Y6Y:Y@Y@Y@YIYIY.YI3LYI3LYIYIYIY.YIYIY.Y'Y.Y.Y'Y'3JY'Y.Y'Y.Y.3IY.Y.Y.Y.3I3J3K3K3LYI3MY.3MYIYIY.Y.3M3NYI3NYIYI3NY'Y.Y.3N3OY.Y.Y'Y'3O3P3PY'Y.Y.3PY'Y.3QY'Y'3Q3R3R3SY.Y.3S3TY.Y.Y'Y'Y'3T3T3UY'3VY'Y'3V3WY'Y'3WY,Y,Y,3WY,Y'3WY'Y'Y'3WY'Y'3W3X3YY,3YY,Y,Y,3YY,Y,Y,Y'3Y3Z4#Y'Y'4#4$Y'4$Y'4%4%4&4'4(4(Y,4)Y,Y.4)4*4+4+Y,Y'4,4,4-Y.Y.Y'4-Y.Y.Y,Y,4-Y,YI4-YIYI4-4.YIYI4.4/YIY.Y.Y.YIYIY.YAY.4.YAYA4.YAY.4.4/4040YA4142YAYA42YA42Y,43Y,Y,Y,4344YI44YIYI4445YIYI45Y,YIYIYIYIYIZ)Z)Z)Z)44YIYIYI44YI44YIYI4445464747YIYIYIZ)Z)4748Z)Z)YIYIYI47YMYMYIYMYI4747YMYMYMYMYM47YMYI4748YMYIYMYMYM47YMYMYMY,Y,YIYIY,Y,YI46Y,Y,46Y,YI46474848Y,Y,Y,48Z&49Z&Y,49Y,4:Y,4:4;Z&Y,4;Y,Y,Y,Y,YKYKY,YK4:YKY,Y,Y,4:4:4;YKYK4;YKYKYK4;Y,4<Y,Y,4<4=4>Y,Y,Y,YKYKYKY,Y,Y,YKYKYK4;4<4=Y,4=Y,Y,Y,YIY,4=Y,4=Y,4>Y,4>Y,4?4@Y,Y,4@Y,4@4AZ)Z)4A4BZ)Z)Y,Y,Y,4BY,Y,4BY,4BZ)Z)Z)Z)4BZ)4C4C4DZ)4EY,Y,4EZ)Y,Y,4EZ)Y,Y,4EY,Z)4EZ)Z)4EZ#4FZ#Z)4FZ)4GZ#Z#4GYMZ)Z)Z)YM4FYMYMYM4F4GYMZ)Z)4G4HYM4H4IYMYMZ)4IZ)Z)4IYMYMYM4IZ)YMYMYMZ)YMYMYMYM4HYM4H4IYMYMY,4IY,4J4J4KZ#Z#Z#Z#4KZ#Y,Z#Z#Z#4JZ#Y,Y,Y,Y,4J4KY,Y,Y,4KZ#Z#YMY?Z#Z#Y?4JYM4JYM4KY?Y?4KY?Z#Z#4KZ#YM4KYMYMYMYMYMZ'YMYMZ'4J4JY?4K4LYM4LY?Y?4LY?Y?Y?Z&Z&YKYKYKYK4KYKYKYK4K4LYKYK4LYKZ&Z&4L4MZ&Z&YK4MZ&Z&4M4NYK4NYKYK4NZ&4O4PYKYKYK4P4PYK4Q4RYKYKY-Y-YKY-4QY-Z&Z&Y-Y-Z#4PZ#Z#4P4Q4R4S4SZ#Y0Y0Z#4S4TY0Z#Y0Y0Y0Z#Y0Y0Y04RY-Z#Y-4RY-Z#4SZ#4SZ#4T4T4UY0Y0Y-Y-Y04U4U4VY0Y0Y-4VY0Y04V4WY0Y04W4XY0Y04X4YY0Y0Z#Z#Z#4YZ#Y?4YY?Y?Y0Y?Y?Y?Y?Y?Z'Y0Y04WY04WY0Z'Z'Y?4WZ'Z'Y0Y04WY0Z'4WZ'YP4WZ'YPYPZ'Z'YP4WY0Y04WY0Y-Y-4WY-Y-Y0Y0Y0Y-Y-4VY04V4WY0Y0Y0Y-Y0Y0Y-Y-Y0Y0Y-4UY-4V4VYYYYYY4V4W4XY0YYYY4XYYY0Y/4XY/Y04XY0Y/Y0Y0Y0Y+Y0Y0Y04W4WY+Y+Y+Y0Y04WY0Y0Y04WY0Y+Y/Y+4WY/Y/4WY/Z'Z'Z'Y+Y04VY0Y0Y0Y/Y/Y/Y+Y/4UY/Z&YEZ&Z&YEYEZ&4TYEYE4T4UZ&Z&Z&Y<Y0YY4TY/Y/4TY/Y/4TYYY/Y/4T4UY2Y2Y2Y2Y/4UY24UY24VY2Y<Y2Y2Y2Y<Y2Y<Y2Y<Y2Y2Y2Y<4S4TY24TY2Y2Y24TY24UY24UY2Y2Y2Y2Y24UY/4UY/Y/Y<Y<Y<4UY<Y<4UY/Y/4UY/Y/Y<4UY/Y/YEYEY<Y<YGYG4TYGY<4TY<Y<4T4UY<Y<Y<YRYRYR4T4UZ(Z(4U4VZ(Z(4VZ(Z(Z(4VYGY<YGYGYGZ%Z%YGYG4UYGYGYGYQYQYGYGYQYQYGYGYQYG4RZ%Z%Z%Y<Y<YGYGY<YGYGYG4PYG4Q4RY<Y<Y<4RY<YG4RYGYGYG4RYGYGYGYQYQYQYQ4QYQYNX.X.X.Z%Z%Y)Y)4OY)Y)Y)X.4OWJWJX.X.X.4OVTVT4O4PVTVTVQVQVTVTVQ4OVTVT4OVQX(X(4OX(4OX(X(X(X'4OX'X'4OX'X'X'WU4OWUWU4O4PWUWUW%W%4P4QWUX,WU4QX,X,4QX,WUX+X+X+U>TT4PTT4PTTU>TTTUTU4PTUTUTUTU4PTL4PTLTLTUTU4PTUTUTU4PTUTU4P4QV;4Q4RV;V;TUTUTU4RTUTU4R4S4SV;TUV;TUTU4SUPTLU0TLU0TLU0TLU0TLU0TLU0TLU5TL4P4PU5U5TLTLU4TL4PTL4PTLTLUPUP4PUP4PUPUPUPU9U9U9UPU94OU9U9UPUP4OUPU9U9UPUPU9UPUPUPV;UPV;4M4MV;4NV;4NV;4OV;V;4OV;V;UPUP4OUPV;V;UPUP4NUPUPUPV;V;V;4NV;V;4NUP4NUPUPUPYBYB4NY>4NY>Y>Y>YBYBY>Y>YBYBY>Y>YBYB4LYB4LYBYBYBYBYI4LYI4L4MYBYBYBYB4MYBY(4MY(Y(4MYIYBYBYIYI4M4N4NYIYBYBYBYIYBYBYIYI4M4NYIYI4N4OYI4OYIYIYMYMYIYIYM4NYIYIYI4NYIYIYMYMYIYIYIYM4MYM4MYMYIYMYIYIYIYMYM4LYM4M4MYM4NYMYPYPZ'YPYPYPZ'YP4LYPZ'YPZ'YPZ'Z'YPYP4KYPZ'4KZ'Z'Z'YPZ'4KZ'Y+YPYPYPYPYP4JY+Y+YPY+4IY+Y+Y+YP4IYPY+Y+Y+Y+YTY+YTY+Y+YJYJYJYWYJY+Y+Y+YWY+YWYWY+Y+YWY+YJYWYJYWYJYWYJYWYWYS4A4BY+Y+YS4BY+YSYSYSYSY+YSYSYSYSY*Y*YSYSY*Y*4>Y/4?4@YT4@YTY/4@Y/Y/Y/Y/Y/YT4@Y/Y/4@Y/Y/Y/Y/4@Y/Y/4@YTY/4@YTYTY/Y/Y/4@Y/Y/4@Y/YT4@YTYTY/Y/YTYTY/Y/YTYTYTY9Y9Y94=Y94>Y9Y*Y9Y9Y9Y*4=Y*4>YGYGYG4>X/X/Y9X/Y94=Y9Y94=Y9Y9Y9Y9X/Y9Y9X/X/4<X/Y9X#4<4=VWYGVWVWVWVW4<VWVWVW4<4=4=VWX#X#VWVW4=4>X/VW4>VWVWVWX#X#VWVW4=VW4=WSVSVSWSWSVSVSVSVS4<VS4<WS4=WSWSWSVSWS4<WSVSWSVSWSVS4<WSWSWSWYWS4;WSWSWSWSVSVSWSWSVS4:VS4:VS4;WSWS4;WSVNVN4;4<WPVNVNVNVN4;VN4<4<4=WYWYVNVNVN4=4=WYWYWYVNVNW#W#VNVNW#W#W#W#W#4;W#W#4;4<W#W#WY4<W#4<W#W#VNVN4<4=VNWYVNWY4<WYWYWY4<WYWYWYWYWYWY4<WYWY4<WY4<4=W,W,4=4>W,W,WYWY4>4?WY4?W,W,4?4@W,W,4@4AW,W,WYW,W,W,WYWYWYW,WY4?W,W,4?W,W,W,WYW,W,W,WYWYW,WY4=4>WYWYW,4>4?4@W,WY4@4AWYWY4AWY4AWYWYWYWYWY4A4BW,W,W,4BW,W,4B4CW,W,W#W#WYWY4B4CW#4CW#W#4CW#W#W#4CWY4DW#4DW#4EW#4E4F4G4HW,W,WSWSWSW,WSW,4F4GWSWSW,W,W,4GW#4GWYWYWY4GWYWYW#4G4H4IWYWY4IWYWY4I4JW#W#W#W#4J4J4KWYWYW#W#4K4LW#W#4L4MWYWYWY4MWYWY4MWY4MWYW#W#4M4N4O4P4P4QW#W#4Q4RW#4SWY4S4TW#4TW#W#W#W#4TW#W#4TW#W#W#W#4TW#W#4TW#W#W#WUWU4T4UWUWUWU4UWUWM4UWMWU4UWMWMWU4UWUWMWUWU4UWMWMWMWT4UWM4UWTWTWM4U4V4WWMWMWTWTWMWT4V4WWUX+WU4WWU4WWMWMWUWU4WWMWUWUWUX+WMWT4VWTWM4VWTWTWM4V4WWTU>UYU>UYUYUY4VUYU>4VU>U>4VUYUYUY4V4WV:V:4WV:V:V:U>U>V:4WU>U>4W4XU>4XV:UY4XUYUYUY4XUYU/U/4X4Y4Z5#UYTTUYTT4Z5#U/U/5#5$U/U/5$5%UU5&TTTT5&TT5&TTUUUU5&TLTTTLUPUPTLUPTLTLU:U:U:UPU:U:TL5#UPUPTLUPUPUPTLUP4ZUPTLUPTLTLUPUP4YUPTLTLTL4YTL4YTLTL4YYBY>YBYBYB4YYBYBS:4YS:4YS:S:S:S:S0S:4YS0S04YS0S:S0S:S:S0S04XS04XS0S:S0Y9Y9Y*Y*Y9Y9Y*Y*Y*Y9Y*Y*Y9Y9Y9Y*W-W-4T4UWF4UWFWFW-W-WFWFY9Y94TW(Y94TW(W(Y9Y9W(Y94SW(W(W(W-4SWFWF4S4TVZVZ4T4UVZVZ4U4VVZW(VZVZVZ4VVZVZ4VW(VZ4VVZW6W6W6W6W/4U4VW/W/W6W6W6VOW6W/4UW/W6W/W6W6VZW(VZW(VZVZ4S4TW64TW6W6W6W(VOVOW(W(VO4SVO4SVOVO4S4TVOVO4TW64UW6W.4US9W6W6W/4UW/4UVO4VVOY9Y9Y9W(Y9Y9W(4UW(W(W(4UW(4UVUVUY9Y94UY9Y94UVUVUW(VUW(VUVU4TVUVU4TVUVUVU4TX#4UX#X#X#VUX#VUX#VUX#VUVU4S4TVUVUVU4TVU4TVUVUVUX#4TX#4TX#VUX#VUVUVU4T4T4UVUVU4U4VVU4WVUVU4WVUX#X#4WX#VUX#VU4WVSVSX#4WVSVS4WX#VSVSX#4WVSVS4WVSX#4WX#X#4WVSVSVSWSWSW7WSW74VW7W74VW7W7W7W,W,4VW,W74VW7W74VW,4WW7W7W74WW74WW94XW94XW94YW9W7W9W7W9W74XW7W74XW9W7W9W7W7W74XW7W7W74XW74X4Y4Z4ZW95#W9W9W<W95#W95#W9W9W9W<5#W<W9W<W9W<W9W<W9W94YW<W9W<W94YW94ZW<W<4ZW<W9W94Z5#5#W<W9W<TLTL5#5$TMTMULTMULUL5#UL5#ULTMUL5#TL5$TL5$TL5%5&TLTLUETLUI5%UIUI5%TLUE5&TLTL5&TLUE5&UE5'TLTL5'UETL5'UPUPS9S9S9WQ5&WQWQWQVU5&W@VU5&X#VUVUW@5&WQWQWQWQWQVVWQVVWQVVW+WEW+WEW+WEW+5#W+5#W+5$5$WE5%WEWEWE5%W+5%W+W+W+W+W+W+WEX#W9X#W9W9W95#W95#W9X#X#W9W9W9W<W9W9W9W<W<W<W<4YW<4YW<W:W<W:W<4YW:W:4YW:WUWUW:4Y4Y4ZW<W<W<W<W)W<W<W<W<W)W)W)W<W)W<W<W)W<W<W<W)W)W<W)W)W)W)W)W<W<W<4SW<W<4SW)W<W)W)W)W)4S4SW<4TW<W)4TW)W)4TW<4UW<WUWU4U4VWUWU4V4WWUWU4W4XWUWU4XWUWUWU4XWX4XWUWXWUT>T>T>4X4X4YUIUIUHTHUHTHUHTHUHTH4WTHTATAV<V<V5V5T+T+T+4VT+T+4VUCUCU?U?U?4UV1V1V1SASZ4USZSZSZS=S=WQWQWQVMX-X-4SX-X*4SVX4TX*4T4UVXVX4UVX4VX*X*4VX*VX4VVXVXWU4VWUWU4V4W4X4Y4YW1W1W1W1W1WUWUW1W1WUWUUIUIUIU*T:T:TITITD4UTD4VS4S44VS4S=S4S4S4S44US4S4T#T#S.S.T#T#S.S.S-S-S-S.S@4RS@S@4RSX4SSXS@4SS@S@4S4TS@S@S?S?S?SUTDTI4STIS.SMS.SMS.SMS.SMS.SMS.S.4PSMS.4QSMSM4QSM4QT$SMT$SM4QSMSM4QT$T$T$T$4QT$4RT$4RT$4S4S4TSJSJS3S34T4USO4USOSGSGSG4USGSO4USOSOSG4USGSWSGSGSGSW4TSWSWSWW>W>4T4UW>W>4U4V4VWVWVWVWVWV4V4WW$4WW?W?4WU#4XU#SJS74XS7SNSNSJSJSJSJSNSJSJSJSJSNS74US74V4V4WSJSJS7SJSJSJSOSG4V4W4WSGSOSGSGSGSISGSOSO4VSISO4VSOSISOSI4VSI4VSISOSOSISISIS8SO4USOS8SGSGSG4USIS>SIS>4T4US8S8S84US8S84US>S>S>SWSWS>4USWSW4USWS>S>4USWWLWCWCWCV$4TV$TPT=V(V(V(V(V(4SV(T=V(T=4SV(U@U@U@V(4RT=T=4RT=T=T=4RU@T=T=U#V(V(V(V(V(U@U@V(V(U@U@4OSOSPSPSOSPSPSPSP4NSPSPS>S>SP4N4NS6SPSPS6S64NS64NS6SRS6S6S6SR4NSR4NSRSR4NS64O4PU=V,V,V,4OT1T1T1U<4OTGTGTGTG4OTGTPTP4OTPTGTGTG4O4OSPSDSPS6S6S64OSDSDSD4O4OSESESET1T1T5T1T0T;T0T0T/4MT/T/4MT0T/T0T0T0T04MT0T;T04MT04MT0T04MT;4NT;4NTGT;TGT;T;T;4NV.V.4NV.4NV.T0T0T04NT0V.T0T04N4OT;T;4O4PT04PV.V.SCSCSCSESCSCSC4OSE4OSSSS4OSSSSSSSESE4OSS4OSSSSSSX;4OXDXD4OXDXDXDT3T3T5T3T54NT5T5T3T34NT5T3T3T54N4N4OT5T5T3T34OT5T0T0T7T0T0T04N4OT04OT0T.4O4PT.4QT0T0T.T.4PT.T.T.T0T04PV.4PUMUMUMUMV.UM4PV.V.4PV.T0T0T04P4PUMT0UMT04PT0T0T04PT04QT0T04QT0T0T0T.4QUMUM4QUMV.V.V.4QV.V.4QV.4QUMUMUMUMUMT.4QSESSSE4QXDXD4Q4RXB4RXBXBXDXD4R4SXDXD4SXBXB4SXBXB4ST.T5T54S4TT4T4T/T/T4T4T/4ST4T44ST/T4T4T/4ST4T4X.X.X.4SX.X.4S4TX&4TX&X&4TX&X&X&4T4UX&X&Y4Y44U4V4V4W4XY@4X4YY@Y@Y@Y@4Y4Z4ZY4Y4Y4Y@Y@4Z5#Y,Y,5#Y,Y'Y'Y,Y,4ZY,5#Y,5#Y,5$Y,YHYH5$5%YHYH5%YHY3Y3Y,Y,Y35$Y,Y,5$Y,Y,Y,YUYUY3YUY3YUY35#Y,Y,Y,Z&Y,Z&Y,Z&4YZ&Z&Z&Y,Z&Y,4YY,4YY,Z&YLYLZ$Z$YLYLZ$4XYV4XYLYLYVYV4XYV4XYLYLYL4X4Y4ZYG4Z5#YXYNYNX.X.X.YN4ZYNX.YNYNYN4ZYNYN4Z5#YNYN5#YNYNYN5#5$5$X.5%X.X.X.YNYNX.X.5$X.YNYN5$X.5$5%YGYGYGYGYG5%YG5%YGX.YGYGYG5%5%X.X.X.YG5%X.X.YGYGX.YGYGYGX.5$X.X.WO5$X.X.X.X&5#5$X&X&5$X&X&X&WGWGW=5$5$WGW=W=W35$W3W3W=W=W=W3V=V=V=5#V=V=5#V=V=V=V=5#V=V=5#5$V=V=V=5$V=V=5$V=5$TLUT5%5%5&V?TL5&TLTLTL5&UG5'5(5(V9V;5)5)V;V;V;5)5*V;V;UGUG5*UG5*5+TLTLTLUGTL5+UGUG5+TU5+TLTLTL5+5,TUTUUKUKUK5,UKUK5,UKUPUKUPUKUKUK5+UKY.Y.YI5+YI5+YIYIY.Y'Y.5+Y'Y'Y.Y.Y.Y.5*5+5+5,YIYI5,YIYIYIY.Y.5,5-Y.Y.5-Y.5-5.YI5/Y.Y.Y.5/5/50YIYI50Y.51Y.51Y.YIYIY'Y'51Y'Y'Y'51525253Y.Y.Y'Y'5354Y'Y.5455Y'Y'Y.Y'Y'Y'Y'Y.Y.Y'Y.Y.52Y.Y.Y.Y.Y'Y.52Y.52Y.Y.Y'Y'52Y.Y'52Y.Y.52Y'5354Y'Y'Y,Y,Y'53Y'Y'Y,Y,Y'Y,Y'52Y'Y'Y'52Y,Y,5253Y,Y,Y'Y'Y,Y,Y,Y,52Y,Y'Y,Y'Y'Y,51Y'52Y'Y'Y'52Y'5253Y,Y'Y,Y,Y,Y,Y,52Y,52Y,Y,Y,Y'52Y'Y'5253Y,Y,53Y,Y,Y,53Y.Y.Y.Y'53Y.54Y'Y'Y'54Y'54Y'55Y'55Y'Y'Y,Y,55Y,Y'Y'Y'55Y,Y,55Y,5556Y,Y,56Y,57Y,57Y'58Y'Y.58595:5:Y'Y'Y'5:Y'5;5<5<5=Y'5>5>5?Y.5@Y'Y'5@Y'5@5AY'Y,Y,Y,Y.Y,Y.Y.YIYIY.Y.YI5?Y.Y.5?Y.Y.5?YIYIYIY.YIY.Y.YAY.5>YAYA5>YAY.Y.Y.5>YI5>YIYI5>5?YIYI5?YAYAYAYAYA5?5@YAYAYA5@YAYA5@YIYAYA5@5A5AY,YAY,YI5AYI5BY,Y,5BY,5BY,YIYI5B5C5DYI5D5EYIYIY,Y,5E5FZ)Z)YIYIYI5EZ)Z)Z)5EYIYI5E5F5GZ)5G5HYIYI5HZ)Z)5IZ)YI5I5J5J5KYIYIZ)Z)YIYIZ)Z)YIYIYIYIYMYMYIYMYI5HZ)Z)YMYMYMYM5GYMYIYI5G5HYIYMYIYI5GYMYMYMY,5GYIYIY,Y,5GY,YI5G5H5IYIYI5IY,5IY,Y,Y,5IY,Y,Y,Y,Z&5IZ&5IZ&5JZ&Y,Z&5JZ&5JZ&Y,Y,Y,5JY,5KY,Y,Y,Z&5JZ&5KZ&5KYKYKYKY,Y,Y,5KY,Y,YKYKY,Y,YKYKY,YKYKYKY,Y,5HY,YKY,YKYKY,5G5HZ&Y,5HY,5I5IZ&Z&Z&YIYIYI5IYI5I5JY,YI5JYI5K5K5L5MY,YIYIYI5MYI5MYIYIYIY,5MY,5MY,YIY,5MY,YI5NY,Y,5NY,Y,Y,Y,5N5NZ)Z)Z)5N5OZ)Z)5O5PZ)Z)Z)5PZ)Z)Y,Y,Y,5PY,Y,5PY,5P5QZ)Z)Z)Y,Z)Z)5PZ)Z)Z)Y,Y,5PY,Y,Y,5PY,Z)Y,Z)Z)Y,Z)Z)Z)5N5OZ)Z)Y,Y,Z)Y,Y,Y,Z)5NY,Y,Z#Z#5MZ#5NZ#Z)Z#Z)5N5NZ#5OYZZ#Z#Z#YMZ)Z)Z)YMZ)Z)YMYMZ)Z)YMZ)Z)Z)Z)YMZ)Z)Z)5J5JZ)5K5LZ)YM5LYMZ)Z)Z)5L5LYM5MYMYM5MYMYMZ)5MYMYMZ)Z)Z)5MZ)YM5MYMY,Y,Y,5M5MZ#Z#Z#Y,Y,Z#Z#5LZ#Z#Z#Y,Z#Y,5LY,5LY,Z#Y,Y,Y,5LY,Y,5LZ#Y,Y,Y,Z#Y?Z#Y?Y?YMYMYMY?5IY?5J5KY?Y?5KY?Z#Z#Y?Y?YMYMYM5JY?Y?Z'5J5JY?Y?Y?5J5KYMYMY?Y?5K5LYMYM5LYM5LY?5M5NYKYKZ#YKYKYKYKZ#YKYKZ#5LYKYK5LYKZ&Z&YKYKZ&YKYKYKZ&Z&YK5JZ&Z&5J5KZ&Z&5KZ&YK5KYKYK5KZ&YK5LYK5LYKYKZ&Z&5LZ&YKYKYKY-YKYKYK5K5KY-Y-Y-5KY-Y-Y-YKY-Y-Y-YK5JZ#Z#Z#Z#Z#5JZ#Z#5JY0Z#Y0Z#Z#Y0Y0Z#Z#Z#Z#5HZ#Z#Z#5HZ#Z#5HY0Y05HYKZ#YKZ#5HZ#5I5I5JZ#5KZ#5KZ#5LZ#5LZ#Y05LY-Y0Y0Y-Y-Y0Y0Y-Y-Y05KY05KY0Y0Y-Y-Y0Y0Y-Y-Y0Y0Y-Y-Y05IY-Y-5I5JY-Y-5J5KY-5KY0Y05KY-Y0Y05K5LY0Y0Z#5LY?Y?Z#5L5M5NY0Y05NY05NY0Y?Y?Y?Y?Y?5NY0Y05NY0Z'Z'5N5OZ'Z'5OZ'5OZ'YP5PY0Y05PY0Y-Y-5P5QY05QY0Y0Y-Y0Y0Y05PY0Y0Y0Y-Y-Y-5PY-YYYYYYY-YY5OYYY-Y-Y-5OYYYY5O5P5P5QY0Y0YYYYY0YYY0Y/Y/Y/Y0Y/Y/Y/Y0Y0Y05NY05NY+Y+Y0Y05NY0Y0Y0Y05NY+Y/Y+Y+Y/Y/5M5NY05NY0Y/Y+Y+Y+Y/5MYEZ&5NY<5NY<Y<5NY<Y<Y<Y0Y/Y/Y/YYYYY/5MYYYY5MY/Y<Y<Y2Y2Y<Y<5LY<5LY2Y/Y2Y<Y<Y2Y2Y25KY2Y2Y2Y<Y2Y2Y<Y<Y2Y<5IY<5JY<Y<Y<Y25JY25JY25KY25KY2Y<Y2Y2Y<Y<5JY<5KY<Y<5KY<Y/5KY<Y/Y/5KY/Y/Y/Y<5KY/Y/YGYGY<5K5KYGY<YGYGYGY<Y<YGYGY<Y<Y<Y<Z(Z(Y<5HZ(Z(5HZ(Z(Z(5H5IZ(Z(Y<Y<Z(Z(YGYG5H5IYGYGZ%Z%YQZ%Z%Z%YGYGY<YGY<5F5G5HYGYG5HYGY<YGYGYGY<YG5GYGYGYGYG5GYQYQZ%Z%Z%Z%5FY)X.X.WJWJX.X.VRVRVTVTVQVQVTVTVQVQVT5BVQVQ5BVQVQVQVNX(VN5B5B5CX(X(5CW3X'X'W35C5D5EW%W%WUWUW%W%WU5DW%W%5DW%WUW%WUWUW%W%WUWUWU5BWUWU5B5CWUWUU>U>U>5C5C5DU>U>TUTU5D5ETUTU5E5FTL5FTL5GTUTU5G5HTUTU5H5ITUTU5I5JTU5JTU5KTUTU5KV;TUV;V;V;TUTUTU5JTUTU5J5KTUTU5K5LTU5LTU5MTUTU5MUPTLU55MU5TLU5U5U5TLU4TLU4TL5KTLTLU0UP5KUP5KUPU0UPU9UPU95K5KUPU9U95KUP5LUPTUTUTU5LTU5L5MV;5MV;5NV;5NV;V;V;5NUPV;V;5NUPV;5OV;UPUPUPV;V;V;5NV;UP5NUPUP5NUPUP5N5OY>Y>YB5O5PY>Y>Y>Y>5P5PYBYBYBYBYBYB5PYB5PYBYB5PYIYBYBY>YB5PYBY(5PY(Y(YIYIY(Y(YI5O5P5QYIYI5QYIYB5QYBYBYIYI5Q5RYIYIYBYBYIYI5Q5RYIYI5RYIYIYMYIYMYMYM5QYMYIYI5Q5RYIYM5RYM5RYMYIYMYMYMYM5RYM5RYMYMYMYM5R5S5S5TYMYM5T5UZ'5V5VYPZ'5W5WYPZ'Z'5WYJZ'5XYPYPYP5XYPYPYPY+YPY+YPY+YW5VYW5W5WYSYSYSY+Y+YSYSY/Y/5VY/Y+5VY+Y+5V5WY+Y+YTYT5WY/YTY/Y/Y/YTY/YTYTY/Y/5U5VY/Y/5V5W5WYTYTYT5WYTYTYTY/Y/Y/5WY/Y/YT5W5WYTYTYT5WY95XY9Y*5XY*5YY*Y*Y*Y9Y*Y9Y*Y9YGWZYGWZX/X/Y9Y9X/X/Y9Y9X/X/Y9X/Y9Y95S5TX#X#5TX#VWVW5TVWVWVWX#X#5SVWX#X#X#5SX#X#VWVWX#X#VWVW5R5SX/X/5SVWVWVW5S5TWSWSVSVSX#VSX#X#5RWSVSVSVSVSVSWS5QWS5RWSVSWSVSVSWSWS5QW,5QWSVS5RWSWS5RWSVS5RVSVS5RWSVSVSWP5RWPWPVNVNWP5RVNVNVN5RWY5RWYWY5R5S5TWY5T5UWYWYVNWYWYWY5T5UWYWYW#W#W#5UW#W#5U5V5VWYWYWY5VW#WYW#VNVN5V5WW#5WW#W#VNVNW#W#5V5WWYWYVNVNWYWYWYWYWY5VWYWY5VW,W,5VW,W,WYWYW,W,WYWYW,W,WYWYW,W,WY5SWY5T5TW,W,W,WYWYWY5TWYWY5TWYWYWYW,5TWY5T5U5V5VW,5WW,WYWYWY5WWYWYW,W,W#W#WY5VW#W#5VWYW,W,W,5VW,5VW,WY5V5WWYWYW,WYW,W,WYWY5V5WWYWY5WWY5WWYWYWYWYWYWY5WWYWYWY5WW,W,W,W#W,W,W#W#5U5VW#W#W,5VW,W,5V5W5XW#W#W,W#5XW,W,5X5YWYWY5YW,5YW#W#W#5YW#5ZW#5ZW#WYW#WYWYW#5ZW#W#5ZW#W#5ZW#W#5ZW#W#W#WS5ZWSWS5ZW,WSWSW,5ZW7W7W#5ZW#WY5ZW#WYW#W#W#5Z6#WY6#WYWY6#6$WYWYWYWY6$WYWYWYWYW#WYWY6#6$W#W#6$6%WY6%WYWYW#W#6%W#W#6%WYWY6%W#WYWYW#W#6%6&W#W#WYWYWYWYWYW#WYWYW#WYWYWYW#6#WYWYWY6#WYWY6#6$WY6$6%6&6&W#W#W#6&6'W#W#6'W#W#W#6'WYW#6(6(WY6)W#W#6)W#W#WYWYW#W#6(W#W#W#6(6)W#W#W#6)W#W#6)6*W#W#VNVN6*6+VNW#6+W#WU6+WUWM6+WUWMWMWU6+6,WM6,WMWMWM6,WM6-WMWUWMWUWMWU6,WMWM6,WMWT6-6-WT6.WTWMWMWM6.WM6.WTWT6.WTWTWTWM6.6/6060WTWTWTWUX+WUX+WUWUWU6/6/WMWMWMWM6/WMWMWMWM6/WMWMWM6/WTWT6/WTWT6/UY60UYU>60U>6161UYUYUYU>61V:V:6162V:V:6263V:V:U>63V:V:6364V:V:6465V:V:U>U>6566U>UY66UY66UY6768TTTTUYUYTTTT67TTUY67TTTT67TTTTTTUYUYU/67UYUY6768UYUYU/68UYUY68U/TTTT6869TTTT69TT696:UUUU6:TTUU6;UU6;UUUUTTTLTTTLTLUPTLUPTLUPTLUPUPUPUP68TLTLTL68TLUPTLUPY>67Y>68YBYBY5Y5S:S:6768S:S:S:68S:68S:S:S0S068S0S:S0S:S:S:S0S:S0W-W-6667W-W-67W-67W-WFWF6768W(W(Y9Y9Y968Y9Y968Y968W-WF69W(W(VZVZ68W(VZVZ68W(VZVZW(W(VZVZVZW(VZ67W(W(67W(VZ6768W(VZW(W(W(VZW667W6W6W6W/W/W6W6W/W665W6W6W6VZVZVZW6VZW(W6W(6364W665W(W(6566VO66VOVOW(W(VOVOW(W(VOW(64W6W.W.64W6W6W664W6W.W66465W/W/W6VO65VO65VOVOVOY9Y9W(65W(W(W(65W(65VUVUY9Y965W(Y9Y965VUVU65VUVU65Y9VUVUX#X#VUX#VUX#VUX#VU63VUX#63X#X#X#VUVUVU63VU63VUVU63X#X#X#63X#VUX#VU63VU64X#X#64X#X#X#6465VU65VUVUX#X#65X#6566VUVUVUVUW@6666X#VU67X#X#67X#VSVSX#X#VSVSX#X#VS65X#66VSVS66VSX#66X#X#66VSVSVS6667W768WSWS68W7W,W,W7686869W76:W,W,6:W,6:6;W7W76;W76<W76<W96=6>W76>W7W7W7W7W76>W7W9W9W9W76=W7W76=6>W76?W7W7W7W96>W7W9W96>W9W9W9W7W7W76>W9W96>W9W9W96>W9W7W9W7W9W9W<W9W9W96<W9W9W9W96<6=6=W<W9W<W96=W9W9W9W96=6>6>W<W<W<W9W9W96>W9W96>W<W96>W9W<UUTLUUUUTLTL6=TLTMUL6=ULULUL6=ULTLTL6=TL6=TLUEUETL6=UE6>UE6>UEUE6>TL6?TLUIULUIUITLTLUE6>6>TLUEUETLTLUEUETLTL6=6>UE6>UEUE6>TLUEUE6>TL6?UPS9WQS9WQVU6>VUVU6>X#VUVUW@WQWQWQW+WEW+W+W+W+W+6<W+6<W+W+W+WE6<WE6<6=W+W+6=6>W+W+WE6>W+W+W9W9X#6>X#6>X#X#W<W<W<6>W<6>W<W:W:W:W<W<W:W:6=W:W:6=W:W:W:W:W<W:W:W:W:W<W)W)W<W<W)W)W<W<W)W)W)69W)69W)6:W)W<6:W<W)6:W)W)6:W<W<W<W)W<W)W<WUWUWUX-68X-X-X-WUWUWU68WUWU6869WUWU69W1WUWUW1W1WUWUW1WUWU6768WXWUWUWXWXT>T>T>67UI67UIUI67UIUIUI6768TATAT+68UC69UCUC69UCU?UCU?V1SASZ68SZX-6869VXX*X*696:VX6:VXX*X*X*6:VX6:6;6<VXX*X*VX6<VX6<VXVX6<X*6=X*VXVXVX6=WUWUWU6=WU6=WU6>WUWUWAWUWU6=WUWU6=WUWUWU6=6>W1W1TD6>TD6?TDTITDTIS4S4S=S=S46=S4S4SXSXS@6=SXSX6=SXS@SXS@SX6<SXS@S@S@6<S@S@6<SX6=SXTDTDTD6=S.SMS.6=6=6>S.S.6>SM6?SM6?T$SMSMSMSMSM6?SMSM6?T$T$SKT$6?6?SK6@SK6@SK6ASKSKSK6ASKS3S3S36AS3S36ASJS3S36A6B6BSO6CSO6CSGSGSGSGSGSO6C6CSG6D6ESGSGSG6ESGSWSWSWW>W>W>6DW>6D6E6F6FW>6G6HW>W>6HWVW>WV6HWVWVWVWVW4WVW4W4W46FW$6GW$U#U#T-U#T-6FT-T-SJ6FSJ6GS7S7S76GS7SJSJSJS7S76FSJS7S7SJSJSOSOSO6E6ESGSGSGSO6ESOSOSOSISISISO6DSOSISOSISO6DSO6DSOSI6DS86ES86ESISISIS8SIS8S8SI6DSIS8S86DS8S>6D6ES>S>S>SWS>6ESWSW6ESWS>6ES>S>6ETP6FTPV(V(V(6FT=V(T=6FV(V(V(6F6F6GT=T=6GU@T=T=6GSO6H6ISP6ISPSP6I6JSP6KSP6KSPSPS6S66KS6SRS6S6S6S6S6S66JS66J6KSRS6S6S66K6KSRSRSRSRS6SRSR6J6KT1T1U<6KTGTGT;TG6KTGTPTP6KV.TGV.TGV.SPSP6J6KS66KS6S6SRSR6KSRSE6KSESET/6KT/T/6KT06LT0T06LT06M6MT;6N6OT06OT0T0T;T;6O6PT06PT0T;6PTGT;6QT;6QT;T;V.V.6QV.6Q6R6ST0T06S6TV.T0T0T06T6TV.6UV.T;6UT0T06UT;6VT;T06VV.V.SCSESCSESESESS6U6USESSSSSESESE6U6USSSSSSX;6UXDXD6UXDXDXDT3T36U6VT56VT5T5T5T3T5T5T56UT56VT3T3T36V6VT5T5T5T0T0T06VT0T06VT0T06VT.T.6VT0T.6WT0T06WT0T.T0T.6WT0T0T0T.T0T06V6W6W6XUMUMUM6XUMUM6XV.6Y6Z6ZUM7#UMT07#T0UMT0UMT07#T0UM7#UM7#UMT0UMT0T07#T07#T.T.T.7#UM7$UMV.7$UMUMV.V.7$V.UM7$UMUMUMUMT.UMSE7#SE7$XDXDXB7$7$XD7%7&7&7'XBXBXDXDXB7'XDXD7'XDXDXD7'XDXB7'XBXB7'7(T5T5T/T/T4T4T/T/T4T4T/T/T4T4T/T/T4T4T/T/T4T4X.X.X.X&6Z7#X&X&X.X.X&X&6Z7#X&X&7#X&X&X&X.X.7#7$X.X.X.7$Y4Y4Y@7$7$Y@7%Y@Y4Y4Y47%Y47%Y@Y@7%Y@Y@Y@Y4Y47%Y@Y4Y4Y@Y@Y@Y@Y4Y4Y@Y@7#Y@7#7$Y4Y4Y47$Y4Y47$Y4Y4Y4Y'Y,Y'Y'Y'Y'Y'7#Y'7#Y'Y,Y'Y,Y'Y,Y'Y,Y,Y,YH6YYUYU6YYUYUYUYHYHYUYHY3Y36XY,Y,6XY,Y,Y3YUY3Y3Y,Y,6WZ&Y,6W6XZ&6XZ&Y,6Y6YYLZ$Z$YVYVYLYLYLYV6XYVYL6XYLYLYV6XYVYV6XYG6YYGYV6YYVYG6Y6ZYXYXYNYN6ZYNYN6Z7#X.YN7#YNYG7#7$YGYG7$7%YGYG7%YNYNYNX.7%X.X.YNYNX.X.YNYNYN7$7$X.X.X.YNX.7$X.YNX.X.X.X.YGYGYGYGX.YGYGYG6YYG6ZYG6ZYGX.YGYGYGX.YG6YX.X.YGYGX.6YX.YGX.YGX.X.WOX.X.X.X.6WX.X.6WX&X.X&X&X&WGW=W=W=WGWG6U6VW=W=W3W=V=V=U>U>V=V=U>U>V=V=U>U>V=V=U>U>V=V=U>U>V=V=U>U>V=V=U>U>6NTLUT6O6OTLTLTLV?V?V?6OV?V?6OTLV?V?TLTLUGUGTL6NTL6NTLTLUGUGTLUGV;V9V;V9V96LV;V;V;V;6LV;V9V96L6MV9V9V9V;TL6L6MUG6MUGTLTLUGUGTLTLUGUGTL6LUGUGUG6L6L6MTLTLV;6MTUTUV;V;TUTUUKUK6L6MUKUK6MUKUKUKUPUKY.Y.6LY.YI6LYIYI6LY'Y.Y'Y.Y.Y.6LY.Y.6LYIY.Y.YIYIY.Y.6K6L6LYIYIYI6L6MYIYI6M6NYIYIY.Y.6NY.YI6NYIYIY.Y.YIY.6MY.YIY.Y.Y.YIYIYI6LYIYI6L6MYIYIY.Y.6MY.YI6MYI6NYIY.YIY.Y.6MY.6NY'Y'Y.Y.Y'6MY.Y.Y'Y'Y'6MY'6MY.Y.Y.6M6NY.6N6OY.Y.Y'Y'Y.Y.Y'Y.Y.Y.Y'Y'Y.Y.6LY'Y.Y'Y'Y'6LY'6LY.Y.Y.Y'Y'6LY.Y'Y'6LY'Y.6LY.6MY'Y'6MY'Y'Y'Y'6MY'Y,Y'Y'Y,Y'Y,6LY'Y'6L6MY'Y'6MY'Y,Y,Y'6MY,Y,Y'Y,Y'6LY'Y'Y'Y'Y'Y,Y'Y'Y,6KY'6KY,Y,Y,Y,6KY,6KY,6LY,Y'Y,Y'Y'Y'6KY,Y,6KY,Y,Y,Y,Y'Y,Y,Y.Y'Y.Y.Y'Y'6IY'Y.6I6JY'Y'Y'Y'Y,Y'Y,Y'6IY'Y'6IY,Y'Y,Y'6I6IY,6JY,Y'Y'Y'6J6JY,Y,Y,Y'Y'Y'6J6JY,Y,Y,Y,Y,6JY'6J6KY,Y,Y.Y.Y.Y'Y.Y'6JY'Y.6JY.6KY.Y.6K6L6L6MY'Y'6MY'Y'Y'Y'Y'6M6N6NY,Y'6OY,Y,6OY,Y'6OY'6PY,Y,6PY,Y'6PY'6Q6QY'Y.6RY'Y'6RY'6RY'6S6T6TY'Y.Y.Y'6TY'Y,6T6UY,Y,YI6UYIYIY.Y.6UY.Y.6UYIYIY.YAY.Y.YAYA6TYAY.Y.Y.6TY.Y.YIYI6S6TYIYI6T6UYI6V6V6WY.6X6X6YYIYI6Y6ZYIYIYAYA6Z7#YAYA7#YIYAYAYA7#YAY,Y,Y,YA6ZYAY,Y,Y,6ZY,YI6ZYIYIY,Y,6ZY,YI6ZYI7#Y,7#Y,7$YI7$YIYIYI7$YIYIYI7$YIYI7$Y,YIYI7$Y,7%7&7&7'YIYIYIYI7'7(7(7)YIYIYIZ)YIYIZ)Z)7(Z)YI7(YIZ)Z)Z)Z)7(Z)YIYIYI7'Z)7(Z)Z)Z)Z)7(Z)7(YIYI7(YIYIYIZ)Z)YIYI7'YIYIYIYIYMYIYIYMYM7&YMYIYIYM7&YIYIYMYMYMYIYMYMY,Y,Y,7$7$Y,YIYIYI7$YIY,YIYIYI7$7$Y,Y,Y,YIYI7$YIYIY,YIY,7#Y,Y,Y,Y,Z&7#Z&7#Z&Y,Z&Y,7#Y,Y,Y,7#Y,7$Y,Z&Y,Y,7#Z&7$Z&7$Z&Z&Z&Z&Z&7$Z&7$Z&Y,Y,Y,YKYKYKY,Y,Y,7#Y,Y,YK7#Y,7#Y,Z&Y,Y,Y,7#Y,Y,Y,7#7#Z&7$7%7%Z&7&Z&YIYIYI7&YIYIYIY,YIYI7%Y,YI7%7&Y,7&Y,7'Y,YI7'YIY,7'Y,Y,Y,YIY,Y,Y,7&Y,7'Y,7'Y,YIYIYIYIYI7'YI7'YIY,7'Y,YI7(7(Y,YI7)Y,Y,7)7*Y,Y,Y,7*YI7*Z)Z)Z)7*Z)7+Y,Y,7+7,Y,Y,Z)Z)7+Z)Z)Z)Y,7+Z)Z)Y,7+Z)Z)7+Y,Z)Z)Y,Y,Z)Z)7*7+Z)Z)Z)Z)Y,Y,Z)Z)7*Z)Y,Y,Z)Z)Y,Y,Z)7)Y,Y,7)Z)7)Z#Z)7*Z)7*Z)7+Z)Z)7+Z#Z#Z#7+Z#7+YZYZYZ7+YZ7,YZ7,YMZ)Z)Z)Z)7,Z)YMZ)7,7-Z)Z)7-Z)Z)YM7-YMZ)Z)Z)YMZ)Z)7,YM7,YMYMYMYMZ)YM7,Z)YM7,YMZ)Z)YMYMZ)Z)7+7,Y,7,7-Z#Y,7-Z#Z#7-7.Z#Z#Y,7.Y,7/7/Z#Z#Z#7/70Y,Z#70Z#Z#Z#YMY?70Y?70Y?YMYMY?70YMYM7071YM72YM72YM73Y?Y?Z'73YM7374Y?74Y?YMYMY?Y?YM74YM74YMYM74Y?YM75YMYM757676Y?YM77YMYMYM7777Y?Y?Y?YKYKZ#Z#YKYKZ#YKYKZ&YKYKZ&Z&74Z&Z&Z&7475Z&Z&75767677YKYK77YKYKYK77Z&78Z&78Z&YK79Z&Z&YK79YKYKYK79YK79Y-Y-Y-79Y-Y-YKYKZ#Z#Z#Z#Z#7878Y079Y0797:Y0Y0Z#Z#7:Z#Z#7:7;Y0YKYKZ#YKY-Y-7:Y-Z#Y-Z#Z#79Y-Z#Z#Y-Y-79Y-Z#79Z#Y-Z#Y-Z#Z#Z#Z#Z#78Z#78Z#Y0Y-Y-Z#Y077Y-Y0Y-Y-Y-Y077Y077Y0Y07778Y0Y07879Y0Y079Y-Y0Y079Y0Y0Y0Y-Y-79Y-Y-Y-79Y-Y-Y-Y-79Y-79Y0Y0Z#Z#79Z#Y?Y?79Y?797:Y?Y?Z#7:Y?Y?Y?Y07:Y07:Y0Y?Y?Y?Y?Z'7:7:Y07;7<Z'Z'Z'7<Z'Z'YP7<Z'Z'YPZ'Z'Z'Z'7;7;Z'YPZ'Y-Y-Y-7;Y-Y-Y-Y07:7;Y0Y0Y07;Y0Y07;7<Y0Y0Y-Y-Y-7<Y-7<YYYYY-7<Y-7=YYYY7=7>YYYY7>YYY-Y-Y0Y07=7>Y0Y0Y0Y07>7?Y07?Y+Y+Y0Y07?Y0Y0Y0Y07?Y/Y/Y+Y+Y/Y/7>Y/Y07>Y0Y/YEYEZ&Z&Z&7=Z&YEYE7=Y<Y<YEYEY<Y<YYYYYY7<YYYY7<7=7=Y<Y2Y27=Y2Y/Y2Y<Y<Y2Y2Y<Y<Y2Y<Y27;Y2Y<Y<Y<Y2Y<Y2Y<Y2Y<Y2Y<79Y<79Y<Y2Y<79Y<Y/7:Y/7:Y/Y/7:7;Y<Y/Y<Y<Y/Y/7:Y/Y/Y/Y<Y<Y/Y/YGYG797:YGYGY<Y<Y<Y<79Y<Y<Y<Y<Z(Y<Y<Z(Z(Y<Y<Z(Z(Y<76Y<Y<76YGY<Y<76YG77YGYGYGY<Y<YGYG7677YGYGY<YGY<YG76YGYGYGYG76Z%Y)Y)Y)VT75VQVQ7576VQVQVNX(VNX(VNVN757676X(X(X(X'W3X'W3W3W3W375W375X'X'75X'X'X'7576WUWUW%W%WUW%7576WUWU76X,WUWUX,X,WU76U>TTU>76U>U>U>TTU>75TTTTTUTUTLTLTUTUTLTLTUTUU0U07273U0U0TLU073U07374TLTL74TUU0U0TUTUU0U07374U0U0TUTUU0U0TUTU7374TUTUV;V;TU73TU7474V;75V;7576V;V;TUTUTU76TUTU7677TUTU7778TUTU7879TUTU797:7:V;7;V;7;V;V;V;TUTUUPUP7:U57;U5U4U4TLU4U0UPU0UPU0UPU0UPUPUPU978U978U9U9V;78V;79V;79V;7:TUTUTU7:7:V;7;V;TU7;TU7<TUV;TUV;7;V;TUV;TUV;TUV;V;7:V;7;UPUP7;7<7<UP7=UPV;V;V;UP7<UPUPUPV;UPUPUPYB7;YBY>7;YBY>Y>YBYB7;Y>YB7;Y>Y>Y>YB7;YBY>7;Y>YBYBYBYBYIYB7:YBYBYIYIYBYIY>YBYBYBYIYIY(Y(YIYIYI77YIYIYBYBYIYB76YI76YIYIYIYBYIYBYIYIYIYBYBYIYIYBYBYIYIYBYIYIYI7273YIYI73YIYMYMYI73YI73YI74YIYIYFYIYMYM73YM73YMYIYMYMYMYM73YM73YMYMYMYM73YO73YMYOYMYOYO737474YMYMYM74YPZ'Z'YPYP74YP74YPZ'YPYPYPZ'YPYPYPZ'73Z'YPZ'Z'Z'YJZ'7272YJZ'YJYP72YPY+YWYWYW72YSYSYWYSYW7172YS72Y/Y+7373Y/Y+Y+Y/Y/Y+Y+Y/Y/Y+Y/YT7172Y/72Y/YTYTY/Y/YTYTY/Y/Y/7171YTYTYTY/Y/717272YTYTYTY/Y/72Y/YTY/YTYT71YTYTYTY9Y971Y9Y*Y9Y*Y*Y*Y*Y*70Y*70Y*Y*Y9Y9Y9X#Y97/X#X#7/X#X#X#VWVWX#7/VW7/70X#70VWX#VWX#70X#X#7071X#X#X/VWX/X/VWVWVW70VWVW7071VSWSVS71VSVSVS71VS71VSVS71WSWSW,WSWS71WSWSWSVSWSWSWS70717172VSVSWSWSVSWSWPVNWPWP70VNWP71VNVN71WY71WYWYWYVNVN7172VN72WYWY72WYWYWYVNVN7273VN73WYWY7374WYWYVNWYWYWYW#73W#WYWY73WYWY7374WYWYW#WYWYWYW#WYWYWYVNVNW#W#VNVN71VNW#VNW#W#VNVNVN7070WY71WYWY71W,W,71WYW,W,WYWYW,W,WYWYWY70WY70WYWYWYWYW,W,WYWY7/70WYWY70W,WYWYW,W,WYWYWY7/WYWY7/70WYWY707171WYW,W,WY71WY72WYWYW,W,W#W#WY71W#W#71WYW,W,7172W,W,W,7272WYWYWY72WYWYWYW,72W,W,72WYW,W,WYWYW,WYWYWY71WYWYWYWY71WYWYW#W#W,W,W#W#7/W#W#W#7/70W,W,7071W,W,71W,W,W,W,W,W#W#W#W#W#70W#W,70W,W,W,W,W#WYWY7/WYW,W,W,W#WYWYW#W#7-W#W#W#7-7.WYWYW#7.7/70WYWYWYW#W#WYWYWY7.WYWYWYWS7.WS7/W,W,7/WSW,W,7/70W#WYW#WYWY7/WYW#W#W#W#7/W#W#WYW#WY7.WYWY7.WYWYWYWYW#WYWYWYWY7-7.WYWY7.W#7.W#W#W#W#W#WYWYW#W#7-W#W#W#7-7.7.W#WYWYW#W#W#7.W#W#7.7/7/W#WY707071WYWYWYWYW#WYWYWYWY70WYWYWY70WY7071W#WYWYWY717172W#W#7273W#W#73W#W#W#WYWYWY73WY7374W#74W#W#W#WYWYW#WYWYWYW#W#WYWY727373W#W#W#W#73W#W#WY7374W#WY74WY7575W#76W#VNVNW#W#VNVNW#W#VNVNW#74W#74W#W#74VNW#W#VNW#W#W#WUWUWU73WUWU73WUWUWUWU73WUWU73WM73WMWMWMWMWM73WMWUWMWMWMWU72WMWMWMWMWT72WT72WTWTWMWMWM727273WTWTWMWMWM73WM7374WT74WTWTWTWMWMWM74WM74WTWT74WTWTWT74WTWTWTWU74WMWMWUWM7475WM75WM76WMWMWM76WMWM7677WT77WTWTU>UYU>UYU>76U>77U>U>U>77U>77U>U>U>UYUYUYU>U>7677U>U>77V:U>U>V:V:U>U>V:V:U>75V:V:U>U>75V:U>U>V:V:U>U>V:V:U>73V:V:73U>V:V:U>73UYUY73U>UYUY7374UYUYV:UYV:74V:UY74U/UYUY7475UYUYUYTTUYUYTTTT73TTTTTTUY73U/U/7374U/U/74U/U/U/U/74U/U/7475U/U/TTTTUUUUTTTTUUUUTTTT73TTUU73UUUUUU73UUUU73TTUU74TTTT74TTUUTTUUUUUPUP73UPTLUP73UP73YBY>YBY>YBY>737374S:757576S:S:S:7677S;S0S0777878S0S:S:W-W-7879W-797:WFW-W-7:W-WFW-WFWFY9Y9W(7979W(W(W(Y9Y9W(79Y9Y979Y9W-W-WFW-W-W-WFWFW(W(7778W(W(7879VZ79VZW(79W(W(W(VZVZVZW(VZVZVZW(VZW6VZW6W6W6W6W/W675W6W6W(W(75W(75W(W6W(VO75VOVOW(W(75W(VOW(VOW(W6W6W.74W.W.74W6W.W.W.W6W6W6W/W/W6W/W/W/W6W6W671W6VOW6VO7071W(W(W(VUW(VUW(70W(VU70W(W(W(Y9Y9Y970VU70VUVUY9Y9VUY9X#7/X#X#7/70X#X#VUVU707171X#VUVU71X#72X#X#X#VUX#VU7172X#X#X#VUX#X#X#7172X#X#X#72X#X#VUVUX#X#VU7171X#VUX#VUX#VUVU7071VUVUVUVUW@W@X#X#70X#X#X#VUX#VU7/VU70VSVSX#VSX#7/X#X#VSVS7/VSX#X#X#7/7/VSVSVSW77/W7W77/WSW7WSW77/W7W77/70W7W77071W77272W,W773W,W,73W,73W,W774W,W,74W,W774W7W774W,W7W,W7W7W,W7W,W7W,W,W7W9W7W9W771W7W7W9W971W971W9W7W7W771W9W97172W7W7W9W9W7W7W9W971W971W9W7W9W7W771W971W9W9W9W7W9W7W970W9W9W9W7W9W7W77/W<W<W<W9W9W97/7/W<W<W<7/W<W9W9W9W<W9W9W9W9W97.W97.W<W<W9W<W<W<W9W9W97-W9W9W9W<W97,W9W97,TLUU7-TM7-7.UL7.UL7/7070TLUE71UE71UEUETLTL71TL71TLUE72UETLUE72TLTL72TL72TLTLTLTLTLUE727273UE74UE74UEUE74TL75TLUE75UEUE7576UEUETLUPTL76TL76UPUP76X#VUVUX#X#7677W+W+W+77W+WEW+W+76WE77WEWEWE7778WEWE7879WEWE79W+WEW+W+W+WE78WEW+W9W978W9X#78X#W9W<78W<79W<W:W<W:78W:W<W<78WUW:79W)W<W)79W<W<79W<79W<W<W<W<W<79W<W)79W)7:7:W<W<W<WU7:7;7<WUWUWU7<WUWUWU7<WU7<W1W17<W1W1W1WUWUWUWXWUWXWXWX7:UIUIUIULUL7:7;UL7;7<UITHTHTATATHTHTATHT+T+UCUCUCUCUC79UCUC79UCSA79SASZX-X-X-7979VXVXVX79X*VXVXX*X*79X*79X*X*X*X*X*79X*X*X*X*79X*X*797:X*VXX*VXX*X*VXX*VX78VXVXX*X*78X*VX78VX79VXX*VXX*WUW1WUW1WUWUWU77WU77WU78WU78WUWUWAWA78WAWU78W1W178W1W1W178TI79TI79TITDTI79S4S4S4SX79S@7:7:SXS@7;S@7;S@S@S@7;S@S@SXSX7;SXS@7;S@S@TD7;TD7<S.SMS.S.S.SMS.S.SMSM7:7;SMSM7;SMS.SMS.SMSM7:SMSMSMSMSM7:7:7;T$T$T$SK7;SKT$7;T$7<T$7<T$7=T$7=7>SKT$SKSKSK7=SKT$SKS3S37=7>S3S3SJSJS3S3S37=7=S3SO7>S3SOS3SO7=SOSOSOSO7=7>SG7>SGSOSOSOSGSOSGSO7=SOSO7=SOSOSOSGSGSWSWW>W>W>WVW>W>W>7;WV7;WVWV7;WVWVWVW>W>7;W>WV7;WVWVW>W>7;7<W>W>WVWVW>WVW>WVW$W$W$W?W$W?W?W?78U#T-U#SJSJSJ78SJ78SJSJS7S77879S7797:SJSOSOSO7:SGSG7:SGSO7:SOSG7:SISISISISI7:SISISISOSISOS8SOS8SOS8SOS8SG77SG78SISISIS8S8S8S8S>SISIS>S>SISIS>S>S>74S>S>74SWS>75S>S>S>SWV$TPV$74V$TPV$TPV(V(V(7373U@T=74V(V(T=T=V(V(73T=V(7374T=U@U@74U@SPSOSP74SP74SPSP74SOSPSPSP74SPSPS>S>SPSPS>S>73S>SP73SPSPSPS6SPSPS6S6SRS6S6S6S6SRSRSR70SR7071SRSRS6S67172S672SRSRU<U<U<72U<U<72U<U<TGTGTGT;TGT;TG707172V.SD72SDSDSPSP72SPS6S6S672SRSR72SRSESDSESET/71T/7272T073T073T0T/T0T0T0T073T073T0T0T0T;T073T073T0T0T;T;73T;T0T;T0T07273T0T0T;T;73T;T073T0T;T;73T;74T;TGT;T;T;T;T;7373V.74V.74V.7576V.V.76V.T0T0T;T0T0T075V.75V.V.V.T0T075V.T0T0T0V.74V.V.V.T;T;7475T;T;75T;T075T0T0T0T075V.SESESSSSSESESESSSESE7374SE74SESSX;X;7475X;X;7576T576T5T5T3T376777778T5T5T5T3T5T3T5T3T5T5T3T376T3T576T5T5T0T0T7T7T0T0T7T7T0T.T.T.T.T0T.T.7273T.T.T0T073T0T.73T.T.UMUMT0UMV.V.UMV.T071T0UMUMV.UMUMUMV.UM70V.V.70V.UM70UMUMV.V.UMV.T0UMT0UM7.UM7/UM7/70UMUM70UMT071T0T0T0UMT0UMT0T07/T.T.T.T0T07/T07/UMT0UMT0UM7/UMV.V.UM7/7/V.UM707071UMUMSSSSSE71SESSSSSS70XBXBXBXDXD70XD7071XBXB71XD72XD72XDXBXBXDXBXBXBXDXDXB71XDXD7172XDXD72XD7273XBXB7374T5T5T.T.T5T.X.X.X&X&X.X.X&X&X&X.X&X&X.X.X&X&X.X&X&X&X.X.X&X&X.X.X&X&X.X.X.X&Y4Y4Y@Y@Y4Y@Y4Y@Y4Y@Y@Y@Y4Y4Y@Y@Y4Y4Y@Y@Y4Y@Y@Y@Y4Y@Y@Y@Y4Y@Y4Y4Y@Y@Y4Y4Y@Y@Y4Y4Y4Y@Y4Y4Y@Y@Y4Y4Y'Y,Y'Y,Y'Y,Y'Y,YHYHYUYUYHYHYUYUY3Y3Y,Y,Y,Y3Y,Y,Y,Y,Y,Z&Z&Z&Y,Z&Y,Y,Y,Z&Z&Z&Y,Z&Z&Z&Y,Z&YLYLZ$Z$YLYVYLYVYVYVYLYLYVYGYVYVYGYGYVYGYVYVYVYGYVYVYVYGYNYNYXYXYNYNYXYNYXYXYXYNYNYNX.X.YNYNYNX.YNYGYNYNYGYNYGYGYNYNYGYGYGYNYGYGYNYNYGYGYNYNYNYGYNYNX.X.YNX.X.X.YNYNX.X.YNX.YNX.YGYGYGX.YGX.YGX.YGYGYGX.YGYGX.X.X.YGX.YGX.X.X.X&X.X&X&X&WGWGW=W=WGWGW=W=UTTLUTUTUTTLUTUTUTTLUTTLV?V?V?TLV?V?TLTLUGUGTLUGTLUGTLTLV9V;V9V;V9V9V9V;V9V9V;V;V9V9V;V;TLUGUGUGTLUGUGUGUGUGTLUGUGUGTLUGUGUGUGTUUGUGTLTLUGTUTLTLV;V;TUV;UKUKUKUPUKUKUPUPUKUKUPUPY.Y.YIY.Y.Y.YIY.Y.Y'Y.Y.Y.Y.YIYIY.YIYIYIY.Y.YIYIY.Y.YIYIY.YIYIYIY.Y.YIY.Y.Y.Y.YIY.Y.YIYIY.Y.YIY.Y.Y.YIY.Y.Y.YIY.YIYIYIY.Y.Y.YIYIY.Y.YIYIY.Y.YIY.Y.Y.YIYIY.Y.YIY.YIY.YIY.Y'Y'Y.Y'Y.Y'Y.Y'Y'Y'Y.Y.Y'Y'Y.Y.Y'Y.Y.Y.Y'Y'Y.Y.Y'Y.Y.Y.Y'Y'Y.Y.Y'Y'Y.Y.Y'Y'Y.Y'Y.Y'Y.Y'Y.Y'Y.Y.Y'Y'Y.Y.Y.Y'Y.Y.Y.Y'Y.Y'Y.Y'Y.Y.Y'Y'Y.Y'Y'Y'Y,Y,Y,Y'Y,Y,Y'Y'Y,Y,Y'Y'Y,Y,Y'Y'Y,Y,Y,Y,Y'Y'Y'Y,Y'Y,Y'Y'Y,Y,Y'Y'Y'Y,Y,Y,Y'Y'Y'Y,Y'Y'Y'Y,Y,Y,Y'Y'Y,Y,Y'Y'Y,Y,Y'Y'Y.Y.Y.Y'Y'Y'Y.Y'Y.Y.Y'Y,Y'Y'Y'Y'Y'Y,Y'Y,Y'Y'Y,Y,Y'Y,Y'Y,Y'Y,Y'Y'Y,Y,Y'Y,Y'Y,Y'Y,Y,Y,Y'Y,Y,Y,Y,Y'Y'Y'Y'Y'Y,Y,Y'Y,Y,Y,Y.Y.Y.Y'Y.Y'Y.Y.Y.Y.Y.Y'Y.Y.Y.Y'Y.Y'Y'Y'Y.Y'Y.Y'Y.Y'Y'Y'Y'Y'Y.Y'Y'Y'Y'Y,Y'Y,Y,Y,Y'Y,Y'Y'Y'Y,Y'Y,Y,Y,Y,Y'Y'Y,Y,Y,Y'Y,Y'Y'Y,Y,Y'Y,Y'Y,Y'Y,Y'Y,Y'Y,Y.Y'Y.Y'Y'Y'Y.Y.Y'Y'Y.Y'Y.Y'Y.Y'Y'Y'Y.Y.Y'Y'Y.Y.Y'Y'Y'Y.Y'Y'Y'Y,Y'Y,Y,Y,Y'Y,Y,Y,Y.Y.YIYIYIY.YIYIY.Y.YIYIY.Y.Y.YAY.YAY.Y.Y.Y.Y.YIY.Y.YIYIY.Y.YIYAY.YAYAYAYIYAYIYAYAYAY.Y.YAYAY.YAY.YAY.YAYAYAYIYIYAYAYIYIYAYAYIYIYAYAYIYAYAYAYAYIYAYAYIYAYAYAYIYIYAY,YAY,YAY,YAY,Y,Y,YIYIYIY,YIYIYIY,YIY,YIY,YIY,Y,Y,YIYIY,YIY,Y,Y,Y,Y,YIY,YIYIYIY,YIYIYIY,Y,YIYIY,Y,YIYIY,Y,YIY,YIY,YIYIY,YIYIYIYIY,YIYIY,Y,YIY,YIYIYIZ)YIYIZ)Z)Z)Z)Z)YIZ)Z)Z)YIYIZ)Z)Z)YIZ)YIZ)Z)Z)Z)YIYIZ)YIZ)YIYIZ)Z)Z)Z)Z)YIZ)Z)Z)YIZ)YIYIYIZ)Z)YIYIYIYMYIYMYMYIYMYMY,Y,YIY,Y,Y,YIYIYIY,YIYIYIY,YIY,YIY,Y,Y,YIYIY,Y,Y,Y,YIY,Y,Z&Z&Z&Y,Z&Y,Z&Y,Z&Y,Z&Y,Z&Y,Z&Y,Y,Y,Z&Y,Y,Y,Z&Y,Z&Z&Z&Z&Z&Y,Z&Y,Z&Y,Z&Y,Z&Y,Y,Y,Z&Y,Z&YKY,YKYKY,Z&Z&Z&Y,Z&Z&Z&Y,Y,Y,Z&Y,Y,Y,Z&Z&Z&YKYKZ&Z&YKYKY,Y,Y,Z&Y,Z&Z&Z&YIYIYIY,YIY,Y,Y,YIY,Y,Y,YIY,YIY,YIY,YIY,YIY,YIY,YIYIYIY,YIY,Y,Y,YIY,YIY,YIY,YIY,YIY,YIY,YIYIYIY,YIY,Y,Y,YIY,YIY,Y,Y,YIY,YIY,YIY,Y,Y,Z)Y,Y,Y,Y,Z)Y,Y,Z)Z)Y,Y,Z)Y,YIYIZ)Z)Z)Z)Y,Y,Z)Y,Z)Z)Y,Y,Z)Z)Y,Z)Z)Z)Y,Z)Z)Z)Y,Y,Y,Z)Y,Y,Y,Z)Y,Y,Z)Y,Y,Y,Y,Z)Y,Y,Z)Z)Z)Z)Y1Y1Y,Y,Z)Z)Y,Y,Z)Z)Z)Z#Z)Z#Z#Z#Z)Z#Z)Z#Z)Z#Z)Z#Z)Z#Z)Z#Z#Z#YZZ#YZZ#Z)YZYZYZYZYZZ)YZZ)YZZ)Z)Z)Z)YMZ)YMZ)YMYMYMZ)YMYMZ)Z)YMYMZ)Z)YMYMZ)YMZ)YMZ)Z)Z)YMZ)YMYMYMYMZ)YMYMZ)Z)Z)YMZ)Z)YMYMZ)YMYMYMY,Y,Y,Z#Y,Y,Y,Z#Y,Y,Z#Z#Y,Y,Y,Z#Y,Y,Z#Z#Y,Z#Y,Y,Y,Z#Z#Z#Y,Z#Z#Z#Y,Y,Y,Z#Y,Y,Z#Z#Y,Z#Z#Z#YMY?Y?Y?YMY?YMYMY?Y?Y?YMY?Y?YMYMY?Y?YMY?YMY?YMY?YMYMYMY?YMY?YMYMZ'Y?Z'Z'YMY?Y?Y?YMY?Y?Y?Y?Y?YMYMYMY?YMYMYMY?YMYMY?Y?YMYMYMY?YMYMYMYMY?Y?YMYMY?YMY?Y?YMY?Y?Y?YMYMYMY?Y?Y?YMYMYMY?Z&Z&YKZ&Z&Z&YKYKZ&Z&YKYKZ&Z&YKYKZ&Z&YKZ&YKZ&YKYKZ&Z&YKYKZ&Z&YKYKYKYKYKZ&Z&Z&YKZ&YKZ&YKYKZ&Z&YKZ&Z&Z&YKYKYKYKY-YKYKYKYKY-Y-YKY-Y-Z#Z#Y0Y0Z#Z#Z#Y0Z#Y0Y0Y0Z#Z#Y0Y0Z#Z#Y0Y0Z#Z#Y0Y0Z#Y0Z#Y0Z#Y0Y0Y0Z#Y-Z#Y-Z#Y-Z#Z#Z#Y-Z#Z#Z#Y-Y-Y-Z#Z#Z#Y0Z#Z#Z#Y0Y0Y-Y0Y0Y0Y-Y0Y0Y0Y-Y0Y0Y-Y-Y0Y0Y-Y-Y0Y0Y-Y-Y0Y0Y-Y-Y0Y0Y-Y-Y-Y0Y-Y-Y0Y0Y-Y-Y0Y-Y-Y-Y-Y0Y-Y-Y0Y0Y-Y0Y0Y0Z#Z#Z#Y?Y?Y?Z#Z#Z#Z#Y?Y?Z#Z#Y?Y?Z#Y?Z#Y?Y?Y0Y0Y0Y0Y0Y?Y0Y?Z'Z'Z'Y0Z'Z'Z'Z'Y0Y0Y0Y0Y0Z'Y0Z'Z'Z'YPYPZ'YPYPYPYPYPZ'Z'Z'YPYPY-Y-Y0Y0Y-Y-Y-Y0Y-Y-Y0Y0Y0Y-Y0Y0Y-Y-Y0Y0Y-Y0Y0Y0Y-Y-Y-YYY-Y-YYYYY-YYY-YYY-YYY-Y-YYYYY0Y0YYY0Y0Y0Y0YYY0Y0Y-Y-Y0Y0Y-Y0Y0Y0Y0Y0Y0Y+Y0Y0Y+Y+Y0Y+Y+Y+Y0Y0Y+Y+Y0Y0Y0Y/Y+Y/Y+Y+Y0Y0Y0Y/YEYEZ&YEYEYEY<Y<YYYYY/Y/YYYYY/Y/YYY/Y/Y/Y<Y<Y2Y2Y2Y2Y/Y2Y2Y<Y2Y2Y2Y<Y<Y<Y2Y<Y2Y<Y<Y<Y/Y/Y/Y<Y/Y<Y/Y<Y/Y/Y<Y<Y<Y/Y<Y<Y/Y/Y<Y/Y/Y/Y<YGY<Y<YGYGY<YGY<Y<Z(Z(YGYGY<Y<YGYGY<YGY<YGY<YGY<Y<Y<YGYGYGY<YGYGYGY<Y<YGYGY<YGYGYGZ%Z%VTVTVTVQVTVTVQVQVTVQVQVQVNVNX(X(VNX(X(X(VNVNVNX(W3W3W3X'W3W3X'X'W3W3X'X'W%W%WUWUW%W%WUW%WUX,WUWUX,X,WUWUX,X,WUWUWUX,WUX,U>TTU>TTU>TTTTTTTUTUU0U0TUTUU0U0TLU0TLU0TLU0TLTLU0U0TLTLTUTUU0U0TUTUU0U0TUTUU0U0TUTUTUV;TUTUV;V;TUTUTUV;TUV;V;V;TUV;TUV;TUV;TUV;TUTUTUV;TUTUV;V;TUTUTUUPTUTUUPUPTUTUUPUPTUTUUPUPTUTUUPUPTUTUUPUPTUTUUPUPTUTUUPUPTUTUUPUPTUV;TUV;TUV;TUV;TUTUTUV;TLTLTLU5TLU5U5U5UPUPU9U9UPUPU9U9V;UPV;UPV;UPV;UPV;UPV;V;V;V;V;UPTUV;V;V;TUV;TUV;TUTUTUV;TUTUTUV;TUV;V;V;TUTUTUV;V;UPV;UPUPUPV;V;UPUPV;V;UPUPV;UPV;UPV;UPV;UPV;UPV;V;UPUPYBYBYBY>YBYBY>Y>YBYBYBY>YBYBYBY>Y>YBYBYBY>YBYBYBYIYIYBYBYIYIYIYBYBYIYBYIYIYIYBYIYIYIYBYBYIYIYBYBYIYIYBYBYMYMYIYMYIYIYIYFYFYFYIYFYMYMYIYMYIYMYIYMYMYMYMYOYMYOYMYOYMYMYOYOYMYMYOYOYOYOYMYMYOYOYMYMYOYOYOYMYPYPZ'Z'YPYPZ'YPZ'YPZ'Z'YPYPZ'YPZ'YJZ'YJYJYJZ'YJYPY+Y+Y+YWYWYSYSYWYSYWYSYWYSYSYSY/Y/Y+Y/Y/Y/Y+Y/Y+Y/Y+Y+YTYTY/Y/YTYTYTY/Y/Y/YTYTY/YTYTYTY/Y/YTYTY/Y/Y/YTY/YTYTYTY/YTYTYTY/Y/Y/YTY/YTYTYTY9Y9Y*Y9Y*Y9Y*Y*Y*Y*Y*Y9Y9Y9X#X#Y9X#X#X#VWVWX#VWVWVWVWX#VWVWX#X#VWVWX#X#VWVWX#X#VWVWX#X#VWVWX#X#VWVWX#X#VWVWX#X#VWVWX#X#WSWSVSVSVSWSVSWSVSWSVSWSWSWSWSW,WSWSVSVSVSWSVSVSWSWSVSWSVSWSVSVSWSWSVSWSVNVNWPVNVNVNWPWPVNVNVNWYVNWYWYWYVNVNVNWYVNWYWYWYVNVNVNWYVNWYVNVNWYVNWYWYVNVNWYWYVNVNWYWYVNVNWYWYVNVNWYWYW#WYWYWYWYW#WYWYW#W#WYWYW#WYWYWYVNVNW#VNVNVNWYWYVNWYVNWYVNWYWYWYWYWYW,W,WYWYW,WYWYWYWYW,W,W,WYW,WYWYW,W,WYWYW,W,WYW,W,W,WYW,WYWYWYWYW,W,WYWYW,W,WYWYW,W,WYWYW,W,WYWYW,W,W,W,WYW,W,W,WYW,W#W#WYWYW#WYWYWYW,W,W,WYW,WYWYWYW,WYWYWYW,W,W,WYW,WYWYWYWYWYW,W,WYWYW,W,WYWYW,WYWYWYW#W#W,W,W#W#W,WYW,W,WYWYW,W,WYWYW,W,WYW,W,W,W,WYW,W,W#W#W#W,W#W,W,W,WYWYWYW,W#WYW#WYW#W#WYWYW#W#WYW#W#WYW#WYW#WYW#W#WYWYW#WYWYW#WYWYWSWSWSW,W,W,WSWSW,W,WSWSW,W,W7W7W,W,W7W7WYW#WYW#W#W#WYWYWYW#WYWYW#WYWYWYWYW#W#W#W#WYW#WYWYWYWYW#WYWYW#W#WYW#WYWYWYW#WYWYW#W#WYW#WYW#WYWYW#W#WYWYW#W#WYWYW#W#WYWYW#W#WYW#WYW#WYWYW#W#W#WYW#WYWYWYWYWYWYW#WYWYW#W#WYWYW#W#WYWYW#W#WYW#WYW#WYWYWYW#WYWYW#W#WYWYW#WYW#W#WYW#WYW#W#W#WYWYWYW#WYWYW#W#WYW#W#W#WYWYW#W#WYWYWYW#WYWYW#W#WYW#WYW#WYWYW#W#WYW#W#W#WYW#W#W#W#W#WYWYWYWYW#W#W#W#WYWYWYWYW#W#W#VNW#W#VNVNW#W#VNVNW#VNWUWUWMWMWMWMWMWUWUWUWUWMWUWUWUWMWUWUWUWMWUWMWUWUWUWUWMWMWMWMWTWTWMWMWTWTWMWTWMWTWMWMWMWTWMWTWTWTWMWMWTWMWMWMWTWTWMWTWTWTWMWMWTWTWMWTWTWTWMWMWMWTWMWMWTWTWMWTWTWTWUWUWMWMWUWMWMWMWMWUWMWMWMWTWMWMWMWTWMWTWMWMWTWMWMWMWMWTWMWMWTWTWMWTWTWTUYUYU>UYU>UYU>UYU>UYUYUYU>UYU>U>U>U>V:V:U>U>V:V:U>U>V:V:U>U>V:V:U>U>V:V:U>U>U>V:U>U>V:V:U>U>UYUYU>U>UYUYU>U>UYUYU>UYUYUYV:UYV:UYV:V:U/U/U/UYU/U/UYUYU/U/UYUYUYTTUYUYU/U/UYUYU/U/UYUYU/U/UYUYU/U/UYUYU/U/UYUYU/U/UYUYU/U/TTTTUUTTTTUUUUUUUUTTUUUUTTTTUUTTTTTTUUTTUUTTUUUUUPUPTLUPTLTLUPUPY>YBY>YBY>YBY>YBS:S;S:S;S:S:S;S;S;S;S:S:S:S:S;S:S:S:S;S:S:S:S;S:S:S;S:S:S:S0S:S:S0S0S:S0S0S0S:S0W-W-WFWFW-WFWFWFW-W-W-WFWFW-WFWFWFW-WFW-Y9Y9W(W(Y9Y9Y9W(W(Y9W(W(W(Y9W(W(W(W(VZVZW(W(VZW(W(W(W(VZW(W(VZW(VZVZW(VZVZW(VZW(W6W(W6W6W6W(W6W(W6W(W6W6VOW(VOW(W(W(VOW(W6W6W.W6W.W.W.W6W6W6W6VOY9Y9W(Y9Y9Y9W(W(W(W(W(VUY9Y9W(W(Y9VUY9VUY9Y9VUY9X#VUX#X#VUVUX#X#VUVUX#X#VUVUVUX#VUX#X#X#X#X#VUX#VUVUVUX#X#X#VUX#VUVUVUX#VUVUX#X#VUX#VUVUX#X#VUX#X#VUVUVUVUX#VUVUVUX#VUX#X#X#X#VUX#X#VUVUVUX#VUVUVUX#VUX#VUX#VUX#X#VSX#X#VSVSX#VSX#X#X#VSX#VSVSVSW7WSW7W7WSWSW7WSWSWSW7WSWSWSWSW7WSWSW7W7W7W,W7W7W,W,W7W,W7W,W7W7W,W,W7W,W7W,W7W7W,W,W7W,W7W,W7W7W7W,W7W7W,W,W7W,W7W,W7W7W,W,W7W,W7W9W7W7W7W9W7W9W7W9W7W7W7W9W9W9W9W9W7W7W9W9W7W9W9W9W7W9W7W9W7W9W7W7W7W9W7W7W7W9W7W9W9W9W9W9W9W<W9W9W<W<W9W9W9W<W9W<W9W<W9W<W<W<W9W9W9W<W9W9W9W<W9W<W9W<TLTLUUTLTLTLUUTLTMULTMULTMTMTMULULULTMULTMULTMTMULULTMULUETLUEUEUETLUETLTLTLUETLTLTLUETLUETLUEUEUETLTLTLTLTLUEUETLTLUETLUETLTLTLUETLUETLTLTLUEUETLTLUETLUETLUEUETLTLUETLTLTLUETLUETLUEUEUETLUEUETLTLUEUETLTLUETLTLUPTLUPTLUPUPUPX#X#VUVUX#X#VUVUX#X#VUX#W+W+W+WEW+W+W+WEW+WEWEWEW+WEW+W+WEWEW+WEWEWEW+W+WEWEW+W+WEW+WEW+W+W+WEW+X#W9X#X#X#W9W9W9W<W<W<W:W<W:W:W:W<W:W<W:WUWUW:W:W:WUW:W:W)W<W)W)W)W<W)W<W)W)W)W<W<W<W)W)W)W)W)W<W)W<W)W<W)W)W<W)WUX-X-X-WUWUX-X-WUX-X-X-WUWUW1WUWUW1W1W1WUWUWUW1WUW1W1W1T>UIUIUIUIULUIUIULULUIULULULUIUIULUIULUIUCUCU?U?UCUCU?U?SASZSASZX-X-X-VXX-VXX-VXX*X*VXVXVXX*VXX*VXX*VXX*X*X*X*VXX*X*X*VXX*X*VXVXX*VXVXVXVXX*VXVXVXX*VXVXX*X*VXX*VXX*VXX*WUWUWUWAWUWAWAWAWUWAWUWAWUWUWUWAWAWAWUWAWUWUWUW1WUW1W1W1TDTITITITITITDTITDTITDTDS4S=S4S4SXSXSXS@SXSXS@S@SXSXS@S@SXSXS@SXSXSXS@SXSXSXS@S@S@SXS@S@S@SXS@SXTDTITDTITDTITDTISMSMS.S.SMSMS.S.SMSMS.S.SMT$SMSMSMT$SMSMSMSMSMT$SMSMT$T$T$T$T$SKT$T$T$SKT$SKT$SKT$SKT$SKT$SKT$T$T$SKSKSKT$SKT$SKT$SKT$SKS3SJSJSJSJS3SJSJS3SOS3SOS3S3SOSOSOS3SOSOS3SOS3SOSOSGSGSGSOSOSOSGSOSGSOSOSOSGSOSOSGSGSOSOW>W>WVWVW>W>WVWVW>WVWVWVW>W>WVW>WVW>WVWVWVW>WVWVW>WVWVWVT-U#T-U#SJS7SJS7SJS7SJSJS7S7S7SJS7S7SJSJS7S7S7SJS7S7SJSJSOSGSOSGSOSGSGSGSOSGSOSGSOSOSOSISISISOSISGSGSGSISGSISGSIS>SWS>S>SWSWS>SWSWSWS>S>V$TPTPTPV(V(V(T=T=V(T=T=T=U@T=T=V(V(T=T=V(T=T=T=V(V(T=T=U@U@T=T=SOSOSPSOSPSOSPSPSOSOSOSPSOSPSPSPS>S>SPS>SPS>SPSPS6S6S6SRSRS6SRSRS6S6S6SRS6S6S6SRS6S6SRSRS6S6SRSRU<U<U<T1U<U<T1U<TPTPTPV.TPTPV.V.TPV.V.V.SPSPSDSPSDSPSDSPS6SRS6S6SDSRSDSRT/T/T0T0T/T0T/T/T/T/T0T0T0T0T/T0T/T0T/T0T0T0T;T;T0T;T0T0T;T;T0T;T0T;T0T0T0T;T0T;T0T;T0T0T;T;T0T;T;T;T0T;T;T;T0T;TGTGT;TGT;TGT;T;T;V.T;T;V.V.T;V.T;V.T;V.T;V.T;V.T;V.T;T0V.V.T0T0V.V.T0V.T0T0V.V.T0V.V.V.T0T0T0V.T0V.V.V.T;T;T0T0T;T;T0T0T;T;T0T;T;T;T0T;T0V.V.V.SESESESSSESSSSSSSESSSESSX;XDXDXDXDX;XDXDX;X;XDXDX;XDXDXDT3T3T5T3T5T3T5T5T3T3T5T3T3T3T5T3T3T3T5T5T3T3T5T5T3T3T5T5T.T0T.T.T0T0T.T0T.T0T.T.T.T0T.T.UMUMT0UMUMV.UMUMV.UMUMUMV.V.UMV.T0UMT0UMT0T0T0UMT0T0T0UMT0UMUMUMT0UMT0T0T0UMT0T0T0T0T.T.T.T0T.T.T0UMT0UMT0UMUMUMUMV.UMV.V.V.UMUMUMV.UMUMUMV.UMUMV.V.UMUMSESSSSSSXDXDXBXBXDXDXBXDXBXDXBXDXDXDXBXDXDXDXBXDXBXDXBXBXDXDXBXDXBXDXBXBXDXDXBXBXDXDXBXDXDXDXBXDXBXDXBXBXDXDXBXBT5T.T5T5T.T.T5T5",U=["Africa/Abidjan","Africa/Accra","Africa/Addis_Ababa","Africa/Algiers","Africa/Asmara","Africa/Bamako","Africa/Bangui","Africa/Banjul","Africa/Bissau","Africa/Blantyre","Africa/Brazzaville","Africa/Bujumbura","Africa/Cairo","Africa/Casablanca","Africa/Ceuta","Africa/Conakry","Africa/Dakar","Africa/Dar_es_Salaam","Africa/Djibouti","Africa/Douala","Africa/El_Aaiun","Africa/Freetown","Africa/Gaborone","Africa/Harare","Africa/Johannesburg","Africa/Juba","Africa/Kampala","Africa/Khartoum","Africa/Kigali","Africa/Kinshasa","Africa/Lagos","Africa/Libreville","Africa/Lome","Africa/Luanda","Africa/Lubumbashi","Africa/Lusaka","Africa/Malabo","Africa/Maputo","Africa/Maseru","Africa/Mbabane","Africa/Mogadishu","Africa/Monrovia","Africa/Nairobi","Africa/Ndjamena","Africa/Niamey","Africa/Nouakchott","Africa/Ouagadougou","Africa/Porto-Novo","Africa/Sao_Tome","Africa/Tripoli","Africa/Tunis","Africa/Windhoek","America/Adak","America/Anchorage","America/Anguilla","America/Antigua","America/Araguaina","America/Argentina/Buenos_Aires","America/Argentina/Catamarca","America/Argentina/Cordoba","America/Argentina/Jujuy","America/Argentina/La_Rioja","America/Argentina/Mendoza","America/Argentina/Rio_Gallegos","America/Argentina/Salta","America/Argentina/San_Juan","America/Argentina/San_Luis","America/Argentina/Tucuman","America/Argentina/Ushuaia","America/Aruba","America/Asuncion","America/Atikokan","America/Bahia","America/Bahia_Banderas","America/Barbados","America/Belem","America/Belize","America/Blanc-Sablon","America/Boa_Vista","America/Bogota","America/Boise","America/Cambridge_Bay","America/Campo_Grande","America/Cancun","America/Caracas","America/Cayenne","America/Cayman","America/Chicago","America/Chihuahua","America/Costa_Rica","America/Creston","America/Cuiaba","America/Curacao","America/Danmarkshavn","America/Dawson_Creek","America/Denver","America/Detroit","America/Dominica","America/Edmonton","America/Eirunepe","America/El_Salvador","America/Fort_Nelson","America/Fortaleza","America/Glace_Bay","America/Godthab","America/Goose_Bay","America/Grand_Turk","America/Grenada","America/Guadeloupe","America/Guatemala","America/Guayaquil","America/Guyana","America/Halifax","America/Havana","America/Hermosillo","America/Indiana/Indianapolis","America/Indiana/Knox","America/Indiana/Marengo","America/Indiana/Petersburg","America/Indiana/Tell_City","America/Indiana/Vincennes","America/Iqaluit","America/Jamaica","America/Juneau","America/Kentucky/Louisville","America/Kentucky/Monticello","America/Kralendijk","America/La_Paz","America/Lima","America/Los_Angeles","America/Lower_Princes","America/Maceio","America/Managua","America/Manaus","America/Marigot","America/Martinique","America/Matamoros","America/Mazatlan","America/Menominee","America/Merida","America/Mexico_City","America/Miquelon","America/Moncton","America/Monterrey","America/Montevideo","America/Montserrat","America/Nassau","America/New_York","America/Nome","America/Noronha","America/North_Dakota/Beulah","America/North_Dakota/New_Salem","America/Ojinaga","America/Panama","America/Pangnirtung","America/Paramaribo","America/Phoenix","America/Port-au-Prince","America/Port_of_Spain","America/Porto_Velho","America/Puerto_Rico","America/Punta_Arenas","America/Rankin_Inlet","America/Recife","America/Regina","America/Rio_Branco","America/Santarem","America/Santiago","America/Santo_Domingo","America/Sao_Paulo","America/Scoresbysund","America/Sitka","America/St_Barthelemy","America/St_Johns","America/St_Kitts","America/St_Lucia","America/St_Thomas","America/St_Vincent","America/Tegucigalpa","America/Thule","America/Thunder_Bay","America/Tijuana","America/Toronto","America/Tortola","America/Vancouver","America/Whitehorse","America/Winnipeg","America/Yakutat","America/Yellowknife","Antarctica/Casey","Antarctica/Davis","Antarctica/DumontDUrville","Antarctica/Macquarie","Antarctica/Mawson","Antarctica/McMurdo","Antarctica/Rothera","Antarctica/Syowa","Antarctica/Troll","Antarctica/Vostok","Arctic/Longyearbyen","Asia/Aden","Asia/Almaty","Asia/Amman","Asia/Anadyr","Asia/Aqtau","Asia/Aqtobe","Asia/Ashgabat","Asia/Atyrau","Asia/Baghdad","Asia/Bahrain","Asia/Baku","Asia/Bangkok","Asia/Barnaul","Asia/Beirut","Asia/Bishkek","Asia/Brunei","Asia/Chita","Asia/Choibalsan","Asia/Colombo","Asia/Damascus","Asia/Dhaka","Asia/Dili","Asia/Dubai","Asia/Dushanbe","Asia/Famagusta","Asia/Gaza","Asia/Hebron","Asia/Ho_Chi_Minh","Asia/Hong_Kong","Asia/Hovd","Asia/Irkutsk","Asia/Jakarta","Asia/Jayapura","Asia/Jerusalem","Asia/Kabul","Asia/Kamchatka","Asia/Karachi","Asia/Kathmandu","Asia/Khandyga","Asia/Kolkata","Asia/Krasnoyarsk","Asia/Kuala_Lumpur","Asia/Kuching","Asia/Kuwait","Asia/Macau","Asia/Magadan","Asia/Makassar","Asia/Manila","Asia/Muscat","Asia/Nicosia","Asia/Novokuznetsk","Asia/Novosibirsk","Asia/Omsk","Asia/Oral","Asia/Phnom_Penh","Asia/Pontianak","Asia/Pyongyang","Asia/Qatar","Asia/Qostanay","Asia/Qyzylorda","Asia/Riyadh","Asia/Sakhalin","Asia/Samarkand","Asia/Seoul","Asia/Shanghai","Asia/Singapore","Asia/Srednekolymsk","Asia/Taipei","Asia/Tashkent","Asia/Tbilisi","Asia/Tehran","Asia/Thimphu","Asia/Tokyo","Asia/Tomsk","Asia/Ulaanbaatar","Asia/Urumqi","Asia/Ust-Nera","Asia/Vientiane","Asia/Vladivostok","Asia/Yakutsk","Asia/Yangon","Asia/Yekaterinburg","Asia/Yerevan","Atlantic/Azores","Atlantic/Bermuda","Atlantic/Canary","Atlantic/Cape_Verde","Atlantic/Faroe","Atlantic/Madeira","Atlantic/Reykjavik","Atlantic/South_Georgia","Atlantic/St_Helena","Atlantic/Stanley","Australia/Adelaide","Australia/Brisbane","Australia/Broken_Hill","Australia/Currie","Australia/Darwin","Australia/Eucla","Australia/Hobart","Australia/Lord_Howe","Australia/Melbourne","Australia/Perth","Australia/Sydney","Etc/GMT","Etc/GMT+1","Etc/GMT+10","Etc/GMT+11","Etc/GMT+12","Etc/GMT+2","Etc/GMT+3","Etc/GMT+4","Etc/GMT+5","Etc/GMT+6","Etc/GMT+7","Etc/GMT+8","Etc/GMT+9","Etc/GMT-1","Etc/GMT-10","Etc/GMT-11","Etc/GMT-12","Etc/GMT-2","Etc/GMT-3","Etc/GMT-4","Etc/GMT-5","Etc/GMT-6","Etc/GMT-7","Etc/GMT-8","Etc/GMT-9","Etc/UTC","Europe/Amsterdam","Europe/Andorra","Europe/Astrakhan","Europe/Athens","Europe/Belgrade","Europe/Berlin","Europe/Bratislava","Europe/Brussels","Europe/Bucharest","Europe/Budapest","Europe/Busingen","Europe/Chisinau","Europe/Copenhagen","Europe/Dublin","Europe/Gibraltar","Europe/Guernsey","Europe/Helsinki","Europe/Isle_of_Man","Europe/Istanbul","Europe/Jersey","Europe/Kaliningrad","Europe/Kiev","Europe/Kirov","Europe/Lisbon","Europe/Ljubljana","Europe/London","Europe/Luxembourg","Europe/Madrid","Europe/Malta","Europe/Mariehamn","Europe/Minsk","Europe/Monaco","Europe/Moscow","Europe/Oslo","Europe/Paris","Europe/Podgorica","Europe/Prague","Europe/Riga","Europe/Rome","Europe/Samara","Europe/San_Marino","Europe/Sarajevo","Europe/Saratov","Europe/Simferopol","Europe/Skopje","Europe/Sofia","Europe/Stockholm","Europe/Tallinn","Europe/Tirane","Europe/Ulyanovsk","Europe/Uzhgorod","Europe/Vaduz","Europe/Vienna","Europe/Vilnius","Europe/Volgograd","Europe/Warsaw","Europe/Zagreb","Europe/Zaporozhye","Europe/Zurich","Indian/Antananarivo","Indian/Chagos","Indian/Christmas","Indian/Cocos","Indian/Comoro","Indian/Kerguelen","Indian/Mahe","Indian/Maldives","Indian/Mauritius","Indian/Mayotte","Indian/Reunion","Pacific/Apia","Pacific/Auckland","Pacific/Bougainville","Pacific/Chatham","Pacific/Chuuk","Pacific/Easter","Pacific/Efate","Pacific/Enderbury","Pacific/Fakaofo","Pacific/Fiji","Pacific/Funafuti","Pacific/Galapagos","Pacific/Gambier","Pacific/Guadalcanal","Pacific/Guam","Pacific/Honolulu","Pacific/Kiritimati","Pacific/Kosrae","Pacific/Kwajalein","Pacific/Majuro","Pacific/Marquesas","Pacific/Midway","Pacific/Nauru","Pacific/Niue","Pacific/Norfolk","Pacific/Noumea","Pacific/Pago_Pago","Pacific/Palau","Pacific/Pitcairn","Pacific/Pohnpei","Pacific/Port_Moresby","Pacific/Rarotonga","Pacific/Saipan","Pacific/Tahiti","Pacific/Tarawa","Pacific/Tongatapu","Pacific/Wake","Pacific/Wallis"];if(W=+W,!(-90<=(Y=+Y)&&Y<=90&&-180<=W&&W<=180))throw new RangeError("invalid coordinates");if(90<=Y)return "Etc/GMT";var S=-1,V=48*(180+W)/360.00000000000006,X=24*(90-Y)/180.00000000000003,Z=0|V,M=0|X,I=96*M+2*Z;for(I=56*T.charCodeAt(I)+T.charCodeAt(I+1)-1995;I+U.length<3136;)I=56*T.charCodeAt(I=8*(S=S+I+1)+4*(M=0|(X=2*(X-M)%2))+2*(Z=0|(V=2*(V-Z)%2))+2304)+T.charCodeAt(I+1)-1995;return U[I+U.length-3136]}"undefined"!=typeof module&&(module.exports=tzlookup);

    },{}],2:[function(_dereq_,module,exports){

    var tzlookup = _dereq_('tz-lookup'); //.trim() pollyfill


    if (!String.prototype.trim) {
      var rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;

      String.prototype.trim = function () {
        return this.replace(rtrim, '');
      };
    }

    var isArray = function isArray(hmm) {
      return Object.prototype.toString.call(hmm) === '[object Array]';
    };

    var isString = function isString(hmm) {
      return typeof hmm === 'string';
    };

    function isObject(hmm) {
      return hmm instanceof Object && hmm.constructor === Object;
    }

    var findTz = function findTz(geo, b) {
      var lat = null;
      var lng = null; //accept weird formats

      if (typeof b === 'number' && typeof geo === 'number') {
        lat = geo;
        lng = b;
      } else if (isArray(geo) === true) {
        lat = geo[0];
        lng = geo[1];
      } else if (isString(geo) === true) {
        var arr = geo.split(/[,/]/);
        lat = arr[0].trim();
        lng = arr[1].trim();
      } else if (isObject(geo) === true) {
        lat = geo.lat || geo.latitude;
        lng = geo.lng || geo.lon || geo["long"] || geo.longitude;
      } else {
        return this;
      } //validate lat/lng


      if (lat < -90 || lat > 90) {
        console.warn('Invalid latitude: ' + lat);
        return this;
      }

      if (lng < -180 || lng > 180) {
        console.warn('Invalid longitude: ' + lng);
        return this;
      }

      var tz = tzlookup(lat, lng);

      if (!tz) {
        console.warn('Found no timezone for ' + lat + ', ' + lng);
        return this;
      }

      return this["goto"](tz);
    };

    module.exports = findTz;

    },{"tz-lookup":1}],3:[function(_dereq_,module,exports){

    var find = _dereq_('./findTz');

    var point = _dereq_('./point');

    module.exports = {
      "in": find,
      point: point
    };

    },{"./findTz":2,"./point":5}],4:[function(_dereq_,module,exports){

    //these are points i chose for each timezone, typically in its most populous location
    module.exports = {
      "Pacific/Midway": '28.21,-177.37',
      //Midway Atoll, United States
      "Pacific/Niue": '-19.06,-169.92',
      //Alofi, Niue
      "Pacific/Pago_Pago": '-14.28,-170.7',
      //Pago Pago, Eastern District, American Samoa
      "America/Adak": '51.88,-176.66',
      //Adak, AK, USA
      "Pacific/Honolulu": '21.31,-157.86',
      //Honolulu, HI, USA
      "Pacific/Johnston": '16.73,-169.53',
      //Johnston Island, United States Minor Outlying Islands
      "Pacific/Rarotonga": '-21.21,-159.78',
      //Avarua District, Cook Islands
      "Pacific/Tahiti": '-17.56,-149.6',
      //Fa'a'ā, French Polynesia
      "Pacific/Marquesas": '-8.91,-140.1',
      //Taioha'e, French Polynesia
      "America/Anchorage": '61.22,-149.9',
      //Anchorage, AK, USA
      "America/Juneau": '58.3,-134.42',
      //Juneau, AK, USA
      "America/Metlakatla": '55.13,-131.57',
      //Metlakatla, AK 99926, USA
      "America/Nome": '64.5,-165.41',
      //Nome, AK, USA
      "America/Sitka": '57.05,-135.33',
      //Sitka, AK, USA
      "America/Yakutat": '59.55,-139.73',
      //Yakutat, AK, USA
      "Pacific/Gambier": '-23.11,-134.97',
      //Mangareva, French Polynesia
      "America/Dawson": '64.06,-139.43',
      //Dawson, YT, Canada
      "America/Los_Angeles": '34.05,-118.24',
      //Los Angeles, CA, USA
      "America/Tijuana": '32.51,-117.04',
      //Tijuana, Baja California, Mexico
      "America/Vancouver": '49.28,-123.12',
      //Vancouver, BC, Canada
      "America/Whitehorse": '60.72,-135.06',
      //Whitehorse, YT, Canada
      "Pacific/Pitcairn": '-25.07,-130.1',
      //Adamstown PCRN 1ZZ, Pitcairn Islands
      "America/Boise": '43.62,-116.2',
      //Boise, ID, USA
      "America/Cambridge_Bay": '69.12,-105.06',
      //Cambridge Bay, NU, Canada
      "America/Chihuahua": '28.63,-106.07',
      //Chihuahua, Mexico
      "America/Creston": '49.1,-116.51',
      //Creston, BC V0B, Canada
      "America/Dawson_Creek": '56.25,-120.85',
      //Fort St John, BC, Canada
      "America/Denver": '31.76,-106.49',
      //El Paso, TX, USA
      "America/Edmonton": '51.05,-114.07',
      //Calgary, AB, Canada
      "America/Fort_Nelson": '58.81,-122.7',
      //Fort Nelson, BC V0C, Canada
      "America/Hermosillo": '29.07,-110.96',
      //Hermosillo, Sonora, Mexico
      "America/Inuvik": '68.36,-133.72',
      //Inuvik, NT X0E, Canada
      "America/Mazatlan": '24.81,-107.39',
      //Culiacán, Sinaloa, Mexico
      "America/Ojinaga": '31.69,-106.42',
      //Ciudad Juarez, Chihuahua, Mexico
      "America/Phoenix": '33.45,-112.07',
      //Phoenix, AZ, USA
      "America/Yellowknife": '62.45,-114.37',
      //Yellowknife, NT X0E, Canada
      "America/Bahia_Banderas": '20.76,-105.33',
      //Bucerías, Nayarit, Mexico
      "America/Belize": '17.5,-88.2',
      //Belize City, Belize
      "America/Chicago": '41.88,-87.63',
      //Chicago, IL, USA
      "America/Costa_Rica": '9.93,-84.09',
      //San José Province, San José, Costa Rica
      "America/El_Salvador": '13.69,-89.22',
      //San Salvador, El Salvador
      "America/Guatemala": '14.63,-90.51',
      //Guatemala City, Guatemala
      "America/Indiana/Knox": '41.3,-86.63',
      //Knox, IN 46534, USA
      "America/Indiana/Tell_City": '37.95,-86.77',
      //Tell City, IN, USA
      "America/Managua": '12.11,-86.24',
      //Managua, Nicaragua
      "America/Matamoros": '26.05,-98.3',
      //Reynosa, Tamaulipas, Mexico
      "America/Menominee": '45.11,-87.61',
      //Menominee, MI 49858, USA
      "America/Merida": '20.97,-89.59',
      //Mérida, Yucatan, Mexico
      "America/Mexico_City": '19.43,-99.13',
      //Mexico City, CDMX, Mexico
      "America/Monterrey": '19.49,-99.12',
      //Gustavo A. Madero, Mexico City, CDMX, Mexico
      "America/North_Dakota/Beulah": '44.63,-86.09',
      //Beulah, MI, USA
      "America/North_Dakota/Center": '47.115,-101.301',
      //Center, ND, USA
      "America/North_Dakota/New_Salem": '46.83,-100.89',
      //Mandan, ND 58554, USA
      "America/Rainy_River": '48.72,-94.57',
      //Rainy River, ON, Canada
      "America/Rankin_Inlet": '62.81,-92.09',
      //Rankin Inlet, NU, Canada
      "America/Regina": '52.13,-106.67',
      //Saskatoon, SK, Canada
      "America/Resolute": '74.7,-94.83',
      //Resolute, NU, Canada
      "America/Swift_Current": '50.29,-107.8',
      //Swift Current, SK, Canada
      "America/Tegucigalpa": '14.07,-87.19',
      //Tegucigalpa, Honduras
      "America/Winnipeg": '49.9,-97.14',
      //Winnipeg, MB, Canada
      "Pacific/Easter": '-27.11,-109.35',
      //Easter Island, Valparaiso Region, Chile
      "Pacific/Galapagos": '-0.74,-90.32',
      //Puerto Ayora, Ecuador
      "America/Atikokan": '48.76,-91.62',
      //Atikokan, ON P0W, Canada
      "America/Bogota": '4.71,-74.07',
      //Bogotá, Bogota, Colombia
      "America/Cancun": '21.16,-86.85',
      //Cancún, Quintana Roo, Mexico
      "America/Cayman": '19.29,-81.37',
      //George Town, Cayman Islands
      "America/Detroit": '42.33,-83.05',
      //Detroit, MI, USA
      "America/Eirunepe": '-6.66,-69.87',
      //Eirunepé - State of Amazonas, 69880-000, Brazil
      "America/Guayaquil": '-2.17,-79.92',
      //Guayaquil, Ecuador
      "America/Havana": '23.11,-82.37',
      //Havana, Cuba
      "America/Indiana/Indianapolis": '39.77,-86.16',
      //Indianapolis, IN, USA
      "America/Indiana/Marengo": '42.25,-88.61',
      //Marengo, IL 60152, USA
      "America/Indiana/Petersburg": '37.23,-77.4',
      //Petersburg, VA, USA
      "America/Indiana/Vevay": '38.75,-85.07',
      //Vevay, IN 47043, USA
      "America/Indiana/Vincennes": '38.68,-87.53',
      //Vincennes, IN 47591, USA
      "America/Indiana/Winamac": '41.05,-86.6',
      //Winamac, IN 46996, USA
      "America/Iqaluit": '63.75,-68.52',
      //Iqaluit, NU, Canada
      "America/Jamaica": '18.02,-76.81',
      //Kingston, Jamaica
      "America/Kentucky/Louisville": '38.25,-85.76',
      //Louisville, KY, USA
      "America/Kentucky/Monticello": '41.66,-74.69',
      //Monticello, NY 12701, USA
      "America/Lima": '-12.05,-77.04',
      //Lima, Peru
      "America/Nassau": '25.05,-77.36',
      //Nassau, The Bahamas
      "America/New_York": '40.71,-74.01',
      //New York, NY, USA
      "America/Nipigon": '49.02,-88.27',
      //Nipigon, ON P0T, Canada
      "America/Panama": '8.98,-79.52',
      //Panama City, Panama
      "America/Pangnirtung": '66.15,-65.7',
      //Pangnirtung, NU, Canada
      "America/Port-au-Prince": '18.59,-72.31',
      //Port-au-Prince, Haiti
      "America/Rio_Branco": '-9.98,-68.43',
      //Rio Branco - State of Acre, Brazil
      "America/Thunder_Bay": '48.38,-89.25',
      //Thunder Bay, ON, Canada
      "America/Toronto": '43.65,-79.38',
      //Toronto, ON, Canada
      "America/Anguilla": '18.21,-63.06',
      //The Valley 2640, Anguilla
      "America/Antigua": '17.13,-61.85',
      //St John's, Antigua and Barbuda
      "America/Aruba": '12.54,-70',
      //Babijn, Aruba
      "America/Asuncion": '-25.26,-57.58',
      //Asuncion, Paraguay
      "America/Barbados": '13.1,-59.61',
      //Bridgetown, Barbados
      "America/Blanc-Sablon": '46.74,-71.25',
      //Levis, QC, Canada
      "America/Boa_Vista": '2.82,-60.68',
      //Boa Vista, State of Roraima, Brazil
      "America/Campo_Grande": '-20.47,-54.62',
      //Campo Grande, State of Mato Grosso do Sul, Brazil
      "America/Caracas": '10.48,-66.9',
      //Caracas, Capital District, Venezuela
      "America/Cuiaba": '-15.6,-56.1',
      //Cuiabá - Coxipó da Ponte, Cuiabá - State of Mato Grosso, Brazil
      "America/Curacao": '12.12,-68.88',
      //Willemstad, Curaçao
      "America/Dominica": '15.31,-61.38',
      //Roseau, Dominica
      "America/Glace_Bay": '46.14,-60.19',
      //Sydney, NS, Canada
      "America/Goose_Bay": '52.94,-66.91',
      //Labrador City, NL, Canada
      "America/Grand_Turk": '21.47,-71.14',
      //Cockburn Town TKCA 1ZZ, Turks and Caicos Islands
      "America/Grenada": '12.06,-61.75',
      //St George's, Grenada
      "America/Guadeloupe": '16.27,-61.53',
      //Les Abymes, Guadeloupe
      "America/Guyana": '6.8,-58.16',
      //Georgetown, Guyana
      "America/Halifax": '44.65,-63.58',
      //Halifax Regional Municipality, NS, Canada
      "America/Kralendijk": '12.14,-68.27',
      //Kralendijk, Caribbean Netherlands
      "America/La_Paz": '-17.81,-63.16',
      //Santa Cruz de la Sierra, Bolivia
      "America/Lower_Princes": '18.05,-63.06',
      //Dutch Cul de Sac, Sint Maarten
      "America/Manaus": '-3.12,-60.02',
      //Manaus, State of Amazonas, Brazil
      "America/Marigot": '18.07,-63.08',
      //Marigot, St Martin
      "America/Martinique": '14.62,-61.06',
      //Fort-de-France Bay, Martinique
      "America/Moncton": '45.27,-66.06',
      //Saint John, NB, Canada
      "America/Montserrat": '16.79,-62.21',
      //Brades, Montserrat
      "America/Porto_Velho": '-8.76,-63.9',
      //Porto Velho - State of Rondônia, Brazil
      "America/Port_of_Spain": '10.65,-61.5',
      //Laventille, Port of Spain, Trinidad and Tobago
      "America/Puerto_Rico": '18.47,-66.11',
      //San Juan, Puerto Rico
      "America/Santiago": '-33.45,-70.67',
      //Santiago, Santiago Metropolitan Region, Chile
      "America/Santo_Domingo": '18.49,-69.93',
      //Santo Domingo, Dominican Republic
      "America/St_Barthelemy": '17.9,-62.85',
      //Gustavia, St Barthélemy
      "America/St_Kitts": '17.3,-62.72',
      //Basseterre, St Kitts & Nevis
      "America/St_Lucia": '14.01,-60.99',
      //Castries, St Lucia
      "America/St_Thomas": '17.72,-64.83',
      //St Croix, USVI
      "America/St_Vincent": '13.16,-61.22',
      //Kingstown, St Vincent and the Grenadines
      "America/Thule": '77.47,-69.23',
      //Qaanaaq, Greenland
      "America/Tortola": '18.43,-64.63',
      //Tortola, British Virgin Islands
      "Antarctica/Palmer": '-64.77,-64.05',
      //Antarctica
      "Atlantic/Bermuda": '32.29,-64.79',
      //Hamilton, Bermuda
      "America/St_Johns": '47.56,-52.71',
      //St. John's, NL, Canada
      "America/Araguaina": '-10.25,-48.32',
      //Palmas, TO, Brazil
      "America/Argentina/Buenos_Aires": '-34.6,-58.38',
      //Buenos Aires, Argentina
      "America/Argentina/Catamarca": '-28.47,-65.78',
      //Catamarca, Catamarca Province, Argentina
      "America/Argentina/Cordoba": '-31.42,-64.19',
      //Córdoba, Cordoba, Argentina
      "America/Argentina/Jujuy": '-24.19,-65.3',
      //Jujuy, Argentina
      "America/Argentina/La_Rioja": '-29.41,-66.86',
      //La Rioja, La Rioja Province, Argentina
      "America/Argentina/Mendoza": '-32.89,-68.85',
      //Mendoza, Capital Department, Mendoza Province, Argentina
      "America/Argentina/Rio_Gallegos": '-51.62,-69.22',
      //Rio Gallegos, Santa Cruz Province, Argentina
      "America/Argentina/Salta": '-24.78,-65.42',
      //Salta, Salta Province, Argentina
      "America/Argentina/San_Juan": '-31.54,-68.54',
      //San Juan, San Juan Province, Argentina
      "America/Argentina/San_Luis": '-33.3,-66.34',
      //San Luis, San Luis Province, Argentina
      "America/Argentina/Tucuman": '-26.81,-65.22',
      //San Miguel de Tucumán, Tucumán, Argentina
      "America/Argentina/Ushuaia": '-54.8,-68.3',
      //Ushuaia, Tierra del Fuego Province, Argentina
      "America/Bahia": '-12.98,-38.5',
      //Salvador - State of Bahia, Brazil
      "America/Belem": '-1.46,-48.49',
      //Belém - State of Pará, Brazil
      "America/Cayenne": '4.92,-52.31',
      //Cayenne, French Guiana
      "America/Fortaleza": '-3.73,-38.53',
      //Fortaleza - State of Ceará, Brazil
      "America/Godthab": '64.18,-51.69',
      //Nuuk, Greenland
      "America/Maceio": '-9.65,-35.71',
      //Maceió - Jardim da Saúde, Maceió - State of Alagoas, Brazil
      "America/Miquelon": '46.78,-56.18',
      //Saint-Pierre, St Pierre and Miquelon
      "America/Montevideo": '-34.9,-56.16',
      //Montevideo, Montevideo Department, Uruguay
      "America/Paramaribo": '5.85,-55.2',
      //Paramaribo, Suriname
      "America/Recife": '-8.05,-34.93',
      //Recife - State of Pernambuco, Brazil
      "America/Santarem": '-2.45,-54.7',
      //Santarém, PA, Brazil
      "America/Sao_Paulo": '-23.55,-46.63',
      //São Paulo, State of São Paulo, Brazil
      "Antarctica/Rothera": '-67.56,-68.12',
      //BIQQ 1ZZ, Antarctica
      "Atlantic/Stanley": '-51.7,-57.85',
      //Stanley FIQQ 1ZZ, Falkland Islands (Islas Malvinas)
      "America/Noronha": '-7.75,-34.83',
      //Ilha de Itamaracá - Baixa Verde, Itamaracá - State of Pernambuco, Brazil
      "Atlantic/South_Georgia": '-54.28,-36.51',
      //Grytviken SIQQ 1ZZ, South Georgia and the South Sandwich Islands
      "America/Scoresbysund": '70.5,-25',
      //Scoresby Sund, Greenland
      "Atlantic/Azores": '37.74,-25.68',
      //Ponta Delgada, Portugal
      "Atlantic/Cape_Verde": '14.93,-23.51',
      //Praia, Cape Verde
      "Africa/Abidjan": '5.36,-4.01',
      //Abidjan, Côte d'Ivoire
      "Africa/Accra": '5.6,-0.19',
      //Accra, Ghana
      "Africa/Bamako": '12.64,-8',
      //Bamako, Mali
      "Africa/Banjul": '13.27,-16.64',
      //Brikama, The Gambia
      "Africa/Bissau": '11.88,-15.62',
      //Bissau, Guinea-Bissau
      "Africa/Casablanca": '33.57,-7.59',
      //Casablanca, Morocco
      "Africa/Conakry": '9.53,-13.69',
      //Camayenne, Conakry, Guinea
      "Africa/Dakar": '14.72,-17.47',
      //Dakar, Senegal
      "Africa/El_Aaiun": '23.72,-15.93',
      //Dakhla 73000
      "Africa/Freetown": '8.47,-13.23',
      //Freetown, Sierra Leone
      "Africa/Lome": '6.17,1.23',
      //Lome, Togo
      "Africa/Monrovia": '6.29,-10.76',
      //Monrovia, Liberia
      "Africa/Nouakchott": '18.07,-15.96',
      //Nouakchott, Mauritania
      "Africa/Ouagadougou": '12.37,-1.52',
      //Ouagadougou, Burkina Faso
      "America/Danmarkshavn": '74.48,-18.98',
      //Greenland
      "Antarctica/Troll": '-72.01,2.54',
      //Troll, Antarctica
      "Atlantic/Canary": '28.12,-15.44',
      //Las Palmas de Gran Canaria, Las Palmas, Spain
      "Atlantic/Faroe": '62.01,-6.79',
      //Tórshavn, Faroe Islands
      "Atlantic/Madeira": '32.67,-16.92',
      //Funchal, Portugal
      "Atlantic/Reykjavik": '64.13,-21.82',
      //Reykjavík, Iceland
      "Atlantic/St_Helena": '-15.93,-5.72',
      //Jamestown STHL 1ZZ, St Helena, Ascension and Tristan da Cunha
      "Europe/Dublin": '53.35,-6.26',
      //Dublin, Ireland
      "Europe/Guernsey": '49.45,-2.55',
      //Saint Peter Port, Guernsey
      "Europe/Isle_of_Man": '54.15,-4.49',
      //Douglas, Isle of Man
      "Europe/Jersey": '49.18,-2.1',
      //St Helier, Jersey
      "Europe/Lisbon": '38.72,-9.14',
      //Lisbon, Portugal
      "Europe/London": '51.51,-0.13',
      //London, UK
      "Africa/Algiers": '36.75,3.06',
      //Algiers, Sidi M'Hamed, Algeria
      "Africa/Bangui": '4.39,18.56',
      //Bangui, Central African Republic
      "Africa/Brazzaville": '-4.26,15.24',
      //Brazzaville, Republic of the Congo
      "Africa/Ceuta": '35.89,-5.32',
      //Ceuta, Spain
      "Africa/Douala": '4.05,9.77',
      //Douala, Cameroon
      "Africa/Kinshasa": '-4.44,15.27',
      //Kinshasa, Democratic Republic of the Congo
      "Africa/Lagos": '6.52,3.38',
      //Lagos, Nigeria
      "Africa/Libreville": '0.42,9.47',
      //Libreville, Gabon
      "Africa/Luanda": '-8.84,13.29',
      //Luanda, Angola
      "Africa/Malabo": '1.85,9.78',
      //Bata, Equatorial Guinea
      "Africa/Ndjamena": '12.13,15.06',
      //N'Djamena, Chad
      "Africa/Niamey": '13.51,2.13',
      //Niamey, Niger
      "Africa/Porto-Novo": '6.37,2.39',
      //Cotonou, Benin
      "Africa/Sao_Tome": '0.33,6.73',
      //São Tomé, São Tomé and Príncipe
      "Africa/Tunis": '36.81,10.18',
      //Tunis, Tunisia
      "Africa/Windhoek": '-22.56,17.07',
      //Windhoek, Namibia
      "Arctic/Longyearbyen": '78.22,15.63',
      //Longyearbyen, Svalbard and Jan Mayen
      "Europe/Amsterdam": '52.37,4.9',
      //Amsterdam, Netherlands
      "Europe/Andorra": '42.51,1.52',
      //AD500 Andorra la Vella, Andorra
      "Europe/Belgrade": '44.79,20.45',
      //Belgrade, Serbia
      "Europe/Berlin": '52.52,13.4',
      //Berlin, Germany
      "Europe/Bratislava": '48.15,17.11',
      //Bratislava, Slovakia
      "Europe/Brussels": '50.85,4.35',
      //Brussels, Belgium
      "Europe/Budapest": '47.5,19.04',
      //Budapest, Hungary
      "Europe/Copenhagen": '55.68,12.57',
      //Copenhagen, Denmark
      "Europe/Gibraltar": '36.14,-5.35',
      //Gibraltar
      "Europe/Ljubljana": '46.06,14.51',
      //Ljubljana, Slovenia
      "Europe/Luxembourg": '49.61,6.13',
      //Luxembourg City, Luxembourg
      "Europe/Madrid": '40.42,-3.7',
      //Madrid, Spain
      "Europe/Malta": '35.9,14.47',
      //Birkirkara, Malta
      "Europe/Monaco": '43.74,7.42',
      //Monaco
      "Europe/Oslo": '59.91,10.75',
      //Oslo, Norway
      "Europe/Paris": '48.86,2.35',
      //Paris, France
      "Europe/Podgorica": '42.43,19.26',
      //Podgorica, Montenegro
      "Europe/Prague": '50.08,14.44',
      //Prague, Czechia
      "Europe/Rome": '41.9,12.5',
      //Rome, Metropolitan City of Rome, Italy
      "Europe/San_Marino": '43.97,12.48',
      //Serravalle, San Marino
      "Europe/Sarajevo": '43.86,18.41',
      //Sarajevo, Bosnia and Herzegovina
      "Europe/Skopje": '42,21.43',
      //Skopje, Macedonia (FYROM)
      "Europe/Stockholm": '59.33,18.07',
      //Stockholm, Sweden
      "Europe/Tirane": '41.33,19.82',
      //Tirana, Albania
      "Europe/Vaduz": '47.17,9.51',
      //Schaan, Liechtenstein
      "Europe/Vatican": '41.9,12.45',
      //00120, Vatican City
      "Europe/Vienna": '48.21,16.37',
      //Vienna, Austria
      "Europe/Warsaw": '52.23,21.01',
      //Warsaw, Poland
      "Europe/Zagreb": '45.81,15.97',
      //u. l., Gundulićeva ul. 43, 10000, Zagreb, Croatia
      "Europe/Zurich": '47.38,8.54',
      //Zürich, Switzerland
      "Africa/Blantyre": '-13.96,33.77',
      //Lilongwe, Malawi
      "Africa/Bujumbura": '-3.36,29.36',
      //Bujumbura, Burundi
      "Africa/Cairo": '30.04,31.24',
      //Cairo, Cairo Governorate, Egypt
      "Africa/Gaborone": '-24.63,25.92',
      //Gaborone, Botswana
      "Africa/Harare": '-17.83,31.03',
      //Harare, Zimbabwe
      "Africa/Johannesburg": '-33.92,18.42',
      //Cape Town, South Africa
      "Africa/Khartoum": '15.5,32.56',
      //Khartoum, Sudan
      "Africa/Kigali": '-1.97,30.1',
      //Kigali, Rwanda
      "Africa/Lubumbashi": '-11.69,27.5',
      //Lubumbashi, Democratic Republic of the Congo
      "Africa/Lusaka": '-15.39,28.32',
      //Lusaka, Zambia
      "Africa/Maputo": '-25.97,32.57',
      //Maputo, Mozambique
      "Africa/Maseru": '-29.32,27.49',
      //Maseru, Lesotho
      "Africa/Mbabane": '-26.51,31.37',
      //Manzini, Swaziland
      "Africa/Tripoli": '32.89,13.19',
      //Tripoli, Libya
      "Asia/Amman": '31.95,35.93',
      //Amman, Jordan
      "Asia/Beirut": '33.89,35.5',
      //Beirut, Lebanon
      "Asia/Damascus": '36.2,37.13',
      //Aleppo, Syria
      "Asia/Gaza": '31.35,34.31',
      //Gaza Strip
      "Asia/Hebron": '31.77,35.21',
      //Jerusalem, Israel
      "Asia/Jerusalem": '31.77,35.21',
      //Jerusalem, Israel
      "Asia/Nicosia": '35.19,33.38',
      //Nicosia, Cyprus
      "Europe/Athens": '37.98,23.73',
      //Athens, Greece
      "Europe/Bucharest": '44.43,26.1',
      //Bucharest, Romania
      "Europe/Chisinau": '47.01,28.86',
      //Chisinau, Moldova
      "Europe/Helsinki": '60.17,24.94',
      //Helsinki, Finland
      "Europe/Istanbul": '41.01,28.98',
      //Istanbul, Turkey
      "Europe/Kaliningrad": '54.71,20.45',
      //Kaliningrad, Kaliningrad Oblast, Russia
      "Europe/Kiev": '50.45,30.52',
      //Kyiv, Ukraine, 02000
      "Europe/Mariehamn": '60.1,19.93',
      //Mariehamn, Åland Islands
      "Europe/Riga": '56.95,24.11',
      //Riga, Latvia
      "Europe/Sofia": '42.7,23.32',
      //Sofia, Bulgaria
      "Europe/Tallinn": '59.44,24.75',
      //Tallinn, Estonia
      "Europe/Uzhgorod": '48.62,22.29',
      //Uzhhorod, Zakarpats'ka oblast, Ukraine
      "Europe/Vilnius": '54.69,25.28',
      //Vilnius, Lithuania
      "Europe/Zaporozhye": '47.84,35.14',
      //Zaporizhzhia, Zaporiz'ka oblast, Ukraine, 69061
      "Africa/Addis_Ababa": '8.98,38.76',
      //Addis Ababa, Ethiopia
      "Africa/Asmara": '15.32,38.93',
      //Asmara, Eritrea
      "Africa/Dar_es_Salaam": '-6.79,39.21',
      //Dar es Salaam, Tanzania
      "Africa/Djibouti": '11.83,42.59',
      //Djibouti
      "Africa/Juba": '4.86,31.57',
      //Juba, South Sudan
      "Africa/Kampala": '0.35,32.58',
      //Kampala, Uganda
      "Africa/Mogadishu": '2.05,45.32',
      //Mogadishu, Somalia
      "Africa/Nairobi": '-1.29,36.82',
      //Nairobi, Kenya
      "Antarctica/Syowa": '-69,39.58',
      //Antarctica
      "Asia/Aden": '15.37,44.19',
      //Sana'a, Yemen
      "Asia/Baghdad": '33.31,44.36',
      //Baghdad, Iraq
      "Asia/Bahrain": '26.23,50.59',
      //Manama, Bahrain
      "Asia/Kuwait": '29.09,48.07',
      //Ahmadi, Kuwait
      "Asia/Qatar": '25.29,51.53',
      //Doha, Qatar
      "Asia/Riyadh": '24.71,46.68',
      //Riyadh Saudi Arabia
      "Europe/Minsk": '53.9,27.56',
      //Minsk, Belarus
      "Europe/Moscow": '55.76,37.62',
      //Moscow, Russia
      "Europe/Simferopol": '44.62,33.53',
      //Sevastopol 99000
      "Europe/Volgograd": '48.71,44.51',
      //Volgograd, Volgograd Oblast, Russia
      "Indian/Antananarivo": '-18.88,47.51',
      //Antananarivo, Madagascar
      "Indian/Comoro": '-11.72,43.25',
      //Moroni, Comoros
      "Indian/Mayotte": '-12.78,45.23',
      //Mamoudzou, Mayotte
      "Asia/Tehran": '35.69,51.39',
      //Tehran, Tehran Province, Iran
      "Asia/Baku": '40.41,49.87',
      //Baku, Azerbaijan
      "Asia/Dubai": '25.2,55.27',
      //Dubai - United Arab Emirates
      "Asia/Muscat": '23.59,58.41',
      //Muscat, Oman
      "Asia/Tbilisi": '41.72,44.83',
      //Tbilisi, Georgia
      "Asia/Yerevan": '40.18,44.5',
      //Yerevan, Armenia
      "Europe/Astrakhan": '46.36,48.06',
      //Astrakhan, Astrakhan Oblast, Russia
      "Europe/Samara": '53.24,50.22',
      //Samara, Samara Oblast, Russia
      "Europe/Ulyanovsk": '54.32,48.38',
      //Ulyanovsk, Ulyanovsk Oblast, Russia
      "Indian/Mahe": '-4.62,55.45',
      //Victoria, Seychelles
      "Indian/Mauritius": '-20.16,57.5',
      //Port Louis, Mauritius
      "Indian/Reunion": '-20.89,55.46',
      //Saint-Denis, Reunion
      "Asia/Kabul": '34.56,69.21',
      //Kabul, Afghanistan
      "Antarctica/Mawson": '-67.6,62.87',
      //Antarctica
      "Asia/Aqtau": '43.64,51.2',
      //Aktau, Kazakhstan
      "Asia/Aqtobe": '50.28,57.17',
      //Aktobe, Kazakhstan
      "Asia/Ashgabat": '37.96,58.33',
      //Ashgabat, Turkmenistan
      "Asia/Dushanbe": '38.56,68.79',
      //Dushanbe, Tajikistan
      "Asia/Karachi": '24.86,67',
      //Karachi, Karachi City, Sindh, Pakistan
      "Asia/Oral": '51.23,51.39',
      //Uralsk, Kazakhstan
      "Asia/Samarkand": '39.63,66.97',
      //Samarkand, Uzbekistan
      "Asia/Tashkent": '41.3,69.24',
      //Tashkent, Uzbekistan
      "Asia/Yekaterinburg": '56.84,60.61',
      //Yekaterinburg, Sverdlovsk Oblast, Russia
      "Indian/Kerguelen": '-49.35,70.22',
      //Port-aux-Français, French Southern and Antarctic Lands
      "Indian/Maldives": '4.18,73.51',
      //Malé, Maldives
      "Asia/Colombo": '6.93,79.86',
      //Colombo, Sri Lanka
      "Asia/Kolkata": '19.08,72.88',
      //Mumbai, Maharashtra, India
      "Asia/Kathmandu": '27.72,85.32',
      //Kathmandu 44600, Nepal
      "Antarctica/Vostok": '-78.46,106.83',
      //Antarctica
      "Asia/Almaty": '43.22,76.85',
      //Almaty, Kazakhstan
      "Asia/Bishkek": '42.87,74.57',
      //Bishkek, Kyrgyzstan
      "Asia/Dhaka": '23.81,90.41',
      //Dhaka, Bangladesh
      "Asia/Novosibirsk": '55.01,82.94',
      //Novosibirsk, Novosibirsk Oblast, Russia
      "Asia/Omsk": '54.99,73.32',
      //Omsk, Omsk Oblast, Russia
      "Asia/Qyzylorda": '44.85,65.48',
      //Kyzylorda, Kazakhstan
      "Asia/Thimphu": '27.47,89.64',
      //Thimphu, Bhutan
      "Asia/Urumqi": '22.52,113.39',
      //Zhongshan, Guangdong, China
      "Indian/Chagos": '-6.34,71.86',
      //Chagos Archipelago, British Indian Ocean Territory
      "Asia/Rangoon": '16.87,96.2',
      //Yangon, Myanmar (Burma)
      "Indian/Cocos": '-12.15,96.82',
      //West Island, 6799, Cocos (Keeling) Islands
      "Antarctica/Davis": '-68.58,77.97',
      //Davis Station, Antarctica
      "Asia/Bangkok": '13.76,100.5',
      //Bangkok, Thailand
      "Asia/Barnaul": '53.35,83.77',
      //Barnaul, Altai Krai, Russia
      "Asia/Hovd": '47.98,91.63',
      //Khovd, Mongolia
      "Asia/Ho_Chi_Minh": '10.82,106.63',
      //Ho Chi Minh City, Vietnam
      "Asia/Jakarta": '-6.18,106.87',
      //Jakarta, Indonesia
      "Asia/Krasnoyarsk": '56.02,92.89',
      //Krasnoyarsk, Krasnoyarsk Krai, Russia
      "Asia/Novokuznetsk": '53.76,87.12',
      //Novokuznetsk, Kemerovo Oblast, Russia
      "Asia/Phnom_Penh": '11.56,104.93',
      //Phnom Penh, Cambodia
      "Asia/Pontianak": '-0.03,109.34',
      //Pontianak, West Kalimantan, Indonesia
      "Asia/Vientiane": '17.98,102.63',
      //Vientiane, Laos
      "Indian/Christmas": '-10.43,105.67',
      //Flying Fish Cove, Christmas Island
      "Antarctica/Casey": '-66.28,110.53',
      //Casey Station, Antarctica
      "Asia/Brunei": '4.9,114.94',
      //Bandar Seri Begawan, Brunei
      "Asia/Choibalsan": '46.67,113.29',
      //Baruun-Urt, Mongolia
      "Asia/Hong_Kong": '22.4,114.11',
      //Hong Kong
      "Asia/Irkutsk": '52.29,104.31',
      //Irkutsk, Irkutsk Oblast, Russia
      "Asia/Kuala_Lumpur": '6.12,102.25',
      //15200 Kota Bharu, Kelantan, Malaysia
      "Asia/Kuching": '1.55,110.36',
      //Kuching, Sarawak, Malaysia
      "Asia/Macau": '22.2,113.54',
      //Macau
      "Asia/Makassar": '-5.15,119.43',
      //Makassar, Makassar City, South Sulawesi, Indonesia
      "Asia/Manila": '14.68,121.04',
      //Quezon City, Metro Manila, Philippines
      "Asia/Shanghai": '31.23,121.47',
      //Shanghai, China
      "Asia/Singapore": '1.35,103.82',
      //Singapore
      "Asia/Taipei": '25.03,121.57',
      //Taipei, Taiwan
      "Asia/Ulaanbaatar": '47.89,106.91',
      //Ulaanbaatar, Mongolia
      "Australia/Perth": '-31.95,115.86',
      //Perth WA, Australia
      "Asia/Pyongyang": '39.04,125.76',
      //Pyongyang, North Korea
      "Australia/Eucla": '-31.68,128.89',
      //Eucla WA 6443, Australia
      "Asia/Chita": '52.05,113.47',
      //Chita, Zabaykalsky Krai, Russia
      "Asia/Dili": '-8.56,125.56',
      //Díli, Timor-Leste
      "Asia/Jayapura": '-3.63,128.11',
      //Ambon Island, Maluku, Indonesia
      "Asia/Khandyga": '62.66,135.55',
      //Khandyga, Sakha Republic, Russia, 678720
      "Asia/Seoul": '37.57,126.98',
      //Seoul, South Korea
      "Asia/Tokyo": '35.69,139.69',
      //Tokyo, Japan
      "Asia/Yakutsk": '52.05,113.47',
      //Chita, Zabaykalsky Krai, Russia
      "Pacific/Palau": '7.34,134.49',
      //Koror, Palau
      "Australia/Adelaide": '-34.93,138.6',
      //Adelaide SA, Australia
      "Australia/Broken_Hill": '-31.95,141.45',
      //Broken Hill NSW 2880, Australia
      "Australia/Darwin": '-12.46,130.85',
      //Darwin NT, Australia
      "Antarctica/DumontDUrville": '-66.66,140',
      //Dumont d'Urville Station, Antarctica
      "Asia/Ust-Nera": '64.56,143.22',
      //Ust-Nera, Sakha Republic, Russia, 678730
      "Asia/Vladivostok": '43.12,131.89',
      //Vladivostok, Primorsky Krai, Russia
      "Australia/Brisbane": '-27.47,153.03',
      //Brisbane QLD, Australia
      "Australia/Currie": '-39.93,143.85',
      //Currie TAS 7256, Australia
      "Australia/Hobart": '-42.88,147.33',
      //Hobart TAS 7000, Australia
      "Australia/Lindeman": '-20.44,149.04',
      //Lindeman Island, Queensland 4805, Australia
      "Australia/Melbourne": '-37.81,144.96',
      //Melbourne VIC, Australia
      "Australia/Sydney": '-33.87,151.21',
      //Sydney NSW, Australia
      "Pacific/Chuuk": '7.44,151.86',
      //Weno, Chuuk, Federated States of Micronesia
      "Pacific/Guam": '13.55,144.85',
      //Dededo, Guam
      "Pacific/Port_Moresby": '-9.44,147.18',
      //Port Moresby, Papua New Guinea
      "Pacific/Saipan": '15.19,145.75',
      //Saipan, CNMI
      "Australia/Lord_Howe": '-31.56,159.08',
      //Lord Howe Island, New South Wales, Australia
      "Antarctica/Macquarie": '-54.63,158.86',
      //Macquarie
      "Asia/Magadan": '59.56,150.83',
      //Magadan, Magadan Oblast, Russia
      "Asia/Sakhalin": '46.96,142.73',
      //Yuzhno-Sakhalinsk, Sakhalin Oblast, Russia
      "Asia/Srednekolymsk": '67.44,153.73',
      //Srednekolymsk, Sakha Republic, Russia, 678790
      "Pacific/Bougainville": '-6.23,155.57',
      //Arawa, Papua New Guinea
      "Pacific/Efate": '-17.73,168.33',
      //Port Vila, Vanuatu
      "Pacific/Guadalcanal": '-9.45,159.97',
      //Honiara, Solomon Islands
      "Pacific/Kosrae": '5.33,163.01',
      //Tofol, Kosrae, Federated States of Micronesia
      "Pacific/Norfolk": '-29.06,167.96',
      //Kingston, Norfolk Island
      "Pacific/Noumea": '-22.27,166.44',
      //Noumea, New Caledonia
      "Pacific/Pohnpei": '6.96,158.21',
      //Kolonia, Pohnpei, Federated States of Micronesia
      "Antarctica/McMurdo": '-77.84,166.69',
      //McMurdo Station, Antarctica
      "Asia/Anadyr": '64.73,177.5',
      //Anadyr, Chukotka Autonomous Okrug, Russia, 689000
      "Asia/Kamchatka": '53.04,158.68',
      //Petropavlovsk-Kamchatskiy, Kamchatka Krai, Russia
      "Pacific/Auckland": '-36.85,174.76',
      //Auckland, New Zealand
      "Pacific/Fiji": '-18.12,178.45',
      //Suva, Fiji
      "Pacific/Funafuti": '-8.52,179.2',
      //Funafuti, Tuvalu
      "Pacific/Kwajalein": '8.78,167.74',
      //Ebeye, Kwajalein Atoll, RMI
      "Pacific/Majuro": '7.12,171.19',
      //Majuro, Majuro Atoll, RMI
      "Pacific/Nauru": '-0.55,166.92',
      //Yaren, Nauru
      "Pacific/Tarawa": '1.45,172.97',
      //Tarawa, Kiribati
      "Pacific/Wake": '19.28,166.65',
      //Wake Island
      "Pacific/Wallis": '-13.28,-176.18',
      //Matā'utu, Wallis and Futuna
      "Pacific/Chatham": '-35.27,174.08',
      //Waitangi 0293, New Zealand
      "Pacific/Apia": '-13.85,-171.75',
      //Apia, Samoa
      "Pacific/Enderbury": '-3.13,-171.08',
      //Enderbury Island, Kiribati
      "Pacific/Fakaofo": '-8.53,-172.52',
      //Atafu Village, Tokelau
      "Pacific/Tongatapu": '-21.14,-175.2',
      //Nuku'alofa, Tonga
      "Pacific/Kiritimati": '1.87,-157.43',
      //Kiritimati, Kiribati
      //extra ones
      "Africa/Asmera": '15.32,38.93',
      //Asmara, Eritrea
      "Africa/Timbuktu": '16.77,-3',
      //Timbuktu, Mali
      "America/Argentina": '-38.42,-63.62',
      //Argentina
      "America/Atka": '52.2,-174.2',
      //Atka, AK, USA
      "America/Buenos_Aires": '-34.6,-58.38',
      //Buenos Aires, Argentina
      "America/Catamarca": '-28.47,-65.79',
      //Catamarca Province, Argentina
      "America/Coral_Harbour": '64.14,-83.17',
      //Coral Harbour, NU, Canada
      "America/Cordoba": '-31.42,-64.18',
      //Córdoba, Argentina
      "America/Ensenada": '31.87,-116.6',
      //Ensenada, Baja California, Mexico
      "America/Fort_Wayne": '41.08,-85.14',
      //Fort Wayne, IN, USA
      "America/Indiana": '40.27,-86.13',
      //Indiana, USA
      "America/Indianapolis": '39.77,-86.16',
      //Indianapolis, IN, USA
      "America/Jujuy": '-24.18,-65.3',
      //Jujuy, Argentina
      "America/Kentucky": '37.84,-84.27',
      //Kentucky, USA
      "America/Knox_IN": '37.92,-85.96',
      //Fort Knox, KY 40121, USA
      "America/Louisville": '38.25,-85.76',
      //Louisville, KY, USA
      "America/Mendoza": '-32.89,-68.85',
      //Mendoza, Capital Department, Mendoza Province, Argentina
      "America/Montreal": '45.5,-73.57',
      //Montreal, QC, Canada
      "America/North_Dakota": '47.55,-101',
      //North Dakota, USA
      "America/Porto_Acre": '-9.59,-67.54',
      //Porto Acre - State of Acre, 69921-000, Brazil
      "America/Rosario": '48.64,-122.87',
      //1400 Rosario Rd, Eastsound, WA 98245, USA
      "America/Santa_Isabel": '32.63,-115.58',
      //Santa Isabel, Baja California, Mexico
      "America/Shiprock": '36.79,-108.69',
      //Shiprock, NM, USA
      "America/Virgin": '10.6573,-61.5180',
      //Port of Spain
      "Antarctica/South_Pole": '-72.29,0.7',
      //Antarctica
      "Asia/Ashkhabad": '37.96,58.33',
      //Ashgabat, Turkmenistan
      "Asia/Calcutta": '22.57,88.36',
      //Kolkata, West Bengal, India
      "Asia/Chongqing": '29.43,106.91',
      //Chongqing, China
      "Asia/Chungking": '29.43,106.91',
      //Chongqing, China
      "Asia/Dacca": '23.81,90.41',
      //Dhaka, Bangladesh
      "Asia/Harbin": '45.8,126.53',
      //Harbin, Heilongjiang, China
      "Asia/Istanbul": '41.01,28.98',
      //Istanbul, Turkey
      "Asia/Kashgar": '39.47,75.99',
      //Kaxgar, Kashgar, Xinjiang, China
      "Asia/Katmandu": '27.72,85.32',
      //Kathmandu 44600, Nepal
      "Asia/Macao": '22.2,113.54',
      //Macau
      "Asia/Saigon": '10.82,106.63',
      //Ho Chi Minh City, Vietnam
      "Asia/Tel_Aviv": '32.09,34.78',
      //Tel Aviv-Yafo, Israel
      "Asia/Thimbu": '27.47,89.64',
      //Thimphu, Bhutan
      "Asia/Ujung_Pandang": '-5.15,119.43',
      //Makassar, Makassar City, South Sulawesi, Indonesia
      "Asia/Ulan_Bator": '47.89,106.91',
      //Ulaanbaatar, Mongolia
      "Atlantic/Faeroe": '62,-7',
      //Faroe Islands
      "Atlantic/Jan_Mayen": '71.03,-8.29',
      //Jan Mayen, Svalbard and Jan Mayen
      "Australia/ACT": '-35.28,149.13',
      //Canberra ACT 2601, Australia
      "Australia/Canberra": '-35.28,149.13',
      //Canberra ACT 2601, Australia
      "Australia/LHI": '-31.56,159.08',
      //Lord Howe Island, New South Wales, Australia
      "Australia/NSW": '-31.25,146.92',
      //New South Wales, Australia
      "Australia/North": '-12.46,130.85',
      //Darwin NT, Australia
      "Australia/Queensland": '-20.92,142.7',
      //Queensland, Australia
      "Australia/South": '-30,136.21',
      //South Australia, Australia
      "Australia/Tasmania": '-41.45,145.97',
      //Tasmania, Australia
      "Australia/Victoria": '-37.47,144.79',
      //Victoria, Australia
      "Australia/West": '-31.95,115.86',
      //Perth WA, Australia
      "Australia/Yancowinna": '-31.7,141.6',
      //Yancowinna, Australia
      "Brazil/Acre": '-9.02,-70.81',
      //State of Acre, Brazil
      "Brazil/DeNoronha": '-3.84,-32.43',
      //Fernando de Noronha, State of Pernambuco, 53990-000, Brazil
      "Brazil/East": '-22.662,-48.635',
      //Sao Paulo
      "Brazil/West": '-2.573,-59.981',
      //Central-West Region, Brazil
      "Canada/Atlantic": '44.65,-63.58',
      //Halifax Regional Municipality, NS, Canada
      "Canada/Central": '50.45,-104.62',
      //Regina, SK, Canada
      "Canada/East-Saskatchewan": '52.94,-106.45',
      //Saskatchewan, Canada
      "Canada/Eastern": '43.65,-79.38',
      //Toronto, ON, Canada
      "Canada/Mountain": '51.05,-114.07',
      //Calgary, AB, Canada
      "Canada/Newfoundland": '53.14,-57.66',
      //Newfoundland and Labrador, Canada
      "Canada/Pacific": '49.28,-123.12',
      //Vancouver, BC, Canada
      "Canada/Saskatchewan": '52.94,-106.45',
      //Saskatchewan, Canada
      "Canada/Yukon": '64.28,-135',
      //Yukon Territory, Canada
      "Chile/Continental": '-33.45,-70.67',
      //Santiago, Santiago Metropolitan Region, Chile
      "Chile/EasterIsland": '-27.11,-109.35',
      //Easter Island, Valparaiso Region, Chile
      "Europe/Belfast": '54.6,-5.93',
      //Belfast, UK
      "Europe/Busingen": '47.7,8.69',
      //78266 Büsingen am Hochrhein, Germany
      "Europe/Nicosia": '35.19,33.38',
      //Nicosia, Cyprus
      "Europe/Tiraspol": '46.85,29.6',
      //Tiraspol, Moldova
      "Mexico/BajaNorte": '30.84,-115.28',
      //Baja California, Mexico
      "Mexico/BajaSur": '26.04,-111.67',
      //Baja California Sur, Mexico
      "Mexico/General": '18.51,-96.47',
      //General, Tetela, Oax., Mexico
      "Pacific/Ponape": '6.97,158.2',
      //Kolonia, Pohnpei 96941, Federated States of Micronesia
      "Pacific/Samoa": '-13.76,-172.1',
      //Samoa
      "Pacific/Truk": '7.45,151.75',
      //Chuuk Lagoon, Federated States of Micronesia
      "Pacific/Yap": '33.79,-118.19',
      //1939 Pacific Avenue, Long Beach, CA 90806, USA
      //these are pretty arbitrary and I made them up myself
      "Etc/GMT": '51.5076,-0.1276',
      //London
      "Etc/GMT+0": '51.5076,-0.1276',
      //London
      "Etc/GMT-0": '51.5076,-0.1276',
      //London
      "Etc/GMT+1": '48.8589,2.3469',
      //Paris
      "Etc/GMT+2": '47.4816,19.1300',
      //budapest
      "Etc/GMT+3": '33.3156,44.3867',
      //baghdad
      "Etc/GMT+4": '25.0749,55.4595',
      //dubai
      "Etc/GMT+5": '33.6940,73.0652',
      //islamabad
      "Etc/GMT+6": '23.7595,90.3788',
      //dhaka
      "Etc/GMT+7": '13.5862,100.6332',
      //bangkok
      "Etc/GMT+8": '39.9061,116.3912',
      //beijing
      "Etc/GMT+9": '28.345,145.030',
      //tokyo
      "Etc/GMT+10": '-27.3396,153.0881',
      //brisbane
      "Etc/GMT+11": '6.9248,158.1611',
      //palakir
      "Etc/GMT+12": '-36.8470,174.7727',
      //aukland
      "Etc/GMT-1": '14.6935,-17.4479',
      //dakar
      "Etc/GMT-2": '64.1755,-51.7355',
      //nuuk
      "Etc/GMT-3": '-22.662,-48.635',
      //Sao Paulo
      "Etc/GMT-4": '10.5061,-66.9146',
      //caracas
      "Etc/GMT-5": '4.5981,-74.0761',
      //bogota
      "Etc/GMT-6": '13.6990,-89.1914',
      //san salvador
      "Etc/GMT-7": '33.41329,-112.00902',
      //pheonix AZ
      "Etc/GMT-8": '61.2167,-149.8949',
      //anchorage (way off)
      "Etc/GMT-9": '-25.0667,-130.1002',
      //adamstown (not technically in -9)
      "Etc/GMT-10": '-17.5571,-149.5554',
      //papeete
      "Etc/GMT-11": '-19.0531,-169.8958',
      //alofi
      "Etc/GMT-12": '0.1954,-176.4786',
      //baker island
      "Etc/GMT-13": '6.9248,158.1611',
      //palakir (+11)
      "Etc/GMT-14": '-27.3396,153.0881',
      //brisbane (+10)
      "Etc/GMT0": '51.5076,-0.1276',
      //London
      "Etc/Greenwich": '51.5076,-0.1276',
      //London
      "Etc/UCT": '51.5076,-0.1276',
      //London
      "Etc/UTC": '51.5076,-0.1276',
      //London
      "Etc/Universal": '51.5076,-0.1276',
      //London
      "Etc/Zulu": '51.5076,-0.1276' //London

    };

    },{}],5:[function(_dereq_,module,exports){

    var points = _dereq_('./IANA-points'); //


    var point = function point() {
      var tz = this.timezone().name;

      if (points.hasOwnProperty(tz) === false) {
        console.warn('Unable to find location for timezone ' + tz);
        return {};
      }

      var arr = points[tz].split(',');
      return {
        lat: parseFloat(arr[0]),
        lng: parseFloat(arr[1])
      };
    };

    module.exports = point;

    },{"./IANA-points":4}]},{},[3])(3)
    });
    });

    function toDegree(radians) {
      let pi = Math.PI;
      return radians * (180 / pi)
    }

    const sunPosition = function (s, lat, lng) {
      if (lat === undefined || lng === undefined) {
        let guess = s.point();
        lat = guess.lat;
        lng = guess.lng;
      }
      s.in = s.in || spacetimeGeo.in; //bolt-on the plugin
      s = s.in(lat, lng);
      let d = new Date(s.epoch);
      let res = suncalc.getPosition(d, lat, lng);
      // return res
      return {
        azimuth: toDegree(res.azimuth),
        altitude: toDegree(res.altitude),
      }
    };
    var sunPosition$1 = sunPosition;

    // the average time between solstices, on timeanddate.com
    // approx 88 days, 23 hours, 30 mins
    const oneYear = 31557060000;

    const halfYear = 15855660000;
    // strangely, this does not seem to be exactly half.
    // const halfYear = oneYear / 2

    // the 2015 winter solstice
    const oneWinter = 1450759620000;

    const goForward = function (epoch) {
      let num = oneWinter + oneYear;
      while (num < epoch) {
        num += oneYear;
      }
      return num
    };
    const goBackward = function (epoch) {
      let num = oneWinter - oneYear;
      while (num > epoch) {
        num -= oneYear;
      }
      return num
    };

    const solstice = function (s) {
      let found = null;
      if (s.epoch > oneWinter) {
        found = goForward(s.epoch);
      } else {
        found = goBackward(s.epoch);
      }
      let winter = s.set(found);
      // ensure it's the right year
      if (winter.year() < s.year()) {
        winter = winter.set(winter.epoch + oneYear);
      }
      if (winter.year() > s.year()) {
        winter = winter.set(winter.epoch - oneYear);
      }
      let summer = winter.set(winter.epoch - halfYear);
      return {
        winter: winter,
        summer: summer,
      }
    };
    // const equinox = function (s) {
    //   return {
    //     summer: null,
    //     winter: null,
    //   }
    // }
    var solstice$1 = solstice;

    const setFrom = function (s, time) {
      let d = new Date(time);
      // console.log(time)
      s = s.clone();
      s.epoch = d.getTime();
      return s
    };

    const calculatePoint = function (s, lat, lng, field) {
      if (lat === undefined || lng === undefined) {
        let guess = s.point();
        lat = guess.lat;
        lng = guess.lng;
      }
      s.in = s.in || spacetimeGeo.in; //bolt-on the plugin
      s = s.in(lat, lng);
      let d = new Date(s.epoch);
      let res = suncalc.getTimes(d, lat, lng);
      return setFrom(s, res[field])
    };

    var index = {
      //depend on this plugin
      in: spacetimeGeo.in,
      point: spacetimeGeo.point,

      solstice: function () {
        return solstice$1(this)
      },
      winterSolstice: function () {
        return solstice$1(this).winter
      },
      summerSolstice: function () {
        return solstice$1(this).summer
      },
      sunPosition: function (lat, lng) {
        return sunPosition$1(this, lat, lng)
      },
      sunrise: function (lat, lng) {
        return calculatePoint(this, lat, lng, 'sunrise')
      },
      sunset: function (lat, lng) {
        return calculatePoint(this, lat, lng, 'sunset')
      },
      noon: function (lat, lng) {
        return calculatePoint(this, lat, lng, 'solarNoon')
      },
      dawn: function (lat, lng) {
        return calculatePoint(this, lat, lng, 'dawn')
      },
      dusk: function (lat, lng) {
        return calculatePoint(this, lat, lng, 'dusk')
      },
      daylight: function (lat, lng) {
        let sunrise = this.sunrise(lat, lng);
        let sunset = this.sunset(lat, lng);
        let delta = sunset.since(sunrise);
        //clean this up a bit
        let duration = {
          hours: delta.diff.hours,
          minutes: delta.diff.minutes,
          seconds: delta.diff.seconds,
        };
        let diff = sunrise.diff(sunset);
        diff.seconds = parseInt((sunset.epoch - sunrise.epoch) / 1000, 10);

        let now = sunrise.diff(this);
        now.seconds = parseInt((this.epoch - sunrise.epoch) / 1000, 10);

        let progress = now.seconds / diff.seconds;
        let status = 'day';
        let dawn = this.dawn();
        let dusk = this.dusk();
        if (progress < 0) {
          progress = 0;
          if (this.epoch > dawn.epoch) {
            status = 'dawn';
          } else {
            status = 'night';
          }
        } else if (progress > 1) {
          progress = 0;
          if (this.epoch < dusk.epoch) {
            status = 'dusk';
          } else {
            status = 'night';
          }
        }

        return {
          dawn: dawn.time(),
          sunrise: sunrise.time(),
          sunset: sunset.time(),
          dusk: dusk.time(),
          duration: {
            inHours: diff.hours,
            inMinutes: diff.minutes,
            inSeconds: diff.seconds,
            human: duration,
          },
          current: {
            progress: progress,
            status: status,
          },
        }
      },
    };

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
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop$1;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
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
    function element$1(name) {
        return document.createElement(name);
    }
    function svg_element$1(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
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
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
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

    var world = writable({
      maxR: 0,
      rotate: 0,
      world: {
        radius: 0,
        rotate: 0,
        from: 0,
        to: 0,
        margin: 0,
      },
      q: Math.PI / 2,
    });
    // export default world

    /* Users/spencer/mountain/somehow-circle/src/Round.svelte generated by Svelte v3.29.0 */
    const file$3 = "Users/spencer/mountain/somehow-circle/src/Round.svelte";

    function add_css$3() {
    	var style = element$1("style");
    	style.id = "svelte-1lnhtnf-style";
    	style.textContent = "path.svelte-1lnhtnf{pointer-events:all}path.svelte-1lnhtnf:hover{filter:drop-shadow(0px 1px 1px steelblue)}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUm91bmQuc3ZlbHRlIiwic291cmNlcyI6WyJSb3VuZC5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbiAgaW1wb3J0IHsgYWZ0ZXJVcGRhdGUgfSBmcm9tICdzdmVsdGUnXG4gIGltcG9ydCB3b3JsZCBmcm9tICcuL3dvcmxkLmpzJ1xuICBleHBvcnQgbGV0IHJhZGl1cyA9IDUwMFxuICBleHBvcnQgbGV0IHJvdGF0ZSA9IDBcbiAgZXhwb3J0IGxldCBmcm9tID0gMFxuICBleHBvcnQgbGV0IHRvID0gMzYwXG4gIGV4cG9ydCBsZXQgbWFyZ2luID0gMFxuICByYWRpdXMgPSBOdW1iZXIocmFkaXVzKVxuXG4gIGZ1bmN0aW9uIHRvUmFkaWFuKGRlZykge1xuICAgIHZhciBwaSA9IE1hdGguUElcbiAgICByZXR1cm4gZGVnICogKHBpIC8gMTgwKVxuICB9XG4gIGNvbnN0IGNoYW5nZSA9ICgpID0+IHtcbiAgICB3b3JsZC51cGRhdGUoKG9iaikgPT4ge1xuICAgICAgb2JqLnJhZGl1cyA9IHJhZGl1c1xuICAgICAgb2JqLnJvdGF0ZSA9IHRvUmFkaWFuKE51bWJlcihyb3RhdGUpKVxuICAgICAgb2JqLmZyb20gPSBOdW1iZXIoZnJvbSlcbiAgICAgIG9iai50byA9IE51bWJlcih0bylcbiAgICAgIG9iai5tYXJnaW4gPSBOdW1iZXIobWFyZ2luKVxuICAgICAgcmV0dXJuIG9ialxuICAgIH0pXG4gIH1cbiAgYWZ0ZXJVcGRhdGUoKCkgPT4ge1xuICAgIGNoYW5nZSgpXG4gIH0pXG4gIGNoYW5nZSgpXG48L3NjcmlwdD5cblxuPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiPlxuICA8c3ZnIHZpZXdCb3g9XCItNTAsLTUwLDEwMCwxMDBcIiBzaGFwZS1yZW5kZXJpbmc9XCJnZW9tZXRyaWNQcmVjaXNpb25cIiB3aWR0aD1cIjEwMCVcIiBoZWlnaHQ9XCIxMDAlXCI+XG4gICAgPCEtLSBhcnJvdy1oZWFkIC0tPlxuICAgIDxkZWZzPlxuICAgICAgPG1hcmtlclxuICAgICAgICBpZD1cInRyaWFuZ2xlXCJcbiAgICAgICAgdmlld0JveD1cIjAgMCAxMCAxMFwiXG4gICAgICAgIHJlZlg9XCI0XCJcbiAgICAgICAgcmVmWT1cIjZcIlxuICAgICAgICBtYXJrZXJVbml0cz1cInN0cm9rZVdpZHRoXCJcbiAgICAgICAgbWFya2VyV2lkdGg9XCI5XCJcbiAgICAgICAgbWFya2VySGVpZ2h0PVwiOVwiXG4gICAgICAgIG9yaWVudD1cImF1dG9cIlxuICAgICAgPlxuICAgICAgICA8cGF0aCBkPVwiTSAwIDAgTCAxMCA0IEwgMCAxMCB6XCIgZmlsbD1cIiNENjg4ODFcIiB0cmFuc2Zvcm09XCJyb3RhdGUoMjMpXCIgLz5cbiAgICAgIDwvbWFya2VyPlxuICAgIDwvZGVmcz5cblxuICAgIDxzbG90IC8+XG4gIDwvc3ZnPlxuPC9kaXY+XG5cbjxzdHlsZT5cbiAgcGF0aCB7XG4gICAgcG9pbnRlci1ldmVudHM6IGFsbDtcbiAgfVxuICBwYXRoOmhvdmVyIHtcbiAgICBmaWx0ZXI6IGRyb3Atc2hhZG93KDBweCAxcHggMXB4IHN0ZWVsYmx1ZSk7XG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBcURFLElBQUksZUFBQyxDQUFDLEFBQ0osY0FBYyxDQUFFLEdBQUcsQUFDckIsQ0FBQyxBQUNELG1CQUFJLE1BQU0sQUFBQyxDQUFDLEFBQ1YsTUFBTSxDQUFFLFlBQVksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEFBQzVDLENBQUMifQ== */";
    	append_dev$1(document.head, style);
    }

    function create_fragment$3(ctx) {
    	let div;
    	let svg;
    	let defs;
    	let marker;
    	let path;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[6].default;
    	const default_slot = create_slot$1(default_slot_template, ctx, /*$$scope*/ ctx[5], null);

    	const block = {
    		c: function create() {
    			div = element$1("div");
    			svg = svg_element$1("svg");
    			defs = svg_element$1("defs");
    			marker = svg_element$1("marker");
    			path = svg_element$1("path");
    			if (default_slot) default_slot.c();
    			attr_dev$1(path, "d", "M 0 0 L 10 4 L 0 10 z");
    			attr_dev$1(path, "fill", "#D68881");
    			attr_dev$1(path, "transform", "rotate(23)");
    			attr_dev$1(path, "class", "svelte-1lnhtnf");
    			add_location$1(path, file$3, 44, 8, 985);
    			attr_dev$1(marker, "id", "triangle");
    			attr_dev$1(marker, "viewBox", "0 0 10 10");
    			attr_dev$1(marker, "refX", "4");
    			attr_dev$1(marker, "refY", "6");
    			attr_dev$1(marker, "markerUnits", "strokeWidth");
    			attr_dev$1(marker, "markerWidth", "9");
    			attr_dev$1(marker, "markerHeight", "9");
    			attr_dev$1(marker, "orient", "auto");
    			add_location$1(marker, file$3, 34, 6, 772);
    			add_location$1(defs, file$3, 33, 4, 759);
    			attr_dev$1(svg, "viewBox", "-50,-50,100,100");
    			attr_dev$1(svg, "shape-rendering", "geometricPrecision");
    			attr_dev$1(svg, "width", "100%");
    			attr_dev$1(svg, "height", "100%");
    			add_location$1(svg, file$3, 31, 2, 635);
    			attr_dev$1(div, "class", "container");
    			add_location$1(div, file$3, 30, 0, 609);
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

    			if (default_slot) {
    				default_slot.m(svg, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 32) {
    					update_slot$1(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[5], dirty, null, null);
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
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function toRadian(deg) {
    	var pi = Math.PI;
    	return deg * (pi / 180);
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots$1("Round", slots, ['default']);
    	let { radius = 500 } = $$props;
    	let { rotate = 0 } = $$props;
    	let { from = 0 } = $$props;
    	let { to = 360 } = $$props;
    	let { margin = 0 } = $$props;
    	radius = Number(radius);

    	const change = () => {
    		world.update(obj => {
    			obj.radius = radius;
    			obj.rotate = toRadian(Number(rotate));
    			obj.from = Number(from);
    			obj.to = Number(to);
    			obj.margin = Number(margin);
    			return obj;
    		});
    	};

    	afterUpdate(() => {
    		change();
    	});

    	change();
    	const writable_props = ["radius", "rotate", "from", "to", "margin"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Round> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("radius" in $$props) $$invalidate(0, radius = $$props.radius);
    		if ("rotate" in $$props) $$invalidate(1, rotate = $$props.rotate);
    		if ("from" in $$props) $$invalidate(2, from = $$props.from);
    		if ("to" in $$props) $$invalidate(3, to = $$props.to);
    		if ("margin" in $$props) $$invalidate(4, margin = $$props.margin);
    		if ("$$scope" in $$props) $$invalidate(5, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		afterUpdate,
    		world,
    		radius,
    		rotate,
    		from,
    		to,
    		margin,
    		toRadian,
    		change
    	});

    	$$self.$inject_state = $$props => {
    		if ("radius" in $$props) $$invalidate(0, radius = $$props.radius);
    		if ("rotate" in $$props) $$invalidate(1, rotate = $$props.rotate);
    		if ("from" in $$props) $$invalidate(2, from = $$props.from);
    		if ("to" in $$props) $$invalidate(3, to = $$props.to);
    		if ("margin" in $$props) $$invalidate(4, margin = $$props.margin);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [radius, rotate, from, to, margin, $$scope, slots];
    }

    class Round extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1lnhtnf-style")) add_css$3();

    		init$1(this, options, instance$3, create_fragment$3, safe_not_equal$1, {
    			radius: 0,
    			rotate: 1,
    			from: 2,
    			to: 3,
    			margin: 4
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

    const trig = [-Math.PI, Math.PI];

    const maxRadius = function (o) {
      let max = 0;
      let r = o.radius + o.width;
      if (r > max) {
        max = r;
      }
      return max
    };

    const makeScales = function (o) {
      let world$1 = get_store_value(world);
      let xScale = scaleLinear({ minmax: [world$1.from, world$1.to], world: trig });

      let max = maxRadius(o);
      max = max + world$1.margin;
      if (max > world$1.maxR) {
        world.update((wo) => {
          wo.maxR = max;
          return wo
        });
      }
      let rScale = scaleLinear({ minmax: [0, world$1.maxR], world: [0, 50] });
      return { xScale, rScale }
    };

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

    const drawArcs = function (obj, xScale, rScale) {
      let { q, rotate } = get_store_value(world);
      let r = rScale(obj.radius);
      let attrs = {
        startAngle: xScale(obj.to) - q + rotate,
        endAngle: xScale(obj.from) - q + rotate,
        innerRadius: r,
        outerRadius: r + rScale(obj.width)
      };
      let path = arc()(attrs);
      return { path }
    };

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
    	let path;
    	let path_d_value;
    	let path_stroke_width_value;

    	const block = {
    		c: function create() {
    			path = svg_element$1("path");
    			attr_dev$1(path, "class", "link");
    			attr_dev$1(path, "d", path_d_value = /*res*/ ctx[1].path);
    			attr_dev$1(path, "stroke", "none");
    			attr_dev$1(path, "fill", /*color*/ ctx[0]);
    			attr_dev$1(path, "stroke-width", path_stroke_width_value = 1);
    			add_location$1(path, file$4, 27, 0, 611);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, path, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*res*/ 2 && path_d_value !== (path_d_value = /*res*/ ctx[1].path)) {
    				attr_dev$1(path, "d", path_d_value);
    			}

    			if (dirty & /*color*/ 1) {
    				attr_dev$1(path, "fill", /*color*/ ctx[0]);
    			}
    		},
    		i: noop$1,
    		o: noop$1,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(path);
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
    	let { color = "blue" } = $$props;
    	color = colors[color] || color;

    	afterUpdate(() => {
    		let obj = {
    			color,
    			to: Number(to),
    			from: Number(from),
    			radius: Number(radius),
    			width: Number(width)
    		};

    		let { xScale, rScale } = makeScales(obj);
    		$$invalidate(1, res = drawArcs(obj, xScale, rScale));
    	});

    	const writable_props = ["to", "from", "radius", "width", "color"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Arc> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("to" in $$props) $$invalidate(2, to = $$props.to);
    		if ("from" in $$props) $$invalidate(3, from = $$props.from);
    		if ("radius" in $$props) $$invalidate(4, radius = $$props.radius);
    		if ("width" in $$props) $$invalidate(5, width = $$props.width);
    		if ("color" in $$props) $$invalidate(0, color = $$props.color);
    	};

    	$$self.$capture_state = () => ({
    		getScales: makeScales,
    		drawArc: drawArcs,
    		colors,
    		afterUpdate,
    		to,
    		from,
    		radius,
    		width,
    		color,
    		res
    	});

    	$$self.$inject_state = $$props => {
    		if ("to" in $$props) $$invalidate(2, to = $$props.to);
    		if ("from" in $$props) $$invalidate(3, from = $$props.from);
    		if ("radius" in $$props) $$invalidate(4, radius = $$props.radius);
    		if ("width" in $$props) $$invalidate(5, width = $$props.width);
    		if ("color" in $$props) $$invalidate(0, color = $$props.color);
    		if ("res" in $$props) $$invalidate(1, res = $$props.res);
    	};

    	let res;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	 $$invalidate(1, res = {});
    	return [color, res, to, from, radius, width];
    }

    class Arc extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$4, create_fragment$4, safe_not_equal$1, {
    			to: 2,
    			from: 3,
    			radius: 4,
    			width: 5,
    			color: 0
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

    const drawLines = function (obj, xScale, rScale) {
      let { q, rotate } = get_store_value(world);
      // draw lines
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
    };

    /* Users/spencer/mountain/somehow-circle/src/Line.svelte generated by Svelte v3.29.0 */
    const file$5 = "Users/spencer/mountain/somehow-circle/src/Line.svelte";

    function create_fragment$5(ctx) {
    	let path;
    	let path_d_value;
    	let path_stroke_value;
    	let path_fill_value;
    	let path_stroke_width_value;

    	const block = {
    		c: function create() {
    			path = svg_element$1("path");
    			attr_dev$1(path, "class", "link");
    			attr_dev$1(path, "d", path_d_value = /*res*/ ctx[0].path);
    			attr_dev$1(path, "stroke", path_stroke_value = /*res*/ ctx[0].color);
    			attr_dev$1(path, "fill", path_fill_value = /*res*/ ctx[0].color);
    			attr_dev$1(path, "stroke-width", path_stroke_width_value = /*res*/ ctx[0].width);
    			add_location$1(path, file$5, 29, 0, 671);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, path, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*res*/ 1 && path_d_value !== (path_d_value = /*res*/ ctx[0].path)) {
    				attr_dev$1(path, "d", path_d_value);
    			}

    			if (dirty & /*res*/ 1 && path_stroke_value !== (path_stroke_value = /*res*/ ctx[0].color)) {
    				attr_dev$1(path, "stroke", path_stroke_value);
    			}

    			if (dirty & /*res*/ 1 && path_fill_value !== (path_fill_value = /*res*/ ctx[0].color)) {
    				attr_dev$1(path, "fill", path_fill_value);
    			}

    			if (dirty & /*res*/ 1 && path_stroke_width_value !== (path_stroke_width_value = /*res*/ ctx[0].width)) {
    				attr_dev$1(path, "stroke-width", path_stroke_width_value);
    			}
    		},
    		i: noop$1,
    		o: noop$1,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(path);
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
    	validate_slots$1("Line", slots, []);
    	let { angle = 0 } = $$props;
    	let { at = 0 } = $$props;
    	angle = angle || at;
    	let { length = 40 } = $$props;
    	let { radius = 0 } = $$props;
    	let { width = 0.1 } = $$props;
    	let { color = "blue" } = $$props;
    	color = colors[color] || color;

    	afterUpdate(() => {
    		let obj = {
    			color,
    			angle: Number(angle),
    			radius: Number(radius),
    			length: Number(length),
    			width: Number(width)
    		};

    		let { xScale, rScale } = makeScales(obj);
    		$$invalidate(0, res = drawLines(obj, xScale, rScale));
    	});

    	const writable_props = ["angle", "at", "length", "radius", "width", "color"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Line> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("angle" in $$props) $$invalidate(1, angle = $$props.angle);
    		if ("at" in $$props) $$invalidate(3, at = $$props.at);
    		if ("length" in $$props) $$invalidate(4, length = $$props.length);
    		if ("radius" in $$props) $$invalidate(5, radius = $$props.radius);
    		if ("width" in $$props) $$invalidate(6, width = $$props.width);
    		if ("color" in $$props) $$invalidate(2, color = $$props.color);
    	};

    	$$self.$capture_state = () => ({
    		getScales: makeScales,
    		colors,
    		drawLine: drawLines,
    		afterUpdate,
    		angle,
    		at,
    		length,
    		radius,
    		width,
    		color,
    		res
    	});

    	$$self.$inject_state = $$props => {
    		if ("angle" in $$props) $$invalidate(1, angle = $$props.angle);
    		if ("at" in $$props) $$invalidate(3, at = $$props.at);
    		if ("length" in $$props) $$invalidate(4, length = $$props.length);
    		if ("radius" in $$props) $$invalidate(5, radius = $$props.radius);
    		if ("width" in $$props) $$invalidate(6, width = $$props.width);
    		if ("color" in $$props) $$invalidate(2, color = $$props.color);
    		if ("res" in $$props) $$invalidate(0, res = $$props.res);
    	};

    	let res;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	 $$invalidate(0, res = {});
    	return [res, angle, color, at, length, radius, width];
    }

    class Line extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$5, create_fragment$5, safe_not_equal$1, {
    			angle: 1,
    			at: 3,
    			length: 4,
    			radius: 5,
    			width: 6,
    			color: 2
    		});

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Line",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get angle() {
    		throw new Error("<Line>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set angle(value) {
    		throw new Error("<Line>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get at() {
    		throw new Error("<Line>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set at(value) {
    		throw new Error("<Line>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get length() {
    		throw new Error("<Line>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set length(value) {
    		throw new Error("<Line>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get radius() {
    		throw new Error("<Line>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set radius(value) {
    		throw new Error("<Line>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get width() {
    		throw new Error("<Line>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Line>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Line>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Line>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const findPoint = function (angle, r) {
      return {
        x: r * Math.sin(angle),
        y: -r * Math.cos(angle)
      }
    };

    const drawLabels = function (obj, xScale, rScale) {
      let { q, rotate } = get_store_value(world);
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
    };

    /* Users/spencer/mountain/somehow-circle/src/Label.svelte generated by Svelte v3.29.0 */
    const file$6 = "Users/spencer/mountain/somehow-circle/src/Label.svelte";

    function create_fragment$6(ctx) {
    	let text_1;
    	let raw_value = /*res*/ ctx[0].text + "";
    	let text_1_x_value;
    	let text_1_y_value;
    	let text_1_transform_value;
    	let text_1_font_size_value;
    	let text_1_text_anchor_value;
    	let text_1_fill_value;

    	const block = {
    		c: function create() {
    			text_1 = svg_element$1("text");
    			attr_dev$1(text_1, "x", text_1_x_value = /*res*/ ctx[0].x);
    			attr_dev$1(text_1, "y", text_1_y_value = /*res*/ ctx[0].y);
    			attr_dev$1(text_1, "transform", text_1_transform_value = "rotate(" + (/*res*/ ctx[0].angle || 0) + "," + (/*res*/ ctx[0].x || 0) + "," + (/*res*/ ctx[0].y || 0) + ")");
    			attr_dev$1(text_1, "font-size", text_1_font_size_value = /*res*/ ctx[0].size);
    			attr_dev$1(text_1, "text-anchor", text_1_text_anchor_value = /*res*/ ctx[0].align);
    			attr_dev$1(text_1, "fill", text_1_fill_value = /*res*/ ctx[0].color);
    			add_location$1(text_1, file$6, 32, 0, 758);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, text_1, anchor);
    			text_1.innerHTML = raw_value;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*res*/ 1 && raw_value !== (raw_value = /*res*/ ctx[0].text + "")) text_1.innerHTML = raw_value;
    			if (dirty & /*res*/ 1 && text_1_x_value !== (text_1_x_value = /*res*/ ctx[0].x)) {
    				attr_dev$1(text_1, "x", text_1_x_value);
    			}

    			if (dirty & /*res*/ 1 && text_1_y_value !== (text_1_y_value = /*res*/ ctx[0].y)) {
    				attr_dev$1(text_1, "y", text_1_y_value);
    			}

    			if (dirty & /*res*/ 1 && text_1_transform_value !== (text_1_transform_value = "rotate(" + (/*res*/ ctx[0].angle || 0) + "," + (/*res*/ ctx[0].x || 0) + "," + (/*res*/ ctx[0].y || 0) + ")")) {
    				attr_dev$1(text_1, "transform", text_1_transform_value);
    			}

    			if (dirty & /*res*/ 1 && text_1_font_size_value !== (text_1_font_size_value = /*res*/ ctx[0].size)) {
    				attr_dev$1(text_1, "font-size", text_1_font_size_value);
    			}

    			if (dirty & /*res*/ 1 && text_1_text_anchor_value !== (text_1_text_anchor_value = /*res*/ ctx[0].align)) {
    				attr_dev$1(text_1, "text-anchor", text_1_text_anchor_value);
    			}

    			if (dirty & /*res*/ 1 && text_1_fill_value !== (text_1_fill_value = /*res*/ ctx[0].color)) {
    				attr_dev$1(text_1, "fill", text_1_fill_value);
    			}
    		},
    		i: noop$1,
    		o: noop$1,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(text_1);
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

    	afterUpdate(() => {
    		let obj = {
    			text,
    			color,
    			align,
    			angle: Number(angle),
    			radius: Number(radius),
    			size: Number(size),
    			rotate: Number(rotate)
    		};

    		let { xScale, rScale } = makeScales(obj);
    		$$invalidate(0, res = drawLabels(obj, xScale, rScale));
    	});

    	const writable_props = ["angle", "at", "radius", "rotate", "size", "align", "text", "color"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Label> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("angle" in $$props) $$invalidate(1, angle = $$props.angle);
    		if ("at" in $$props) $$invalidate(3, at = $$props.at);
    		if ("radius" in $$props) $$invalidate(4, radius = $$props.radius);
    		if ("rotate" in $$props) $$invalidate(5, rotate = $$props.rotate);
    		if ("size" in $$props) $$invalidate(6, size = $$props.size);
    		if ("align" in $$props) $$invalidate(7, align = $$props.align);
    		if ("text" in $$props) $$invalidate(8, text = $$props.text);
    		if ("color" in $$props) $$invalidate(2, color = $$props.color);
    	};

    	$$self.$capture_state = () => ({
    		getScales: makeScales,
    		colors,
    		afterUpdate,
    		drawLabel: drawLabels,
    		angle,
    		at,
    		radius,
    		rotate,
    		size,
    		align,
    		text,
    		color,
    		res
    	});

    	$$self.$inject_state = $$props => {
    		if ("angle" in $$props) $$invalidate(1, angle = $$props.angle);
    		if ("at" in $$props) $$invalidate(3, at = $$props.at);
    		if ("radius" in $$props) $$invalidate(4, radius = $$props.radius);
    		if ("rotate" in $$props) $$invalidate(5, rotate = $$props.rotate);
    		if ("size" in $$props) $$invalidate(6, size = $$props.size);
    		if ("align" in $$props) $$invalidate(7, align = $$props.align);
    		if ("text" in $$props) $$invalidate(8, text = $$props.text);
    		if ("color" in $$props) $$invalidate(2, color = $$props.color);
    		if ("res" in $$props) $$invalidate(0, res = $$props.res);
    	};

    	let res;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	 $$invalidate(0, res = {});
    	return [res, angle, color, at, radius, rotate, size, align, text];
    }

    class Label extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$6, create_fragment$6, safe_not_equal$1, {
    			angle: 1,
    			at: 3,
    			radius: 4,
    			rotate: 5,
    			size: 6,
    			align: 7,
    			text: 8,
    			color: 2
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

    const findPoint$1 = function (angle, r) {
      return {
        x: r * Math.sin(angle),
        y: -r * Math.cos(angle)
      }
    };

    const drawLabels$1 = function (obj, xScale, rScale) {
      let { q, rotate } = get_store_value(world);
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
    };

    /* Users/spencer/mountain/somehow-circle/src/Tick.svelte generated by Svelte v3.29.0 */
    const file$7 = "Users/spencer/mountain/somehow-circle/src/Tick.svelte";

    function create_fragment$7(ctx) {
    	let text_1;
    	let raw_value = /*res*/ ctx[0].text + "";
    	let text_1_x_value;
    	let text_1_y_value;
    	let text_1_transform_value;
    	let text_1_font_size_value;
    	let text_1_text_anchor_value;
    	let text_1_fill_value;

    	const block = {
    		c: function create() {
    			text_1 = svg_element$1("text");
    			attr_dev$1(text_1, "x", text_1_x_value = /*res*/ ctx[0].x);
    			attr_dev$1(text_1, "y", text_1_y_value = /*res*/ ctx[0].y);
    			attr_dev$1(text_1, "transform", text_1_transform_value = "rotate(" + (/*res*/ ctx[0].angle || 0) + "," + (/*res*/ ctx[0].x || 0) + "," + (/*res*/ ctx[0].y || 0) + ")");
    			attr_dev$1(text_1, "font-size", text_1_font_size_value = /*res*/ ctx[0].size);
    			attr_dev$1(text_1, "text-anchor", text_1_text_anchor_value = /*res*/ ctx[0].align);
    			attr_dev$1(text_1, "fill", text_1_fill_value = /*res*/ ctx[0].color);
    			add_location$1(text_1, file$7, 33, 0, 781);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev$1(target, text_1, anchor);
    			text_1.innerHTML = raw_value;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*res*/ 1 && raw_value !== (raw_value = /*res*/ ctx[0].text + "")) text_1.innerHTML = raw_value;
    			if (dirty & /*res*/ 1 && text_1_x_value !== (text_1_x_value = /*res*/ ctx[0].x)) {
    				attr_dev$1(text_1, "x", text_1_x_value);
    			}

    			if (dirty & /*res*/ 1 && text_1_y_value !== (text_1_y_value = /*res*/ ctx[0].y)) {
    				attr_dev$1(text_1, "y", text_1_y_value);
    			}

    			if (dirty & /*res*/ 1 && text_1_transform_value !== (text_1_transform_value = "rotate(" + (/*res*/ ctx[0].angle || 0) + "," + (/*res*/ ctx[0].x || 0) + "," + (/*res*/ ctx[0].y || 0) + ")")) {
    				attr_dev$1(text_1, "transform", text_1_transform_value);
    			}

    			if (dirty & /*res*/ 1 && text_1_font_size_value !== (text_1_font_size_value = /*res*/ ctx[0].size)) {
    				attr_dev$1(text_1, "font-size", text_1_font_size_value);
    			}

    			if (dirty & /*res*/ 1 && text_1_text_anchor_value !== (text_1_text_anchor_value = /*res*/ ctx[0].align)) {
    				attr_dev$1(text_1, "text-anchor", text_1_text_anchor_value);
    			}

    			if (dirty & /*res*/ 1 && text_1_fill_value !== (text_1_fill_value = /*res*/ ctx[0].color)) {
    				attr_dev$1(text_1, "fill", text_1_fill_value);
    			}
    		},
    		i: noop$1,
    		o: noop$1,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev$1(text_1);
    		}
    	};

    	dispatch_dev$1("SvelteRegisterBlock", {
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
    	validate_slots$1("Tick", slots, []);
    	let { angle = 0 } = $$props;
    	let { at = 0 } = $$props;
    	angle = angle || at;
    	let { radius = 0 } = $$props;
    	let { rotate = 90 } = $$props;
    	let { size = 1.5 } = $$props;
    	let { align = angle < 0 ? "left" : "right" } = $$props;
    	let { text = "" } = $$props;
    	let { color = "blue" } = $$props;
    	color = colors[color] || color;

    	afterUpdate(() => {
    		let obj = {
    			text,
    			color,
    			align,
    			angle: Number(angle),
    			radius: Number(radius),
    			size: Number(size),
    			rotate: Number(rotate)
    		};

    		let { xScale, rScale } = makeScales(obj);
    		$$invalidate(0, res = drawLabels$1(obj, xScale, rScale));
    	});

    	const writable_props = ["angle", "at", "radius", "rotate", "size", "align", "text", "color"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Tick> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("angle" in $$props) $$invalidate(1, angle = $$props.angle);
    		if ("at" in $$props) $$invalidate(3, at = $$props.at);
    		if ("radius" in $$props) $$invalidate(4, radius = $$props.radius);
    		if ("rotate" in $$props) $$invalidate(5, rotate = $$props.rotate);
    		if ("size" in $$props) $$invalidate(6, size = $$props.size);
    		if ("align" in $$props) $$invalidate(7, align = $$props.align);
    		if ("text" in $$props) $$invalidate(8, text = $$props.text);
    		if ("color" in $$props) $$invalidate(2, color = $$props.color);
    	};

    	$$self.$capture_state = () => ({
    		getScales: makeScales,
    		drawTicks: drawLabels$1,
    		colors,
    		afterUpdate,
    		angle,
    		at,
    		radius,
    		rotate,
    		size,
    		align,
    		text,
    		color,
    		res
    	});

    	$$self.$inject_state = $$props => {
    		if ("angle" in $$props) $$invalidate(1, angle = $$props.angle);
    		if ("at" in $$props) $$invalidate(3, at = $$props.at);
    		if ("radius" in $$props) $$invalidate(4, radius = $$props.radius);
    		if ("rotate" in $$props) $$invalidate(5, rotate = $$props.rotate);
    		if ("size" in $$props) $$invalidate(6, size = $$props.size);
    		if ("align" in $$props) $$invalidate(7, align = $$props.align);
    		if ("text" in $$props) $$invalidate(8, text = $$props.text);
    		if ("color" in $$props) $$invalidate(2, color = $$props.color);
    		if ("res" in $$props) $$invalidate(0, res = $$props.res);
    	};

    	let res;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	 $$invalidate(0, res = {});
    	return [res, angle, color, at, radius, rotate, size, align, text];
    }

    class Tick extends SvelteComponentDev$1 {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$7, create_fragment$7, safe_not_equal$1, {
    			angle: 1,
    			at: 3,
    			radius: 4,
    			rotate: 5,
    			size: 6,
    			align: 7,
    			text: 8,
    			color: 2
    		});

    		dispatch_dev$1("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tick",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get angle() {
    		throw new Error("<Tick>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set angle(value) {
    		throw new Error("<Tick>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get at() {
    		throw new Error("<Tick>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set at(value) {
    		throw new Error("<Tick>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get radius() {
    		throw new Error("<Tick>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set radius(value) {
    		throw new Error("<Tick>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rotate() {
    		throw new Error("<Tick>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rotate(value) {
    		throw new Error("<Tick>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Tick>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Tick>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get align() {
    		throw new Error("<Tick>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set align(value) {
    		throw new Error("<Tick>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get text() {
    		throw new Error("<Tick>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set text(value) {
    		throw new Error("<Tick>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Tick>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Tick>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* 2020/sunset-direction/Post.svelte generated by Svelte v3.29.0 */

    const { console: console_1 } = globals;

    const file$8 = "2020/sunset-direction/Post.svelte";

    function add_css$4() {
    	var style = element("style");
    	style.id = "svelte-13wxeui-style";
    	style.textContent = ".all.svelte-13wxeui{position:relative}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCB7IFBhZ2UgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2luZGV4Lm1qcydcbiAgaW1wb3J0IHNwYWNldGltZSBmcm9tICdzcGFjZXRpbWUnXG4gIGltcG9ydCB7IGNhbGNZZWFyIH0gZnJvbSAnLi9jYWxjJ1xuICBpbXBvcnQgZGF5bGlnaHQgZnJvbSAnc3BhY2V0aW1lLWRheWxpZ2h0J1xuICBpbXBvcnQgeyBSb3VuZCwgQXJjLCBMaW5lLCBUaWNrLCBMYWJlbCB9IGZyb20gJy9Vc2Vycy9zcGVuY2VyL21vdW50YWluL3NvbWVob3ctY2lyY2xlL3NyYydcbiAgLy8gaW1wb3J0IHsgTGF0aXR1ZGUgfSBmcm9tICdzb21laG93LXNsaWRlcidcbiAgLy8gaW1wb3J0IHsgbGF0LCB0aWNrcyB9IGZyb20gJy4vc3RvcmUnXG4gIGltcG9ydCB7IGdldFN1blNldCwgZ2V0U3VuUmlzZSB9IGZyb20gJy4vY2FsYydcbiAgbGV0IHRpdGxlID0gYFN1bnJpc2UgKyBTdW5zZXQgZGlyZWN0aW9uYFxuICBzcGFjZXRpbWUuZXh0ZW5kKGRheWxpZ2h0KVxuICBsZXQgZGF5ID0gc3BhY2V0aW1lLm5vdygpLmZvcm1hdCgnaXNvLXNob3J0JylcblxuICBsZXQgbGF0ID0gMzdcblxuICBjb25zdCBmbXQgPSBmdW5jdGlvbiAodikge1xuICAgIHYgLT0gOTBcbiAgICB2ICo9IC0xXG4gICAgcmV0dXJuIHZcbiAgfVxuICAvLyBnZXQgY3VycmVudCBzdW5zZXQgYXppbW91dFxuICBsZXQgbm93ID0gc3BhY2V0aW1lKGRheSlcbiAgbGV0IGN1cnJlbnRTZXQgPSAwXG4gIGxldCBjdXJyZW50UmlzZSA9IDBcbiAgbGV0IHRpY2tzID0gW11cbiAgY29uc3QgY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgIG5vdyA9IHNwYWNldGltZShkYXkpXG4gICAgY29uc29sZS5sb2coJ2NhbGMnLCBsYXQsIGRheSlcbiAgICBub3cgPSBnZXRTdW5TZXQobm93LCBmbXQobGF0KSlcbiAgICBjdXJyZW50U2V0ID0gbm93LnN1blBvc2l0aW9uKCkuYXppbXV0aFxuICAgIG5vdyA9IGdldFN1blJpc2Uobm93LCBmbXQobGF0KSlcbiAgICBjdXJyZW50UmlzZSA9IG5vdy5zdW5Qb3NpdGlvbigpLmF6aW11dGhcbiAgICBjb25zb2xlLmxvZyhjdXJyZW50UmlzZSlcbiAgICB0aWNrcyA9IGNhbGNZZWFyKGxhdClcbiAgfVxuICBjaGFuZ2UoKVxuPC9zY3JpcHQ+XG5cbjxQYWdlIHt0aXRsZX0gZ3Jvdz17dHJ1ZX0gbWF4PXsxMTAwfSBzdWI9XCJhdCB7bGF0fcKwXCI+XG4gIDxkaXYgY2xhc3M9XCJhbGxcIj5cbiAgICA8aW5wdXQgdHlwZT1cInJhbmdlXCIgYmluZDp2YWx1ZT17bGF0fSBtaW49XCI0XCIgbWF4PVwiNzRcIiBvbjpjaGFuZ2U9e2NoYW5nZX0gLz5cbiAgICA8aW5wdXQgdHlwZT1cImRhdGVcIiBiaW5kOnZhbHVlPXtkYXl9IG9uOmNoYW5nZT17Y2hhbmdlfSAvPlxuICAgIDwhLS0gPGRpdj57Y3VycmVudFNldH08L2Rpdj4gLS0+XG4gICAgPCEtLSA8ZGl2IGNsYXNzPVwicmlnaHQgZjIgbXQ0XCIgc3R5bGU9XCJtYXJnaW4tYm90dG9tOi01MHB4O1wiPntmbXQoJGxhdCl9wrA8L2Rpdj4gLS0+XG4gICAgPFJvdW5kIHdpZHRoPVwiNTAwXCIgaGVpZ2h0PVwiNTAwXCIgcm90YXRlPVwiLTkwXCIgbWFyZ2luPVwiMTBcIj5cbiAgICAgIDxUaWNrIHRleHQ9XCJOXCIgYW5nbGU9XCIxODBcIiByYWRpdXM9XCI0NVwiIHNpemU9XCIyLjZcIiBjb2xvcj1cImxpZ2h0Ymx1ZVwiIHJvdGF0ZT1cIjBcIiAvPlxuICAgICAgPFRpY2sgdGV4dD1cIlNcIiBhbmdsZT1cIjBcIiByYWRpdXM9XCI0NVwiIHNpemU9XCIyLjZcIiBjb2xvcj1cImxpZ2h0Ymx1ZVwiIHJvdGF0ZT1cIjBcIiAvPlxuICAgICAgPFRpY2sgdGV4dD1cIkVcIiBhbmdsZT1cIjkwXCIgcmFkaXVzPVwiNDVcIiBzaXplPVwiMi42XCIgY29sb3I9XCJsaWdodGJsdWVcIiAvPlxuICAgICAgPFRpY2sgdGV4dD1cIldcIiBhbmdsZT1cIjI3MFwiIHJhZGl1cz1cIjQ1XCIgc2l6ZT1cIjIuNlwiIGNvbG9yPVwibGlnaHRibHVlXCIgLz5cbiAgICAgIDwhLS0gc3VucmlzZS9zdW5zZXQgdGlja3MgLS0+XG4gICAgICB7I2VhY2ggdGlja3MgYXMgd2VlaywgaSAod2Vlay5pZCl9XG4gICAgICAgIDxBcmMgZnJvbT17d2Vlay5zdW5zZXR9IHRvPXt3ZWVrLnN1bnNldCArIDAuNX0gY29sb3I9XCJwaW5rXCIgd2lkdGg9XCI4XCIgcmFkaXVzPVwiNTJcIiAvPlxuICAgICAgICA8QXJjIGZyb209e3dlZWsuc3VucmlzZX0gdG89e3dlZWsuc3VucmlzZSArIDAuNX0gY29sb3I9XCJ5ZWxsb3dcIiB3aWR0aD1cIjhcIiByYWRpdXM9XCI1MlwiIC8+XG4gICAgICAgIHsjaWYgaSA9PT0gNTAgfHwgaSA9PT0gMjQgfHwgaSA9PT0gMTB9XG4gICAgICAgICAgPFRpY2tcbiAgICAgICAgICAgIGF0PXt3ZWVrLnN1bnNldH1cbiAgICAgICAgICAgIGNvbG9yPVwibGlnaHRcIlxuICAgICAgICAgICAgdGV4dD17d2Vlay5kYXRlfVxuICAgICAgICAgICAgcmFkaXVzPVwiNjJcIlxuICAgICAgICAgICAgYWxpZ249e2kgPT09IDI0ID8gJ2xlZnQnIDogJ3JpZ2h0J31cbiAgICAgICAgICAvPlxuICAgICAgICAgIDxUaWNrXG4gICAgICAgICAgICBhdD17d2Vlay5zdW5yaXNlfVxuICAgICAgICAgICAgY29sb3I9XCJsaWdodFwiXG4gICAgICAgICAgICB0ZXh0PXt3ZWVrLmRhdGV9XG4gICAgICAgICAgICByYWRpdXM9XCI2OVwiXG4gICAgICAgICAgICBhbGlnbj17aSA9PT0gMjQgPyAnbGVmdCcgOiAncmlnaHQnfVxuICAgICAgICAgIC8+XG4gICAgICAgIHsvaWZ9XG4gICAgICB7L2VhY2h9XG5cbiAgICAgIDwhLS0gZHJhdyBpbnNpZGUgYXJjcyAtLT5cbiAgICAgIDxMaW5lIHJhZGl1cz1cIjVcIiBsZW5ndGg9XCI0MFwiIGFuZ2xlPXtjdXJyZW50U2V0fSBjb2xvcj1cImxpZ2h0Ymx1ZVwiIHdpZHRoPVwiMC4yXCIgLz5cbiAgICAgIDxMaW5lIHJhZGl1cz1cIjVcIiBsZW5ndGg9XCI0MFwiIGFuZ2xlPXtjdXJyZW50UmlzZX0gY29sb3I9XCJsaWdodGJsdWVcIiB3aWR0aD1cIjAuMlwiIC8+XG4gICAgICA8QXJjXG4gICAgICAgIHJhZGl1cz1cIjE1XCJcbiAgICAgICAgbGVuZ3RoPVwiNDBcIlxuICAgICAgICBmcm9tPXtjdXJyZW50UmlzZX1cbiAgICAgICAgdG89e2N1cnJlbnRTZXR9XG4gICAgICAgIGNvbG9yPVwibGlnaHRibHVlXCJcbiAgICAgICAgb3BhY2l0eT1cIjAuN1wiXG4gICAgICAgIHdpZHRoPVwiNlwiXG4gICAgICAvPlxuICAgICAgPCEtLSA8TGFiZWxcbiAgICAgIHRleHQ9e25vdy5mb3JtYXQoJ3ttb250aC1zaG9ydH0ge2RheS1vcmRpbmFsfScpfVxuICAgICAgc2l6ZT1cIjJcIlxuICAgICAgcmFkaXVzPVwiMFwiXG4gICAgICBhbmdsZT1cIjBcIlxuICAgICAgYWxpZ249XCJjZW50ZXJcIlxuICAgICAgY29sb3I9XCJncmV5XCJcbiAgICAvPiAtLT5cbiAgICA8L1JvdW5kPlxuICAgIDxkaXYgc3R5bGU9XCJjb2xvcjpncmV5O1wiPlxuICAgICAge25vdy5mb3JtYXQoJ3ttb250aC1zaG9ydH0ge2RheS1vcmRpbmFsfScpfVxuICAgIDwvZGl2PlxuICA8L2Rpdj5cbjwvUGFnZT5cblxuPHN0eWxlPlxuICAuYWxsIHtcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBbUdFLElBQUksZUFBQyxDQUFDLEFBQ0osUUFBUSxDQUFFLFFBQVEsQUFDcEIsQ0FBQyJ9 */";
    	append_dev(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	child_ctx[13] = i;
    	return child_ctx;
    }

    // (54:8) {#if i === 50 || i === 24 || i === 10}
    function create_if_block(ctx) {
    	let tick0;
    	let t;
    	let tick1;
    	let current;

    	tick0 = new Tick({
    			props: {
    				at: /*week*/ ctx[11].sunset,
    				color: "light",
    				text: /*week*/ ctx[11].date,
    				radius: "62",
    				align: /*i*/ ctx[13] === 24 ? "left" : "right"
    			},
    			$$inline: true
    		});

    	tick1 = new Tick({
    			props: {
    				at: /*week*/ ctx[11].sunrise,
    				color: "light",
    				text: /*week*/ ctx[11].date,
    				radius: "69",
    				align: /*i*/ ctx[13] === 24 ? "left" : "right"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(tick0.$$.fragment);
    			t = space();
    			create_component(tick1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(tick0, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(tick1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tick0_changes = {};
    			if (dirty & /*ticks*/ 32) tick0_changes.at = /*week*/ ctx[11].sunset;
    			if (dirty & /*ticks*/ 32) tick0_changes.text = /*week*/ ctx[11].date;
    			if (dirty & /*ticks*/ 32) tick0_changes.align = /*i*/ ctx[13] === 24 ? "left" : "right";
    			tick0.$set(tick0_changes);
    			const tick1_changes = {};
    			if (dirty & /*ticks*/ 32) tick1_changes.at = /*week*/ ctx[11].sunrise;
    			if (dirty & /*ticks*/ 32) tick1_changes.text = /*week*/ ctx[11].date;
    			if (dirty & /*ticks*/ 32) tick1_changes.align = /*i*/ ctx[13] === 24 ? "left" : "right";
    			tick1.$set(tick1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tick0.$$.fragment, local);
    			transition_in(tick1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tick0.$$.fragment, local);
    			transition_out(tick1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tick0, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(tick1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(54:8) {#if i === 50 || i === 24 || i === 10}",
    		ctx
    	});

    	return block;
    }

    // (51:6) {#each ticks as week, i (week.id)}
    function create_each_block(key_1, ctx) {
    	let first;
    	let arc0;
    	let t0;
    	let arc1;
    	let t1;
    	let if_block_anchor;
    	let current;

    	arc0 = new Arc({
    			props: {
    				from: /*week*/ ctx[11].sunset,
    				to: /*week*/ ctx[11].sunset + 0.5,
    				color: "pink",
    				width: "8",
    				radius: "52"
    			},
    			$$inline: true
    		});

    	arc1 = new Arc({
    			props: {
    				from: /*week*/ ctx[11].sunrise,
    				to: /*week*/ ctx[11].sunrise + 0.5,
    				color: "yellow",
    				width: "8",
    				radius: "52"
    			},
    			$$inline: true
    		});

    	let if_block = (/*i*/ ctx[13] === 50 || /*i*/ ctx[13] === 24 || /*i*/ ctx[13] === 10) && create_if_block(ctx);

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(arc0.$$.fragment);
    			t0 = space();
    			create_component(arc1.$$.fragment);
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(arc0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(arc1, target, anchor);
    			insert_dev(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const arc0_changes = {};
    			if (dirty & /*ticks*/ 32) arc0_changes.from = /*week*/ ctx[11].sunset;
    			if (dirty & /*ticks*/ 32) arc0_changes.to = /*week*/ ctx[11].sunset + 0.5;
    			arc0.$set(arc0_changes);
    			const arc1_changes = {};
    			if (dirty & /*ticks*/ 32) arc1_changes.from = /*week*/ ctx[11].sunrise;
    			if (dirty & /*ticks*/ 32) arc1_changes.to = /*week*/ ctx[11].sunrise + 0.5;
    			arc1.$set(arc1_changes);

    			if (/*i*/ ctx[13] === 50 || /*i*/ ctx[13] === 24 || /*i*/ ctx[13] === 10) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*ticks*/ 32) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(arc0.$$.fragment, local);
    			transition_in(arc1.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(arc0.$$.fragment, local);
    			transition_out(arc1.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(arc0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(arc1, detaching);
    			if (detaching) detach_dev(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(51:6) {#each ticks as week, i (week.id)}",
    		ctx
    	});

    	return block;
    }

    // (45:4) <Round width="500" height="500" rotate="-90" margin="10">
    function create_default_slot_1(ctx) {
    	let tick0;
    	let t0;
    	let tick1;
    	let t1;
    	let tick2;
    	let t2;
    	let tick3;
    	let t3;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t4;
    	let line0;
    	let t5;
    	let line1;
    	let t6;
    	let arc;
    	let current;

    	tick0 = new Tick({
    			props: {
    				text: "N",
    				angle: "180",
    				radius: "45",
    				size: "2.6",
    				color: "lightblue",
    				rotate: "0"
    			},
    			$$inline: true
    		});

    	tick1 = new Tick({
    			props: {
    				text: "S",
    				angle: "0",
    				radius: "45",
    				size: "2.6",
    				color: "lightblue",
    				rotate: "0"
    			},
    			$$inline: true
    		});

    	tick2 = new Tick({
    			props: {
    				text: "E",
    				angle: "90",
    				radius: "45",
    				size: "2.6",
    				color: "lightblue"
    			},
    			$$inline: true
    		});

    	tick3 = new Tick({
    			props: {
    				text: "W",
    				angle: "270",
    				radius: "45",
    				size: "2.6",
    				color: "lightblue"
    			},
    			$$inline: true
    		});

    	let each_value = /*ticks*/ ctx[5];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*week*/ ctx[11].id;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	line0 = new Line({
    			props: {
    				radius: "5",
    				length: "40",
    				angle: /*currentSet*/ ctx[3],
    				color: "lightblue",
    				width: "0.2"
    			},
    			$$inline: true
    		});

    	line1 = new Line({
    			props: {
    				radius: "5",
    				length: "40",
    				angle: /*currentRise*/ ctx[4],
    				color: "lightblue",
    				width: "0.2"
    			},
    			$$inline: true
    		});

    	arc = new Arc({
    			props: {
    				radius: "15",
    				length: "40",
    				from: /*currentRise*/ ctx[4],
    				to: /*currentSet*/ ctx[3],
    				color: "lightblue",
    				opacity: "0.7",
    				width: "6"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(tick0.$$.fragment);
    			t0 = space();
    			create_component(tick1.$$.fragment);
    			t1 = space();
    			create_component(tick2.$$.fragment);
    			t2 = space();
    			create_component(tick3.$$.fragment);
    			t3 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			create_component(line0.$$.fragment);
    			t5 = space();
    			create_component(line1.$$.fragment);
    			t6 = space();
    			create_component(arc.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(tick0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(tick1, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(tick2, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(tick3, target, anchor);
    			insert_dev(target, t3, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, t4, anchor);
    			mount_component(line0, target, anchor);
    			insert_dev(target, t5, anchor);
    			mount_component(line1, target, anchor);
    			insert_dev(target, t6, anchor);
    			mount_component(arc, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*ticks*/ 32) {
    				const each_value = /*ticks*/ ctx[5];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, t4.parentNode, outro_and_destroy_block, create_each_block, t4, get_each_context);
    				check_outros();
    			}

    			const line0_changes = {};
    			if (dirty & /*currentSet*/ 8) line0_changes.angle = /*currentSet*/ ctx[3];
    			line0.$set(line0_changes);
    			const line1_changes = {};
    			if (dirty & /*currentRise*/ 16) line1_changes.angle = /*currentRise*/ ctx[4];
    			line1.$set(line1_changes);
    			const arc_changes = {};
    			if (dirty & /*currentRise*/ 16) arc_changes.from = /*currentRise*/ ctx[4];
    			if (dirty & /*currentSet*/ 8) arc_changes.to = /*currentSet*/ ctx[3];
    			arc.$set(arc_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tick0.$$.fragment, local);
    			transition_in(tick1.$$.fragment, local);
    			transition_in(tick2.$$.fragment, local);
    			transition_in(tick3.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(line0.$$.fragment, local);
    			transition_in(line1.$$.fragment, local);
    			transition_in(arc.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tick0.$$.fragment, local);
    			transition_out(tick1.$$.fragment, local);
    			transition_out(tick2.$$.fragment, local);
    			transition_out(tick3.$$.fragment, local);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(line0.$$.fragment, local);
    			transition_out(line1.$$.fragment, local);
    			transition_out(arc.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tick0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(tick1, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(tick2, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(tick3, detaching);
    			if (detaching) detach_dev(t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(t4);
    			destroy_component(line0, detaching);
    			if (detaching) detach_dev(t5);
    			destroy_component(line1, detaching);
    			if (detaching) detach_dev(t6);
    			destroy_component(arc, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(45:4) <Round width=\\\"500\\\" height=\\\"500\\\" rotate=\\\"-90\\\" margin=\\\"10\\\">",
    		ctx
    	});

    	return block;
    }

    // (39:0) <Page {title} grow={true} max={1100} sub="at {lat}°">
    function create_default_slot(ctx) {
    	let div1;
    	let input0;
    	let t0;
    	let input1;
    	let t1;
    	let round;
    	let t2;
    	let div0;
    	let t3_value = /*now*/ ctx[2].format("{month-short} {day-ordinal}") + "";
    	let t3;
    	let current;
    	let mounted;
    	let dispose;

    	round = new Round({
    			props: {
    				width: "500",
    				height: "500",
    				rotate: "-90",
    				margin: "10",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			input0 = element("input");
    			t0 = space();
    			input1 = element("input");
    			t1 = space();
    			create_component(round.$$.fragment);
    			t2 = space();
    			div0 = element("div");
    			t3 = text(t3_value);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "4");
    			attr_dev(input0, "max", "74");
    			add_location(input0, file$8, 40, 4, 1141);
    			attr_dev(input1, "type", "date");
    			add_location(input1, file$8, 41, 4, 1221);
    			set_style(div0, "color", "grey");
    			add_location(div0, file$8, 92, 4, 3079);
    			attr_dev(div1, "class", "all svelte-13wxeui");
    			add_location(div1, file$8, 39, 2, 1119);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, input0);
    			set_input_value(input0, /*lat*/ ctx[1]);
    			append_dev(div1, t0);
    			append_dev(div1, input1);
    			set_input_value(input1, /*day*/ ctx[0]);
    			append_dev(div1, t1);
    			mount_component(round, div1, null);
    			append_dev(div1, t2);
    			append_dev(div1, div0);
    			append_dev(div0, t3);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[8]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[8]),
    					listen_dev(input0, "change", /*change*/ ctx[7], false, false, false),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[9]),
    					listen_dev(input1, "change", /*change*/ ctx[7], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*lat*/ 2) {
    				set_input_value(input0, /*lat*/ ctx[1]);
    			}

    			if (dirty & /*day*/ 1) {
    				set_input_value(input1, /*day*/ ctx[0]);
    			}

    			const round_changes = {};

    			if (dirty & /*$$scope, currentRise, currentSet, ticks*/ 16440) {
    				round_changes.$$scope = { dirty, ctx };
    			}

    			round.$set(round_changes);
    			if ((!current || dirty & /*now*/ 4) && t3_value !== (t3_value = /*now*/ ctx[2].format("{month-short} {day-ordinal}") + "")) set_data_dev(t3, t3_value);
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
    			if (detaching) detach_dev(div1);
    			destroy_component(round);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(39:0) <Page {title} grow={true} max={1100} sub=\\\"at {lat}°\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let page;
    	let current;

    	page = new Page({
    			props: {
    				title: /*title*/ ctx[6],
    				grow: true,
    				max: 1100,
    				sub: "at " + /*lat*/ ctx[1] + "°",
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
    			if (dirty & /*lat*/ 2) page_changes.sub = "at " + /*lat*/ ctx[1] + "°";

    			if (dirty & /*$$scope, now, currentRise, currentSet, ticks, day, lat*/ 16447) {
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
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Post", slots, []);
    	let title = `Sunrise + Sunset direction`;
    	main$1.extend(index);
    	let day = main$1.now().format("iso-short");
    	let lat = 37;

    	const fmt = function (v) {
    		v -= 90;
    		v *= -1;
    		return v;
    	};

    	// get current sunset azimout
    	let now = main$1(day);

    	let currentSet = 0;
    	let currentRise = 0;
    	let ticks = [];

    	const change = function () {
    		$$invalidate(2, now = main$1(day));
    		console.log("calc", lat, day);
    		$$invalidate(2, now = getSunSet(now, fmt(lat)));
    		$$invalidate(3, currentSet = now.sunPosition().azimuth);
    		$$invalidate(2, now = getSunRise(now, fmt(lat)));
    		$$invalidate(4, currentRise = now.sunPosition().azimuth);
    		console.log(currentRise);
    		$$invalidate(5, ticks = calcYear(lat));
    	};

    	change();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	function input0_change_input_handler() {
    		lat = to_number(this.value);
    		$$invalidate(1, lat);
    	}

    	function input1_input_handler() {
    		day = this.value;
    		$$invalidate(0, day);
    	}

    	$$self.$capture_state = () => ({
    		Page,
    		spacetime: main$1,
    		calcYear,
    		daylight: index,
    		Round,
    		Arc,
    		Line,
    		Tick,
    		Label,
    		getSunSet,
    		getSunRise,
    		title,
    		day,
    		lat,
    		fmt,
    		now,
    		currentSet,
    		currentRise,
    		ticks,
    		change
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(6, title = $$props.title);
    		if ("day" in $$props) $$invalidate(0, day = $$props.day);
    		if ("lat" in $$props) $$invalidate(1, lat = $$props.lat);
    		if ("now" in $$props) $$invalidate(2, now = $$props.now);
    		if ("currentSet" in $$props) $$invalidate(3, currentSet = $$props.currentSet);
    		if ("currentRise" in $$props) $$invalidate(4, currentRise = $$props.currentRise);
    		if ("ticks" in $$props) $$invalidate(5, ticks = $$props.ticks);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		day,
    		lat,
    		now,
    		currentSet,
    		currentRise,
    		ticks,
    		title,
    		change,
    		input0_change_input_handler,
    		input1_input_handler
    	];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-13wxeui-style")) add_css$4();
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$8.name
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
