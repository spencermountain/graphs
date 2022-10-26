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

    var data = [
      {
        "start": "2003-01-21",
        "issued": "2003-06-20",
        "completed": "2018-12-21",
        "units": 10,
        "postal": "M4C",
        "address": "2151 DANFORTH AVE"
      },
      {
        "start": "2013-09-23",
        "issued": "2015-11-10",
        "completed": "2018-11-02",
        "units": 134,
        "postal": "M6J",
        "address": "1093 QUEEN ST W"
      },
      {
        "start": "2014-01-29",
        "issued": "2015-12-30",
        "completed": "2018-11-06",
        "units": 40,
        "postal": "M9M",
        "address": "2277-2295 SHEPPARD AVE W"
      },
      {
        "start": "2014-12-24",
        "issued": "2017-05-11",
        "completed": "2018-11-01",
        "units": 16,
        "postal": "M1N",
        "address": "1340 KINGSTON RD"
      },
      {
        "start": "2015-04-20",
        "issued": "2016-12-08",
        "completed": "2018-11-28",
        "units": 81,
        "postal": "M4G",
        "address": "1900 BAYVIEW AVE"
      },
      {
        "start": "2016-01-26",
        "issued": "2017-01-17",
        "completed": "2018-12-17",
        "units": 8,
        "postal": "   ",
        "address": "24 HOWARD ST"
      },
      {
        "start": "2016-04-04",
        "issued": "2016-11-10",
        "completed": "2018-11-26",
        "units": 5,
        "postal": "M4T",
        "address": "42 GLEN ELM AVE"
      },
      {
        "start": "2017-07-31",
        "issued": "2017-12-18",
        "completed": "2018-12-06",
        "units": 2,
        "postal": "M5T",
        "address": "405 DUNDAS ST W"
      },
      {
        "start": "2003-06-26",
        "issued": "2003-10-21",
        "completed": "2019-07-30",
        "units": 3,
        "postal": "M5R",
        "address": "109 SPADINA RD"
      },
      {
        "start": "2003-08-13",
        "issued": "2005-12-09",
        "completed": "2019-09-26",
        "units": 395,
        "postal": "   ",
        "address": "185 BREMNER BLVD"
      },
      {
        "start": "2004-02-24",
        "issued": "2004-09-22",
        "completed": "2019-05-08",
        "units": 3,
        "postal": "M4X",
        "address": "483 ONTARIO ST"
      },
      {
        "start": "2007-01-22",
        "issued": "2009-04-30",
        "completed": "2019-08-07",
        "units": 328,
        "postal": "M5V",
        "address": "51 BATHURST ST"
      },
      {
        "start": "2007-05-18",
        "issued": "2007-12-19",
        "completed": "2019-10-23",
        "units": 66,
        "postal": "M4M",
        "address": "625 QUEEN ST E"
      },
      {
        "start": "2008-04-15",
        "issued": "2008-12-24",
        "completed": "2019-10-03",
        "units": 193,
        "postal": "   ",
        "address": "55 DE BOERS DR"
      },
      {
        "start": "2008-10-15",
        "issued": "2012-02-06",
        "completed": "2019-11-01",
        "units": 8,
        "postal": "M2N",
        "address": "1 ANNDALE DR"
      },
      {
        "start": "2010-02-19",
        "issued": "2010-12-17",
        "completed": "2019-02-19",
        "units": 210,
        "postal": "M1T",
        "address": "10 CHICHESTER PL"
      },
      {
        "start": "2012-12-17",
        "issued": "2013-07-05",
        "completed": "2019-05-30",
        "units": 2,
        "postal": "M6K",
        "address": "77 BEATY AVE"
      },
      {
        "start": "2012-07-31",
        "issued": "2015-03-05",
        "completed": "2019-04-03",
        "units": 409,
        "postal": "M5V",
        "address": "199 RICHMOND ST W"
      },
      {
        "start": "2012-11-29",
        "issued": "2013-02-20",
        "completed": "2019-01-08",
        "units": 2,
        "postal": "M6K",
        "address": "135 TYNDALL AVE"
      },
      {
        "start": "2013-03-08",
        "issued": "2013-10-30",
        "completed": "2019-11-06",
        "units": 16,
        "postal": "   ",
        "address": "255 CHRISTIE ST"
      },
      {
        "start": "2013-05-13",
        "issued": "2014-06-02",
        "completed": "2019-11-26",
        "units": 12,
        "postal": "   ",
        "address": "4800 EGLINTON AVE W"
      },
      {
        "start": "2013-05-15",
        "issued": "2016-05-27",
        "completed": "2019-02-06",
        "units": 520,
        "postal": "M8Z",
        "address": "15 ZORRA ST"
      },
      {
        "start": "2013-05-23",
        "issued": "2018-01-12",
        "completed": "2019-08-07",
        "units": 283,
        "postal": "M5R",
        "address": "1451 BATHURST ST"
      },
      {
        "start": "2013-05-28",
        "issued": "2014-04-30",
        "completed": "2019-01-28",
        "units": 12,
        "postal": "M1P",
        "address": "1483 BIRCHMOUNT RD"
      },
      {
        "start": "2013-08-01",
        "issued": "2015-04-15",
        "completed": "2019-07-08",
        "units": 22,
        "postal": "M1M",
        "address": "3738 ST CLAIR AVE E"
      },
      {
        "start": "2013-11-01",
        "issued": "2015-07-03",
        "completed": "2019-11-18",
        "units": 92,
        "postal": "M6P",
        "address": "2803 DUNDAS ST W"
      },
      {
        "start": "2013-11-04",
        "issued": "2014-05-02",
        "completed": "2019-12-24",
        "units": 2,
        "postal": "M6P",
        "address": "198 QUEBEC AVE"
      },
      {
        "start": "2013-11-26",
        "issued": "2014-05-09",
        "completed": "2019-09-26",
        "units": 2,
        "postal": "M4J",
        "address": "36 EATON AVE"
      },
      {
        "start": "2014-03-21",
        "issued": "2014-12-29",
        "completed": "2019-08-12",
        "units": 6,
        "postal": "M6C",
        "address": "228 VAUGHAN RD"
      },
      {
        "start": "2014-05-15",
        "issued": "2018-07-19",
        "completed": "2019-08-09",
        "units": 51,
        "postal": "M6C",
        "address": "109 VAUGHAN RD"
      },
      {
        "start": "2014-06-15",
        "issued": "2017-01-10",
        "completed": "2019-08-12",
        "units": 413,
        "postal": "M4P",
        "address": "99 ERSKINE AVE"
      },
      {
        "start": "2014-10-30",
        "issued": "2017-01-19",
        "completed": "2019-02-20",
        "units": 250,
        "postal": "M1J",
        "address": "1340 DANFORTH RD"
      },
      {
        "start": "2014-11-27",
        "issued": "2018-08-31",
        "completed": "2019-09-23",
        "units": 315,
        "postal": "   ",
        "address": "255 RANEE AVE"
      },
      {
        "start": "2014-11-28",
        "issued": "2016-12-22",
        "completed": "2019-12-19",
        "units": 337,
        "postal": "M5B",
        "address": "355 CHURCH ST"
      },
      {
        "start": "2014-12-09",
        "issued": "2017-06-29",
        "completed": "2019-04-18",
        "units": 283,
        "postal": "M9B",
        "address": "5365 DUNDAS ST W"
      },
      {
        "start": "2014-12-15",
        "issued": "2018-02-27",
        "completed": "2019-12-19",
        "units": 93,
        "postal": "M5P",
        "address": "1486 BATHURST ST"
      },
      {
        "start": "2014-12-17",
        "issued": "2017-07-21",
        "completed": "2019-05-02",
        "units": 210,
        "postal": "M3J",
        "address": "4700 KEELE ST"
      },
      {
        "start": "2014-12-19",
        "issued": "2016-07-08",
        "completed": "2019-01-16",
        "units": 259,
        "postal": "M1N",
        "address": "2229 KINGSTON RD"
      },
      {
        "start": "2015-01-20",
        "issued": "2015-03-17",
        "completed": "2019-09-10",
        "units": 4,
        "postal": "M4M",
        "address": "13-17 CUMMINGS ST"
      },
      {
        "start": "2015-04-20",
        "issued": "2017-03-29",
        "completed": "2019-08-14",
        "units": 172,
        "postal": "M5B",
        "address": "186 JARVIS ST"
      },
      {
        "start": "2015-09-09",
        "issued": "2017-09-18",
        "completed": "2019-10-03",
        "units": 218,
        "postal": "M5V",
        "address": "604 RICHMOND ST W"
      },
      {
        "start": "2015-10-15",
        "issued": "2018-01-15",
        "completed": "2019-04-05",
        "units": 276,
        "postal": "M4C",
        "address": "14 TRENT AVE"
      },
      {
        "start": "2015-11-10",
        "issued": "2017-11-17",
        "completed": "2019-11-28",
        "units": 14,
        "postal": "M4M",
        "address": "175 JONES AVE"
      },
      {
        "start": "2015-12-22",
        "issued": "2017-12-01",
        "completed": "2019-02-06",
        "units": 49,
        "postal": "M4E",
        "address": "663 KINGSTON RD"
      },
      {
        "start": "2016-01-15",
        "issued": "2017-11-17",
        "completed": "2019-11-28",
        "units": 12,
        "postal": "M4M",
        "address": "169 JONES AVE"
      },
      {
        "start": "2016-03-09",
        "issued": "2016-04-11",
        "completed": "2019-07-16",
        "units": 2,
        "postal": "M6G",
        "address": "870 MANNING AVE"
      },
      {
        "start": "2016-06-02",
        "issued": "2016-09-16",
        "completed": "2019-06-24",
        "units": 2,
        "postal": "M6E",
        "address": "1715 DUFFERIN ST"
      },
      {
        "start": "2016-06-13",
        "issued": "2017-07-04",
        "completed": "2019-10-03",
        "units": 563,
        "postal": "M5A",
        "address": "181 DUNDAS ST E"
      },
      {
        "start": "2016-06-27",
        "issued": "2018-01-08",
        "completed": "2019-08-15",
        "units": 332,
        "postal": "M5T",
        "address": "591 DUNDAS ST E"
      },
      {
        "start": "2016-09-14",
        "issued": "2017-03-06",
        "completed": "2019-12-11",
        "units": 3,
        "postal": "M3M",
        "address": "1307 WILSON AVE"
      },
      {
        "start": "2017-01-31",
        "issued": "2017-05-26",
        "completed": "2019-02-04",
        "units": 2,
        "postal": "M5S",
        "address": "69 BRUNSWICK AVE"
      },
      {
        "start": "2016-11-02",
        "issued": "2017-02-09",
        "completed": "2019-04-18",
        "units": 2,
        "postal": "M6M",
        "address": "2529 EGLINTON AVE W"
      },
      {
        "start": "2016-11-28",
        "issued": "2017-02-03",
        "completed": "2019-07-29",
        "units": 8,
        "postal": "M6C",
        "address": "55-57 HUMEWOOD DR"
      },
      {
        "start": "2016-12-06",
        "issued": "2017-03-02",
        "completed": "2019-12-22",
        "units": 2,
        "postal": "M6S",
        "address": "218 JANE ST"
      },
      {
        "start": "2016-12-22",
        "issued": "2017-08-22",
        "completed": "2019-03-28",
        "units": 12,
        "postal": "M1N",
        "address": "1548 KINGSTON RD"
      },
      {
        "start": "2016-12-28",
        "issued": "2017-03-24",
        "completed": "2019-10-04",
        "units": 2,
        "postal": "M4T",
        "address": "2 GLENROSE AVE"
      },
      {
        "start": "2017-05-05",
        "issued": "2017-10-25",
        "completed": "2019-02-04",
        "units": 2,
        "postal": "M6E",
        "address": "143 HOPE ST"
      },
      {
        "start": "2017-06-02",
        "issued": "2017-07-20",
        "completed": "2019-05-09",
        "units": 6,
        "postal": "M6H",
        "address": "105 WESTMOUNT AVE"
      },
      {
        "start": "2017-06-08",
        "issued": "2018-07-19",
        "completed": "2019-09-26",
        "units": 2,
        "postal": "M5V",
        "address": "490 QUEEN ST W"
      },
      {
        "start": "2017-07-14",
        "issued": "2018-06-12",
        "completed": "2019-01-18",
        "units": 2,
        "postal": "M6H",
        "address": "308 SALEM AVE"
      },
      {
        "start": "2017-09-21",
        "issued": "2017-11-17",
        "completed": "2019-01-14",
        "units": 3,
        "postal": "M6B",
        "address": "814 GLENCAIRN AVE"
      },
      {
        "start": "2017-11-20",
        "issued": "2018-03-05",
        "completed": "2019-11-05",
        "units": 9,
        "postal": "M4Y",
        "address": "123 ISABELLA ST"
      },
      {
        "start": "2018-04-10",
        "issued": "2018-10-18",
        "completed": "2019-09-30",
        "units": 3,
        "postal": "M4L",
        "address": "303 KINGSTON RD"
      },
      {
        "start": "2018-04-20",
        "issued": "2018-06-04",
        "completed": "2019-12-05",
        "units": 2,
        "postal": "M6P",
        "address": "1609 DUPONT ST"
      },
      {
        "start": "2018-05-04",
        "issued": "2018-07-10",
        "completed": "2019-10-02",
        "units": 2,
        "postal": "M8V",
        "address": "178 SYMONS ST"
      },
      {
        "start": "2018-05-07",
        "issued": "2018-09-28",
        "completed": "2019-12-16",
        "units": 3,
        "postal": "M1K",
        "address": "540 BIRCHMOUNT RD"
      },
      {
        "start": "2018-05-10",
        "issued": "2018-10-30",
        "completed": "2019-10-25",
        "units": 4,
        "postal": "M6K",
        "address": "180 SHERIDAN AVE"
      },
      {
        "start": "2018-05-11",
        "issued": "2018-09-12",
        "completed": "2019-06-06",
        "units": 2,
        "postal": "M6E",
        "address": "2 BRANSTONE RD"
      },
      {
        "start": "2018-05-14",
        "issued": "2018-08-31",
        "completed": "2019-04-18",
        "units": 4,
        "postal": "M3J",
        "address": "11 CATFORD RD"
      },
      {
        "start": "2018-05-30",
        "issued": "2019-06-06",
        "completed": "2019-12-03",
        "units": 5,
        "postal": "M6P",
        "address": "201 ANNETTE ST"
      },
      {
        "start": "2018-06-11",
        "issued": "2018-08-23",
        "completed": "2019-10-30",
        "units": 2,
        "postal": "M6K",
        "address": "93 DUNN AVE"
      },
      {
        "start": "2018-06-20",
        "issued": "2018-08-10",
        "completed": "2019-05-08",
        "units": 2,
        "postal": "M6H",
        "address": "2 WESTMOUNT AVE"
      },
      {
        "start": "2018-06-21",
        "issued": "2018-07-27",
        "completed": "2019-09-18",
        "units": 3,
        "postal": "M8Y",
        "address": "112 ALGOMA ST"
      },
      {
        "start": "2018-06-27",
        "issued": "2018-10-03",
        "completed": "2019-04-18",
        "units": 3,
        "postal": "M4G",
        "address": "958 EGLINTON AVE E"
      },
      {
        "start": "2018-07-05",
        "issued": "2018-12-24",
        "completed": "2019-07-17",
        "units": 2,
        "postal": "M6N",
        "address": "61 SCARLETT RD"
      },
      {
        "start": "2018-08-10",
        "issued": "2018-10-26",
        "completed": "2019-11-01",
        "units": 2,
        "postal": "M4E",
        "address": "2076 QUEEN ST E"
      },
      {
        "start": "2019-02-01",
        "issued": "2019-03-07",
        "completed": "2019-09-24",
        "units": 2,
        "postal": "M5S",
        "address": "584 SPADINA AVE"
      },
      {
        "start": "2019-05-09",
        "issued": "2019-07-10",
        "completed": "2019-12-02",
        "units": 2,
        "postal": "M4W",
        "address": "33 WHITEHALL RD"
      },
      {
        "start": "2019-06-27",
        "issued": "2019-08-02",
        "completed": "2019-12-18",
        "units": 2,
        "postal": "M6H",
        "address": "162 RUSHOLME RD"
      },
      {
        "start": "1996-05-08",
        "issued": "1996-06-05",
        "completed": "2019-05-24",
        "units": 2,
        "postal": "M6H",
        "address": "84 DELAWARE AVE"
      },
      {
        "start": "1998-04-22",
        "issued": "1998-07-21",
        "completed": "2019-08-12",
        "units": 2,
        "postal": "M4J",
        "address": "80 FELSTEAD AVE"
      },
      {
        "start": "2002-06-12",
        "issued": "2005-04-26",
        "completed": "2020-02-18",
        "units": 12,
        "postal": "M6A",
        "address": "3443 BATHURST ST"
      },
      {
        "start": "2004-03-02",
        "issued": "2005-04-20",
        "completed": "2020-04-16",
        "units": 6,
        "postal": "M4Y",
        "address": "346 JARVIS ST"
      },
      {
        "start": "2008-07-25",
        "issued": "2009-05-20",
        "completed": "2020-07-30",
        "units": 7,
        "postal": "M1N",
        "address": "1725 KINGSTON RD"
      },
      {
        "start": "2009-05-12",
        "issued": "2009-06-02",
        "completed": "2020-02-11",
        "units": 3,
        "postal": "M5B",
        "address": "79 SHUTER ST"
      },
      {
        "start": "2010-11-12",
        "issued": "2011-12-14",
        "completed": "2020-04-29",
        "units": 20,
        "postal": "M1B",
        "address": "1795 MARKHAM RD"
      },
      {
        "start": "2011-07-13",
        "issued": "2014-02-28",
        "completed": "2020-02-05",
        "units": 118,
        "postal": "   ",
        "address": "1888 BAYVIEW AVE"
      },
      {
        "start": "2011-09-22",
        "issued": "2012-01-31",
        "completed": "2020-10-19",
        "units": 2,
        "postal": "M3N",
        "address": "101 DRIFTWOOD AVE"
      },
      {
        "start": "2011-10-21",
        "issued": "2016-08-05",
        "completed": "2020-11-27",
        "units": 208,
        "postal": "M5S",
        "address": "200 BLOOR ST W"
      },
      {
        "start": "2011-12-02",
        "issued": "2014-03-19",
        "completed": "2020-11-10",
        "units": 195,
        "postal": "M5P",
        "address": "17 GLEBE RD W"
      },
      {
        "start": "2011-12-16",
        "issued": "2014-02-14",
        "completed": "2020-09-29",
        "units": 234,
        "postal": "M5P",
        "address": "54 BERWICK AVE"
      },
      {
        "start": "2012-02-08",
        "issued": "2016-04-01",
        "completed": "2020-11-04",
        "units": 188,
        "postal": "M4N",
        "address": "3018 YONGE ST"
      },
      {
        "start": "2012-11-09",
        "issued": "2014-01-24",
        "completed": "2020-10-19",
        "units": 2,
        "postal": "M4E",
        "address": "194 NEVILLE PARK BLVD"
      },
      {
        "start": "2013-04-22",
        "issued": "2016-09-01",
        "completed": "2020-02-27",
        "units": 369,
        "postal": "M4X",
        "address": "545-565 SHERBOURNE ST"
      },
      {
        "start": "2013-06-27",
        "issued": "2018-06-20",
        "completed": "2020-11-18",
        "units": 694,
        "postal": "   ",
        "address": "130 HARBOUR ST"
      },
      {
        "start": "2013-07-02",
        "issued": "2019-05-24",
        "completed": "2020-07-13",
        "units": 529,
        "postal": "M5A",
        "address": "424 ADELAIDE ST E"
      },
      {
        "start": "2013-09-27",
        "issued": "2016-10-07",
        "completed": "2020-02-08",
        "units": 387,
        "postal": "M5B",
        "address": "365 CHURCH ST"
      },
      {
        "start": "2013-10-10",
        "issued": "2015-12-11",
        "completed": "2020-07-20",
        "units": 179,
        "postal": "M4S",
        "address": "87 DAVISVILLE AVE"
      },
      {
        "start": "2013-10-10",
        "issued": "2015-12-11",
        "completed": "2020-07-20",
        "units": 342,
        "postal": "M4S",
        "address": "108 BALLIOL ST"
      },
      {
        "start": "2013-10-25",
        "issued": "2017-08-01",
        "completed": "2020-08-11",
        "units": 352,
        "postal": "   ",
        "address": "117 MCMAHON DR"
      },
      {
        "start": "2013-10-25",
        "issued": "2017-08-01",
        "completed": "2020-08-11",
        "units": 390,
        "postal": "   ",
        "address": "115 MCMAHON DR"
      },
      {
        "start": "2013-11-19",
        "issued": "2014-12-04",
        "completed": "2020-04-17",
        "units": 9,
        "postal": "M5R",
        "address": "277 DAVENPORT RD"
      },
      {
        "start": "2014-03-07",
        "issued": "2016-11-23",
        "completed": "2020-11-16",
        "units": 102,
        "postal": "M6P",
        "address": "1990 BLOOR ST W"
      },
      {
        "start": "2014-03-13",
        "issued": "2016-12-07",
        "completed": "2020-02-10",
        "units": 142,
        "postal": "M1N",
        "address": "1088 KINGSTON RD"
      },
      {
        "start": "2014-04-28",
        "issued": "2017-06-23",
        "completed": "2020-01-15",
        "units": 256,
        "postal": "   ",
        "address": "219 QUEEN ST W"
      },
      {
        "start": "2014-09-10",
        "issued": "2019-01-08",
        "completed": "2020-06-15",
        "units": 148,
        "postal": "M4Y",
        "address": "17 DUNDONALD ST"
      },
      {
        "start": "2014-12-23",
        "issued": "2016-09-29",
        "completed": "2020-10-26",
        "units": 204,
        "postal": "M1R",
        "address": "2150 LAWRENCE AVE E"
      },
      {
        "start": "2015-02-05",
        "issued": "2018-08-15",
        "completed": "2020-11-04",
        "units": 3,
        "postal": "M1K",
        "address": "552 BIRCHMOUNT RD"
      },
      {
        "start": "2015-05-12",
        "issued": "2015-09-22",
        "completed": "2020-08-14",
        "units": 2,
        "postal": "M5R",
        "address": "1072 BATHURST ST"
      },
      {
        "start": "2015-06-01",
        "issued": "2016-05-05",
        "completed": "2020-05-21",
        "units": 2,
        "postal": "M6N",
        "address": "12 DENNIS AVE"
      },
      {
        "start": "2015-08-24",
        "issued": "2020-03-24",
        "completed": "2020-06-12",
        "units": 8,
        "postal": "M6H",
        "address": "1377 DUFFERIN ST"
      },
      {
        "start": "2015-08-26",
        "issued": "2018-05-30",
        "completed": "2020-02-07",
        "units": 107,
        "postal": "   ",
        "address": "741 SHEPPARD AVE W"
      },
      {
        "start": "2015-09-01",
        "issued": "2016-06-20",
        "completed": "2020-03-03",
        "units": 2,
        "postal": "M4L",
        "address": "1912 QUEEN ST E"
      },
      {
        "start": "2016-03-03",
        "issued": "2018-04-18",
        "completed": "2020-11-09",
        "units": 369,
        "postal": "   ",
        "address": "22 JOHN ST"
      },
      {
        "start": "2016-04-15",
        "issued": "2016-08-23",
        "completed": "2020-03-13",
        "units": 2,
        "postal": "M6H",
        "address": "999 A DOVERCOURT RD"
      },
      {
        "start": "2016-05-03",
        "issued": "2018-05-10",
        "completed": "2020-08-11",
        "units": 60,
        "postal": "M6R",
        "address": "35 WABASH AVE"
      },
      {
        "start": "2016-05-19",
        "issued": "2018-04-13",
        "completed": "2020-12-09",
        "units": 207,
        "postal": "M2K",
        "address": "591 SHEPPARD AVE E"
      },
      {
        "start": "2018-09-18",
        "issued": "2018-11-15",
        "completed": "2020-12-02",
        "units": 17,
        "postal": "M5V",
        "address": "620 KING ST W"
      },
      {
        "start": "2016-05-26",
        "issued": "2018-03-02",
        "completed": "2020-05-29",
        "units": 26,
        "postal": "M9N",
        "address": "31-35 KING ST"
      },
      {
        "start": "2016-06-28",
        "issued": "2018-07-03",
        "completed": "2020-11-13",
        "units": 8,
        "postal": "M9N",
        "address": "1855 JANE ST"
      },
      {
        "start": "2016-10-17",
        "issued": "2017-01-31",
        "completed": "2020-04-02",
        "units": 2,
        "postal": "M8V",
        "address": "2504 LAKE SHORE BLVD W"
      },
      {
        "start": "2016-10-27",
        "issued": "2017-09-29",
        "completed": "2020-01-15",
        "units": 3,
        "postal": "M9B",
        "address": "350 THE EAST MALL"
      },
      {
        "start": "2016-11-24",
        "issued": "2017-02-01",
        "completed": "2020-10-20",
        "units": 2,
        "postal": "M6H",
        "address": "100 MILLICENT ST"
      },
      {
        "start": "2016-12-21",
        "issued": "2019-06-18",
        "completed": "2020-10-30",
        "units": 154,
        "postal": "M2K",
        "address": "3237 BAYVIEW AVE"
      },
      {
        "start": "2016-12-22",
        "issued": "2017-06-05",
        "completed": "2020-11-30",
        "units": 31,
        "postal": "M5A",
        "address": "257 DUNDAS ST E"
      },
      {
        "start": "2016-12-23",
        "issued": "2019-11-01",
        "completed": "2020-10-16",
        "units": 325,
        "postal": "M3C",
        "address": "1185 EGLINTON AVE E"
      },
      {
        "start": "2016-12-28",
        "issued": "2018-11-20",
        "completed": "2020-07-30",
        "units": 9,
        "postal": "M6P",
        "address": "3260 DUNDAS ST W"
      },
      {
        "start": "2017-01-27",
        "issued": "2018-12-18",
        "completed": "2020-03-17",
        "units": 22,
        "postal": "M4L",
        "address": "96 COXWELL AVE"
      },
      {
        "start": "2017-03-02",
        "issued": "2018-11-13",
        "completed": "2020-02-06",
        "units": 572,
        "postal": "M4Y",
        "address": "411 CHURCH ST"
      },
      {
        "start": "2017-03-09",
        "issued": "2019-07-08",
        "completed": "2020-09-29",
        "units": 315,
        "postal": "M4P",
        "address": "18 ERSKINE AVE"
      },
      {
        "start": "2017-05-30",
        "issued": "2018-11-26",
        "completed": "2020-06-24",
        "units": 2,
        "postal": "M5P",
        "address": "963 AVENUE RD"
      },
      {
        "start": "2017-05-31",
        "issued": "2017-10-30",
        "completed": "2020-10-13",
        "units": 2,
        "postal": "M5T",
        "address": "398 COLLEGE ST"
      },
      {
        "start": "2017-08-02",
        "issued": "2017-08-22",
        "completed": "2020-05-20",
        "units": 3,
        "postal": "M6G",
        "address": "230 CHRISTIE ST"
      },
      {
        "start": "2017-10-19",
        "issued": "2018-05-25",
        "completed": "2020-12-08",
        "units": 3,
        "postal": "M6E",
        "address": "353 OAKWOOD AVE"
      },
      {
        "start": "2017-12-14",
        "issued": "2018-07-25",
        "completed": "2020-07-13",
        "units": 2,
        "postal": "M8V",
        "address": "19 LOUISA ST"
      },
      {
        "start": "2018-02-22",
        "issued": "2018-08-22",
        "completed": "2020-06-10",
        "units": 2,
        "postal": "M6H",
        "address": "22 WALLACE AVE"
      },
      {
        "start": "2018-03-23",
        "issued": "2018-10-29",
        "completed": "2020-01-20",
        "units": 3,
        "postal": "M6S",
        "address": "230 SOUTH KINGSWAY"
      },
      {
        "start": "2018-04-05",
        "issued": "2018-06-22",
        "completed": "2020-08-31",
        "units": 17,
        "postal": "M6M",
        "address": "6 BICKNELL AVE"
      },
      {
        "start": "2018-04-05",
        "issued": "2018-06-22",
        "completed": "2020-08-31",
        "units": 28,
        "postal": "   ",
        "address": "630 ROGERS RD"
      },
      {
        "start": "2018-04-06",
        "issued": "2018-06-22",
        "completed": "2020-08-31",
        "units": 9,
        "postal": "   ",
        "address": "7 FORBES AVE"
      },
      {
        "start": "2018-04-06",
        "issued": "2018-06-22",
        "completed": "2020-08-31",
        "units": 8,
        "postal": "   ",
        "address": "17 FORBES AVE"
      },
      {
        "start": "2018-04-10",
        "issued": "2018-08-28",
        "completed": "2020-02-28",
        "units": 4,
        "postal": "M6E",
        "address": "1106 ST CLAIR AVE W"
      },
      {
        "start": "2020-02-03",
        "issued": "2020-05-20",
        "completed": "2020-06-25",
        "units": 2,
        "postal": "M5V",
        "address": "532 RICHMOND ST W"
      },
      {
        "start": "2018-05-15",
        "issued": "2018-07-24",
        "completed": "2020-01-20",
        "units": 2,
        "postal": "M6E",
        "address": "1685 EGLINTON AVE W"
      },
      {
        "start": "2018-05-16",
        "issued": "2018-07-20",
        "completed": "2020-06-17",
        "units": 26,
        "postal": "M9N",
        "address": "35 KING ST"
      },
      {
        "start": "2018-06-04",
        "issued": "2019-05-09",
        "completed": "2020-07-29",
        "units": 2,
        "postal": "M6N",
        "address": "453 KEELE ST"
      },
      {
        "start": "2018-07-17",
        "issued": "2018-10-17",
        "completed": "2020-11-16",
        "units": 8,
        "postal": "M8V",
        "address": "2982-2984 LAKE SHORE BLVD W"
      },
      {
        "start": "2018-07-26",
        "issued": "2018-08-15",
        "completed": "2020-08-28",
        "units": 2,
        "postal": "M4N",
        "address": "89 BOWOOD AVE"
      },
      {
        "start": "2018-08-24",
        "issued": "2019-02-28",
        "completed": "2020-11-26",
        "units": 11,
        "postal": "M4K",
        "address": "377 A BROADVIEW AVE"
      },
      {
        "start": "2018-09-28",
        "issued": "2019-03-25",
        "completed": "2020-12-02",
        "units": 3,
        "postal": "M5S",
        "address": "370 HURON ST"
      },
      {
        "start": "2018-10-15",
        "issued": "2018-11-28",
        "completed": "2020-07-16",
        "units": 2,
        "postal": "M6N",
        "address": "53 ROCKCLIFFE BLVD"
      },
      {
        "start": "2018-10-16",
        "issued": "2019-02-15",
        "completed": "2020-11-19",
        "units": 2,
        "postal": "M6H",
        "address": "86 PETERBOROUGH AVE"
      },
      {
        "start": "2018-11-07",
        "issued": "2019-03-14",
        "completed": "2020-06-25",
        "units": 4,
        "postal": "M2J",
        "address": "12 LEITH HILL RD"
      },
      {
        "start": "2018-11-12",
        "issued": "2019-01-07",
        "completed": "2020-09-29",
        "units": 4,
        "postal": "M5R",
        "address": "526 HURON ST"
      },
      {
        "start": "2018-11-26",
        "issued": "2019-03-01",
        "completed": "2020-11-19",
        "units": 2,
        "postal": "M4M",
        "address": "183 MUNRO ST"
      },
      {
        "start": "2019-01-14",
        "issued": "2019-04-01",
        "completed": "2020-04-27",
        "units": 2,
        "postal": "M4K",
        "address": "1258 BROADVIEW AVE"
      },
      {
        "start": "2019-01-25",
        "issued": "2019-05-29",
        "completed": "2020-07-12",
        "units": 12,
        "postal": "M3A",
        "address": "77 PARKWOODS VILLAGE DR"
      },
      {
        "start": "2019-03-04",
        "issued": "2019-05-07",
        "completed": "2020-04-06",
        "units": 2,
        "postal": "M4J",
        "address": "79 EATON AVE"
      },
      {
        "start": "2019-03-14",
        "issued": "2019-06-20",
        "completed": "2020-02-21",
        "units": 4,
        "postal": "M9V",
        "address": "10 GARFELLA DR"
      },
      {
        "start": "2019-03-25",
        "issued": "2019-05-31",
        "completed": "2020-11-03",
        "units": 2,
        "postal": "M6G",
        "address": "452 MONTROSE AVE"
      },
      {
        "start": "2019-03-28",
        "issued": "2019-08-19",
        "completed": "2020-07-23",
        "units": 2,
        "postal": "M5T",
        "address": "205 BATHURST ST"
      },
      {
        "start": "2019-05-02",
        "issued": "2019-10-30",
        "completed": "2020-07-30",
        "units": 2,
        "postal": "M6M",
        "address": "20 AVON DR"
      },
      {
        "start": "2019-05-03",
        "issued": "2019-10-09",
        "completed": "2020-01-23",
        "units": 3,
        "postal": "M4G",
        "address": "175 BRENTCLIFFE RD"
      },
      {
        "start": "2019-05-23",
        "issued": "2020-01-30",
        "completed": "2020-12-03",
        "units": 13,
        "postal": "M3K",
        "address": "940 WILSON AVE"
      },
      {
        "start": "2019-06-24",
        "issued": "2019-12-20",
        "completed": "2020-07-31",
        "units": 5,
        "postal": "M6B",
        "address": "9 FRASERWOOD AVE"
      },
      {
        "start": "2019-07-22",
        "issued": "2019-08-16",
        "completed": "2020-08-24",
        "units": 2,
        "postal": "M8V",
        "address": "88 BURLINGTON ST"
      },
      {
        "start": "2019-09-12",
        "issued": "2019-10-28",
        "completed": "2020-12-15",
        "units": 2,
        "postal": "M6E",
        "address": "15 ENNERDALE RD"
      },
      {
        "start": "1995-10-30",
        "issued": "1995-11-10",
        "completed": "2020-01-16",
        "units": 3,
        "postal": "M4K",
        "address": "391 PAPE AVE"
      },
      {
        "start": "12-18-1997",
        "issued": "05-22-1998",
        "completed": "04-15-2021",
        "units": 5,
        "postal": "M6R",
        "address": "461 A RONCESVALLES AVE"
      },
      {
        "start": "12-10-1998",
        "issued": "03-15-1999",
        "completed": "03-15-2021",
        "units": 178,
        "postal": "M5B",
        "address": "225 JARVIS ST"
      },
      {
        "start": "05-22-2003",
        "issued": "07-08-2003",
        "completed": "03-25-2021",
        "units": 5,
        "postal": "M3M",
        "address": "156 TROUTBROOKE DR"
      },
      {
        "start": "07-15-2014",
        "issued": "10-05-2016",
        "completed": "01-12-2021",
        "units": 9,
        "postal": "M6E",
        "address": "998 ST CLAIR AVE W"
      },
      {
        "start": "05-16-2018",
        "issued": "03-11-2020",
        "completed": "09-21-2021",
        "units": 3,
        "postal": "M9P",
        "address": "2245 LAWRENCE AVE W"
      },
      {
        "start": "05-02-2018",
        "issued": "09-18-2018",
        "completed": "04-09-2021",
        "units": 2,
        "postal": "M2J",
        "address": "12 DEERFORD RD"
      },
      {
        "start": "10-05-2018",
        "issued": "01-27-2020",
        "completed": "02-12-2021",
        "units": 2,
        "postal": "M5R",
        "address": "142 AVENUE RD"
      },
      {
        "start": "02-02-2018",
        "issued": "07-26-2018",
        "completed": "03-24-2021",
        "units": 120,
        "postal": "M5B",
        "address": "385 CHURCH ST"
      },
      {
        "start": "08-09-2017",
        "issued": "10-18-2017",
        "completed": "02-11-2021",
        "units": 3,
        "postal": "M5T",
        "address": "214 BATHURST ST"
      },
      {
        "start": "11-28-2017",
        "issued": "08-05-2020",
        "completed": "05-31-2021",
        "units": 3,
        "postal": "M5R",
        "address": "328 BRUNSWICK AVE"
      },
      {
        "start": "12-29-2017",
        "issued": "02-21-2019",
        "completed": "03-10-2021",
        "units": 9,
        "postal": "M1C",
        "address": "750 MORNINGSIDE AVE"
      },
      {
        "start": "08-28-2020",
        "issued": "09-02-2021",
        "completed": "10-18-2021",
        "units": 4,
        "postal": "M8V",
        "address": "3263 LAKE SHORE BLVD W"
      },
      {
        "start": "10-05-2016",
        "issued": "09-27-2018",
        "completed": "10-14-2021",
        "units": 9,
        "postal": "M1H",
        "address": "555 BRIMORTON DR"
      },
      {
        "start": "10-27-2016",
        "issued": "09-29-2017",
        "completed": "02-10-2021",
        "units": 3,
        "postal": "M9B",
        "address": "340 THE EAST MALL"
      },
      {
        "start": "04-17-2020",
        "issued": "07-03-2020",
        "completed": "11-26-2021",
        "units": 2,
        "postal": "M4K",
        "address": "456 DANFORTH AVE"
      },
      {
        "start": "04-15-2020",
        "issued": "10-09-2020",
        "completed": "10-25-2021",
        "units": 2,
        "postal": "M1M",
        "address": "40 PARKCREST DR"
      },
      {
        "start": "04-16-2020",
        "issued": "07-16-2020",
        "completed": "07-09-2021",
        "units": 2,
        "postal": "M6R",
        "address": "415 RONCESVALLES AVE"
      },
      {
        "start": "09-24-2019",
        "issued": "01-07-2020",
        "completed": "06-17-2021",
        "units": 2,
        "postal": "M6J",
        "address": "1472 DUNDAS ST W"
      },
      {
        "start": "08-01-2019",
        "issued": "08-21-2020",
        "completed": "08-10-2021",
        "units": 4,
        "postal": "M6C",
        "address": "781 ST CLAIR AVE W"
      },
      {
        "start": "09-19-2019",
        "issued": "06-19-2020",
        "completed": "10-19-2021",
        "units": 3,
        "postal": "M6S",
        "address": "85 WINDERMERE AVE"
      },
      {
        "start": "09-30-2019",
        "issued": null,
        "completed": "04-21-2021",
        "units": 5,
        "postal": "M6J",
        "address": "46 A OSSINGTON AVE"
      },
      {
        "start": "05-28-2019",
        "issued": "09-16-2020",
        "completed": "03-26-2021",
        "units": 2,
        "postal": "M4B",
        "address": "2908 ST CLAIR AVE E"
      },
      {
        "start": "04-30-2019",
        "issued": "06-08-2020",
        "completed": "10-29-2021",
        "units": 4,
        "postal": "M2J",
        "address": "3000 VICTORIA PARK AVE"
      },
      {
        "start": "06-28-2019",
        "issued": "06-24-2020",
        "completed": "10-05-2021",
        "units": 2,
        "postal": "M4M",
        "address": "710 GERRARD ST E"
      },
      {
        "start": "05-23-2019",
        "issued": "05-11-2020",
        "completed": "03-19-2021",
        "units": 4,
        "postal": "M6C",
        "address": "940 ST CLAIR AVE W"
      },
      {
        "start": "04-08-2019",
        "issued": "03-10-2020",
        "completed": "10-28-2021",
        "units": 2,
        "postal": "M4C",
        "address": "75 EASTDALE AVE"
      },
      {
        "start": "05-28-2014",
        "issued": "09-19-2014",
        "completed": "08-09-2021",
        "units": 8,
        "postal": "M3N",
        "address": "35 TOBERMORY DR"
      },
      {
        "start": "01-24-2012",
        "issued": "09-01-2021",
        "completed": "10-20-2021",
        "units": 400,
        "postal": "M4V",
        "address": "111 ST CLAIR AVE W"
      },
      {
        "start": "06-25-2014",
        "issued": "10-30-2020",
        "completed": "12-06-2021",
        "units": 3,
        "postal": "M1E",
        "address": "4457-4459 LAWRENCE AVE E"
      },
      {
        "start": "08-07-2018",
        "issued": "10-17-2018",
        "completed": "09-10-2021",
        "units": 2,
        "postal": "M5R",
        "address": "47 MADISON AVE"
      },
      {
        "start": "06-12-2018",
        "issued": "12-12-2019",
        "completed": "02-05-2021",
        "units": 2,
        "postal": "M6H",
        "address": "398 WESTMORELAND AVE N"
      },
      {
        "start": "04-28-2021",
        "issued": "05-18-2021",
        "completed": "05-20-2021",
        "units": 2,
        "postal": "M6G",
        "address": "435 GRACE ST"
      },
      {
        "start": "07-16-2020",
        "issued": "10-06-2020",
        "completed": "12-17-2021",
        "units": 2,
        "postal": "M4C",
        "address": "2 KEYSTONE AVE"
      },
      {
        "start": "09-01-2020",
        "issued": "09-24-2020",
        "completed": "02-14-2021",
        "units": 2,
        "postal": "M3M",
        "address": "30 RENSHAW ST"
      },
      {
        "start": "01-07-1998",
        "issued": "09-21-1998",
        "completed": "09-28-2021",
        "units": 2,
        "postal": "M6N",
        "address": "268 WESTON RD"
      },
      {
        "start": "06-11-2020",
        "issued": "11-18-2020",
        "completed": "10-14-2021",
        "units": 2,
        "postal": "M5T",
        "address": "7 D'ARCY ST"
      },
      {
        "start": "09-17-2019",
        "issued": "02-11-2020",
        "completed": "01-26-2021",
        "units": 2,
        "postal": "M6E",
        "address": "556 WESTMOUNT AVE"
      },
      {
        "start": "09-27-2019",
        "issued": "11-18-2019",
        "completed": "03-08-2021",
        "units": 2,
        "postal": "M6K",
        "address": "674 DUFFERIN ST"
      },
      {
        "start": "07-19-2019",
        "issued": "08-27-2020",
        "completed": "03-15-2021",
        "units": 2,
        "postal": "M6S",
        "address": "69 COLBECK ST"
      },
      {
        "start": "02-21-2020",
        "issued": "07-08-2020",
        "completed": "08-31-2021",
        "units": 2,
        "postal": "M4M",
        "address": "389 R LESLIE ST"
      },
      {
        "start": "03-30-2007",
        "issued": "09-26-2011",
        "completed": "02-02-2021",
        "units": 3,
        "postal": "M6P",
        "address": "212 MAVETY ST"
      },
      {
        "start": "01-20-1998",
        "issued": "01-29-1998",
        "completed": "08-10-2021",
        "units": 4,
        "postal": "M6K",
        "address": "32 LEOPOLD ST"
      },
      {
        "start": "01-17-2003",
        "issued": "03-21-2003",
        "completed": "02-03-2021",
        "units": 4,
        "postal": "M5A",
        "address": "276 GEORGE ST"
      },
      {
        "start": "07-04-2019",
        "issued": "12-05-2019",
        "completed": "07-22-2021",
        "units": 2,
        "postal": "M6P",
        "address": "207 PERTH AVE"
      },
      {
        "start": "04-12-2019",
        "issued": "07-19-2019",
        "completed": "09-15-2021",
        "units": 5,
        "postal": "M5B",
        "address": "213 JARVIS ST"
      },
      {
        "start": "06-24-2019",
        "issued": "12-30-2019",
        "completed": "06-11-2021",
        "units": 4,
        "postal": "M5R",
        "address": "410 BRUNSWICK AVE"
      },
      {
        "start": "11-29-2018",
        "issued": "05-27-2019",
        "completed": "10-25-2021",
        "units": 2,
        "postal": "M4K",
        "address": "131 GOUGH AVE"
      },
      {
        "start": "04-04-2012",
        "issued": "05-29-2012",
        "completed": "02-11-2021",
        "units": 2,
        "postal": "M5R",
        "address": "11 1-2 WELLS ST"
      },
      {
        "start": "03-26-2015",
        "issued": "05-14-2015",
        "completed": "01-28-2021",
        "units": 2,
        "postal": "M8Z",
        "address": "45 CARDIGAN RD"
      },
      {
        "start": "04-23-2018",
        "issued": "11-07-2018",
        "completed": "01-05-2021",
        "units": 2,
        "postal": "M8W",
        "address": "24 THIRTY THIRD ST"
      },
      {
        "start": "04-06-2018",
        "issued": "07-30-2018",
        "completed": "09-02-2021",
        "units": 2,
        "postal": "M6E",
        "address": "17 MONTCALM AVE"
      },
      {
        "start": "08-12-2020",
        "issued": "09-11-2020",
        "completed": "09-08-2021",
        "units": 2,
        "postal": "M5N",
        "address": "6 WINGATE PL"
      },
      {
        "start": "09-25-2020",
        "issued": "11-19-2020",
        "completed": "09-16-2021",
        "units": 2,
        "postal": "M6E",
        "address": "216 GLENHOLME AVE"
      },
      {
        "start": "08-22-2019",
        "issued": "10-10-2019",
        "completed": "06-01-2021",
        "units": 2,
        "postal": "M6E",
        "address": "346 CALEDONIA RD"
      },
      {
        "start": "02-25-2020",
        "issued": "04-09-2020",
        "completed": "08-17-2021",
        "units": 2,
        "postal": "M4J",
        "address": "323 MORTIMER AVE"
      },
      {
        "start": "01-30-2019",
        "issued": "06-04-2019",
        "completed": "02-22-2021",
        "units": 3,
        "postal": "M8V",
        "address": "89 CAVELL AVE"
      },
      {
        "start": "07-05-2018",
        "issued": "10-25-2019",
        "completed": "05-14-2021",
        "units": 57,
        "postal": "M2J",
        "address": "1 ADRA VILLAWAY"
      },
      {
        "start": "09-04-2018",
        "issued": "03-12-2020",
        "completed": "07-13-2021",
        "units": 32,
        "postal": "M4J",
        "address": "14 DEWHURST BLVD"
      },
      {
        "start": "07-19-2018",
        "issued": "04-26-2019",
        "completed": "11-30-2021",
        "units": 14,
        "postal": "M8W",
        "address": "68 DAISY AVE"
      },
      {
        "start": "07-17-2018",
        "issued": "06-24-2020",
        "completed": "09-24-2021",
        "units": 4,
        "postal": "M4L",
        "address": "1602 QUEEN ST E"
      },
      {
        "start": "07-17-2018",
        "issued": "06-23-2020",
        "completed": "09-24-2021",
        "units": 4,
        "postal": "M4L",
        "address": "1604 QUEEN ST E"
      },
      {
        "start": "05-15-2018",
        "issued": "05-11-2020",
        "completed": "11-24-2021",
        "units": 180,
        "postal": "   ",
        "address": "10 DE BOERS DR"
      },
      {
        "start": "05-01-2015",
        "issued": "10-02-2018",
        "completed": "05-28-2021",
        "units": 200,
        "postal": "M5R",
        "address": "94 CUMBERLAND ST"
      },
      {
        "start": "02-18-2016",
        "issued": "09-09-2019",
        "completed": "07-06-2021",
        "units": 124,
        "postal": "M4T",
        "address": "1331 YONGE ST"
      },
      {
        "start": "09-08-2017",
        "issued": "12-04-2018",
        "completed": "07-25-2021",
        "units": 4,
        "postal": "M1W",
        "address": "2100-2122 BRIDLETOWNE CRCL"
      },
      {
        "start": "10-18-2017",
        "issued": "08-10-2018",
        "completed": "06-25-2021",
        "units": 73,
        "postal": "   ",
        "address": "5131 SHEPPARD AVE E"
      },
      {
        "start": "03-17-2016",
        "issued": "06-16-2017",
        "completed": "11-01-2021",
        "units": 20,
        "postal": "M1E",
        "address": "280 MANSE RD"
      },
      {
        "start": "04-13-2016",
        "issued": "07-16-2019",
        "completed": "03-15-2021",
        "units": 7,
        "postal": "M6B",
        "address": "293 VIEWMOUNT AVE"
      },
      {
        "start": "03-26-2013",
        "issued": "07-22-2013",
        "completed": "07-06-2021",
        "units": 2,
        "postal": "M1S",
        "address": "10 MARILYN AVE"
      },
      {
        "start": "11-21-2014",
        "issued": "10-05-2018",
        "completed": "11-11-2021",
        "units": 372,
        "postal": "M6A",
        "address": "3095 DUFFERIN ST"
      },
      {
        "start": "11-04-2014",
        "issued": "03-18-2016",
        "completed": "02-18-2021",
        "units": 157,
        "postal": "M8V",
        "address": "2151-2153 LAKE SHORE BLVD W"
      },
      {
        "start": "12-11-2014",
        "issued": "05-11-2020",
        "completed": "08-17-2021",
        "units": 146,
        "postal": "M1G",
        "address": "02-Jan MEADOWGLEN PL"
      },
      {
        "start": "12-16-2014",
        "issued": "02-04-2019",
        "completed": "06-15-2021",
        "units": 221,
        "postal": "M6E",
        "address": "1603 EGLINTON AVE W"
      },
      {
        "start": "10-02-2013",
        "issued": "03-28-2017",
        "completed": "03-22-2021",
        "units": 552,
        "postal": "   ",
        "address": "87 PETER ST"
      },
      {
        "start": "10-17-2016",
        "issued": "01-25-2019",
        "completed": "03-29-2021",
        "units": 219,
        "postal": "M4S",
        "address": "1985 YONGE ST"
      },
      {
        "start": "11-18-2016",
        "issued": "12-04-2018",
        "completed": "03-11-2021",
        "units": 122,
        "postal": "M4M",
        "address": "875 QUEEN ST E"
      },
      {
        "start": "11-09-2016",
        "issued": "10-17-2019",
        "completed": "03-16-2021",
        "units": 564,
        "postal": "M4S",
        "address": "45 DUNFIELD AVE"
      },
      {
        "start": "08-24-2016",
        "issued": "08-25-2020",
        "completed": "06-10-2021",
        "units": 537,
        "postal": "   ",
        "address": "403 CHURCH ST"
      },
      {
        "start": "12-19-2016",
        "issued": "12-12-2018",
        "completed": "04-20-2021",
        "units": 236,
        "postal": "M2J",
        "address": "2205 SHEPPARD AVE E"
      },
      {
        "start": "05-10-2017",
        "issued": "01-12-2021",
        "completed": "09-10-2021",
        "units": 385,
        "postal": "M5B",
        "address": "77 MUTUAL ST"
      },
      {
        "start": "06-15-2020",
        "issued": "12-08-2020",
        "completed": "10-05-2021",
        "units": 56,
        "postal": "M1L",
        "address": "11 MACEY AVE"
      },
      {
        "start": "04-22-2005",
        "issued": "09-21-2006",
        "completed": "05-05-2021",
        "units": 264,
        "postal": "   ",
        "address": "333 SIDNEY BELSEY CRES"
      },
      {
        "start": "08-07-2019",
        "issued": "01-24-2020",
        "completed": "04-09-2021",
        "units": 21,
        "postal": "M1P",
        "address": "1255 BIRCHMOUNT RD"
      },
      {
        "start": "12-21-2004",
        "issued": "01-31-2019",
        "completed": "03-19-2021",
        "units": 377,
        "postal": "M4Y",
        "address": "46 WELLESLEY ST E"
      },
      {
        "start": "04-16-2019",
        "issued": "05-11-2020",
        "completed": "11-18-2021",
        "units": 8,
        "postal": "M8W",
        "address": "68 LONG BRANCH AVE"
      },
      {
        "start": "01-31-2019",
        "issued": "06-23-2020",
        "completed": "09-24-2021",
        "units": 10,
        "postal": "M4L",
        "address": "1598 QUEEN ST E"
      },
      {
        "start": "02-25-2010",
        "issued": "04-23-2014",
        "completed": "04-19-2021",
        "units": 165,
        "postal": "M4V",
        "address": "700 HURON ST"
      },
      {
        "start": "05-17-2017",
        "issued": "04-16-2019",
        "completed": "02-16-2021",
        "units": 22,
        "postal": "M8W",
        "address": "3600 LAKE SHORE BLVD W"
      },
      {
        "start": "05-05-2017",
        "issued": "02-19-2020",
        "completed": "03-21-2021",
        "units": 96,
        "postal": "   ",
        "address": "1 NEIGHBOURHOOD LANE"
      },
      {
        "start": "04-27-2017",
        "issued": "08-28-2019",
        "completed": "10-13-2021",
        "units": 160,
        "postal": "M4S",
        "address": "11 LILLIAN ST"
      },
      {
        "start": "08-22-2016",
        "issued": "08-19-2019",
        "completed": "10-19-2021",
        "units": 150,
        "postal": "M5T",
        "address": "233 COLLEGE ST"
      },
      {
        "start": "2001-03-08",
        "issued": "2001-05-16",
        "completed": "2022-05-13",
        "units": 2,
        "postal": "M6H",
        "address": "115 WALLACE AVE"
      },
      {
        "start": "2002-06-04",
        "issued": "2002-06-04",
        "completed": "2022-04-07",
        "units": 0,
        "postal": "M6G",
        "address": "22 MANCHESTER AVE"
      },
      {
        "start": "2007-06-28",
        "issued": "2012-09-05",
        "completed": "2022-02-02",
        "units": 2,
        "postal": "M5P",
        "address": "1695 BATHURST ST"
      },
      {
        "start": "2011-09-07",
        "issued": "2012-10-18",
        "completed": "2022-08-03",
        "units": 105,
        "postal": "M4J",
        "address": "280 DONLANDS AVE"
      },
      {
        "start": "2011-09-07",
        "issued": "2018-05-02",
        "completed": "2022-07-20",
        "units": 6,
        "postal": "M3N",
        "address": "265 EDDYSTONE AVE"
      },
      {
        "start": "2011-12-29",
        "issued": "2012-08-22",
        "completed": "2022-02-18",
        "units": 2,
        "postal": "M4J",
        "address": "2 CHATHAM AVE"
      },
      {
        "start": "2013-01-28",
        "issued": "2016-08-18",
        "completed": "2022-02-08",
        "units": 588,
        "postal": "   ",
        "address": "830 LAWRENCE AVE W"
      },
      {
        "start": "2013-03-18",
        "issued": "2016-09-21",
        "completed": "2022-04-08",
        "units": 284,
        "postal": "   ",
        "address": "1 THE ESPLANADE"
      },
      {
        "start": "2016-12-16",
        "issued": "2017-08-16",
        "completed": "2022-06-28",
        "units": 32,
        "postal": "M5G",
        "address": "480 UNIVERSITY AVE"
      },
      {
        "start": "2013-11-04",
        "issued": "2014-07-04",
        "completed": "2022-06-20",
        "units": 3,
        "postal": "M4J",
        "address": "721 DANFORTH AVE"
      },
      {
        "start": "2013-11-04",
        "issued": "2014-07-04",
        "completed": "2022-06-20",
        "units": 3,
        "postal": "M4J",
        "address": "725 DANFORTH AVE"
      },
      {
        "start": "2014-07-29",
        "issued": "2017-06-30",
        "completed": "2022-06-14",
        "units": 747,
        "postal": "M5T",
        "address": "255 COLLEGE ST"
      },
      {
        "start": "2014-10-10",
        "issued": "2018-05-04",
        "completed": "2022-02-18",
        "units": 911,
        "postal": "M5V",
        "address": "355 KING ST W"
      },
      {
        "start": "2014-11-07",
        "issued": "2018-10-16",
        "completed": "2022-05-04",
        "units": 1004,
        "postal": "M5B",
        "address": "241 JARVIS ST"
      },
      {
        "start": "2014-12-01",
        "issued": "2018-05-09",
        "completed": "2022-03-22",
        "units": 80,
        "postal": "M1N",
        "address": "1346 KINGSTON RD"
      },
      {
        "start": "2020-06-26",
        "issued": "2020-12-23",
        "completed": "2022-08-23",
        "units": 5,
        "postal": "M5C",
        "address": "25 RICHMOND ST E"
      },
      {
        "start": "2020-06-26",
        "issued": "2020-12-23",
        "completed": "2022-08-23",
        "units": 6,
        "postal": "M5C",
        "address": "20 LOMBARD ST"
      },
      {
        "start": "2015-06-18",
        "issued": "2017-12-07",
        "completed": "2022-03-21",
        "units": 228,
        "postal": "   ",
        "address": "1 EDGEWATER DR"
      },
      {
        "start": "2016-03-14",
        "issued": "2020-05-12",
        "completed": "2022-01-11",
        "units": 913,
        "postal": "M5A",
        "address": "143 LAKE SHORE BLVD E"
      },
      {
        "start": "2016-04-26",
        "issued": "2018-01-04",
        "completed": "2022-07-19",
        "units": 17,
        "postal": "M4J",
        "address": "120 DONLANDS AVE"
      },
      {
        "start": "2016-12-16",
        "issued": "2020-03-13",
        "completed": "2022-02-08",
        "units": 91,
        "postal": "M4L",
        "address": "1327 QUEEN ST E"
      },
      {
        "start": "2016-12-20",
        "issued": "2019-03-19",
        "completed": "2022-05-09",
        "units": 355,
        "postal": "M2N",
        "address": "4841-4881 YONGE ST"
      },
      {
        "start": "2016-12-22",
        "issued": "2020-06-05",
        "completed": "2022-05-24",
        "units": 409,
        "postal": "   ",
        "address": "30 MUTUAL ST"
      },
      {
        "start": "2016-12-23",
        "issued": "2019-03-29",
        "completed": "2022-07-20",
        "units": 333,
        "postal": "M9B",
        "address": "5245 DUNDAS ST W"
      },
      {
        "start": "2016-12-28",
        "issued": "2019-09-17",
        "completed": "2022-07-28",
        "units": 42,
        "postal": "M1N",
        "address": "1400 KINGSTON RD"
      },
      {
        "start": "2016-12-30",
        "issued": "2020-05-11",
        "completed": "2022-01-17",
        "units": 247,
        "postal": "M3H",
        "address": "9 TIPPETT RD"
      },
      {
        "start": "2017-04-12",
        "issued": "2019-07-23",
        "completed": "2022-02-23",
        "units": 82,
        "postal": "M4V",
        "address": "200 MADISON AVE"
      },
      {
        "start": "2017-06-29",
        "issued": "2017-12-22",
        "completed": "2022-04-22",
        "units": 4,
        "postal": "M2R",
        "address": "4981 BATHURST ST"
      },
      {
        "start": "2017-07-06",
        "issued": "2018-12-10",
        "completed": "2022-02-22",
        "units": 115,
        "postal": "M8X",
        "address": "571 PRINCE EDWARD DR N"
      },
      {
        "start": "2017-07-13",
        "issued": "2017-12-22",
        "completed": "2022-08-24",
        "units": 7,
        "postal": "M2R",
        "address": "4979 BATHURST ST"
      },
      {
        "start": "2017-09-25",
        "issued": "2018-10-31",
        "completed": "2022-03-02",
        "units": 143,
        "postal": "M1E",
        "address": "4434 KINGSTON RD"
      },
      {
        "start": "2017-11-24",
        "issued": "2021-01-11",
        "completed": "2022-02-18",
        "units": 346,
        "postal": "   ",
        "address": "25 NICHOLAS AVE"
      },
      {
        "start": "2017-12-21",
        "issued": "2020-09-22",
        "completed": "2022-06-16",
        "units": 8,
        "postal": "   ",
        "address": "181 BEDFORD RD"
      },
      {
        "start": "2017-12-21",
        "issued": "2020-09-23",
        "completed": "2022-06-16",
        "units": 8,
        "postal": "M5R",
        "address": "250 DAVENPORT RD"
      },
      {
        "start": "2018-03-19",
        "issued": "2019-04-17",
        "completed": "2022-03-23",
        "units": 243,
        "postal": "M5T",
        "address": "203 COLLEGE ST"
      },
      {
        "start": "2018-04-16",
        "issued": "2018-06-01",
        "completed": "2022-06-21",
        "units": 2,
        "postal": "M6H",
        "address": "247 CONCORD AVE"
      },
      {
        "start": "2018-05-02",
        "issued": "2018-09-21",
        "completed": "2022-04-27",
        "units": 2,
        "postal": "M6K",
        "address": "1572 KING ST W"
      },
      {
        "start": "2018-06-21",
        "issued": "2019-11-14",
        "completed": "2022-03-08",
        "units": 222,
        "postal": "M5A",
        "address": "219 DUNDAS ST E"
      },
      {
        "start": "2018-10-29",
        "issued": "2019-06-14",
        "completed": "2022-02-17",
        "units": 3,
        "postal": "M6H",
        "address": "1340 BLOOR ST W"
      },
      {
        "start": "2019-04-10",
        "issued": "2019-07-26",
        "completed": "2022-01-21",
        "units": 4,
        "postal": "M6K",
        "address": "345 DUFFERIN ST"
      },
      {
        "start": "2019-08-06",
        "issued": "2020-09-29",
        "completed": "2022-06-17",
        "units": 4,
        "postal": "M6N",
        "address": "63 SCARLETT RD"
      },
      {
        "start": "2019-10-25",
        "issued": "2020-03-13",
        "completed": "2022-07-27",
        "units": 2,
        "postal": "M6H",
        "address": "16 ROSEMOUNT AVE"
      },
      {
        "start": "2020-06-10",
        "issued": "2020-08-21",
        "completed": "2022-02-16",
        "units": 2,
        "postal": "M6E",
        "address": "31 ENNERDALE RD"
      },
      {
        "start": "2020-06-30",
        "issued": "2020-10-29",
        "completed": "2022-03-10",
        "units": 12,
        "postal": "   ",
        "address": "200 EXBURY RD"
      },
      {
        "start": "2020-07-15",
        "issued": "2020-10-28",
        "completed": "2022-01-31",
        "units": 2,
        "postal": "M4X",
        "address": "60 WINCHESTER ST"
      },
      {
        "start": "2020-08-13",
        "issued": "2020-10-19",
        "completed": "2022-02-15",
        "units": 2,
        "postal": "M6N",
        "address": "5 MARIPOSA AVE"
      },
      {
        "start": "2020-10-20",
        "issued": "2021-02-01",
        "completed": "2022-06-29",
        "units": 3,
        "postal": "   ",
        "address": "531 DELAWARE AVE N"
      },
      {
        "start": "2021-02-03",
        "issued": "2021-04-26",
        "completed": "2022-07-28",
        "units": 7,
        "postal": "M6H",
        "address": "679 DOVERCOURT RD"
      },
      {
        "start": "2021-02-10",
        "issued": "2021-05-13",
        "completed": "2022-05-06",
        "units": 4,
        "postal": "M5V",
        "address": "475 QUEEN ST W"
      },
      {
        "start": "2021-05-07",
        "issued": "2021-06-25",
        "completed": "2022-02-02",
        "units": 0,
        "postal": "M4K",
        "address": "13 VICTOR AVE"
      },
      {
        "start": "2021-09-24",
        "issued": "2021-12-03",
        "completed": "2022-05-11",
        "units": 2,
        "postal": "M6H",
        "address": "548 ST CLARENS AVE"
      },
      {
        "start": "2021-11-02",
        "issued": "2022-03-24",
        "completed": "2022-07-11",
        "units": 2,
        "postal": "M5R",
        "address": "161 MADISON AVE"
      }
    ];

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

    var data$1 = {
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
    Object.keys(data$1).forEach((k) => {
      let split = k.split('|');
      let obj = {
        offset: Number(split[0]),
        hem: split[1]
      };
      if (split[2]) {
        obj.dst = split[2];
      }
      let names = data$1[k].split(',');
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

    //a very-tiny version of d3-scale's scaleLinear
    const scaleLinear = function (obj, num) {
      let world = obj.world || [];
      let minmax = obj.minmax || [];
      let range = minmax[1] - minmax[0];
      let percent = (num - minmax[0]) / range;
      let size = world[1] - world[0];
      return parseInt(size * percent, 10)
    };

    /* 2022/pipeline/Post.svelte generated by Svelte v3.29.0 */
    const file = "2022/pipeline/Post.svelte";

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-tt4o6j-style";
    	style.textContent = ".down.svelte-tt4o6j{margin:15%;margin-left:14%}.term.svelte-tt4o6j{color:grey;padding:0.3rem;font-size:15px;line-height:15px;font-weight:100;flex:1;margin:2px;height:20px;display:inline-block}.above.svelte-tt4o6j{margin-top:3rem;margin-bottom:0rem}.legend.svelte-tt4o6j{width:14rem;height:8px}.line.svelte-tt4o6j{height:95%;bottom:1%;border-left:2px dashed darkgrey;width:10px;position:absolute}.build.svelte-tt4o6j{background-color:#6699cc;border-radius:0px 2px 2px 0px}.approve.svelte-tt4o6j{background-color:#8ba3a2;border-radius:2px}.wait.svelte-tt4o6j{background-color:lightsteelblue}.container.svelte-tt4o6j{margin-left:15%;margin-right:15%;position:relative;overflow:clip}.row.svelte-tt4o6j{position:relative;min-height:4px;margin-top:1px}.lines.svelte-tt4o6j{min-height:5px}.bar.svelte-tt4o6j{min-height:6px;position:absolute;box-shadow:2px 2px 8px 0px rgba(0, 0, 0, 0.2)}.label.svelte-tt4o6j{color:grey;margin-bottom:0.4rem;line-height:18px}.sublabel.svelte-tt4o6j{position:absolute;bottom:-29px;font-size:11px}.col.svelte-tt4o6j{display:flex;flex-direction:column;justify-content:space-around;align-items:center;text-align:center;flex-wrap:wrap;align-self:stretch}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBkYXRhIGZyb20gJy4vZGF0YS5qcydcbiAgaW1wb3J0IHNwYWNldGltZSBmcm9tICdzcGFjZXRpbWUnXG4gIGltcG9ydCBzY2FsZSBmcm9tICcuL3NjYWxlLmpzJ1xuXG4gIGxldCBzdGFydCA9IHNwYWNldGltZSgnMjAwNi0xMS0xMycpXG4gIGxldCBlbmQgPSBzcGFjZXRpbWUoJzIwMjMtMDEtMDEnKVxuICBsZXQgeFNjYWxlID0gc3RyID0+IHNjYWxlKHsgd29ybGQ6IFswLCAxMDBdLCBtaW5tYXg6IFtzdGFydC5lcG9jaCwgZW5kLmVwb2NoXSB9LCBzcGFjZXRpbWUoU3RyaW5nKHN0cikpLmVwb2NoKVxuXG4gIGxldCBjb2xvcnMgPSB7XG4gICAgbWlsbGVyOiAnI0M0QUJBQicsXG4gICAgZm9yZDogJyNENjg4ODEnLFxuICAgIHRvcnkxOiAnIzhCQTNBMicsXG4gICAgdG9yeTI6ICcjOWM4OTZjJyxcbiAgfVxuICBjb25zdCBnZXRUZXJtID0gc3RyID0+IHtcbiAgICBpZiAoc3RyLm1hdGNoKC8oMjAwKS8pICYmICFzdHIubWF0Y2goLzIwMDktKDExfDEyKS8pKSB7XG4gICAgICByZXR1cm4gY29sb3JzLm1pbGxlclxuICAgIH0gZWxzZSBpZiAoc3RyLm1hdGNoKC8oMjAxMHwyMDExfDIwMTJ8MjAxMykvKSAmJiAhc3RyLm1hdGNoKC8yMDEzLSgxMXwxMikvKSkge1xuICAgICAgcmV0dXJuIGNvbG9ycy5taWxsZXJcbiAgICB9IGVsc2UgaWYgKHN0ci5tYXRjaCgvKDIwMTR8MjAxNXwyMDE2fDIwMTcpLykgJiYgIXN0ci5tYXRjaCgvMjAxNy0oMTF8MTIpLykpIHtcbiAgICAgIHJldHVybiBjb2xvcnMuZm9yZFxuICAgIH0gZWxzZSBpZiAoc3RyLm1hdGNoKC8oMjAxOHwyMDE5fDIwMjB8MjAyMXwyMDIyKS8pICYmICFzdHIubWF0Y2goLzIwMTctKDExfDEyKS8pKSB7XG4gICAgICByZXR1cm4gY29sb3JzLnRvcnkxXG4gICAgfVxuICAgIHJldHVybiBjb2xvcnMudG9yeTJcbiAgfVxuXG4gIGxldCByb3dzID0gZGF0YS5tYXAobyA9PiB7XG4gICAgbGV0IHN0YXJ0ID0geFNjYWxlKG8uc3RhcnQpXG4gICAgbGV0IGlzc3VlZCA9IHhTY2FsZShvLmlzc3VlZClcbiAgICBsZXQgZG9uZSA9IHhTY2FsZShvLmNvbXBsZXRlZClcbiAgICBsZXQgYXBwcm92ZWRfdGVybSA9IGdldFRlcm0oby5zdGFydCB8fCAnJylcbiAgICBsZXQgaXNzdWVkX3Rlcm0gPSBnZXRUZXJtKG8uaXNzdWVkIHx8ICcnKVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHllbGxvd19zdGFydDogc3RhcnQsXG4gICAgICB5ZWxsb3dfd2lkdGg6IGlzc3VlZCAtIHN0YXJ0LFxuICAgICAgYmx1ZV9zdGFydDogaXNzdWVkLFxuICAgICAgYmx1ZV93aWR0aDogZG9uZSAtIGlzc3VlZCxcbiAgICAgIGNvbXBsZXRlZDogby5jb21wbGV0ZWQsXG4gICAgICB1bml0czogby51bml0cyxcbiAgICAgIGFkZHJlc3M6IG8uYWRkcmVzcyxcbiAgICAgIGFwcHJvdmVkX3Rlcm06ICcjRDY4ODgxJyxcbiAgICAgIGlzc3VlZF90ZXJtOiAnIzhCQTNBMicsXG4gICAgICBkb25lLFxuICAgIH1cbiAgfSlcbiAgcm93cyA9IHJvd3MuZmlsdGVyKG8gPT4gby51bml0cyA+IDQpXG4gIHJvd3MgPSByb3dzLnNvcnQoKGEsIGIpID0+IHtcbiAgICBpZiAoYS5kb25lID4gYi5kb25lKSB7XG4gICAgICByZXR1cm4gLTFcbiAgICB9IGVsc2UgaWYgKGEuZG9uZSA8IGIuZG9uZSkge1xuICAgICAgcmV0dXJuIDFcbiAgICB9XG4gICAgcmV0dXJuIDBcbiAgfSlcbjwvc2NyaXB0PlxuXG48ZGl2PlxuICA8ZGl2IGNsYXNzPVwiYWJvdmVcIj5cbiAgICA8IS0tIDxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOjVyZW07IG1hcmdpbi1sZWZ0OjRyZW07IG1hcmdpbi1ib3R0b206MnJlbTtcIj5UaW1lbGluZSBvZiBkZXZlbG9wbWVudDo8L2Rpdj4gLS0+XG4gICAgPGRpdiBjbGFzcz1cInJvd1wiIHN0eWxlPVwianVzdGlmeS1jb250ZW50OmNlbnRlcjsgbWFyZ2luLWxlZnQ6M3JlbTsgbWFyZ2luLWJvdHRvbTozcmVtO1wiPlxuICAgICAgPGRpdiBjbGFzcz1cImNvbFwiIHN0eWxlPVwid2lkdGg6MTJweDtcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImxhYmVsXCI+Jm5ic3A7PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJsZWdlbmQgYXBwcm92ZVwiIHN0eWxlPVwid2lkdGg6MTJweDsgYm9yZGVyLXJhZGl1czoycHggMHB4IDBweCAycHg7YmFja2dyb3VuZC1jb2xvcjojOEJBM0EyO1wiIC8+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJjb2xcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImxhYmVsXCI+QXBwbGljYXRpb24gUHJvY2VzczwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwibGVnZW5kIHdhaXRcIiBzdHlsZT1cIlwiIC8+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJsYWJlbCBzdWJsYWJlbFwiIHN0eWxlPVwibGVmdDozNyU7XCI+c3VibWl0dGVkPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJjb2xcIiBzdHlsZT1cIndpZHRoOjEycHg7XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJsYWJlbFwiPiZuYnNwOzwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwibGVnZW5kIGFwcHJvdmVcIiBzdHlsZT1cIndpZHRoOjEycHg7Ym9yZGVyLXJhZGl1czowcHg7IGJhY2tncm91bmQtY29sb3I6I0Q2ODg4MTtcIiAvPlxuICAgICAgICA8ZGl2IGNsYXNzPVwibGFiZWwgc3VibGFiZWxcIj5pc3N1ZWQ8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImNvbFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwibGFiZWxcIj5CdWlsZGluZzwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwibGVnZW5kIGJ1aWxkXCIgc3R5bGU9XCJib3JkZXItcmFkaXVzOjBweCAycHggMnB4IDBweDtcIiAvPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIDwvZGl2PlxuICA8ZGl2IGNsYXNzPVwiY29udGFpbmVyIGNvbFwiPlxuICAgIDxkaXYgY2xhc3M9XCJyb3dcIiBzdHlsZT1cImp1c3RpZnktY29udGVudDogZmxleC1lbmQ7IG1hcmdpbi1yaWdodDoyMHB4OyB0b3A6MjBweDsgY29sb3I6Z3JleTtcIj5cbiAgICAgIDxoND5NdWx0aXBsZXhlcyBjb21wbGV0ZWQ8YnIgLz4gZHVyaW5nIHRoaXMgdGVybSDihpM8L2g0PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgc3R5bGU9XCJtYXJnaW46MC43NXJlbTtcIiAvPlxuICAgIHsjZWFjaCByb3dzIGFzIG8sIGl9XG4gICAgICA8ZGl2IGNsYXNzPVwicm93IGxpbmVzXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJiYXIgd2FpdFwiIHN0eWxlPVwibGVmdDp7by55ZWxsb3dfc3RhcnR9JTsgd2lkdGg6e28ueWVsbG93X3dpZHRofSU7XCIgLz5cbiAgICAgICAgPGRpdiBjbGFzcz1cImJhciBhcHByb3ZlXCIgc3R5bGU9XCJsZWZ0OntvLnllbGxvd19zdGFydH0lOyB3aWR0aDp7MC42NX0lOyBiYWNrZ3JvdW5kLWNvbG9yOntvLmlzc3VlZF90ZXJtfTtcIiAvPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiYmFyIGJ1aWxkXCIgc3R5bGU9XCJsZWZ0OntvLmJsdWVfc3RhcnR9JTsgd2lkdGg6e28uYmx1ZV93aWR0aH0lO1wiIHRpdGxlPXtvLmFkZHJlc3MgKyBvLmNvbXBsZXRlZH0gLz5cbiAgICAgICAgPGRpdiBjbGFzcz1cImJhciBhcHByb3ZlXCIgc3R5bGU9XCJsZWZ0OntvLmJsdWVfc3RhcnR9JTsgd2lkdGg6ezAuNX0lOyBiYWNrZ3JvdW5kLWNvbG9yOntvLmFwcHJvdmVkX3Rlcm19O1wiIC8+XG4gICAgICA8L2Rpdj5cbiAgICB7L2VhY2h9XG4gICAgPGRpdiBjbGFzcz1cImxpbmVcIiBzdHlsZT1cImxlZnQ6e3hTY2FsZSgnMjAxOC0xMC0yMicpfSVcIiAvPlxuICAgIDxkaXYgY2xhc3M9XCJsaW5lXCIgc3R5bGU9XCJsZWZ0Ont4U2NhbGUoJzIwMTQtMTAtMjcnKX0lXCIgLz5cbiAgICA8ZGl2IGNsYXNzPVwibGluZVwiIHN0eWxlPVwibGVmdDp7eFNjYWxlKCcyMDEwLTEwLTI1Jyl9JVwiIC8+XG4gICAgPGRpdiBzdHlsZT1cIm1hcmdpbjowLjc1cmVtO1wiIC8+XG4gICAgPCEtLSA8ZGl2IGNsYXNzPVwibGluZVwiIHN0eWxlPVwibGVmdDp7eFNjYWxlKCcyMDA2LTExLTEzJyl9JVwiIC8+IC0tPlxuICA8L2Rpdj5cbiAgPGRpdiBjbGFzcz1cInJvdyBkb3duIGJhcnNcIj5cbiAgICA8ZGl2IGNsYXNzPVwidGVybSBjb2xcIiBzdHlsZT1cImJvcmRlci10b3A6M3B4IHNvbGlkIGxpZ2h0Z3JleTtcIj5NaWxsZXIgIzI8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwidGVybSBjb2xcIiBzdHlsZT1cImJvcmRlci10b3A6M3B4IHNvbGlkIGxpZ2h0Z3JleTtcIj5Gb3JkPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cInRlcm0gY29sXCIgc3R5bGU9XCJib3JkZXItdG9wOjNweCBzb2xpZCBsaWdodGdyZXk7XCI+VG9yeSAjMTwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJ0ZXJtIGNvbFwiIHN0eWxlPVwiYm9yZGVyLXRvcDozcHggc29saWQgbGlnaHRncmV5O1wiPlRvcnkgIzI8L2Rpdj5cbiAgPC9kaXY+XG48L2Rpdj5cblxuPHN0eWxlPlxuICAuZG93biB7XG4gICAgbWFyZ2luOiAxNSU7XG4gICAgbWFyZ2luLWxlZnQ6IDE0JTtcbiAgICAvKiBib3JkZXI6IDFweCBzb2xpZCBncmV5OyAqL1xuICAgIC8qIG1hcmdpbi1sZWZ0OiAyMnB4OyAqL1xuICB9XG4gIC50ZXJtIHtcbiAgICAvKiBib3JkZXItcmFkaXVzOiA1cHg7ICovXG4gICAgY29sb3I6IGdyZXk7XG4gICAgcGFkZGluZzogMC4zcmVtO1xuICAgIGZvbnQtc2l6ZTogMTVweDtcbiAgICBsaW5lLWhlaWdodDogMTVweDtcbiAgICBmb250LXdlaWdodDogMTAwO1xuICAgIGZsZXg6IDE7XG4gICAgbWFyZ2luOiAycHg7XG4gICAgaGVpZ2h0OiAyMHB4O1xuICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgfVxuICAuYWJvdmUge1xuICAgIG1hcmdpbi10b3A6IDNyZW07XG4gICAgbWFyZ2luLWJvdHRvbTogMHJlbTtcbiAgfVxuICAubGVnZW5kIHtcbiAgICB3aWR0aDogMTRyZW07XG4gICAgaGVpZ2h0OiA4cHg7XG4gIH1cbiAgLmxpbmUge1xuICAgIGhlaWdodDogOTUlO1xuICAgIGJvdHRvbTogMSU7XG4gICAgYm9yZGVyLWxlZnQ6IDJweCBkYXNoZWQgZGFya2dyZXk7XG4gICAgd2lkdGg6IDEwcHg7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICB9XG4gIC5idWlsZCB7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogIzY2OTljYztcbiAgICBib3JkZXItcmFkaXVzOiAwcHggMnB4IDJweCAwcHg7XG4gIH1cbiAgLmFwcHJvdmUge1xuICAgIGJhY2tncm91bmQtY29sb3I6ICM4YmEzYTI7XG4gICAgYm9yZGVyLXJhZGl1czogMnB4O1xuICAgIC8qIHBhZGRpbmctdG9wOiAxcHg7ICovXG4gICAgLyogcGFkZGluZy1ib3R0b206IDFweDsgKi9cbiAgfVxuICAud2FpdCB7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogbGlnaHRzdGVlbGJsdWU7XG4gICAgLyogYm9yZGVyLXJhZGl1czogM3B4IDBweCAwcHggM3B4OyAqL1xuICB9XG4gIC5jb250YWluZXIge1xuICAgIG1hcmdpbi1sZWZ0OiAxNSU7XG4gICAgbWFyZ2luLXJpZ2h0OiAxNSU7XG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgIC8qIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCBncmV5OyAqL1xuICAgIG92ZXJmbG93OiBjbGlwO1xuICB9XG4gIC5yb3cge1xuICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICBtaW4taGVpZ2h0OiA0cHg7XG4gICAgbWFyZ2luLXRvcDogMXB4O1xuICB9XG4gIC5saW5lcyB7XG4gICAgbWluLWhlaWdodDogNXB4O1xuICAgIC8qIG1hcmdpbjogMnJlbTsgKi9cbiAgfVxuICAuYmFyIHtcbiAgICBtaW4taGVpZ2h0OiA2cHg7XG4gICAgLyogYm9yZGVyLXJhZGl1czogM3B4OyAqL1xuICAgIC8qIHBhZGRpbmctdG9wOiA1cHg7ICovXG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIGJveC1zaGFkb3c6IDJweCAycHggOHB4IDBweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gIH1cbiAgLmxhYmVsIHtcbiAgICBjb2xvcjogZ3JleTtcbiAgICBtYXJnaW4tYm90dG9tOiAwLjRyZW07XG4gICAgbGluZS1oZWlnaHQ6IDE4cHg7XG4gIH1cbiAgLnN1YmxhYmVsIHtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgYm90dG9tOiAtMjlweDtcbiAgICBmb250LXNpemU6IDExcHg7XG4gIH1cbiAgLmNvbCB7XG4gICAgZGlzcGxheTogZmxleDtcbiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYXJvdW5kO1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIGZsZXgtd3JhcDogd3JhcDtcbiAgICBhbGlnbi1zZWxmOiBzdHJldGNoO1xuICB9XG48L3N0eWxlPlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQStHRSxLQUFLLGNBQUMsQ0FBQyxBQUNMLE1BQU0sQ0FBRSxHQUFHLENBQ1gsV0FBVyxDQUFFLEdBQUcsQUFHbEIsQ0FBQyxBQUNELEtBQUssY0FBQyxDQUFDLEFBRUwsS0FBSyxDQUFFLElBQUksQ0FDWCxPQUFPLENBQUUsTUFBTSxDQUNmLFNBQVMsQ0FBRSxJQUFJLENBQ2YsV0FBVyxDQUFFLElBQUksQ0FDakIsV0FBVyxDQUFFLEdBQUcsQ0FDaEIsSUFBSSxDQUFFLENBQUMsQ0FDUCxNQUFNLENBQUUsR0FBRyxDQUNYLE1BQU0sQ0FBRSxJQUFJLENBQ1osT0FBTyxDQUFFLFlBQVksQUFDdkIsQ0FBQyxBQUNELE1BQU0sY0FBQyxDQUFDLEFBQ04sVUFBVSxDQUFFLElBQUksQ0FDaEIsYUFBYSxDQUFFLElBQUksQUFDckIsQ0FBQyxBQUNELE9BQU8sY0FBQyxDQUFDLEFBQ1AsS0FBSyxDQUFFLEtBQUssQ0FDWixNQUFNLENBQUUsR0FBRyxBQUNiLENBQUMsQUFDRCxLQUFLLGNBQUMsQ0FBQyxBQUNMLE1BQU0sQ0FBRSxHQUFHLENBQ1gsTUFBTSxDQUFFLEVBQUUsQ0FDVixXQUFXLENBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQ2hDLEtBQUssQ0FBRSxJQUFJLENBQ1gsUUFBUSxDQUFFLFFBQVEsQUFDcEIsQ0FBQyxBQUNELE1BQU0sY0FBQyxDQUFDLEFBQ04sZ0JBQWdCLENBQUUsT0FBTyxDQUN6QixhQUFhLENBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxBQUNoQyxDQUFDLEFBQ0QsUUFBUSxjQUFDLENBQUMsQUFDUixnQkFBZ0IsQ0FBRSxPQUFPLENBQ3pCLGFBQWEsQ0FBRSxHQUFHLEFBR3BCLENBQUMsQUFDRCxLQUFLLGNBQUMsQ0FBQyxBQUNMLGdCQUFnQixDQUFFLGNBQWMsQUFFbEMsQ0FBQyxBQUNELFVBQVUsY0FBQyxDQUFDLEFBQ1YsV0FBVyxDQUFFLEdBQUcsQ0FDaEIsWUFBWSxDQUFFLEdBQUcsQ0FDakIsUUFBUSxDQUFFLFFBQVEsQ0FFbEIsUUFBUSxDQUFFLElBQUksQUFDaEIsQ0FBQyxBQUNELElBQUksY0FBQyxDQUFDLEFBQ0osUUFBUSxDQUFFLFFBQVEsQ0FDbEIsVUFBVSxDQUFFLEdBQUcsQ0FDZixVQUFVLENBQUUsR0FBRyxBQUNqQixDQUFDLEFBQ0QsTUFBTSxjQUFDLENBQUMsQUFDTixVQUFVLENBQUUsR0FBRyxBQUVqQixDQUFDLEFBQ0QsSUFBSSxjQUFDLENBQUMsQUFDSixVQUFVLENBQUUsR0FBRyxDQUdmLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLFVBQVUsQ0FBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQUFDaEQsQ0FBQyxBQUNELE1BQU0sY0FBQyxDQUFDLEFBQ04sS0FBSyxDQUFFLElBQUksQ0FDWCxhQUFhLENBQUUsTUFBTSxDQUNyQixXQUFXLENBQUUsSUFBSSxBQUNuQixDQUFDLEFBQ0QsU0FBUyxjQUFDLENBQUMsQUFDVCxRQUFRLENBQUUsUUFBUSxDQUNsQixNQUFNLENBQUUsS0FBSyxDQUNiLFNBQVMsQ0FBRSxJQUFJLEFBQ2pCLENBQUMsQUFDRCxJQUFJLGNBQUMsQ0FBQyxBQUNKLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLE1BQU0sQ0FDdEIsZUFBZSxDQUFFLFlBQVksQ0FDN0IsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsVUFBVSxDQUFFLE1BQU0sQ0FDbEIsU0FBUyxDQUFFLElBQUksQ0FDZixVQUFVLENBQUUsT0FBTyxBQUNyQixDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (89:4) {#each rows as o, i}
    function create_each_block(ctx) {
    	let div4;
    	let div0;
    	let t0;
    	let div1;
    	let t1;
    	let div2;
    	let div2_title_value;
    	let t2;
    	let div3;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			t1 = space();
    			div2 = element("div");
    			t2 = space();
    			div3 = element("div");
    			attr_dev(div0, "class", "bar wait svelte-tt4o6j");
    			set_style(div0, "left", /*o*/ ctx[6].yellow_start + "%");
    			set_style(div0, "width", /*o*/ ctx[6].yellow_width + "%");
    			add_location(div0, file, 90, 8, 2980);
    			attr_dev(div1, "class", "bar approve svelte-tt4o6j");
    			set_style(div1, "left", /*o*/ ctx[6].yellow_start + "%");
    			set_style(div1, "width", 0.65 + "%");
    			set_style(div1, "background-color", /*o*/ ctx[6].issued_term);
    			add_location(div1, file, 91, 8, 3070);
    			attr_dev(div2, "class", "bar build svelte-tt4o6j");
    			set_style(div2, "left", /*o*/ ctx[6].blue_start + "%");
    			set_style(div2, "width", /*o*/ ctx[6].blue_width + "%");
    			attr_dev(div2, "title", div2_title_value = /*o*/ ctx[6].address + /*o*/ ctx[6].completed);
    			add_location(div2, file, 92, 8, 3187);
    			attr_dev(div3, "class", "bar approve svelte-tt4o6j");
    			set_style(div3, "left", /*o*/ ctx[6].blue_start + "%");
    			set_style(div3, "width", 0.5 + "%");
    			set_style(div3, "background-color", /*o*/ ctx[6].approved_term);
    			add_location(div3, file, 93, 8, 3306);
    			attr_dev(div4, "class", "row lines svelte-tt4o6j");
    			add_location(div4, file, 89, 6, 2948);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div0);
    			append_dev(div4, t0);
    			append_dev(div4, div1);
    			append_dev(div4, t1);
    			append_dev(div4, div2);
    			append_dev(div4, t2);
    			append_dev(div4, div3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*rows*/ 1) {
    				set_style(div0, "left", /*o*/ ctx[6].yellow_start + "%");
    			}

    			if (dirty & /*rows*/ 1) {
    				set_style(div0, "width", /*o*/ ctx[6].yellow_width + "%");
    			}

    			if (dirty & /*rows*/ 1) {
    				set_style(div1, "left", /*o*/ ctx[6].yellow_start + "%");
    			}

    			if (dirty & /*rows*/ 1) {
    				set_style(div1, "background-color", /*o*/ ctx[6].issued_term);
    			}

    			if (dirty & /*rows*/ 1) {
    				set_style(div2, "left", /*o*/ ctx[6].blue_start + "%");
    			}

    			if (dirty & /*rows*/ 1) {
    				set_style(div2, "width", /*o*/ ctx[6].blue_width + "%");
    			}

    			if (dirty & /*rows*/ 1 && div2_title_value !== (div2_title_value = /*o*/ ctx[6].address + /*o*/ ctx[6].completed)) {
    				attr_dev(div2, "title", div2_title_value);
    			}

    			if (dirty & /*rows*/ 1) {
    				set_style(div3, "left", /*o*/ ctx[6].blue_start + "%");
    			}

    			if (dirty & /*rows*/ 1) {
    				set_style(div3, "background-color", /*o*/ ctx[6].approved_term);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(89:4) {#each rows as o, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div28;
    	let div15;
    	let div14;
    	let div2;
    	let div0;
    	let t1;
    	let div1;
    	let t2;
    	let div6;
    	let div3;
    	let t4;
    	let div4;
    	let t5;
    	let div5;
    	let t7;
    	let div10;
    	let div7;
    	let t9;
    	let div8;
    	let t10;
    	let div9;
    	let t12;
    	let div13;
    	let div11;
    	let t14;
    	let div12;
    	let t15;
    	let div22;
    	let div16;
    	let h4;
    	let t16;
    	let br;
    	let t17;
    	let t18;
    	let div17;
    	let t19;
    	let t20;
    	let div18;
    	let t21;
    	let div19;
    	let t22;
    	let div20;
    	let t23;
    	let div21;
    	let t24;
    	let div27;
    	let div23;
    	let t26;
    	let div24;
    	let t28;
    	let div25;
    	let t30;
    	let div26;
    	let each_value = /*rows*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div28 = element("div");
    			div15 = element("div");
    			div14 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = " ";
    			t1 = space();
    			div1 = element("div");
    			t2 = space();
    			div6 = element("div");
    			div3 = element("div");
    			div3.textContent = "Application Process";
    			t4 = space();
    			div4 = element("div");
    			t5 = space();
    			div5 = element("div");
    			div5.textContent = "submitted";
    			t7 = space();
    			div10 = element("div");
    			div7 = element("div");
    			div7.textContent = " ";
    			t9 = space();
    			div8 = element("div");
    			t10 = space();
    			div9 = element("div");
    			div9.textContent = "issued";
    			t12 = space();
    			div13 = element("div");
    			div11 = element("div");
    			div11.textContent = "Building";
    			t14 = space();
    			div12 = element("div");
    			t15 = space();
    			div22 = element("div");
    			div16 = element("div");
    			h4 = element("h4");
    			t16 = text("Multiplexes completed");
    			br = element("br");
    			t17 = text(" during this term ↓");
    			t18 = space();
    			div17 = element("div");
    			t19 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t20 = space();
    			div18 = element("div");
    			t21 = space();
    			div19 = element("div");
    			t22 = space();
    			div20 = element("div");
    			t23 = space();
    			div21 = element("div");
    			t24 = space();
    			div27 = element("div");
    			div23 = element("div");
    			div23.textContent = "Miller #2";
    			t26 = space();
    			div24 = element("div");
    			div24.textContent = "Ford";
    			t28 = space();
    			div25 = element("div");
    			div25.textContent = "Tory #1";
    			t30 = space();
    			div26 = element("div");
    			div26.textContent = "Tory #2";
    			attr_dev(div0, "class", "label svelte-tt4o6j");
    			add_location(div0, file, 64, 8, 1891);
    			attr_dev(div1, "class", "legend approve svelte-tt4o6j");
    			set_style(div1, "width", "12px");
    			set_style(div1, "border-radius", "2px 0px 0px 2px");
    			set_style(div1, "background-color", "#8BA3A2");
    			add_location(div1, file, 65, 8, 1931);
    			attr_dev(div2, "class", "col svelte-tt4o6j");
    			set_style(div2, "width", "12px");
    			add_location(div2, file, 63, 6, 1845);
    			attr_dev(div3, "class", "label svelte-tt4o6j");
    			add_location(div3, file, 68, 8, 2083);
    			attr_dev(div4, "class", "legend wait svelte-tt4o6j");
    			add_location(div4, file, 69, 8, 2136);
    			attr_dev(div5, "class", "label sublabel svelte-tt4o6j");
    			set_style(div5, "left", "37%");
    			add_location(div5, file, 70, 8, 2181);
    			attr_dev(div6, "class", "col svelte-tt4o6j");
    			add_location(div6, file, 67, 6, 2057);
    			attr_dev(div7, "class", "label svelte-tt4o6j");
    			add_location(div7, file, 73, 8, 2308);
    			attr_dev(div8, "class", "legend approve svelte-tt4o6j");
    			set_style(div8, "width", "12px");
    			set_style(div8, "border-radius", "0px");
    			set_style(div8, "background-color", "#D68881");
    			add_location(div8, file, 74, 8, 2348);
    			attr_dev(div9, "class", "label sublabel svelte-tt4o6j");
    			add_location(div9, file, 75, 8, 2451);
    			attr_dev(div10, "class", "col svelte-tt4o6j");
    			set_style(div10, "width", "12px");
    			add_location(div10, file, 72, 6, 2262);
    			attr_dev(div11, "class", "label svelte-tt4o6j");
    			add_location(div11, file, 78, 8, 2537);
    			attr_dev(div12, "class", "legend build svelte-tt4o6j");
    			set_style(div12, "border-radius", "0px 2px 2px 0px");
    			add_location(div12, file, 79, 8, 2579);
    			attr_dev(div13, "class", "col svelte-tt4o6j");
    			add_location(div13, file, 77, 6, 2511);
    			attr_dev(div14, "class", "row svelte-tt4o6j");
    			set_style(div14, "justify-content", "center");
    			set_style(div14, "margin-left", "3rem");
    			set_style(div14, "margin-bottom", "3rem");
    			add_location(div14, file, 62, 4, 1751);
    			attr_dev(div15, "class", "above svelte-tt4o6j");
    			add_location(div15, file, 60, 2, 1615);
    			add_location(br, file, 85, 31, 2839);
    			add_location(h4, file, 85, 6, 2814);
    			attr_dev(div16, "class", "row svelte-tt4o6j");
    			set_style(div16, "justify-content", "flex-end");
    			set_style(div16, "margin-right", "20px");
    			set_style(div16, "top", "20px");
    			set_style(div16, "color", "grey");
    			add_location(div16, file, 84, 4, 2714);
    			set_style(div17, "margin", "0.75rem");
    			add_location(div17, file, 87, 4, 2885);
    			attr_dev(div18, "class", "line svelte-tt4o6j");
    			set_style(div18, "left", /*xScale*/ ctx[1]("2018-10-22") + "%");
    			add_location(div18, file, 96, 4, 3443);
    			attr_dev(div19, "class", "line svelte-tt4o6j");
    			set_style(div19, "left", /*xScale*/ ctx[1]("2014-10-27") + "%");
    			add_location(div19, file, 97, 4, 3505);
    			attr_dev(div20, "class", "line svelte-tt4o6j");
    			set_style(div20, "left", /*xScale*/ ctx[1]("2010-10-25") + "%");
    			add_location(div20, file, 98, 4, 3567);
    			set_style(div21, "margin", "0.75rem");
    			add_location(div21, file, 99, 4, 3629);
    			attr_dev(div22, "class", "container col svelte-tt4o6j");
    			add_location(div22, file, 83, 2, 2682);
    			attr_dev(div23, "class", "term col svelte-tt4o6j");
    			set_style(div23, "border-top", "3px solid lightgrey");
    			add_location(div23, file, 103, 4, 3775);
    			attr_dev(div24, "class", "term col svelte-tt4o6j");
    			set_style(div24, "border-top", "3px solid lightgrey");
    			add_location(div24, file, 104, 4, 3857);
    			attr_dev(div25, "class", "term col svelte-tt4o6j");
    			set_style(div25, "border-top", "3px solid lightgrey");
    			add_location(div25, file, 105, 4, 3934);
    			attr_dev(div26, "class", "term col svelte-tt4o6j");
    			set_style(div26, "border-top", "3px solid lightgrey");
    			add_location(div26, file, 106, 4, 4014);
    			attr_dev(div27, "class", "row down bars svelte-tt4o6j");
    			add_location(div27, file, 102, 2, 3743);
    			add_location(div28, file, 59, 0, 1607);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div28, anchor);
    			append_dev(div28, div15);
    			append_dev(div15, div14);
    			append_dev(div14, div2);
    			append_dev(div2, div0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div14, t2);
    			append_dev(div14, div6);
    			append_dev(div6, div3);
    			append_dev(div6, t4);
    			append_dev(div6, div4);
    			append_dev(div6, t5);
    			append_dev(div6, div5);
    			append_dev(div14, t7);
    			append_dev(div14, div10);
    			append_dev(div10, div7);
    			append_dev(div10, t9);
    			append_dev(div10, div8);
    			append_dev(div10, t10);
    			append_dev(div10, div9);
    			append_dev(div14, t12);
    			append_dev(div14, div13);
    			append_dev(div13, div11);
    			append_dev(div13, t14);
    			append_dev(div13, div12);
    			append_dev(div28, t15);
    			append_dev(div28, div22);
    			append_dev(div22, div16);
    			append_dev(div16, h4);
    			append_dev(h4, t16);
    			append_dev(h4, br);
    			append_dev(h4, t17);
    			append_dev(div22, t18);
    			append_dev(div22, div17);
    			append_dev(div22, t19);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div22, null);
    			}

    			append_dev(div22, t20);
    			append_dev(div22, div18);
    			append_dev(div22, t21);
    			append_dev(div22, div19);
    			append_dev(div22, t22);
    			append_dev(div22, div20);
    			append_dev(div22, t23);
    			append_dev(div22, div21);
    			append_dev(div28, t24);
    			append_dev(div28, div27);
    			append_dev(div27, div23);
    			append_dev(div27, t26);
    			append_dev(div27, div24);
    			append_dev(div27, t28);
    			append_dev(div27, div25);
    			append_dev(div27, t30);
    			append_dev(div27, div26);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*rows*/ 1) {
    				each_value = /*rows*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div22, t20);
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
    			if (detaching) detach_dev(div28);
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
    	let start = main$1("2006-11-13");
    	let end = main$1("2023-01-01");

    	let xScale = str => scaleLinear(
    		{
    			world: [0, 100],
    			minmax: [start.epoch, end.epoch]
    		},
    		main$1(String(str)).epoch
    	);

    	let colors = {
    		miller: "#C4ABAB",
    		ford: "#D68881",
    		tory1: "#8BA3A2",
    		tory2: "#9c896c"
    	};

    	const getTerm = str => {
    		if (str.match(/(200)/) && !str.match(/2009-(11|12)/)) {
    			return colors.miller;
    		} else if (str.match(/(2010|2011|2012|2013)/) && !str.match(/2013-(11|12)/)) {
    			return colors.miller;
    		} else if (str.match(/(2014|2015|2016|2017)/) && !str.match(/2017-(11|12)/)) {
    			return colors.ford;
    		} else if (str.match(/(2018|2019|2020|2021|2022)/) && !str.match(/2017-(11|12)/)) {
    			return colors.tory1;
    		}

    		return colors.tory2;
    	};

    	let rows = data.map(o => {
    		let start = xScale(o.start);
    		let issued = xScale(o.issued);
    		let done = xScale(o.completed);
    		let approved_term = getTerm(o.start || "");
    		let issued_term = getTerm(o.issued || "");

    		return {
    			yellow_start: start,
    			yellow_width: issued - start,
    			blue_start: issued,
    			blue_width: done - issued,
    			completed: o.completed,
    			units: o.units,
    			address: o.address,
    			approved_term: "#D68881",
    			issued_term: "#8BA3A2",
    			done
    		};
    	});

    	rows = rows.filter(o => o.units > 4);

    	rows = rows.sort((a, b) => {
    		if (a.done > b.done) {
    			return -1;
    		} else if (a.done < b.done) {
    			return 1;
    		}

    		return 0;
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		data,
    		spacetime: main$1,
    		scale: scaleLinear,
    		start,
    		end,
    		xScale,
    		colors,
    		getTerm,
    		rows
    	});

    	$$self.$inject_state = $$props => {
    		if ("start" in $$props) start = $$props.start;
    		if ("end" in $$props) end = $$props.end;
    		if ("xScale" in $$props) $$invalidate(1, xScale = $$props.xScale);
    		if ("colors" in $$props) colors = $$props.colors;
    		if ("rows" in $$props) $$invalidate(0, rows = $$props.rows);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [rows, xScale];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-tt4o6j-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment.name
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
