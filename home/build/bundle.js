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
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
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

    var manifest = {
      2018: [
        {
          num: 'sports-by-city',
          title: 'Sports seasons by city',
          thumb: 'thumb.png',
        },
        {
          num: 'weather-by-latitude',
          title: 'Weather by latitude',
          thumb: 'thumb.png',
        },
        {
          num: 'lunar-astronauts',
          title: 'Lunar astronauts by age',
          thumb: 'thumb.png',
        },
        // {
        //   num: '04',
        //   title: 'Toronto and montreal',
        //   thumb: 'thumb.png',
        // },
        {
          num: 'baseball-season',
          title: '2018 baseball season',
          thumb: 'thumb.png',
        },
      ],
      2019: [
        {
          num: 'nhl-team-performance',
          title: 'NHL performance by team',
          thumb: 'thumb.jpg',
        },
        {
          num: 'nhl-history',
          title: 'History of the NHL',
          thumb: 'thumb.png',
        },
        {
          num: 'rain-in-toronto',
          title: 'Rain in Toronto',
          thumb: 'thumb.png',
        },
        {
          num: 'break-up-the-year',
          title: 'Break-up the year',
          thumb: 'thumb.png',
        },
        // {
        //   num: '05',
        //   title: 'Reading all of wikipedia',
        //   thumb: 'thumb.png',
        // },
        {
          num: 'nhl-arenas',
          title: 'NHL arenas',
          thumb: 'thumb.png',
        },
        {
          num: 'baseball-schedule',
          title: 'Baseball schedule',
          thumb: 'thumb.png',
        },
        {
          num: 'generations-of-people',
          title: 'Generations of people',
          thumb: 'thumb.png',
        },
        {
          num: 'daylight-by-latitude',
          title: 'Daylight by latitude',
          thumb: 'thumb.jpg',
        },
        {
          num: 'ontario-landfills',
          title: 'Ontario Landfills',
          thumb: 'thumb.png',
        },
        {
          num: 'ontario-line',
          title: 'Ontario Line Map',
          thumb: 'thumb.jpg',
        },
      ],
      2020: [
        {
          num: 'ontario-covid',
          title: 'Causes of death in Ontario',
          thumb: 'thumb.jpg',
        },
        {
          num: 'daylight-savings-changes',
          title: 'Daylight Savings times',
          thumb: 'thumb.jpg',
        },
        {
          num: 'year-in-toronto',
          title: 'The Year in Toronto',
          thumb: 'thumb.jpg',
        },
        {
          num: 'skydome-roof-by-year',
          title: 'Skydome roof',
          thumb: 'thumb.jpg',
        },
        // {
        //   num: 'toronto-streets',
        //   title: 'Toronto street-map',
        //   thumb: 'thumb.jpg',
        // },
        {
          num: 'mayors-of-toronto',
          title: 'Mayors of Toronto',
          thumb: 'thumb.jpg',
        },
        {
          num: 'rocket-launches',
          title: 'Rocket Launches',
          thumb: 'thumb.jpg',
        },
        {
          num: 'nhl-playoffs',
          title: 'NHL playoffs by year',
          thumb: 'thumb.jpg',
        },
        {
          num: 'leafs-roster',
          title: 'Toronto Maple leafs roster',
          thumb: 'thumb.jpg',
        },
        {
          num: 'leafs-budget',
          title: 'Toronto Maple leafs budget',
          thumb: 'thumb.jpg',
        },
        {
          num: 'population-of-canada',
          title: 'Population of Canada',
          thumb: 'thumb.jpg',
        },
        {
          num: 'covid-as-skydome',
          title: 'Covid as percentage of skydome',
          thumb: 'thumb.jpg',
        },
        {
          num: 'population-of-ontario',
          title: 'Population of Ontario',
          thumb: 'thumb.jpg',
        },
        {
          num: 'toronto-budget',
          title: 'Toronto City budget',
          thumb: 'thumb.jpg',
        },
        {
          num: 'earth-as-pie',
          title: 'Earth as a pie-chart',
          thumb: 'thumb.jpg',
        },
        {
          num: 'cerb-budget',
          title: "CERB and Canada's budget",
          thumb: 'thumb.jpg',
        },
        {
          num: 'cerb-population',
          title: "CERB and Canada's population",
          thumb: 'thumb.jpg',
        },
        {
          num: 'covid-income',
          title: "Canada's income during COVID",
          thumb: 'thumb.jpg',
        },
        {
          num: 'sunset-direction',
          title: 'Sunset direction by year',
          thumb: 'thumb.jpg',
        },
        {
          num: 'computer-history',
          title: 'Computer programming timeline',
          thumb: 'thumb.jpg',
        },
        {
          num: 'governments-of-canada',
          title: 'Governments of Canada',
          thumb: 'thumb.jpg',
        },
        {
          num: 'transit-projects-canada',
          title: 'Public Transit in Canada',
          thumb: 'thumb.jpg',
        },
        {
          num: 'stanley-cups-in-canada',
          title: 'Stanley Cups in Canada',
          thumb: 'thumb.jpg',
        },
        {
          num: 'climates-canada',
          title: 'Climates in Canada',
          thumb: 'thumb.jpg',
        },
        {
          num: 'snowfall-in-canada',
          title: 'Snowfall in Canada',
          thumb: 'thumb.jpg',
        },
        {
          num: 'weeks-of-the-year',
          title: 'Weeks of the Year',
          thumb: 'thumb.jpg',
        },
      ],
      2021: [
        {
          num: 'computers-and-typewriters',
          title: 'Computers and Typewriters',
          thumb: 'thumb.jpg',
        },
        {
          num: 'cbc-radio-schedule',
          title: 'CBC Radio 1 Schedule',
          thumb: 'thumb.jpg',
        }
      ],
      2022: [
        {
          num: 'toronto-construction',
          title: 'Toronto construction',
          thumb: 'thumb.jpg',
        },
        {
          num: 'bluejays-calendar',
          title: 'Blue Jays 2022 schedule',
          thumb: 'thumb.jpg',
        },
        {
          num: 'accumulated-units',
          title: 'Housing units by Toronto mayor',
          thumb: 'thumb.jpg',
        },
        {
          num: 'construction-map',
          title: 'Active Toronto Multiplex permits',
          thumb: 'thumb.jpg',
        },
        {
          num: 'missing-middle',
          title: 'Toronto construction permits by building size',
          thumb: 'thumb.jpg',
        },
        {
          num: 'pipeline',
          title: 'Timeline of Completed Toronto condos',
          thumb: 'thumb.jpg',
        },
        {
          num: 'population-growth',
          title: 'Population growth of Toronto',
          thumb: 'thumb.jpg',
        },
        {
          num: 'riding-sankey',
          title: 'Toronto growth by ward',
          thumb: 'thumb.jpg',
        },
        {
          num: 'toronto-council',
          title: 'Longest-serving Toronto City Councilors',
          thumb: 'thumb.jpg',
        },
        {
          num: 'transit-map',
          title: 'Transit stations by ward',
          thumb: 'thumb.jpg',
        },
        {
          num: 'toronto-elections',
          title: 'Toronto elections',
          thumb: 'thumb.jpg',
        },
        {
          num: 'aspect-ratios',
          title: 'Aspect ratios',
          thumb: 'thumb.jpg',
        },
        {
          num: 'one-of',
          title: 'One of 1,000',
          thumb: 'thumb.jpg',
        },
      ],
      2023: [
        {
          num: 'timezone-offsets',
          title: 'Timezone offsets',
          thumb: 'thumb.jpg',
        },
        {
          num: 'dst-changes',
          title: 'DST changes',
          thumb: 'thumb.jpg',
        },
        {
          num: 'canada-homeowners',
          title: 'Canada homeowners',
          thumb: 'thumb.jpg',
        },
      ]
    };

    /* home/Post.svelte generated by Svelte v3.29.0 */

    const { Object: Object_1 } = globals;
    const file = "home/Post.svelte";

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-16jk3gz-style";
    	style.textContent = ".title.svelte-16jk3gz{padding-bottom:10px}.target.svelte-16jk3gz:hover{border:1px solid lightgrey;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2)}.target.svelte-16jk3gz{border:1px solid #fbfbfb;padding:1.5rem;margin:1rem}.container.svelte-16jk3gz{margin:3rem;background-color:#fbfbfb}.which.svelte-16jk3gz{width:800px;text-align:left;margin-bottom:2rem;margin-top:50px}.num.svelte-16jk3gz{display:inline;padding-left:1.5rem;padding-right:1.5rem;border-bottom:3px solid steelblue}.posts.svelte-16jk3gz{display:grid;grid-template-columns:repeat(2, 1fr);box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2);margin-bottom:2rem;padding-bottom:1rem}@media only screen and (max-width: 800px){.posts.svelte-16jk3gz{grid-template-columns:repeat(1, 1fr)}.which.svelte-16jk3gz{width:400px}}.link.svelte-16jk3gz{font-size:1rem;text-decoration:none;color:steelblue}.col.svelte-16jk3gz{display:flex;width:100%;flex:1;flex-direction:column;justify-content:flex-start;align-items:center;text-align:center;flex-wrap:nowrap;align-self:stretch}.year.svelte-16jk3gz{margin-top:2rem}.post.svelte-16jk3gz{overflow:hidden;width:400px;min-height:260px;font-size:1.2rem}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBieVllYXIgZnJvbSAnLi4vbWFuaWZlc3QuanMnXG48L3NjcmlwdD5cblxuPGRpdj5cbiAgPGRpdiBjbGFzcz1cIlwiIHN0eWxlPVwiZm9udC1zaXplOjEwcHg7IGNvbG9yOmdyZXk7XCI+XG4gICAgZ3JhcGhzIGJ5IDxhIGNsYXNzPVwibGlua1wiIHN0eWxlPVwiZm9udC1zaXplOjEwcHg7XCIgaHJlZj1cImh0dHA6Ly90d2l0dGVyLmNvbS9zcGVuY2VybW91bnRhaW4vXCJcbiAgICAgID5Ac3BlbmNlcm1vdW50YWluPC9hXG4gICAgPlxuICA8L2Rpdj5cbiAgPGRpdiBjbGFzcz1cImNvbnRhaW5lciBcIj5cbiAgICB7I2VhY2ggT2JqZWN0LmtleXMoYnlZZWFyKS5zb3J0KCkucmV2ZXJzZSgpIGFzIHllYXJ9XG4gICAgICA8ZGl2IGNsYXNzPVwieWVhciBjb2xcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cIndoaWNoXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm51bVwiPnt5ZWFyfTwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInBvc3RzXCI+XG4gICAgICAgICAgeyNlYWNoIGJ5WWVhclt5ZWFyXS5yZXZlcnNlKCkgYXMgb31cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwb3N0IGNvbFwiPlxuICAgICAgICAgICAgICA8YSBocmVmPVwiL3t5ZWFyfS97by5udW19XCIgY2xhc3M9XCJ0YXJnZXRcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGl0bGVcIj5cbiAgICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIve3llYXJ9L3tvLm51bX1cIiBjbGFzcz1cImxpbmtcIj57by50aXRsZX08L2E+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgIDxpbWcgYWx0PVwiXCIgc3R5bGU9XCJ3aWR0aDoxNTBweDtcIiBzcmM9XCIve3llYXJ9L3tvLm51bX0ve28udGh1bWJ9XCIgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgey9lYWNofVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIHsvZWFjaH1cbiAgPC9kaXY+XG48L2Rpdj5cblxuPCEtLSA8c3ZlbHRlOmNvbXBvbmVudCB0aGlzPXtDaGF0Qm94fSAvPiAtLT5cbjxzdHlsZT5cbiAgLnRpdGxlIHtcbiAgICBwYWRkaW5nLWJvdHRvbTogMTBweDtcbiAgfVxuICAudGFyZ2V0OmhvdmVyIHtcbiAgICBib3JkZXI6IDFweCBzb2xpZCBsaWdodGdyZXk7XG4gICAgYm94LXNoYWRvdzogMnB4IDJweCA4cHggMHB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcbiAgfVxuICAudGFyZ2V0IHtcbiAgICBib3JkZXI6IDFweCBzb2xpZCAjZmJmYmZiO1xuICAgIHBhZGRpbmc6IDEuNXJlbTtcbiAgICBtYXJnaW46IDFyZW07XG4gIH1cbiAgLmNvbnRhaW5lciB7XG4gICAgbWFyZ2luOiAzcmVtO1xuICAgIGJhY2tncm91bmQtY29sb3I6ICNmYmZiZmI7XG4gIH1cbiAgLndoaWNoIHtcbiAgICB3aWR0aDogODAwcHg7XG4gICAgdGV4dC1hbGlnbjogbGVmdDtcbiAgICAvKiBhbGlnbi1zZWxmOiBmbGV4LXN0YXJ0O1xuICAgIG1hcmdpbi1sZWZ0OiAxNTBweDsgKi9cbiAgICBtYXJnaW4tYm90dG9tOiAycmVtO1xuICAgIG1hcmdpbi10b3A6IDUwcHg7XG4gIH1cbiAgLm51bSB7XG4gICAgZGlzcGxheTogaW5saW5lO1xuICAgIHBhZGRpbmctbGVmdDogMS41cmVtO1xuICAgIHBhZGRpbmctcmlnaHQ6IDEuNXJlbTtcbiAgICBib3JkZXItYm90dG9tOiAzcHggc29saWQgc3RlZWxibHVlO1xuICB9XG4gIC5wb3N0cyB7XG4gICAgZGlzcGxheTogZ3JpZDtcbiAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IHJlcGVhdCgyLCAxZnIpO1xuICAgIGJveC1zaGFkb3c6IDJweCAycHggOHB4IDBweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gICAgbWFyZ2luLWJvdHRvbTogMnJlbTtcbiAgICBwYWRkaW5nLWJvdHRvbTogMXJlbTtcbiAgICAvKiBoZWlnaHQ6IGZpdC1jb250ZW50OyAqL1xuICB9XG4gIEBtZWRpYSBvbmx5IHNjcmVlbiBhbmQgKG1heC13aWR0aDogODAwcHgpIHtcbiAgICAucG9zdHMge1xuICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiByZXBlYXQoMSwgMWZyKTtcbiAgICB9XG4gICAgLndoaWNoIHtcbiAgICAgIHdpZHRoOiA0MDBweDtcbiAgICB9XG4gIH1cblxuICAubGluayB7XG4gICAgZm9udC1zaXplOiAxcmVtO1xuICAgIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcbiAgICBjb2xvcjogc3RlZWxibHVlO1xuICB9XG4gIC5jb2wge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgZmxleDogMTtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBmbGV4LXdyYXA6IG5vd3JhcDtcbiAgICBhbGlnbi1zZWxmOiBzdHJldGNoO1xuICB9XG4gIC55ZWFyIHtcbiAgICBtYXJnaW4tdG9wOiAycmVtO1xuICB9XG4gIC5wb3N0IHtcbiAgICAvKiBib3JkZXI6IDFweCBzb2xpZCBncmV5OyAqL1xuICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgd2lkdGg6IDQwMHB4O1xuICAgIG1pbi1oZWlnaHQ6IDI2MHB4O1xuICAgIGZvbnQtc2l6ZTogMS4ycmVtO1xuICB9XG48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 */";
    	append_dev(document.head, style);
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    // (18:10) {#each byYear[year].reverse() as o}
    function create_each_block_1(ctx) {
    	let div2;
    	let a1;
    	let div0;
    	let a0;
    	let t0_value = /*o*/ ctx[3].title + "";
    	let t0;
    	let a0_href_value;
    	let t1;
    	let div1;
    	let img;
    	let img_src_value;
    	let a1_href_value;
    	let t2;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			a1 = element("a");
    			div0 = element("div");
    			a0 = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			img = element("img");
    			t2 = space();
    			attr_dev(a0, "href", a0_href_value = "/" + /*year*/ ctx[0] + "/" + /*o*/ ctx[3].num);
    			attr_dev(a0, "class", "link svelte-16jk3gz");
    			add_location(a0, file, 21, 18, 671);
    			attr_dev(div0, "class", "title svelte-16jk3gz");
    			add_location(div0, file, 20, 16, 633);
    			attr_dev(img, "alt", "");
    			set_style(img, "width", "150px");
    			if (img.src !== (img_src_value = "/" + /*year*/ ctx[0] + "/" + /*o*/ ctx[3].num + "/" + /*o*/ ctx[3].thumb)) attr_dev(img, "src", img_src_value);
    			add_location(img, file, 24, 18, 787);
    			add_location(div1, file, 23, 16, 763);
    			attr_dev(a1, "href", a1_href_value = "/" + /*year*/ ctx[0] + "/" + /*o*/ ctx[3].num);
    			attr_dev(a1, "class", "target svelte-16jk3gz");
    			add_location(a1, file, 19, 14, 575);
    			attr_dev(div2, "class", "post col svelte-16jk3gz");
    			add_location(div2, file, 18, 12, 538);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, a1);
    			append_dev(a1, div0);
    			append_dev(div0, a0);
    			append_dev(a0, t0);
    			append_dev(a1, t1);
    			append_dev(a1, div1);
    			append_dev(div1, img);
    			append_dev(div2, t2);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(18:10) {#each byYear[year].reverse() as o}",
    		ctx
    	});

    	return block;
    }

    // (12:4) {#each Object.keys(byYear).sort().reverse() as year}
    function create_each_block(ctx) {
    	let div3;
    	let div1;
    	let div0;
    	let t0_value = /*year*/ ctx[0] + "";
    	let t0;
    	let t1;
    	let div2;
    	let t2;
    	let each_value_1 = manifest[/*year*/ ctx[0]].reverse();
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div2 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			attr_dev(div0, "class", "num svelte-16jk3gz");
    			add_location(div0, file, 14, 10, 407);
    			attr_dev(div1, "class", "which svelte-16jk3gz");
    			add_location(div1, file, 13, 8, 377);
    			attr_dev(div2, "class", "posts svelte-16jk3gz");
    			add_location(div2, file, 16, 8, 460);
    			attr_dev(div3, "class", "year col svelte-16jk3gz");
    			add_location(div3, file, 12, 6, 346);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div1);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div3, t1);
    			append_dev(div3, div2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append_dev(div3, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*Object, byYear*/ 0) {
    				each_value_1 = manifest[/*year*/ ctx[0]].reverse();
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
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
    		source: "(12:4) {#each Object.keys(byYear).sort().reverse() as year}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div2;
    	let div0;
    	let t0;
    	let a;
    	let t2;
    	let div1;
    	let each_value = Object.keys(manifest).sort().reverse();
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text("graphs by ");
    			a = element("a");
    			a.textContent = "@spencermountain";
    			t2 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(a, "class", "link svelte-16jk3gz");
    			set_style(a, "font-size", "10px");
    			attr_dev(a, "href", "http://twitter.com/spencermountain/");
    			add_location(a, file, 6, 14, 131);
    			attr_dev(div0, "class", "");
    			set_style(div0, "font-size", "10px");
    			set_style(div0, "color", "grey");
    			add_location(div0, file, 5, 2, 66);
    			attr_dev(div1, "class", "container  svelte-16jk3gz");
    			add_location(div1, file, 10, 2, 258);
    			add_location(div2, file, 4, 0, 58);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, t0);
    			append_dev(div0, a);
    			append_dev(div2, t2);
    			append_dev(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*byYear, Object*/ 0) {
    				each_value = Object.keys(manifest).sort().reverse();
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
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
    	validate_slots("Post", slots, []);
    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ byYear: manifest });
    	return [];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-16jk3gz-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new Post({
      target: document.body,
      props: {},
    });

    return app;

}());
