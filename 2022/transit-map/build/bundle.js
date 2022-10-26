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

    let blues = ["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#14568f", '#164770', "#375a87"];
    let reds = ['#cc6966', '#cc6966', '#D68881', '#AB5850'];
    let soon = '#e6b3bc';
    const colors = {
      "Spadina-Fort York": blues[4],
      "Toronto Centre": blues[6],
      "University-Rosedale": blues[7],//12
      "Toronto-St. Paul's": blues[6],
      "Davenport": blues[3],
      "Parkdale-High Park": blues[5],
      "Toronto-Danforth": blues[6],
      "Willowdale": blues[3],
      "Eglinton-Lawrence": blues[5],
      "Don Valley North": blues[4],
      "Beaches-East York": blues[3],
      "York South-Weston": '#4292c6',//blues[3],
      "York Centre": '#70a5c4',//blues[3],
      "Don Valley West": blues[4],
      "Don Valley East": blues[5],
      "Etobicoke-Lakeshore": blues[4],
      "Etobicoke Centre": reds[3],
      "Etobicoke North": reds[2],
      "Humber River-Black Creek": blues[3],
      "Scarborough Southwest": blues[6],
      "Scarborough-Rouge Park": reds[1],
      "Scarborough Centre": soon,
      "Scarborough-Guildwood": reds[2],
      "Scarborough-Agincourt": reds[2],
      "Scarborough North": reds[3],
    };
    const heights = {
      "Spadina-Fort York": 0.1,
      "Toronto Centre": 0.4,
      "University-Rosedale": 0.3,
      "Toronto-St. Paul's": 0.3,
      "Davenport": 0.3,
      "Parkdale-High Park": 0.2,
      "Toronto-Danforth": 0.1,
      "Willowdale": 0.3,
      "Eglinton-Lawrence": 0.3,
      "Beaches-East York": 0.1,
      "York South-Weston": 0.1,
      "York Centre": 0.1,
      "Don Valley North": 0.3,
      "Don Valley West": 0.1,
      "Don Valley East": 0.3,
      "Etobicoke-Lakeshore": 0.1,
      "Etobicoke Centre": 0.3,
      "Etobicoke North": 0.5,
      "Humber River-Black Creek": 0.3,
      "Scarborough Southwest": 0.1,
      "Scarborough-Rouge Park": 0.2,
      "Scarborough Centre": 0.3,
      "Scarborough-Guildwood": 0.4,
      "Scarborough-Agincourt": 0.1,
      "Scarborough North": 0.4,
    };


    let data = {
      "type": "FeatureCollection", "features": [
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.5078301632192, 43.717755170299], [-79.513221023395, 43.7393893286881], [-79.510381238191, 43.739526260413], [-79.497023646026, 43.7425188149772], [-79.4978842288617, 43.7435970086561], [-79.4979603830721, 43.7459123558268], [-79.5019292009025, 43.7471239025161], [-79.5047368055003, 43.7491526746467], [-79.497769710548, 43.75049213921], [-79.494908422866, 43.7521753532944], [-79.4917305581402, 43.7530207672587], [-79.4894699236512, 43.7518257800638], [-79.4881735629245, 43.7520237517077], [-79.4945741214528, 43.7774193374245], [-79.4945063595238, 43.7815790749568], [-79.5170107512026, 43.7763624451289], [-79.5647842958979, 43.7665453900781], [-79.5806438818039, 43.7630179182296], [-79.5792491647708, 43.7622086612556], [-79.5806227685616, 43.7603638887415], [-79.5807665880169, 43.7589271435657], [-79.5838189764281, 43.7586957215887], [-79.5852117269988, 43.7564970328686], [-79.5831251031601, 43.7537221327563], [-79.583102609624, 43.7527494886288], [-79.5782702914092, 43.7504831390866], [-79.5755216981474, 43.7500302744664], [-79.5732689816388, 43.7503607707071], [-79.5733424684195, 43.7480032180334], [-79.5724664347146, 43.7468404067294], [-79.56522093938261, 43.7456791861558], [-79.5621660109076, 43.7440740642195], [-79.56189799115661, 43.7427018485814], [-79.5543721603638, 43.7432222920798], [-79.5512095828039, 43.7442382435337], [-79.5504066872699, 43.7425407464228], [-79.5476142499566, 43.7417338956159], [-79.546182744285, 43.7400547206654], [-79.5505592625798, 43.736403863062], [-79.5500146986765, 43.733302576651], [-79.543219136828, 43.729920155544], [-79.5388639145477, 43.7292601735004], [-79.5382294635565, 43.7272575309714], [-79.5408657326509, 43.726126900147], [-79.5412725103929, 43.7249250431239], [-79.5407877210953, 43.7222652771005], [-79.5422656109076, 43.7209685513827], [-79.5440354676611, 43.718033394111], [-79.5436508592293, 43.7171513376391], [-79.5406879163732, 43.7165358356898], [-79.5407375276308, 43.7153565722686], [-79.5382066350366, 43.7145787923277], [-79.5378418799993, 43.7129901010899], [-79.5247120595825, 43.7159100930063], [-79.5078301632192, 43.717755170299]]] }, "properties": { "_id": 701, "AREA_ID": 2457740, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993196, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 7, "AREA_LONG_CODE": 7, "AREA_NAME": "Humber River-Black Creek", "AREA_DESC": "Humber River-Black Creek (7)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344785, "Shape__Area": 58868732.515625, "Shape__Length": 43438.9430476219 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4114492180327, 43.751653633058], [-79.4156929234726, 43.7517524347681], [-79.4161842944729, 43.7505779593249], [-79.4201280705346, 43.74931158657851], [-79.4222907421622, 43.7496097660865], [-79.4234706383109, 43.7513097372232], [-79.4280572742622, 43.7541313787285], [-79.4301124189409, 43.7573756131494], [-79.432982086036, 43.7571882977582], [-79.4352580703734, 43.7588637140975], [-79.4377072311299, 43.75903151614], [-79.437613622935, 43.7601971549839], [-79.4399843054519, 43.7615576575323], [-79.4414485315034, 43.7677016776661], [-79.4466552188864, 43.788262865416804], [-79.4454403678408, 43.7905665841201], [-79.44575516760682, 43.792407466692], [-79.4631884218653, 43.7886477313178], [-79.4700896742123, 43.7872832010882], [-79.4945063595238, 43.7815790749568], [-79.4945741214528, 43.7774193374245], [-79.4881735629245, 43.7520237517077], [-79.4894699236512, 43.7518257800638], [-79.4917305581402, 43.7530207672587], [-79.494908422866, 43.7521753532944], [-79.497769710548, 43.75049213921], [-79.5047368055003, 43.7491526746467], [-79.5019292009025, 43.7471239025161], [-79.4979603830721, 43.7459123558268], [-79.4978842288617, 43.7435970086561], [-79.497023646026, 43.7425188149772], [-79.510381238191, 43.739526260413], [-79.513221023395, 43.7393893286881], [-79.5078301632192, 43.717755170299], [-79.5020820091586, 43.7184122410568], [-79.4914106264141, 43.720290147594], [-79.4725666844142, 43.7248699022048], [-79.4437087383412, 43.7311183624022], [-79.4399231952323, 43.7325258213692], [-79.4266625320039, 43.7403069953391], [-79.4176528567426, 43.7462370430891], [-79.4153777629284, 43.748865642121906], [-79.4114492180327, 43.751653633058]]] }, "properties": { "_id": 702, "AREA_ID": 2457739, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993195, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 6, "AREA_LONG_CODE": 6, "AREA_NAME": "York Centre", "AREA_DESC": "York Centre (6)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344801, "Shape__Area": 67805388.546875, "Shape__Length": 40910.1746192152 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.408388704346, 43.7536163537944], [-79.3986662636602, 43.7597200744556], [-79.3933248375784, 43.7619333312937], [-79.38715209799, 43.763311731433106], [-79.3880562118249, 43.7665892748458], [-79.3921089600341, 43.7847640261134], [-79.3935963878887, 43.7922977653692], [-79.39623005788661, 43.8032701311798], [-79.426378474157, 43.7966223806342], [-79.44575516760682, 43.792407466692], [-79.4454403678408, 43.7905665841201], [-79.4466552188864, 43.788262865416804], [-79.4414485315034, 43.7677016776661], [-79.4399843054519, 43.7615576575323], [-79.437613622935, 43.7601971549839], [-79.4377072311299, 43.75903151614], [-79.4352580703734, 43.7588637140975], [-79.432982086036, 43.7571882977582], [-79.4301124189409, 43.7573756131494], [-79.4280572742622, 43.7541313787285], [-79.4234706383109, 43.7513097372232], [-79.4222907421622, 43.7496097660865], [-79.4201280705346, 43.74931158657851], [-79.4161842944729, 43.7505779593249], [-79.4156929234726, 43.7517524347681], [-79.4114492180327, 43.751653633058], [-79.408388704346, 43.7536163537944]]] }, "properties": { "_id": 703, "AREA_ID": 2457738, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993194, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 18, "AREA_LONG_CODE": 18, "AREA_NAME": "Willowdale", "AREA_DESC": "Willowdale (18)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344817, "Shape__Area": 37926494.109375, "Shape__Length": 24766.996983523597 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.3848473659846, 43.6940268867582], [-79.3891249054345, 43.6931049639157], [-79.38874183639071, 43.6917249723705], [-79.3909188985912, 43.6913013363369], [-79.3897761640267, 43.6897844397294], [-79.3866459126664, 43.6877014211196], [-79.3907253918597, 43.6867926166736], [-79.3902572917164, 43.68559309553601], [-79.3928542300674, 43.6850259296234], [-79.391194825918, 43.681081122778], [-79.3984396599047, 43.6777672851479], [-79.4015776356744, 43.676667386558], [-79.4218189621437, 43.6724249826802], [-79.4293964137968, 43.670972707104006], [-79.425659480152, 43.6619849168039], [-79.4207821526692, 43.6493340834881], [-79.4053616100253, 43.6523649340544], [-79.4037475308531, 43.6517410074764], [-79.3914607906137, 43.6543333741155], [-79.3837661930223, 43.6557159692698], [-79.3809264046243, 43.6563287749711], [-79.3831103705459, 43.6613718103314], [-79.3858549461133, 43.6608156633898], [-79.38886911734551, 43.6681966792186], [-79.3799057240718, 43.6699739729667], [-79.379468072457, 43.6718257155842], [-79.3771450315158, 43.673147823563], [-79.3704029794067, 43.6726681873031], [-79.3677565359953, 43.6716872883271], [-79.365865786904, 43.6716443633414], [-79.361707163492, 43.6702394044539], [-79.3597108499133, 43.6704618791026], [-79.3605255527314, 43.6719707333508], [-79.3629509953311, 43.6732428267766], [-79.3633907880318, 43.6753226406503], [-79.3649564974, 43.6767286258956], [-79.3637314492195, 43.67879746595711], [-79.3663684190196, 43.6813973948914], [-79.3620935417814, 43.6843735329363], [-79.3616529398897, 43.6855353030927], [-79.3621680058351, 43.6884665602725], [-79.3637594621279, 43.68892782246921], [-79.3619867207247, 43.6912450061215], [-79.3634683206274, 43.693486622295], [-79.3668785003559, 43.6943545165468], [-79.3708543515811, 43.6906295716362], [-79.3739589544036, 43.6923556869459], [-79.3813532167439, 43.6950870228904], [-79.3848473659846, 43.6940268867582]]] }, "properties": { "_id": 704, "AREA_ID": 2457737, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993193, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 11, "AREA_LONG_CODE": 11, "AREA_NAME": "University-Rosedale", "AREA_DESC": "University-Rosedale (11)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344833, "Shape__Area": 26002990.5859375, "Shape__Length": 29861.631463743797 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.2790326884178, 43.6716713902779], [-79.2818987803938, 43.6783412103258], [-79.283155233091, 43.6786372685676], [-79.290959064225, 43.6976556809163], [-79.2922231987733, 43.700106982489906], [-79.3005925599442, 43.719785826787], [-79.3195020581948, 43.7156321727074], [-79.3206527784705, 43.7134421147331], [-79.3185750144187, 43.7115079752649], [-79.3209553699854, 43.7102875657469], [-79.324850658126, 43.7095710783109], [-79.32625526402691, 43.7082184142758], [-79.3285240249072, 43.7077534322891], [-79.3301704617418, 43.7063617736705], [-79.3327837966381, 43.7053101014183], [-79.3330914324973, 43.7033709024658], [-79.3313033230546, 43.7016569817106], [-79.32709986130472, 43.701504367047], [-79.3295965399394, 43.6982704634436], [-79.32559525655701, 43.6880499516796], [-79.3148681478337, 43.6622739414704], [-79.31492459201341, 43.6619658989816], [-79.3120473255335, 43.6588006888104], [-79.3049931280337, 43.6568923429502], [-79.3064212627985, 43.6605940802713], [-79.3050061241604, 43.6630172663929], [-79.3033770878132, 43.6645480698745], [-79.2993210596661, 43.6656656572019], [-79.2969575800859, 43.6653380026416], [-79.2935318954764, 43.6672889364751], [-79.2886115523924, 43.6686282888689], [-79.2855857345591, 43.6698323419322], [-79.2827944266321, 43.6701298498383], [-79.2790326884178, 43.6716713902779]]] }, "properties": { "_id": 705, "AREA_ID": 2457736, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993192, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 19, "AREA_LONG_CODE": 19, "AREA_NAME": "Beaches-East York", "AREA_DESC": "Beaches-East York (19)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344849, "Shape__Area": 32155032.5859375, "Shape__Length": 30975.8780338131 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.2790326884178, 43.6716713902779], [-79.277736779687, 43.6719770292296], [-79.2765828285787, 43.673926410401], [-79.2708275794281, 43.6797592385031], [-79.2672783408323, 43.6838827140223], [-79.2637804438524, 43.6866460230398], [-79.2599685400992, 43.6905939542028], [-79.25777119808261, 43.6934298205664], [-79.2556045511247, 43.6950622999596], [-79.2438675477254, 43.70039069165221], [-79.2431494328894, 43.7019064165019], [-79.2394306322993, 43.7036690543769], [-79.2385762620681, 43.7046428864531], [-79.2357783535717, 43.7044886163378], [-79.233106007531, 43.7058652459833], [-79.2319385051203, 43.7048932662665], [-79.2298167983503, 43.7058745850074], [-79.2334367253041, 43.7075882482497], [-79.2330236649682, 43.70933261149501], [-79.2294353013807, 43.7125532503045], [-79.2260084984359, 43.7126916729709], [-79.2235474682073, 43.71802622711011], [-79.2205130785049, 43.7210864818528], [-79.2176941683912, 43.7217840727941], [-79.2161673880067, 43.7243729552579], [-79.2151283833658, 43.7249337310274], [-79.2127612905359, 43.7280935596794], [-79.2147584726277, 43.7333740285108], [-79.2189135347958, 43.7431820122067], [-79.2286728302396, 43.7410178693341], [-79.2437417303308, 43.7376320226885], [-79.2591712432005, 43.734307901948], [-79.2712101564479, 43.7314341033418], [-79.301254497822, 43.72483768628171], [-79.3026450183565, 43.7247230254748], [-79.3005925599442, 43.719785826787], [-79.2922231987733, 43.700106982489906], [-79.290959064225, 43.6976556809163], [-79.283155233091, 43.6786372685676], [-79.2818987803938, 43.6783412103258], [-79.2790326884178, 43.6716713902779]]] }, "properties": { "_id": 706, "AREA_ID": 2457735, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993191, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 20, "AREA_LONG_CODE": 20, "AREA_NAME": "Scarborough Southwest", "AREA_DESC": "Scarborough Southwest (20)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344865, "Shape__Area": 53987872.90625, "Shape__Length": 45132.3461099565 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.1792029490005, 43.7518781562957], [-79.1750729064925, 43.7540753195705], [-79.167280471169, 43.7568344755552], [-79.1589754605121, 43.7586939816235], [-79.1532276665619, 43.7591027223883], [-79.1515157201078, 43.7601541281865], [-79.1464086955008, 43.7657394244667], [-79.1416685222578, 43.7690561740581], [-79.1373394292113, 43.7715219891907], [-79.1337901643696, 43.7758453508084], [-79.1291180836339, 43.7804869407756], [-79.1268904770031, 43.7822359129713], [-79.1237563247688, 43.785405507824606], [-79.1227904069074, 43.787226368542], [-79.1211751263664, 43.7884908071682], [-79.1202810873384, 43.7910139270796], [-79.1169525370164, 43.7941716578235], [-79.1193212413309, 43.7947972112552], [-79.121932277766, 43.7974029991345], [-79.1243552741194, 43.7977321396357], [-79.1242266730957, 43.7990102268028], [-79.1255725741139, 43.8002169322739], [-79.127683111259, 43.8002863669536], [-79.1302314083948, 43.8016077407289], [-79.1337707984169, 43.8027165169259], [-79.1343907542408, 43.8044286769497], [-79.1340371751162, 43.8067930634637], [-79.1355874892799, 43.8079231463636], [-79.1370503040589, 43.8077117657374], [-79.1406399326833, 43.8084476619858], [-79.1428768045716, 43.8100782474371], [-79.146095795582, 43.8100667120699], [-79.1482264905451, 43.812319622569], [-79.1494726812546, 43.8124794315347], [-79.1521581508901, 43.8146850290788], [-79.152795994535, 43.8167212606017], [-79.1554974647575, 43.8225805471385], [-79.1659064612318, 43.8459082109445], [-79.1702915177967, 43.8554571861712], [-79.2044977667187, 43.847253686673], [-79.2278142704233, 43.8420905838785], [-79.2261796095168, 43.839809456890904], [-79.2226261230132, 43.8384643204549], [-79.2220597545012, 43.83630719029801], [-79.2239800202871, 43.8353126631789], [-79.2236350248054, 43.833772647193], [-79.2214794148288, 43.8323048126031], [-79.2196088088061, 43.832493788485], [-79.2175231260072, 43.830379278518], [-79.2322978138953, 43.8257250560645], [-79.2301429534698, 43.8230341463964], [-79.230539321233, 43.8217479894662], [-79.225745726855, 43.8122196586578], [-79.2247171138135, 43.81074930396441], [-79.2195339246432, 43.8077119793511], [-79.2175470088073, 43.8050712191431], [-79.217285815342, 43.8031624542912], [-79.2183727997375, 43.8004403737787], [-79.215721815678, 43.7936789796981], [-79.2134014102026, 43.79414450169071], [-79.1970100599685, 43.7965219057717], [-79.1958756800204, 43.792811229356], [-79.193767105969, 43.7879884890298], [-79.1935841293527, 43.7859175384586], [-79.1898661329994, 43.7771014707958], [-79.1863354125094, 43.769240509847], [-79.1860023082925, 43.7674542583898], [-79.1792029490005, 43.7518781562957]]] }, "properties": { "_id": 707, "AREA_ID": 2457734, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993190, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 25, "AREA_LONG_CODE": 25, "AREA_NAME": "Scarborough-Rouge Park", "AREA_DESC": "Scarborough-Rouge Park (25)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344881, "Shape__Area": 103900635.804688, "Shape__Length": 52384.382993714404 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.215721815678, 43.7936789796981], [-79.2183727997375, 43.8004403737787], [-79.217285815342, 43.8031624542912], [-79.2175470088073, 43.8050712191431], [-79.2195339246432, 43.8077119793511], [-79.2247171138135, 43.81074930396441], [-79.225745726855, 43.8122196586578], [-79.230539321233, 43.8217479894662], [-79.2301429534698, 43.8230341463964], [-79.2322978138953, 43.8257250560645], [-79.2175231260072, 43.830379278518], [-79.2196088088061, 43.832493788485], [-79.2214794148288, 43.8323048126031], [-79.2236350248054, 43.833772647193], [-79.2239800202871, 43.8353126631789], [-79.2220597545012, 43.83630719029801], [-79.2226261230132, 43.8384643204549], [-79.2261796095168, 43.839809456890904], [-79.2278142704233, 43.8420905838785], [-79.2511891488379, 43.8365989872391], [-79.2973325288169, 43.8259504741618], [-79.2888003517962, 43.8070508608343], [-79.2866165944347, 43.804463521110605], [-79.2791092392982, 43.7867802672807], [-79.277177685215, 43.7830835998816], [-79.2747764602797, 43.7772824387948], [-79.2690559158931, 43.7785026331619], [-79.2549798538438, 43.781222537134], [-79.2478246126028, 43.782570035916706], [-79.2404588438344, 43.7841995865015], [-79.2318755307811, 43.78663586080171], [-79.227618028048, 43.788212802607], [-79.2220367231067, 43.7913090054401], [-79.215721815678, 43.7936789796981]]] }, "properties": { "_id": 708, "AREA_ID": 2457733, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993189, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 23, "AREA_LONG_CODE": 23, "AREA_NAME": "Scarborough North", "AREA_DESC": "Scarborough North (23)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344897, "Shape__Area": 58475793.5898438, "Shape__Length": 33292.5789433519 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.1792029490005, 43.7518781562957], [-79.1860023082925, 43.7674542583898], [-79.1863354125094, 43.769240509847], [-79.1898661329994, 43.7771014707958], [-79.1935841293527, 43.7859175384586], [-79.193767105969, 43.7879884890298], [-79.1958756800204, 43.792811229356], [-79.1970100599685, 43.7965219057717], [-79.2134014102026, 43.79414450169071], [-79.215721815678, 43.7936789796981], [-79.2220367231067, 43.7913090054401], [-79.227618028048, 43.788212802607], [-79.2318755307811, 43.78663586080171], [-79.2404588438344, 43.7841995865015], [-79.2478246126028, 43.782570035916706], [-79.2549798538438, 43.781222537134], [-79.2518721140703, 43.7736494692383], [-79.2513322064066, 43.7716015931157], [-79.2456368361459, 43.7568721620127], [-79.2454227767629, 43.755548528507106], [-79.2352672256062, 43.7577217927048], [-79.2353034268332, 43.7566060172556], [-79.2286728302396, 43.7410178693341], [-79.2189135347958, 43.7431820122067], [-79.2147584726277, 43.7333740285108], [-79.2127612905359, 43.7280935596794], [-79.2098135457344, 43.7306513118465], [-79.2075945150275, 43.7333466637968], [-79.20523862580481, 43.7348380111742], [-79.2023764556137, 43.7357322646344], [-79.1975442710124, 43.739144651501], [-79.195842819855, 43.7412311364137], [-79.1886883316032, 43.74684509944401], [-79.1880360723065, 43.7468377942982], [-79.1792029490005, 43.7518781562957]]] }, "properties": { "_id": 709, "AREA_ID": 2457732, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993188, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 24, "AREA_LONG_CODE": 24, "AREA_NAME": "Scarborough-Guildwood", "AREA_DESC": "Scarborough-Guildwood (24)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344913, "Shape__Area": 50102587.5664063, "Shape__Length": 31659.0590874056 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.2286728302396, 43.7410178693341], [-79.2353034268332, 43.7566060172556], [-79.2352672256062, 43.7577217927048], [-79.2454227767629, 43.755548528507106], [-79.2456368361459, 43.7568721620127], [-79.2513322064066, 43.7716015931157], [-79.2518721140703, 43.7736494692383], [-79.2549798538438, 43.781222537134], [-79.2690559158931, 43.7785026331619], [-79.2747764602797, 43.7772824387948], [-79.3100686334796, 43.7690841321655], [-79.315906667163, 43.7683843471083], [-79.3197941465542, 43.7683633049312], [-79.3152454343223, 43.7578694237401], [-79.3093483452118, 43.7409191071266], [-79.3026450183565, 43.7247230254748], [-79.301254497822, 43.72483768628171], [-79.2712101564479, 43.7314341033418], [-79.2591712432005, 43.734307901948], [-79.2437417303308, 43.7376320226885], [-79.2286728302396, 43.7410178693341]]] }, "properties": { "_id": 710, "AREA_ID": 2457731, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993187, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 21, "AREA_LONG_CODE": 21, "AREA_NAME": "Scarborough Centre", "AREA_DESC": "Scarborough Centre (21)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344929, "Shape__Area": 54085225.4570313, "Shape__Length": 31081.9504946095 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.3197941465542, 43.7683633049312], [-79.315906667163, 43.7683843471083], [-79.3100686334796, 43.7690841321655], [-79.2747764602797, 43.7772824387948], [-79.277177685215, 43.7830835998816], [-79.2791092392982, 43.7867802672807], [-79.2866165944347, 43.804463521110605], [-79.2888003517962, 43.8070508608343], [-79.2973325288169, 43.8259504741618], [-79.3413178929128, 43.81565075423731], [-79.3384124880604, 43.8087513966747], [-79.3318284859423, 43.7940161724994], [-79.3197941465542, 43.7683633049312]]] }, "properties": { "_id": 711, "AREA_ID": 2457730, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993186, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 22, "AREA_LONG_CODE": 22, "AREA_NAME": "Scarborough-Agincourt", "AREA_DESC": "Scarborough-Agincourt (22)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344945, "Shape__Area": 41093408.3320313, "Shape__Length": 25980.7020486281 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.3346939799612, 43.7030774853307], [-79.3337099880079, 43.7066408323834], [-79.3343949847785, 43.7099964553998], [-79.3379109060016, 43.7088807115245], [-79.3402897783158, 43.7116957492328], [-79.3466048259545, 43.716058226541], [-79.3489195159251, 43.7163104551611], [-79.3504272110557, 43.7184804800259], [-79.3488224387122, 43.7236079101053], [-79.3499549896187, 43.72619818663501], [-79.3522331577934, 43.7281418305163], [-79.355272524315, 43.731730217815], [-79.3568836019381, 43.7383123947843], [-79.3619159069717, 43.7616917468028], [-79.3619440085579, 43.7645558308108], [-79.3629278029548, 43.7663407333661], [-79.3715811133045, 43.7659373594165], [-79.3797418238159, 43.7648736927255], [-79.38715209799, 43.763311731433106], [-79.3933248375784, 43.7619333312937], [-79.3986662636602, 43.7597200744556], [-79.408388704346, 43.7536163537944], [-79.4081097503073, 43.7497935450057], [-79.4070357719152, 43.7456878291731], [-79.4045311142273, 43.7341706849335], [-79.4021952907712, 43.7251017926697], [-79.3989974316929, 43.7095833507147], [-79.3912268870284, 43.711128749686], [-79.3870311308924, 43.7005063734658], [-79.3848473659846, 43.6940268867582], [-79.3813532167439, 43.6950870228904], [-79.3739589544036, 43.6923556869459], [-79.3708543515811, 43.6906295716362], [-79.3668785003559, 43.6943545165468], [-79.3634683206274, 43.693486622295], [-79.3619867207247, 43.6912450061215], [-79.3637594621279, 43.68892782246921], [-79.3621680058351, 43.6884665602725], [-79.3600546991794, 43.6912922992574], [-79.3616687237251, 43.6941791963243], [-79.3599967328217, 43.6953068405967], [-79.3569281630571, 43.6954248824872], [-79.3550205923027, 43.6980465430698], [-79.3510982916581, 43.6988703032065], [-79.3501239659486, 43.6998628344381], [-79.344452660439, 43.698264442969], [-79.3404848838388, 43.6999898584467], [-79.3390873109582, 43.701261139675], [-79.3354178284738, 43.7031996690207], [-79.3346939799612, 43.7030774853307]]] }, "properties": { "_id": 712, "AREA_ID": 2457729, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993185, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 15, "AREA_LONG_CODE": 15, "AREA_NAME": "Don Valley West", "AREA_DESC": "Don Valley West (15)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344961, "Shape__Area": 58048830.4765625, "Shape__Length": 37532.8144065602 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4293964137968, 43.670972707104006], [-79.4218189621437, 43.6724249826802], [-79.4015776356744, 43.676667386558], [-79.3984396599047, 43.6777672851479], [-79.391194825918, 43.681081122778], [-79.3928542300674, 43.6850259296234], [-79.3902572917164, 43.68559309553601], [-79.3907253918597, 43.6867926166736], [-79.3866459126664, 43.6877014211196], [-79.3897761640267, 43.6897844397294], [-79.3909188985912, 43.6913013363369], [-79.38874183639071, 43.6917249723705], [-79.3891249054345, 43.6931049639157], [-79.3848473659846, 43.6940268867582], [-79.3870311308924, 43.7005063734658], [-79.3912268870284, 43.711128749686], [-79.3989974316929, 43.7095833507147], [-79.3983665000037, 43.7067319904649], [-79.4383244817957, 43.698276523348305], [-79.4502789805454, 43.6956920028916], [-79.4461172265153, 43.6855663935808], [-79.4386937707147, 43.6871340019649], [-79.4382584452398, 43.6863629590337], [-79.4346396357324, 43.6870982979164], [-79.4326971769691, 43.6807965882232], [-79.4302261813582, 43.6747352755612], [-79.4293964137968, 43.670972707104006]]] }, "properties": { "_id": 713, "AREA_ID": 2457728, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993184, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 12, "AREA_LONG_CODE": 12, "AREA_NAME": "Toronto-St. Paul's", "AREA_DESC": "Toronto-St. Paul's (12)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344977, "Shape__Area": 25109621.808593802, "Shape__Length": 23816.299191398302 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4600458827451, 43.6672259620873], [-79.4749769499394, 43.6672932419678], [-79.50562352908182, 43.66547434106781], [-79.50998125987792, 43.6643262829786], [-79.5122116343354, 43.6626336614198], [-79.51024739127061, 43.6619363043415], [-79.507087751107, 43.6629133065681], [-79.5055219916522, 43.6628054218342], [-79.4995196790461, 43.6586875469094], [-79.5000256761463, 43.6571662838643], [-79.5026906701104, 43.6547988064916], [-79.5027792636753, 43.6532145747912], [-79.5003399235002, 43.6521705405961], [-79.4966463840316, 43.6519769626991], [-79.4930575046471, 43.6522603798781], [-79.4914956669504, 43.6516256785584], [-79.4910228324512, 43.6496812854456], [-79.49276980587, 43.6471188378476], [-79.4927043168302, 43.6459030909994], [-79.4891046937299, 43.6412077969294], [-79.486662788906, 43.642025160026], [-79.48498957077521, 43.6417367915592], [-79.4848333120482, 43.6384761119348], [-79.48247869169431, 43.6379682954638], [-79.4788468502256, 43.6381194083997], [-79.4774989205305, 43.6377333518459], [-79.4754993659415, 43.6341070392367], [-79.4712285274822, 43.631699270778], [-79.4678325804732, 43.63413440251771], [-79.4639120891753, 43.6357057922048], [-79.4578993565609, 43.63717593921311], [-79.4552313714824, 43.6374782990929], [-79.4525925455566, 43.6367268170047], [-79.4476412898037, 43.6365328910426], [-79.4432248569311, 43.6347150777054], [-79.4411410113958, 43.6348739964159], [-79.4393578345295, 43.6332300232549], [-79.4334849415635, 43.630825366193], [-79.4277754764607, 43.629793474517], [-79.4287065660649, 43.6329132750031], [-79.42542438496672, 43.6338795502891], [-79.4286441986526, 43.6422084224097], [-79.4282100821178, 43.6423113693663], [-79.4388843845511, 43.6473035501615], [-79.44404972012, 43.6509155885405], [-79.4600458827451, 43.6672259620873]]] }, "properties": { "_id": 714, "AREA_ID": 2457727, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993183, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 4, "AREA_LONG_CODE": 4, "AREA_NAME": "Parkdale-High Park", "AREA_DESC": "Parkdale-High Park (4)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17344993, "Shape__Area": 29293133.5976563, "Shape__Length": 28220.033151902597 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.5378418799993, 43.7129901010899], [-79.5382066350366, 43.7145787923277], [-79.5407375276308, 43.7153565722686], [-79.5406879163732, 43.7165358356898], [-79.5436508592293, 43.7171513376391], [-79.5440354676611, 43.718033394111], [-79.5422656109076, 43.7209685513827], [-79.5407877210953, 43.7222652771005], [-79.5412725103929, 43.7249250431239], [-79.5408657326509, 43.726126900147], [-79.5382294635565, 43.7272575309714], [-79.5388639145477, 43.7292601735004], [-79.543219136828, 43.729920155544], [-79.5500146986765, 43.733302576651], [-79.5505592625798, 43.736403863062], [-79.546182744285, 43.7400547206654], [-79.5476142499566, 43.7417338956159], [-79.5504066872699, 43.7425407464228], [-79.5512095828039, 43.7442382435337], [-79.5543721603638, 43.7432222920798], [-79.56189799115661, 43.7427018485814], [-79.5621660109076, 43.7440740642195], [-79.56522093938261, 43.7456791861558], [-79.5724664347146, 43.7468404067294], [-79.5733424684195, 43.7480032180334], [-79.5732689816388, 43.7503607707071], [-79.5755216981474, 43.7500302744664], [-79.5782702914092, 43.7504831390866], [-79.583102609624, 43.7527494886288], [-79.5831251031601, 43.7537221327563], [-79.5852117269988, 43.7564970328686], [-79.5838189764281, 43.7586957215887], [-79.5807665880169, 43.7589271435657], [-79.5806227685616, 43.7603638887415], [-79.5792491647708, 43.7622086612556], [-79.5806438818039, 43.7630179182296], [-79.6020523373788, 43.7581532282044], [-79.631721857084, 43.7515094653301], [-79.6352527965954, 43.7512343784588], [-79.6392649324429, 43.7498707479426], [-79.6376119524667, 43.7483009597757], [-79.6356625935042, 43.7446205357672], [-79.6303547109175, 43.7354695478806], [-79.6278393000436, 43.7332549005057], [-79.626322420991, 43.7290342707815], [-79.6191476713094, 43.7162516271379], [-79.6132234260489, 43.706271070269], [-79.6072497398261, 43.696924267763], [-79.60219054037671, 43.6877974496568], [-79.6001496835619, 43.6851074430882], [-79.5999540271655, 43.6837251306252], [-79.5947473748081, 43.6750176692098], [-79.5945516762254, 43.6742113487651], [-79.5910867990462, 43.6685878284164], [-79.583665164003, 43.6713403830692], [-79.5819082034639, 43.6722567123934], [-79.5676823599195, 43.6741859581037], [-79.5631767235789, 43.6744777585563], [-79.5708382592862, 43.69159248871011], [-79.5640038673633, 43.6930280676695], [-79.5487565947864, 43.6966211442977], [-79.5259742600834, 43.7015979484891], [-79.526091989064, 43.7016506151712], [-79.5285699277462, 43.7024152124689], [-79.5311573120798, 43.7047826284806], [-79.5359612062898, 43.7045893739186], [-79.5356588659721, 43.7078940159504], [-79.5389018828899, 43.7089999793716], [-79.5395981412305, 43.7107121143573], [-79.5378418799993, 43.7129901010899]]] }, "properties": { "_id": 715, "AREA_ID": 2457726, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993182, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 1, "AREA_LONG_CODE": 1, "AREA_NAME": "Etobicoke North", "AREA_DESC": "Etobicoke North (1)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345009, "Shape__Area": 92641345.765625, "Shape__Length": 51338.9218600238 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4712285274822, 43.631699270778], [-79.4754993659415, 43.6341070392367], [-79.4774989205305, 43.6377333518459], [-79.4788468502256, 43.6381194083997], [-79.48247869169431, 43.6379682954638], [-79.4848333120482, 43.6384761119348], [-79.48498957077521, 43.6417367915592], [-79.486662788906, 43.642025160026], [-79.4891046937299, 43.6412077969294], [-79.4927043168302, 43.6459030909994], [-79.49276980587, 43.6471188378476], [-79.4910228324512, 43.6496812854456], [-79.4914956669504, 43.6516256785584], [-79.4930575046471, 43.6522603798781], [-79.4966463840316, 43.6519769626991], [-79.5003399235002, 43.6521705405961], [-79.5027792636753, 43.6532145747912], [-79.5026906701104, 43.6547988064916], [-79.5000256761463, 43.6571662838643], [-79.4995196790461, 43.6586875469094], [-79.5055219916522, 43.6628054218342], [-79.5082499120096, 43.661486263759706], [-79.5174834276711, 43.6578684023978], [-79.520208373706, 43.6506797589968], [-79.5224017400885, 43.6482693883743], [-79.5255610444464, 43.6505330994388], [-79.5289987624355, 43.6511714026723], [-79.5307372725108, 43.6508943726447], [-79.53240378264921, 43.65186821957371], [-79.5375193098668, 43.6529065729624], [-79.53816546635362, 43.6551521522389], [-79.5401566658913, 43.6548094726671], [-79.540476698974, 43.6535618079735], [-79.5353609571934, 43.64179494861], [-79.5450464411757, 43.6396728433821], [-79.5595857324343, 43.6362382298188], [-79.5567688031798, 43.6285327906689], [-79.5637603220542, 43.6270261958096], [-79.5636018205713, 43.6248884696888], [-79.5656115130545, 43.6240411931447], [-79.5656528881072, 43.621480206749304], [-79.56681892169, 43.6208674174729], [-79.5665102195911, 43.6179511046525], [-79.5678508018179, 43.6167801241472], [-79.56833903819171, 43.6145024481026], [-79.5677121756653, 43.613778197935], [-79.5648626840304, 43.61338380571771], [-79.5642159914611, 43.6122409814071], [-79.5671692674104, 43.6106647375411], [-79.5666447684118, 43.6086794290846], [-79.5648729052982, 43.6072177522052], [-79.5626406853583, 43.6067194807543], [-79.5592627567759, 43.6047545319023], [-79.556311083331, 43.6025686391816], [-79.5558334280694, 43.5999854335394], [-79.5534845101654, 43.5979027856554], [-79.5539542240828, 43.5963318397424], [-79.5529669840787, 43.5954187085046], [-79.549114722288, 43.5951603855203], [-79.548768294082, 43.59362481450031], [-79.5495470658683, 43.5906173371568], [-79.5464074329289, 43.5889304044527], [-79.54815794509442, 43.5869967340056], [-79.54465152682852, 43.58527706857001], [-79.5438825698345, 43.581392216061], [-79.5398920097531, 43.58615266343731], [-79.5371092462848, 43.5880287129564], [-79.5340024505072, 43.5877891691677], [-79.5311094772172, 43.5885722378178], [-79.5292451471249, 43.5882351752002], [-79.5272325728757, 43.5896129134491], [-79.5198377456312, 43.5902130236246], [-79.5185660076543, 43.590720325244], [-79.516534537025, 43.5900875016782], [-79.51087196119582, 43.5910429198153], [-79.5105821639297, 43.593710959672], [-79.5023203057964, 43.5944852445522], [-79.5003889094817, 43.5953989235066], [-79.4995620170387, 43.5975323291697], [-79.4978630860199, 43.5985134674422], [-79.4979152216045, 43.6002102312135], [-79.4959517611735, 43.6019519390388], [-79.4930689710267, 43.602010363967], [-79.4894642485688, 43.6055296136714], [-79.4865353265029, 43.6096874983154], [-79.4870275385939, 43.6129517142637], [-79.484393670375, 43.6176339130496], [-79.48163157209521, 43.6187682656442], [-79.4788469134069, 43.6170904430837], [-79.4805478134712, 43.6156955078209], [-79.4799568917259, 43.6122883867298], [-79.475913311093, 43.6173802572409], [-79.4764794765642, 43.6188992824292], [-79.4803951138219, 43.6210724571131], [-79.4775433188162, 43.6215819162148], [-79.4770579072371, 43.6201055889248], [-79.4748211257673, 43.6201771654399], [-79.4727774689504, 43.6223325971224], [-79.4692274031704, 43.6229528836083], [-79.4706678931338, 43.6253296326039], [-79.4740613981299, 43.6225724950573], [-79.4768534994517, 43.6238961838694], [-79.474770036563, 43.6288378622763], [-79.4726066947335, 43.6296827843502], [-79.4712285274822, 43.631699270778]]] }, "properties": { "_id": 716, "AREA_ID": 2457725, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993181, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 3, "AREA_LONG_CODE": 3, "AREA_NAME": "Etobicoke-Lakeshore", "AREA_DESC": "Etobicoke-Lakeshore (3)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345025, "Shape__Area": 76412570.2265625, "Shape__Length": 60137.672264100496 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.5259742600834, 43.7015979484891], [-79.5487565947864, 43.6966211442977], [-79.5640038673633, 43.6930280676695], [-79.5708382592862, 43.69159248871011], [-79.5631767235789, 43.6744777585563], [-79.5676823599195, 43.6741859581037], [-79.5819082034639, 43.6722567123934], [-79.583665164003, 43.6713403830692], [-79.5910867990462, 43.6685878284164], [-79.5887784056154, 43.6646223420356], [-79.608734677802, 43.6464513180578], [-79.607683357736, 43.6449385261636], [-79.6033406409018, 43.6447127744638], [-79.5992188918142, 43.6436891537729], [-79.5956284959256, 43.6432061755429], [-79.5924526407722, 43.6447165267285], [-79.5887020135614, 43.64282473685691], [-79.5882173137965, 43.6414569121051], [-79.5852630927809, 43.6369585274457], [-79.5860533928455, 43.6354457118936], [-79.5851410858316, 43.6312157427427], [-79.5855901572194, 43.62891926008731], [-79.5805881674285, 43.6276096009698], [-79.5797062832202, 43.626921621341204], [-79.5745086881419, 43.6255299732179], [-79.5697949910604, 43.626982200484], [-79.5685857329421, 43.6267443953196], [-79.5668617232265, 43.62821715408], [-79.56479212432691, 43.6281598367137], [-79.5637603220542, 43.6270261958096], [-79.5567688031798, 43.6285327906689], [-79.5595857324343, 43.6362382298188], [-79.5450464411757, 43.6396728433821], [-79.5353609571934, 43.64179494861], [-79.540476698974, 43.6535618079735], [-79.5401566658913, 43.6548094726671], [-79.53816546635362, 43.6551521522389], [-79.5375193098668, 43.6529065729624], [-79.53240378264921, 43.65186821957371], [-79.5307372725108, 43.6508943726447], [-79.5289987624355, 43.6511714026723], [-79.5255610444464, 43.6505330994388], [-79.5224017400885, 43.6482693883743], [-79.520208373706, 43.6506797589968], [-79.5174834276711, 43.6578684023978], [-79.5082499120096, 43.661486263759706], [-79.5055219916522, 43.6628054218342], [-79.507087751107, 43.6629133065681], [-79.51024739127061, 43.6619363043415], [-79.5122116343354, 43.6626336614198], [-79.512986576215, 43.666544666736804], [-79.5112739940851, 43.6682776863479], [-79.5124395570694, 43.6735163028494], [-79.5120475763723, 43.6743219633395], [-79.5085201092123, 43.6767526014928], [-79.5072424624144, 43.67926859386441], [-79.5057624411482, 43.6802363734113], [-79.5057022156682, 43.68196003781], [-79.5084472907873, 43.6823647108813], [-79.5100111950506, 43.683516689263], [-79.5125522883929, 43.6888217984749], [-79.5132891036969, 43.6933839865311], [-79.5120285102376, 43.6960855846417], [-79.5135356370615, 43.6972481755086], [-79.5163391557657, 43.6968006881954], [-79.5188158132893, 43.6971218243443], [-79.5214336140373, 43.69986916779641], [-79.5255772442768, 43.7014203167337], [-79.5259742600834, 43.7015979484891]]] }, "properties": { "_id": 717, "AREA_ID": 2457724, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993180, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 2, "AREA_LONG_CODE": 2, "AREA_NAME": "Etobicoke Centre", "AREA_DESC": "Etobicoke Centre (2)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345041, "Shape__Area": 71410521.4023438, "Shape__Length": 45328.6431346332 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4646206444876, 43.6921556119541], [-79.4630531790546, 43.6928428599805], [-79.4502789805454, 43.6956920028916], [-79.4383244817957, 43.698276523348305], [-79.3983665000037, 43.7067319904649], [-79.3989974316929, 43.7095833507147], [-79.4021952907712, 43.7251017926697], [-79.4045311142273, 43.7341706849335], [-79.4070357719152, 43.7456878291731], [-79.4081097503073, 43.7497935450057], [-79.408388704346, 43.7536163537944], [-79.4114492180327, 43.751653633058], [-79.4153777629284, 43.748865642121906], [-79.4176528567426, 43.7462370430891], [-79.4266625320039, 43.7403069953391], [-79.4399231952323, 43.7325258213692], [-79.4437087383412, 43.7311183624022], [-79.4725666844142, 43.7248699022048], [-79.4688363649464, 43.706090340875704], [-79.4654991432383, 43.6939894890229], [-79.4646206444876, 43.6921556119541]]] }, "properties": { "_id": 718, "AREA_ID": 2457723, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993179, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 8, "AREA_LONG_CODE": 8, "AREA_NAME": "Eglinton-Lawrence", "AREA_DESC": "Eglinton-Lawrence (8)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345057, "Shape__Area": 43406745.9609375, "Shape__Length": 28793.624012969103 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.38715209799, 43.763311731433106], [-79.3797418238159, 43.7648736927255], [-79.3715811133045, 43.7659373594165], [-79.3629278029548, 43.7663407333661], [-79.3507455918096, 43.766896391932], [-79.32887196645511, 43.7682233010623], [-79.3197941465542, 43.7683633049312], [-79.3318284859423, 43.7940161724994], [-79.3384124880604, 43.8087513966747], [-79.3413178929128, 43.81565075423731], [-79.3725082420786, 43.8085079576189], [-79.39623005788661, 43.8032701311798], [-79.3935963878887, 43.7922977653692], [-79.3921089600341, 43.7847640261134], [-79.3880562118249, 43.7665892748458], [-79.38715209799, 43.763311731433106]]] }, "properties": { "_id": 719, "AREA_ID": 2457722, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993178, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 17, "AREA_LONG_CODE": 17, "AREA_NAME": "Don Valley North", "AREA_DESC": "Don Valley North (17)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345073, "Shape__Area": 46882591.9140625, "Shape__Length": 27888.8175228336 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.3330914324973, 43.7033709024658], [-79.3327837966381, 43.7053101014183], [-79.3301704617418, 43.7063617736705], [-79.3285240249072, 43.7077534322891], [-79.32625526402691, 43.7082184142758], [-79.324850658126, 43.7095710783109], [-79.3209553699854, 43.7102875657469], [-79.3185750144187, 43.7115079752649], [-79.3206527784705, 43.7134421147331], [-79.3195020581948, 43.7156321727074], [-79.3005925599442, 43.719785826787], [-79.3026450183565, 43.7247230254748], [-79.3093483452118, 43.7409191071266], [-79.3152454343223, 43.7578694237401], [-79.3197941465542, 43.7683633049312], [-79.32887196645511, 43.7682233010623], [-79.3507455918096, 43.766896391932], [-79.3629278029548, 43.7663407333661], [-79.3619440085579, 43.7645558308108], [-79.3619159069717, 43.7616917468028], [-79.3568836019381, 43.7383123947843], [-79.355272524315, 43.731730217815], [-79.3522331577934, 43.7281418305163], [-79.3499549896187, 43.72619818663501], [-79.3488224387122, 43.7236079101053], [-79.3504272110557, 43.7184804800259], [-79.3489195159251, 43.7163104551611], [-79.3466048259545, 43.716058226541], [-79.3402897783158, 43.7116957492328], [-79.3379109060016, 43.7088807115245], [-79.3343949847785, 43.7099964553998], [-79.3337099880079, 43.7066408323834], [-79.3346939799612, 43.7030774853307], [-79.3330914324973, 43.7033709024658]]] }, "properties": { "_id": 720, "AREA_ID": 2457721, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993177, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 16, "AREA_LONG_CODE": 16, "AREA_NAME": "Don Valley East", "AREA_DESC": "Don Valley East (16)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345089, "Shape__Area": 44017098.9648438, "Shape__Length": 30862.9870733169 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4293964137968, 43.670972707104006], [-79.4302261813582, 43.6747352755612], [-79.4326971769691, 43.6807965882232], [-79.4346396357324, 43.6870982979164], [-79.4382584452398, 43.6863629590337], [-79.4386937707147, 43.6871340019649], [-79.4461172265153, 43.6855663935808], [-79.4502789805454, 43.6956920028916], [-79.4630531790546, 43.6928428599805], [-79.4646206444876, 43.6921556119541], [-79.4629324999454, 43.6889762777141], [-79.4612985347611, 43.6832389166322], [-79.4676043950252, 43.6817118880485], [-79.4664530229404, 43.6806018741342], [-79.4705581756293, 43.6796952496402], [-79.4695233182969, 43.67687365058], [-79.4600458827451, 43.6672259620873], [-79.44404972012, 43.6509155885405], [-79.4388843845511, 43.6473035501615], [-79.4282100821178, 43.6423113693663], [-79.4226733486885, 43.6407054775233], [-79.4214164277034, 43.640820387101904], [-79.4247515152879, 43.6494378865496], [-79.4207821526692, 43.6493340834881], [-79.425659480152, 43.6619849168039], [-79.4293964137968, 43.670972707104006]]] }, "properties": { "_id": 721, "AREA_ID": 2457720, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993176, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 9, "AREA_LONG_CODE": 9, "AREA_NAME": "Davenport", "AREA_DESC": "Davenport (9)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345105, "Shape__Area": 23129406.894531302, "Shape__Length": 24054.749603152402 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.3597108499133, 43.6704618791026], [-79.361707163492, 43.6702394044539], [-79.365865786904, 43.6716443633414], [-79.3677565359953, 43.6716872883271], [-79.3704029794067, 43.6726681873031], [-79.3771450315158, 43.673147823563], [-79.379468072457, 43.6718257155842], [-79.3799057240718, 43.6699739729667], [-79.38886911734551, 43.6681966792186], [-79.3858549461133, 43.6608156633898], [-79.3831103705459, 43.6613718103314], [-79.3809264046243, 43.6563287749711], [-79.3837661930223, 43.6557159692698], [-79.3823360419431, 43.6521516709262], [-79.3815498064014, 43.6517030684006], [-79.3791349753174, 43.6459870607196], [-79.3765030771403, 43.6457838773097], [-79.3717413242899, 43.6480415953011], [-79.3526160273598, 43.6524418238029], [-79.3495236876076, 43.6535994380291], [-79.3542050943883, 43.6576642319021], [-79.3573207284055, 43.6681907476975], [-79.3597108499133, 43.6704618791026]]] }, "properties": { "_id": 722, "AREA_ID": 2457719, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993175, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 13, "AREA_LONG_CODE": 13, "AREA_NAME": "Toronto Centre", "AREA_DESC": "Toronto Centre (13)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345121, "Shape__Area": 11208160.4492188, "Shape__Length": 14958.0646795112 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.4646206444876, 43.6921556119541], [-79.4654991432383, 43.6939894890229], [-79.4688363649464, 43.706090340875704], [-79.4725666844142, 43.7248699022048], [-79.4914106264141, 43.720290147594], [-79.5020820091586, 43.7184122410568], [-79.5078301632192, 43.717755170299], [-79.5247120595825, 43.7159100930063], [-79.5378418799993, 43.7129901010899], [-79.5395981412305, 43.7107121143573], [-79.5389018828899, 43.7089999793716], [-79.5356588659721, 43.7078940159504], [-79.5359612062898, 43.7045893739186], [-79.5311573120798, 43.7047826284806], [-79.5285699277462, 43.7024152124689], [-79.526091989064, 43.7016506151712], [-79.5255772442768, 43.7014203167337], [-79.5214336140373, 43.69986916779641], [-79.5188158132893, 43.6971218243443], [-79.5163391557657, 43.6968006881954], [-79.5135356370615, 43.6972481755086], [-79.5120285102376, 43.6960855846417], [-79.5132891036969, 43.6933839865311], [-79.5125522883929, 43.6888217984749], [-79.5100111950506, 43.683516689263], [-79.5084472907873, 43.6823647108813], [-79.5057022156682, 43.68196003781], [-79.5057624411482, 43.6802363734113], [-79.5072424624144, 43.67926859386441], [-79.5085201092123, 43.6767526014928], [-79.5120475763723, 43.6743219633395], [-79.5124395570694, 43.6735163028494], [-79.5112739940851, 43.6682776863479], [-79.512986576215, 43.666544666736804], [-79.5122116343354, 43.6626336614198], [-79.50998125987792, 43.6643262829786], [-79.50562352908182, 43.66547434106781], [-79.4749769499394, 43.6672932419678], [-79.4600458827451, 43.6672259620873], [-79.4695233182969, 43.67687365058], [-79.4705581756293, 43.6796952496402], [-79.4664530229404, 43.6806018741342], [-79.4676043950252, 43.6817118880485], [-79.4612985347611, 43.6832389166322], [-79.4629324999454, 43.6889762777141], [-79.4646206444876, 43.6921556119541]]] }, "properties": { "_id": 723, "AREA_ID": 2457718, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993174, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 5, "AREA_LONG_CODE": 5, "AREA_NAME": "York South-Weston", "AREA_DESC": "York South-Weston (5)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345137, "Shape__Area": 47807729.9414063, "Shape__Length": 34744.1176803513 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.31492459201341, 43.6619658989816], [-79.3148681478337, 43.6622739414704], [-79.32559525655701, 43.6880499516796], [-79.3295965399394, 43.6982704634436], [-79.32709986130472, 43.701504367047], [-79.3313033230546, 43.7016569817106], [-79.3330914324973, 43.7033709024658], [-79.3346939799612, 43.7030774853307], [-79.3354178284738, 43.7031996690207], [-79.3390873109582, 43.701261139675], [-79.3404848838388, 43.6999898584467], [-79.344452660439, 43.698264442969], [-79.3501239659486, 43.6998628344381], [-79.3510982916581, 43.6988703032065], [-79.3550205923027, 43.6980465430698], [-79.3569281630571, 43.6954248824872], [-79.3599967328217, 43.6953068405967], [-79.3616687237251, 43.6941791963243], [-79.3600546991794, 43.6912922992574], [-79.3621680058351, 43.6884665602725], [-79.3616529398897, 43.6855353030927], [-79.3620935417814, 43.6843735329363], [-79.3663684190196, 43.6813973948914], [-79.3637314492195, 43.67879746595711], [-79.3649564974, 43.6767286258956], [-79.3633907880318, 43.6753226406503], [-79.3629509953311, 43.6732428267766], [-79.3605255527314, 43.6719707333508], [-79.3597108499133, 43.6704618791026], [-79.3573207284055, 43.6681907476975], [-79.3542050943883, 43.6576642319021], [-79.3495236876076, 43.6535994380291], [-79.3476541079523, 43.6504189245783], [-79.3598538981138, 43.6452985787937], [-79.349647800299, 43.6333942966004], [-79.3470841780091, 43.6332016059977], [-79.3432444747351, 43.6372351101977], [-79.3406485042618, 43.6391130522775], [-79.3363890654187, 43.6394146125684], [-79.3373730147543, 43.6403415200555], [-79.3304531607182, 43.6465874098193], [-79.3282119453724, 43.6476351891416], [-79.325800593322, 43.6468412022612], [-79.3253599461881, 43.6456348059853], [-79.3268227780294, 43.6439759009155], [-79.3276805151202, 43.641191974666], [-79.3308597316998, 43.6388019607439], [-79.32886084202092, 43.6381104703536], [-79.3253275311595, 43.6422724659406], [-79.3243223243259, 43.6452055431525], [-79.3216831921554, 43.6448233544955], [-79.3234019327958, 43.637530130094206], [-79.3261823206466, 43.6355776802128], [-79.3256244057232, 43.6342178106398], [-79.3266052796253, 43.6318730101644], [-79.3290061322984, 43.6320892212866], [-79.3293831957036, 43.6332937382186], [-79.3348951673093, 43.6308778389293], [-79.3337222407961, 43.6296587547558], [-79.3313482329035, 43.6312604231127], [-79.328908422377, 43.6309421090871], [-79.329974945967, 43.62832787773531], [-79.3322265420183, 43.6260853200143], [-79.3357581060723, 43.62634620504651], [-79.3373629281092, 43.6288106601461], [-79.3393981480706, 43.6291825585783], [-79.3373110383427, 43.6259221463885], [-79.337374918295, 43.6229153284272], [-79.3384873399966, 43.6221595363892], [-79.3405277108482, 43.6237678370521], [-79.3423796091585, 43.6232310953807], [-79.3396461178413, 43.6208653343598], [-79.3412294740746, 43.6194993304094], [-79.3446723472034, 43.6184277705781], [-79.34376564219, 43.6167266004795], [-79.3441227420691, 43.6132564751468], [-79.3420597776082, 43.6144584023877], [-79.3370970425623, 43.6191421195379], [-79.33242558036092, 43.6204180140228], [-79.3279672674898, 43.6194542903096], [-79.3286572105745, 43.6213233614034], [-79.3260338305603, 43.6220832045753], [-79.3229393481247, 43.6222846308309], [-79.323142770218, 43.6239913235329], [-79.3218906755739, 43.632744450442], [-79.3231122208066, 43.6344600039072], [-79.3220625820318, 43.6389130863044], [-79.320639405571, 43.6417759098873], [-79.3212964716725, 43.6426853123828], [-79.3200655682834, 43.646965800353], [-79.3201012518389, 43.6493886272717], [-79.3180075086009, 43.6543276971172], [-79.3147496175453, 43.6573730126593], [-79.313140220612, 43.6580733264547], [-79.3160473514316, 43.6598869969395], [-79.3171125851442, 43.6614746167282], [-79.31492459201341, 43.6619658989816]]] }, "properties": { "_id": 724, "AREA_ID": 2457717, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993173, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 14, "AREA_LONG_CODE": 14, "AREA_NAME": "Toronto-Danforth", "AREA_DESC": "Toronto-Danforth (14)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345153, "Shape__Area": 41685482.890625, "Shape__Length": 61191.203214624504 } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-79.3837661930223, 43.6557159692698], [-79.3914607906137, 43.6543333741155], [-79.4037475308531, 43.6517410074764], [-79.4053616100253, 43.6523649340544], [-79.4207821526692, 43.6493340834881], [-79.4247515152879, 43.6494378865496], [-79.4214164277034, 43.640820387101904], [-79.4226733486885, 43.6407054775233], [-79.4282100821178, 43.6423113693663], [-79.4286441986526, 43.6422084224097], [-79.42542438496672, 43.6338795502891], [-79.4287065660649, 43.6329132750031], [-79.4277754764607, 43.629793474517], [-79.4224664079757, 43.6290618383046], [-79.4213771433781, 43.6275354027725], [-79.4186349803506, 43.626750452393], [-79.4173341771496, 43.6279242645219], [-79.4154553603797, 43.6270588013799], [-79.4133136232645, 43.6270212728243], [-79.4103768397526, 43.62779774605941], [-79.4091521369427, 43.6295161538464], [-79.4094608196914, 43.6310160397365], [-79.4086244122116, 43.6330664039131], [-79.405063443553, 43.6331162682793], [-79.4023342669007, 43.6310362774904], [-79.3988630444965, 43.6328769598804], [-79.3987655310305, 43.6315514189895], [-79.4048993790719, 43.6278384356606], [-79.4013600684978, 43.6253943833933], [-79.3954961465048, 43.620734898536], [-79.3934340167476, 43.6187066156912], [-79.3916147358676, 43.6161071066609], [-79.3916141534939, 43.6150586392325], [-79.389936811102, 43.6136556870088], [-79.3897639442667, 43.6123008518077], [-79.3848970206598, 43.6119634617379], [-79.3820636578514, 43.6122566396451], [-79.379761088599, 43.6137006071719], [-79.3760824816177, 43.614436550507], [-79.3719448395172, 43.6163381484364], [-79.370493424694, 43.6175982595047], [-79.3664531220754, 43.619338102491], [-79.3578217925513, 43.6254492066633], [-79.3559408320384, 43.6273138227813], [-79.3544121352382, 43.6297705810501], [-79.3497604744627, 43.6296396320818], [-79.3493872836886, 43.6310230779534], [-79.3525152582638, 43.6337126393982], [-79.349647800299, 43.6333942966004], [-79.3598538981138, 43.6452985787937], [-79.3476541079523, 43.6504189245783], [-79.3495236876076, 43.6535994380291], [-79.3526160273598, 43.6524418238029], [-79.3717413242899, 43.6480415953011], [-79.3765030771403, 43.6457838773097], [-79.3791349753174, 43.6459870607196], [-79.3815498064014, 43.6517030684006], [-79.3823360419431, 43.6521516709262], [-79.3837661930223, 43.6557159692698]]] }, "properties": { "_id": 725, "AREA_ID": 2457716, "DATE_EFFECTIVE": "2018-08-07T18:11:06", "DATE_EXPIRY": "3000-01-01T05:00:00", "AREA_ATTR_ID": 25993172, "AREA_TYPE_ID": 528, "PARENT_AREA_ID": null, "AREA_TYPE": "CITW", "AREA_CLASS_ID": null, "AREA_CLASS": null, "AREA_SHORT_CODE": 10, "AREA_LONG_CODE": 10, "AREA_NAME": "Spadina-Fort York", "AREA_DESC": "Spadina-Fort York (10)", "FEATURE_CODE": null, "FEATURE_CODE_DESC": null, "TRANS_ID_CREATE": 279754, "TRANS_ID_EXPIRE": -1, "X": null, "Y": null, "LONGITUDE": null, "LATITUDE": null, "OBJECTID": 17345169, "Shape__Area": 35724182.2929688, "Shape__Length": 38163.5568548265 } }
      ]
    };

    data.features = data.features.map(o => {
      o.properties.color = colors[o.properties.AREA_NAME] || 'red';
      o.properties.height = heights[o.properties.AREA_NAME] * 500;
      o.properties.height += 300;
      return o
    });

    const addWards = function (map) {
      map.addSource('wards', {
        type: 'geojson',
        data: data,
      });
      map.addLayer({
        id: 'outline',
        type: 'fill-extrusion',
        source: 'wards',
        layout: {},
        paint: {
          // 'line-color': ['get', 'color'],
          // 'fill-extrusion-line-width': 2,
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.9
        },
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
          'fill-color': '#fff', // blue color fill
          'fill-opacity': 1,
        },
      });

    };

    var ttc = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {
            "type": "LineString",
            "coordinates": [
              // [
              //   -79.528128999,
              //   43.796772003
              // ],
              // [
              //   -79.526474005,
              //   43.790618005
              // ],
              // [
              //   -79.525172006,
              //   43.787391005
              // ],
              [
                -79.522341003,
                43.781965998
              ],
              [
                -79.521134001,
                43.780626003
              ],
              [
                -79.519480994,
                43.779732998
              ],
              [
                -79.496685003,
                43.773239002
              ],
              [
                -79.493748004,
                43.771307999
              ],
              [
                -79.492554001,
                43.769300999
              ],
              [
                -79.489390005,
                43.756974005
              ],
              [
                -79.488342998,
                43.755400001
              ],
              [
                -79.485660996,
                43.753679001
              ],
              [
                -79.482428005,
                43.753042998
              ],
              [
                -79.479794998,
                43.753302003
              ],
              [
                -79.473965002,
                43.754588005
              ],
              [
                -79.469989005,
                43.754840003
              ],
              [
                -79.466535995,
                43.754341005
              ],
              [
                -79.464857001,
                43.753777001
              ],
              [
                -79.463647999,
                43.752657003
              ],
              [
                -79.462470998,
                43.749926001
              ],
              [
                -79.460784,
                43.744731001
              ],
              [
                -79.459819003,
                43.743459997
              ],
              [
                -79.451673995,
                43.737582001
              ],
              [
                -79.451052002,
                43.736545005
              ],
              [
                -79.449259999,
                43.731609004
              ],
              [
                -79.448144998,
                43.725782003
              ],
              [
                -79.443179002,
                43.712872998
              ],
              [
                -79.442062,
                43.710521999
              ],
              [
                -79.439053001,
                43.705940999
              ],
              [
                -79.436330003,
                43.699037998
              ],
              [
                -79.435305005,
                43.697106005
              ],
              [
                -79.433013994,
                43.694609998
              ],
              [
                -79.431341006,
                43.693234004
              ],
              [
                -79.427657001,
                43.691420998
              ],
              [
                -79.421706995,
                43.690246998
              ],
              [
                -79.419407005,
                43.689464997
              ],
              [
                -79.417919994,
                43.688193
              ],
              [
                -79.416458,
                43.685925003
              ],
              [
                -79.415275004,
                43.683216005
              ],
              [
                -79.411933002,
                43.682821001
              ],
              [
                -79.410221999,
                43.681881
              ],
              [
                -79.407691005,
                43.675815
              ],
              [
                -79.404669998,
                43.668130002
              ],
              [
                -79.403812995,
                43.667507998
              ],
              [
                -79.401976996,
                43.667715997
              ],
              [
                -79.397845004,
                43.668576003
              ],
              [
                -79.395549004,
                43.668875003
              ],
              [
                -79.394449005,
                43.668436997
              ],
              [
                -79.393136996,
                43.665883003
              ],
              [
                -79.391825,
                43.664202002
              ],
              [
                -79.391135995,
                43.662364999
              ],
              [
                -79.390983999,
                43.660533002
              ],
              [
                -79.386490004,
                43.650032999
              ],
              [
                -79.384530996,
                43.646835003
              ],
              [
                -79.382984,
                43.645518999
              ],
              [
                -79.381761,
                43.645415997
              ],
              [
                -79.378653001,
                43.646249003
              ],
              [
                -79.377933997,
                43.64679
              ],
              [
                -79.377857994,
                43.648442998
              ],
              [
                -79.383455,
                43.661674004
              ],
              [
                -79.383441006,
                43.664393002
              ],
              [
                -79.386757005,
                43.673106001
              ],
              [
                -79.387584994,
                43.674437997
              ],
              [
                -79.393586006,
                43.688179997
              ],
              [
                -79.394334999,
                43.690188998
              ],
              [
                -79.395535995,
                43.691536003
              ],
              [
                -79.396827004,
                43.696363003
              ],
              [
                -79.397601002,
                43.698237001
              ],
              [
                -79.398462005,
                43.702407998
              ],
              [
                -79.398613995,
                43.706927003
              ],
              [
                -79.401339999,
                43.719495
              ],
              [
                -79.402393003,
                43.725045998
              ],
              [
                -79.403492,
                43.729105
              ],
              [
                -79.405338001,
                43.736922996
              ],
              [
                -79.405266004,
                43.738684004
              ],
              [
                -79.406212,
                43.743532004
              ],
              [
                -79.407098995,
                43.746893003
              ],
              [
                -79.407957001,
                43.747973002
              ],
              [
                -79.408537005,
                43.749905999
              ],
              [
                -79.408824995,
                43.752721999
              ],
              [
                -79.411134995,
                43.761454004
              ],
              [
                -79.416009002,
                43.780757
              ]
            ]
          },
          "properties": {
            "OBJECTID": 53420,
            "ROUTE_NAME": "LINE 1 (YONGE-UNIVERSITY)",
            "color": "#f5deb3",
            "RID": 1
          }
        },
        {
          "type": "Feature",
          "geometry": {
            "type": "LineString",
            "coordinates": [
              [
                -79.535402005,
                43.637805004
              ],
              [
                -79.533857999,
                43.639131997
              ],
              [
                -79.529517995,
                43.643643997
              ],
              [
                -79.527735998,
                43.644646
              ],
              [
                -79.520554999,
                43.646201997
              ],
              [
                -79.517363999,
                43.646731001
              ],
              [
                -79.510722997,
                43.648253004
              ],
              [
                -79.508035,
                43.648701002
              ],
              [
                -79.500070997,
                43.650602002
              ],
              [
                -79.497866001,
                43.650645005
              ],
              [
                -79.495876001,
                43.650213002
              ],
              [
                -79.490967994,
                43.648470003
              ],
              [
                -79.487762995,
                43.648388998
              ],
              [
                -79.484830001,
                43.649698999
              ],
              [
                -79.481556002,
                43.650644001
              ],
              [
                -79.453016,
                43.656998
              ],
              [
                -79.444757001,
                43.659048997
              ],
              [
                -79.439503002,
                43.659409003
              ],
              [
                -79.432055,
                43.660896997
              ],
              [
                -79.428073003,
                43.661972
              ],
              [
                -79.416533,
                43.664454999
              ],
              [
                -79.414167998,
                43.665156001
              ],
              [
                -79.401976996,
                43.667715997
              ],
              [
                -79.397845004,
                43.668576003
              ],
              [
                -79.389995001,
                43.670173003
              ],
              [
                -79.387713002,
                43.670919001
              ],
              [
                -79.382520005,
                43.671195001
              ],
              [
                -79.378988003,
                43.671865003
              ],
              [
                -79.373995003,
                43.672252997
              ],
              [
                -79.371759003,
                43.672809003
              ],
              [
                -79.366935005,
                43.674614998
              ],
              [
                -79.360647,
                43.675847998
              ],
              [
                -79.358036,
                43.677226001
              ],
              [
                -79.338298995,
                43.681063002
              ],
              [
                -79.321671002,
                43.684613999
              ],
              [
                -79.303507001,
                43.688596003
              ],
              [
                -79.299542997,
                43.689715004
              ],
              [
                -79.295268999,
                43.692212
              ],
              [
                -79.292439004,
                43.693442002
              ],
              [
                -79.284483003,
                43.696500999
              ],
              [
                -79.282586005,
                43.697638002
              ],
              [
                -79.281270002,
                43.699486997
              ],
              [
                -79.279832005,
                43.707825004
              ],
              [
                -79.278601999,
                43.714239999
              ],
              [
                -79.277890006,
                43.716304998
              ],
              [
                -79.274438005,
                43.723658999
              ],
              [
                -79.269994002,
                43.728579002
              ],
              [
                -79.267141999,
                43.731366997
              ],
              [
                -79.264535004,
                43.732238001
              ]
            ]
          },
          "properties": {
            "OBJECTID": 53421,
            "ROUTE_NAME": "LINE 2 (BLOOR - DANFORTH)",
            "color": "#7f9c6c",
            "RID": 2
          }
        },
        {
          "type": "Feature",
          "geometry": {
            "type": "LineString",
            "coordinates": [
              [
                -79.263317994,
                43.732656998
              ],
              [
                -79.264535004,
                43.732238001
              ],
              [
                -79.263317994,
                43.732656998
              ],
              [
                -79.263328,
                43.733320003
              ],
              [
                -79.270193998,
                43.749479998
              ],
              [
                -79.270633004,
                43.751536
              ],
              [
                -79.276866001,
                43.767790001
              ],
              [
                -79.276842001,
                43.768805
              ],
              [
                -79.275633998,
                43.769659999
              ],
              [
                -79.268789997,
                43.771122998
              ],
              [
                -79.257245996,
                43.774565005
              ],
              [
                -79.253868005,
                43.774994997
              ],
              [
                -79.251072996,
                43.774869001
              ]
            ]
          },
          "properties": {
            "OBJECTID": 53422,
            "ROUTE_NAME": "LINE 3 (SCARBOROUGH)",
            "color": "steelblue",
            "RID": 3
          }
        },
        {
          "type": "Feature",
          "geometry": {
            "type": "LineString",
            "coordinates": [
              [
                -79.411134995,
                43.761454004
              ],
              [
                -79.389105995,
                43.766319005
              ],
              [
                -79.383337994,
                43.767749003
              ],
              [
                -79.368454996,
                43.770976997
              ],
              [
                -79.364437001,
                43.771385999
              ],
              [
                -79.360885,
                43.772048005
              ],
              [
                -79.347238996,
                43.775052997
              ]
            ]
          },
          "properties": {
            "OBJECTID": 53423,
            "ROUTE_NAME": "LINE 4 (SHEPPARD)",
            "color": "#6D5685",
            "RID": 4
          }
        },


        {
          "type": "Feature",
          "properties": {
            "ROUTE_NAME": "Eglinton Crosstown",
            "color": "#cc8a66",
          },
          "geometry": {
            "type": "LineString",
            "coordinates": [
              [
                -79.26303148269653,
                43.733398628766096
              ],
              [
                -79.28455352783202,
                43.72862303765891
              ],
              [
                -79.30292129516602,
                43.72483950684785
              ],
              [
                -79.31339263916016,
                43.72595598341762
              ],
              [
                -79.31802749633789,
                43.726204086496104
              ],
              [
                -79.33073043823242,
                43.72304069527186
              ],
              [
                -79.35484886169434,
                43.71559676286074
              ],
              [
                -79.37570571899414,
                43.71150220582834
              ],
              [
                -79.45029258728026,
                43.69598998329128
              ],
              [
                -79.46368217468262,
                43.69270087644112
              ],
              [
                -79.4655704498291,
                43.69201820901719
              ],
              [
                -79.4684886932373,
                43.69189408683249
              ],
              [
                -79.48591232299805,
                43.687922041287244
              ]
            ]
          }

        },



        // {
        //   "type": "Feature",
        //   "properties": {
        //     "ROUTE_NAME": "UP express",
        //     "color": "#bfb0b3",
        //   },
        //   "geometry": {
        //     "type": "LineString",
        //     "coordinates": [
        //       [
        //         -79.38044786453247,
        //         43.644476148364504
        //       ],
        //       [
        //         -79.39351558685303,
        //         43.642084857927046
        //       ],
        //       [
        //         -79.39851522445679,
        //         43.64082706306976
        //       ],
        //       [
        //         -79.40538167953491,
        //         43.640159334112184
        //       ],
        //       [
        //         -79.42235469818114,
        //         43.640640720851366
        //       ],
        //       [
        //         -79.42538022994995,
        //         43.641230802560266
        //       ],
        //       [
        //         -79.4307017326355,
        //         43.64338920996541
        //       ],
        //       [
        //         -79.4381260871887,
        //         43.64699155895161
        //       ],
        //       [
        //         -79.44140911102294,
        //         43.64863738788296
        //       ],
        //       [
        //         -79.44385528564453,
        //         43.6507023736017
        //       ],
        //       [
        //         -79.4515585899353,
        //         43.65840274688734
        //       ],
        //       [
        //         -79.4606351852417,
        //         43.66799578200857
        //       ],
        //       [
        //         -79.4672441482544,
        //         43.674607564174735
        //       ],
        //       [
        //         -79.47381019592285,
        //         43.680628929123934
        //       ],
        //       [
        //         -79.47810173034668,
        //         43.6830807551234
        //       ],
        //       [
        //         -79.4864273071289,
        //         43.68720828647336
        //       ],
        //       [
        //         -79.49608325958252,
        //         43.69183202564382
        //       ],
        //       [
        //         -79.5126485824585,
        //         43.700023547288495
        //       ],
        //       [
        //         -79.52372074127197,
        //         43.7052047274842
        //       ],
        //       [
        //         -79.52814102172852,
        //         43.7064456622583
        //       ],
        //       [
        //         -79.5329475402832,
        //         43.706911006175595
        //       ],
        //       [
        //         -79.53917026519775,
        //         43.70687998336016
        //       ],
        //       [
        //         -79.5633316040039,
        //         43.706259523679876
        //       ],
        //       [
        //         -79.58088397979736,
        //         43.70601133800949
        //       ],
        //       [
        //         -79.61242675781249,
        //         43.705452916494146
        //       ]
        //     ]
        //   }
        // },


        // {
        //   "type": "Feature",
        //   "properties": {
        //     "ROUTE_NAME": "Go east",
        //     "color": "#bfb0b3",
        //   },
        //   "geometry": {
        //     "type": "LineString",
        //     "coordinates": [
        //       [
        //         -79.38059806823729,
        //         43.64449167591344
        //       ],
        //       [
        //         -79.36665058135986,
        //         43.64731762298236
        //       ],
        //       [
        //         -79.35695171356201,
        //         43.6499571237856
        //       ],
        //       [
        //         -79.35060024261475,
        //         43.65321752346015
        //       ],
        //       [
        //         -79.34751033782959,
        //         43.65514262872613
        //       ],
        //       [
        //         -79.34648036956787,
        //         43.65678823430195
        //       ],
        //       [
        //         -79.3452787399292,
        //         43.66337020563492
        //       ],
        //       [
        //         -79.34403419494629,
        //         43.665791692755704
        //       ],
        //       [
        //         -79.34154510498047,
        //         43.66870976539732
        //       ],
        //       [
        //         -79.33836936950684,
        //         43.67122416101328
        //       ],
        //       [
        //         -79.33467864990234,
        //         43.67302452772504
        //       ],
        //       [
        //         -79.32751178741455,
        //         43.675911209895716
        //       ],
        //       [
        //         -79.32158946990967,
        //         43.67817700292489
        //       ],
        //       [
        //         -79.30751323699951,
        //         43.683763524273346
        //       ],
        //       [
        //         -79.30262088775635,
        //         43.68571868385149
        //       ],
        //       [
        //         -79.3003463745117,
        //         43.68630832264586
        //       ]
        //     ]
        //   }
        // },


        // {
        //   "type": "Feature",
        //   "properties": {
        //     "ROUTE_NAME": "Go east",
        //     "color": "#bfb0b3"
        //   },
        //   "geometry": {
        //     "type": "LineString",
        //     "coordinates": [

        //       [
        //         -79.29163455963135,
        //         43.80250898697117
        //       ],
        //       [
        //         -79.29066896438599,
        //         43.800929328405026
        //       ],
        //       [
        //         -79.28858757019043,
        //         43.79611266064601
        //       ],
        //       [
        //         -79.28684949874877,
        //         43.79208556645399
        //       ],
        //       [
        //         -79.28436040878296,
        //         43.78602892542118
        //       ],
        //       [
        //         -79.26262378692627,
        //         43.73234431023762
        //       ],
        //       [
        //         -79.26034927368164,
        //         43.72818887413058
        //       ],
        //       [
        //         -79.25610065460205,
        //         43.72651421389918
        //       ],
        //       [
        //         -79.25395488739014,
        //         43.72421923309539
        //       ],
        //       [
        //         -79.25309658050537,
        //         43.72192416436804
        //       ],
        //       [
        //         -79.25309658050537,
        //         43.71984612089551
        //       ],
        //       [
        //         -79.25485610961914,
        //         43.71689951779365
        //       ],
        //       [
        //         -79.26820278167725,
        //         43.697386247688776
        //       ],
        //       [
        //         -79.27124977111816,
        //         43.69477986118131
        //       ],
        //       [
        //         -79.27502632141112,
        //         43.69273190659395
        //       ],
        //       [
        //         -79.27871704101562,
        //         43.69133553382245
        //       ],
        //       [
        //         -79.30047512054443,
        //         43.68637038955022
        //       ],

        //     ]
        //   }
        // },

        // {
        //   "type": "Feature",
        //   "properties": {
        //     "ROUTE_NAME": "Go east",
        //     "color": "#bfb0b3"
        //   },
        //   "geometry": {
        //     "type": "LineString",
        //     "coordinates": [
        //       [
        //         -79.29167747497559,
        //         43.80257093351484
        //       ],
        //       [
        //         -79.30163383483887,
        //         43.823133635349556
        //       ]
        //     ]
        //   }
        // },


        // {
        //   "type": "Feature",
        //   "properties": {
        //     "ROUTE_NAME": "Ontario Line",
        //     "color": "#6699cc",
        //   },
        //   "geometry": {
        //     "type": "LineString",
        //     "coordinates": [
        //       [
        //         -79.33897018432617,
        //         43.72046643992622
        //       ],
        //       [
        //         -79.33579444885254,
        //         43.7131152465404
        //       ],
        //       [
        //         -79.33635234832764,
        //         43.71060260657362
        //       ],
        //       [
        //         -79.33845520019531,
        //         43.70911358503263
        //       ],
        //       [
        //         -79.34240341186523,
        //         43.70802781683793
        //       ],
        //       [
        //         -79.34789657592773,
        //         43.70675589193788
        //       ],
        //       [
        //         -79.35175895690918,
        //         43.703498400224376
        //       ],
        //       [
        //         -79.35214519500732,
        //         43.70157484580676
        //       ],
        //       [
        //         -79.34948444366455,
        //         43.69747933082594
        //       ],
        //       [
        //         -79.34497833251953,
        //         43.678983977039664
        //       ],
        //       [
        //         -79.3409013748169,
        //         43.669113317468934
        //       ],
        //       [
        //         -79.34287548065186,
        //         43.66700239968739
        //       ],
        //       [
        //         -79.3449354171753,
        //         43.66389797397276
        //       ],
        //       [
        //         -79.34630870819092,
        //         43.657253963541315
        //       ],
        //       [
        //         -79.34836864471434,
        //         43.65458373355482
        //       ],
        //       [
        //         -79.35308933258057,
        //         43.65194443607904
        //       ],
        //       [
        //         -79.3568229675293,
        //         43.6499571237856
        //       ],
        //       [
        //         -79.3595266342163,
        //         43.64908765397935
        //       ],
        //       [
        //         -79.3617582321167,
        //         43.64992607150924
        //       ],
        //       [
        //         -79.36330318450928,
        //         43.65275176291473
        //       ],
        //       [
        //         -79.36583518981934,
        //         43.65421113388417
        //       ],
        //       [
        //         -79.37077045440674,
        //         43.6543663840279
        //       ],
        //       [
        //         -79.3793535232544,
        //         43.652503355813494
        //       ],
        //       [
        //         -79.38677787780762,
        //         43.65095078815211
        //       ],
        //       [
        //         -79.39643383026123,
        //         43.64871502020936
        //       ],
        //       [
        //         -79.40304279327393,
        //         43.643932681623234
        //       ],
        //       [
        //         -79.41943645477295,
        //         43.63576456071818
        //       ]
        //     ]
        //   },
        // },

        // {
        //   "type": "Feature",
        //   "properties": {
        //     "ROUTE_NAME": "Finch West",
        //     "color": "#978BA3"
        //   },
        //   "geometry": {
        //     "type": "LineString",
        //     "coordinates": [
        //       [
        //         -79.49097633361816,
        //         43.76350089109259
        //       ],
        //       [
        //         -79.49363708496094,
        //         43.76278803624408
        //       ],
        //       [
        //         -79.49501037597655,
        //         43.76204417865027
        //       ],
        //       [
        //         -79.49994564056395,
        //         43.76111434365176
        //       ],
        //       [
        //         -79.51728343963623,
        //         43.757394859144306
        //       ],
        //       [
        //         -79.51861381530762,
        //         43.7573018690691
        //       ],
        //       [
        //         -79.52084541320801,
        //         43.756743925583116
        //       ],
        //       [
        //         -79.54243183135986,
        //         43.75209419421577
        //       ],
        //       [
        //         -79.55264568328857,
        //         43.749955196469124
        //       ],
        //       [
        //         -79.56852436065674,
        //         43.74632802557607
        //       ],
        //       [
        //         -79.57929611206055,
        //         43.7437237673328
        //       ],
        //       [
        //         -79.58225727081299,
        //         43.74338272512562
        //       ],
        //       [
        //         -79.58581924438477,
        //         43.74344473294418
        //       ],
        //       [
        //         -79.58813667297363,
        //         43.74285565607489
        //       ],
        //       [
        //         -79.5889949798584,
        //         43.741863513508584
        //       ],
        //       [
        //         -79.58968162536621,
        //         43.73997219619709
        //       ],
        //       [
        //         -79.59015369415283,
        //         43.7374916894919
        //       ],
        //       [
        //         -79.59178447723389,
        //         43.736747517441835
        //       ],
        //       [
        //         -79.60315704345703,
        //         43.73411183371628
        //       ],
        //       [
        //         -79.60262060165405,
        //         43.73288697650424
        //       ],
        //       [
        //         -79.60150480270386,
        //         43.730452692236796
        //       ]
        //     ]
        //   }
        // },

        // {
        //   "type": "Feature",
        //   "properties": {
        //     //
        //     "ROUTE_NAME": "Scarborough Extension",
        //     "color": "#AABE9C"
        //   },
        //   "geometry": {
        //     "type": "LineString",
        //     "coordinates": [
        //       [
        //         -79.26292419433594,
        //         43.73333661054293
        //       ],
        //       [
        //         -79.24627304077148,
        //         43.73705759025331
        //       ],
        //       [
        //         -79.24567222595215,
        //         43.738669942989965
        //       ],
        //       [
        //         -79.24575805664061,
        //         43.741460450894486
        //       ],
        //       [
        //         -79.24489974975586,
        //         43.74573897707891
        //       ],
        //       [
        //         -79.24447059631348,
        //         43.752807176476544
        //       ],
        //       [
        //         -79.24567222595215,
        //         43.75559702541283
        //       ],
        //       [
        //         -79.24610137939452,
        //         43.75795279656078
        //       ],
        //       [
        //         -79.25159454345703,
        //         43.77245734331019
        //       ],
        //       [
        //         -79.25451278686523,
        //         43.781133595742496
        //       ],
        //       [
        //         -79.25725936889647,
        //         43.78733014814683
        //       ],
        //       [
        //         -79.25880432128906,
        //         43.789746629487276
        //       ],
        //       [
        //         -79.26652908325195,
        //         43.807960036932826
        //       ]
        //     ]
        //   }
        // },


      ]
    };

    const addTTC = function (map) {
      map.addSource('ttc', {
        type: 'geojson',
        data: ttc,
      });
      // map.addLayer({
      //   id: 'outline',
      //   type: 'line',
      //   source: 'ttc',
      //   layout: {},
      //   paint: {
      //     'line-color': 'steelblue',
      //     'line-width': 1.5,
      //   },
      // })

      map.addLayer({
        'id': 'lines',
        'type': 'line',
        'source': 'ttc',
        'paint': {
          'line-width': 6,
          // Use a get expression (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-get)
          // to set the line-color to a feature property value.
          'line-color': ['get', 'color']
        }
      });
    };

    var line1 = [
      {
        "title": "Dundas station (Toronto)",
        "geo": {
          "lat": 43.65639,
          "lon": -79.38083
        },
        "ward": "Toronto Centre"
      },
      {
        "title": "College station (Toronto)",
        "geo": {
          "lat": 43.66139,
          "lon": -79.38306
        },
        "ward": "Toronto Centre"
      },
      {
        "title": "Bloor–Yonge station",
        "geo": {
          "lat": 43.67111,
          "lon": -79.38583
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "Davisville station",
        "geo": {
          "lat": 43.69778,
          "lon": -79.39722
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "title": "Downsview Park station",
        "geo": {
          "lat": 43.75389,
          "lon": -79.47833
        },
        "ward": "York Centre"
      },
      {
        "title": "Eglinton West station",
        "geo": {
          "lat": 43.69921,
          "lon": -79.43582
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "title": "Dupont station",
        "geo": {
          "lat": 43.67458,
          "lon": -79.40683
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "Eglinton station",
        "geo": {
          "lat": 43.70583,
          "lon": -79.39833
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "title": "Finch station",
        "geo": {
          "lat": 43.78056,
          "lon": -79.41472
        },
        "ward": "Willowdale"
      },
      {
        "title": "Finch West station",
        "geo": {
          "lat": 43.76528,
          "lon": -79.49111
        },
        "ward": "York Centre"
      },
      {
        "title": "Lawrence West station",
        "geo": {
          "lat": 43.71583,
          "lon": -79.44417
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "title": "Glencairn station",
        "geo": {
          "lat": 43.70889,
          "lon": -79.44083
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "title": "King station (Toronto)",
        "geo": {
          "lat": 43.64917,
          "lon": -79.37778
        },
        "ward": "Toronto Centre"
      },
      {
        "title": "Lawrence station (Toronto)",
        "geo": {
          "lat": 43.725,
          "lon": -79.40222
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "title": "Museum station (Toronto)",
        "geo": {
          "lat": 43.66722,
          "lon": -79.39361
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "Osgoode station",
        "geo": {
          "lat": 43.65083,
          "lon": -79.38667
        },
        "ward": "Spadina-Fort York"
      },
      {
        "title": "Queen station",
        "geo": {
          "lat": 43.6525,
          "lon": -79.37917
        },
        "ward": "Toronto Centre"
      },
      {
        "title": "North York Centre station",
        "geo": {
          "lat": 43.76833,
          "lon": -79.41278
        },
        "ward": "Willowdale"
      },
      {
        "title": "Pioneer Village station",
        "geo": {
          "lat": 43.77694,
          "lon": -79.50944
        },
        "ward": "Humber River-Black Creek"
      },
      {
        "title": "St. Clair West station",
        "geo": {
          "lat": 43.68389,
          "lon": -79.41511
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "title": "Queen's Park station (Toronto)",
        "geo": {
          "lat": 43.66,
          "lon": -79.39056
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "St. Andrew station",
        "geo": {
          "lat": 43.64778,
          "lon": -79.38472
        },
        "ward": "Spadina-Fort York"
      },
      {
        "title": "Rosedale station (Toronto)",
        "geo": {
          "lat": 43.67694,
          "lon": -79.38889
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "St. Clair station",
        "geo": {
          "lat": 43.68778,
          "lon": -79.39306
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "title": "Sheppard West station",
        "geo": {
          "lat": 43.74944,
          "lon": -79.46194
        },
        "ward": "York Centre"
      },
      {
        "title": "Spadina station",
        "geo": {
          "lat": 43.66722,
          "lon": -79.40389
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "St. George station",
        "geo": {
          "lat": 43.66806,
          "lon": -79.39972
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "St. Patrick station",
        "geo": {
          "lat": 43.65472,
          "lon": -79.38833
        },
        "ward": "Spadina-Fort York"
      },
      {
        "title": "Sheppard–Yonge station",
        "geo": {
          "lat": 43.76139,
          "lon": -79.41083
        },
        "ward": "Willowdale"
      },
      {
        "title": "Wilson station (Toronto)",
        "geo": {
          "lat": 43.73417,
          "lon": -79.45
        },
        "ward": "York Centre"
      },
      {
        "title": "Union station (TTC)",
        "geo": {
          "lat": 43.64556,
          "lon": -79.38056
        },
        "ward": "Spadina-Fort York"
      },
      {
        "title": "Wellesley station",
        "geo": {
          "lat": 43.66528,
          "lon": -79.38389
        },
        "ward": "Toronto Centre"
      },
      {
        "title": "Summerhill station",
        "geo": {
          "lat": 43.68222,
          "lon": -79.39083
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "Yorkdale station",
        "geo": {
          "lat": 43.72472,
          "lon": -79.4475
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "title": "York Mills station",
        "geo": {
          "lat": 43.74417,
          "lon": -79.40667
        },
        "ward": "Don Valley West"
      },
      {
        "title": "York University station",
        "geo": {
          "lat": 43.77417,
          "lon": -79.49972
        },
        "ward": "Humber River-Black Creek"
      },
      // {
      //   "title": "Highway 407 station",
      //   "geo": {
      //     "lat": 43.78389,
      //     "lon": -79.52306
      //   },
      //   "ward": null
      // },
      // {
      //   "title": "Vaughan Metropolitan Centre station",
      //   "geo": {
      //     "lat": 43.79417,
      //     "lon": -79.5275
      //   },
      //   "ward": null
      // }
    ];

    var line2 = [
      {
        "title": "Bloor–Yonge station",
        "geo": {
          "lat": 43.67111,
          "lon": -79.38583
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "Bathurst station (Toronto)",
        "geo": {
          "lat": 43.66611,
          "lon": -79.41111
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "Bay station",
        "geo": {
          "lat": 43.67028,
          "lon": -79.39
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "Castle Frank station",
        "geo": {
          "lat": 43.67361,
          "lon": -79.36889
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "Broadview station",
        "geo": {
          "lat": 43.67694,
          "lon": -79.35833
        },
        "ward": "Toronto-Danforth"
      },
      {
        "title": "Dufferin station",
        "geo": {
          "lat": 43.66,
          "lon": -79.43556
        },
        "ward": "Davenport"
      },
      {
        "title": "Christie station",
        "geo": {
          "lat": 43.66417,
          "lon": -79.41833
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "Chester station (Toronto)",
        "geo": {
          "lat": 43.67833,
          "lon": -79.3525
        },
        "ward": "Toronto-Danforth"
      },
      {
        "title": "Donlands station",
        "geo": {
          "lat": 43.68111,
          "lon": -79.33778
        },
        "ward": "Toronto-Danforth"
      },
      {
        "title": "Coxwell station",
        "geo": {
          "lat": 43.68417,
          "lon": -79.32306
        },
        "ward": "Beaches-East York"
      },
      {
        "title": "Islington station (Toronto)",
        "geo": {
          "lat": 43.64528,
          "lon": -79.52444
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "title": "Jane station",
        "geo": {
          "lat": 43.64992,
          "lon": -79.48389
        },
        "ward": "Parkdale-High Park"
      },
      {
        "title": "High Park station",
        "geo": {
          "lat": 43.65389,
          "lon": -79.46667
        },
        "ward": "Parkdale-High Park"
      },
      {
        "title": "Dundas West station",
        "geo": {
          "lat": 43.65694,
          "lon": -79.45292
        },
        "ward": "Parkdale-High Park"
      },
      {
        "title": "Greenwood station (Toronto)",
        "geo": {
          "lat": 43.6825,
          "lon": -79.33028
        },
        "ward": "Toronto-Danforth"
      },
      {
        "title": "Kennedy station",
        "geo": {
          "lat": 43.7325,
          "lon": -79.26361
        },
        "ward": "Scarborough Southwest"
      },
      {
        "title": "Kipling station",
        "geo": {
          "lat": 43.63722,
          "lon": -79.53611
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "title": "Keele station",
        "geo": {
          "lat": 43.65556,
          "lon": -79.45972
        },
        "ward": "Parkdale-High Park"
      },
      {
        "title": "Lansdowne station (Toronto)",
        "geo": {
          "lat": 43.65917,
          "lon": -79.44278
        },
        "ward": "Davenport"
      },
      {
        "title": "Main Street station (Toronto)",
        "geo": {
          "lat": 43.68903,
          "lon": -79.30167
        },
        "ward": "Beaches-East York"
      },
      {
        "title": "Royal York station",
        "geo": {
          "lat": 43.64806,
          "lon": -79.51139
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "title": "Old Mill station",
        "geo": {
          "lat": 43.65,
          "lon": -79.49472
        },
        "ward": "Etobicoke-Lakeshore"
      },
      {
        "title": "Runnymede station",
        "geo": {
          "lat": 43.65167,
          "lon": -79.47583
        },
        "ward": "Parkdale-High Park"
      },
      {
        "title": "Ossington station",
        "geo": {
          "lat": 43.66222,
          "lon": -79.42667
        },
        "ward": "Davenport"
      },
      {
        "title": "Pape station",
        "geo": {
          "lat": 43.68,
          "lon": -79.345
        },
        "ward": "Toronto-Danforth"
      },
      {
        "title": "Spadina station",
        "geo": {
          "lat": 43.66722,
          "lon": -79.40389
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "St. George station",
        "geo": {
          "lat": 43.66806,
          "lon": -79.39972
        },
        "ward": "University-Rosedale"
      },
      {
        "title": "Sherbourne station",
        "geo": {
          "lat": 43.67222,
          "lon": -79.37639
        },
        "ward": "Toronto Centre"
      },
      {
        "title": "Victoria Park station (Toronto)",
        "geo": {
          "lat": 43.695,
          "lon": -79.28861
        },
        "ward": "Scarborough Southwest"
      },
      {
        "title": "Warden station",
        "geo": {
          "lat": 43.71139,
          "lon": -79.27972
        },
        "ward": "Scarborough Southwest"
      },
      {
        "title": "Woodbine station",
        "geo": {
          "lat": 43.68639,
          "lon": -79.31278
        },
        "ward": "Beaches-East York"
      }
    ];

    var line3 = [
      {
        "title": "Kennedy station",
        "geo": {
          "lat": 43.7325,
          "lon": -79.26361
        },
        "ward": "Scarborough Southwest"
      },
      {
        "title": "Lawrence East station",
        "geo": {
          "lat": 43.75028,
          "lon": -79.27028
        },
        "ward": "Scarborough Centre"
      },
      {
        "title": "Ellesmere station",
        "geo": {
          "lat": 43.76694,
          "lon": -79.27639
        },
        "ward": "Scarborough Centre"
      },
      {
        "title": "Midland station (Toronto)",
        "geo": {
          "lat": 43.77042,
          "lon": -79.27194
        },
        "ward": "Scarborough Centre"
      },
      {
        "title": "McCowan station",
        "geo": {
          "lat": 43.77492,
          "lon": -79.25167
        },
        "ward": "Scarborough-Guildwood"
      },
      {
        "title": "Scarborough Centre station",
        "geo": {
          "lat": 43.77444,
          "lon": -79.25778
        },
        "ward": "Scarborough Centre"
      }
    ];

    var line4 = [
      {
        "title": "Sheppard–Yonge station",
        "geo": {
          "lat": 43.76139,
          "lon": -79.41083
        },
        "ward": "Willowdale"
      },
      {
        "title": "Bayview station (Toronto)",
        "geo": {
          "lat": 43.76694,
          "lon": -79.38667
        },
        "ward": "Don Valley North"
      },
      {
        "title": "Bessarion station",
        "geo": {
          "lat": 43.76917,
          "lon": -79.37639
        },
        "ward": "Don Valley North"
      },
      {
        "title": "Leslie station",
        "geo": {
          "lat": 43.77139,
          "lon": -79.36528
        },
        "ward": "Don Valley North"
      },
      {
        "title": "Don Mills station",
        "geo": {
          "lat": 43.77556,
          "lon": -79.34639
        },
        "ward": "Don Valley North"
      }
    ];

    var line5 = [
      {
        "title": "Caledonia station",
        "geo": {
          "lat": 43.69222,
          "lon": -79.46556
        },
        "ward": "York South-Weston"
      },
      {
        "title": "Chaplin station",
        "geo": {
          "lat": 43.70278,
          "lon": -79.41722
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "title": "Avenue station",
        "geo": {
          "lat": 43.70472,
          "lon": -79.40778
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "title": "Aga Khan Park & Museum stop",
        "geo": {
          "lat": 43.7225,
          "lon": -79.3325
        },
        "ward": "Don Valley East"
      },
      {
        "title": "Birchmount stop",
        "geo": {
          "lat": 43.73,
          "lon": -79.27778
        },
        "ward": "Scarborough Centre"
      },
      {
        "title": "Eglinton West station",
        "geo": {
          "lat": 43.69921,
          "lon": -79.43582
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "title": "Eglinton station",
        "geo": {
          "lat": 43.70583,
          "lon": -79.39833
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "title": "Fairbank station",
        "geo": {
          "lat": 43.69556,
          "lon": -79.45
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "title": "Forest Hill station (Toronto)",
        "geo": {
          "lat": 43.70111,
          "lon": -79.42528
        },
        "ward": "Eglinton-Lawrence"
      },
      {
        "title": "Golden Mile stop",
        "geo": {
          "lat": 43.72778,
          "lon": -79.28778
        },
        "ward": "Scarborough Southwest"
      },
      {
        "title": "Kennedy station",
        "geo": {
          "lat": 43.7325,
          "lon": -79.26361
        },
        "ward": "Scarborough Southwest"
      },
      {
        "title": "Keelesdale station",
        "geo": {
          "lat": 43.69028,
          "lon": -79.475
        },
        "ward": "York South-Weston"
      },
      {
        "title": "Laird station",
        "geo": {
          "lat": 43.71333,
          "lon": -79.365
        },
        "ward": "Don Valley West"
      },
      {
        "title": "Hakimi Lebovic stop",
        "geo": {
          "lat": 43.72694,
          "lon": -79.29167
        },
        "ward": "Scarborough Southwest"
      },
      {
        "title": "Ionview stop",
        "geo": {
          "lat": 43.73139,
          "lon": -79.27167
        },
        "ward": "Scarborough Centre"
      },
      {
        "title": "Mount Dennis station",
        "geo": {
          "lat": 43.6875,
          "lon": -79.48722
        },
        "ward": "York South-Weston"
      },
      {
        "title": "Oakwood station (Toronto)",
        "geo": {
          "lat": 43.69722,
          "lon": -79.44306
        },
        "ward": "Toronto-St. Paul's"
      },
      {
        "title": "Mount Pleasant station (Toronto)",
        "geo": {
          "lat": 43.70839,
          "lon": -79.39017
        },
        "ward": "Don Valley West"
      },
      {
        "title": "Leaside station",
        "geo": {
          "lat": 43.71111,
          "lon": -79.37694
        },
        "ward": "Don Valley West"
      },
      {
        "title": "O'Connor stop",
        "geo": {
          "lat": 43.72472,
          "lon": -79.30167
        },
        "ward": "Scarborough Southwest"
      },
      {
        "title": "Science Centre station",
        "geo": {
          "lat": 43.72056,
          "lon": -79.33889
        },
        "ward": "Don Valley East"
      },
      {
        "title": "Sunnybrook Park stop",
        "geo": {
          "lat": 43.71722,
          "lon": -79.34944
        },
        "ward": "Don Valley East"
      },
      {
        "title": "Wynford stop",
        "geo": {
          "lat": 43.72417,
          "lon": -79.32611
        },
        "ward": "Don Valley East"
      },
      {
        "title": "Sloane stop",
        "geo": {
          "lat": 43.72583,
          "lon": -79.3125
        },
        "ward": "Don Valley East"
      },
      {
        "title": "Pharmacy stop",
        "geo": {
          "lat": 43.72583,
          "lon": -79.29694
        },
        "ward": "Scarborough Centre"
      }
    ];

    let dots = [];
    line1.forEach(obj => {
      dots.push({
        "type": "Feature",
        "properties": { "color": "#f5deb3" },
        "geometry": {
          "type": "Point",
          "coordinates": [obj.geo.lon, obj.geo.lat]
        }
      });
    });
    line2.forEach(obj => {
      dots.push({
        "type": "Feature",
        "properties": { "color": "#5b7848" },
        "geometry": {
          "type": "Point",
          "coordinates": [obj.geo.lon, obj.geo.lat]
        }
      });
    });
    line3.forEach(obj => {
      dots.push({
        "type": "Feature",
        "properties": { "color": "steelblue" },
        "geometry": {
          "type": "Point",
          "coordinates": [obj.geo.lon, obj.geo.lat]
        }
      });
    });
    line4.forEach(obj => {
      dots.push({
        "type": "Feature",
        "properties": { "color": "#6D5685" },
        "geometry": {
          "type": "Point",
          "coordinates": [obj.geo.lon, obj.geo.lat]
        }
      });
    });
    line5.forEach(obj => {
      dots.push({
        "type": "Feature",
        "properties": { "color": "#e09b75" },
        "geometry": {
          "type": "Point",
          "coordinates": [obj.geo.lon, obj.geo.lat]
        }
      });
    });

    const addStops = function (map) {
      // Add the vector tileset as a source.
      map.addSource('stops', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: dots

        }
      });
      map.addLayer({
        'id': 'stops',
        'type': 'circle',
        'source': 'stops',
        'paint': {
          'circle-radius': 7,
          'circle-opacity': 0.7,
          'circle-color': ['get', 'color']
        }
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

    /**
     * @module helpers
     */
    /**
     * Earth Radius used with the Harvesine formula and approximates using a spherical (non-ellipsoid) Earth.
     *
     * @memberof helpers
     * @type {number}
     */
    var earthRadius = 6371008.8;
    /**
     * Unit of measurement factors using a spherical (non-ellipsoid) earth radius.
     *
     * @memberof helpers
     * @type {Object}
     */
    var factors = {
        centimeters: earthRadius * 100,
        centimetres: earthRadius * 100,
        degrees: earthRadius / 111325,
        feet: earthRadius * 3.28084,
        inches: earthRadius * 39.37,
        kilometers: earthRadius / 1000,
        kilometres: earthRadius / 1000,
        meters: earthRadius,
        metres: earthRadius,
        miles: earthRadius / 1609.344,
        millimeters: earthRadius * 1000,
        millimetres: earthRadius * 1000,
        nauticalmiles: earthRadius / 1852,
        radians: 1,
        yards: earthRadius * 1.0936,
    };
    /**
     * Wraps a GeoJSON {@link Geometry} in a GeoJSON {@link Feature}.
     *
     * @name feature
     * @param {Geometry} geometry input geometry
     * @param {Object} [properties={}] an Object of key-value pairs to add as properties
     * @param {Object} [options={}] Optional Parameters
     * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
     * @param {string|number} [options.id] Identifier associated with the Feature
     * @returns {Feature} a GeoJSON Feature
     * @example
     * var geometry = {
     *   "type": "Point",
     *   "coordinates": [110, 50]
     * };
     *
     * var feature = turf.feature(geometry);
     *
     * //=feature
     */
    function feature(geom, properties, options) {
        if (options === void 0) { options = {}; }
        var feat = { type: "Feature" };
        if (options.id === 0 || options.id) {
            feat.id = options.id;
        }
        if (options.bbox) {
            feat.bbox = options.bbox;
        }
        feat.properties = properties || {};
        feat.geometry = geom;
        return feat;
    }
    /**
     * Creates a {@link Point} {@link Feature} from a Position.
     *
     * @name point
     * @param {Array<number>} coordinates longitude, latitude position (each in decimal degrees)
     * @param {Object} [properties={}] an Object of key-value pairs to add as properties
     * @param {Object} [options={}] Optional Parameters
     * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
     * @param {string|number} [options.id] Identifier associated with the Feature
     * @returns {Feature<Point>} a Point feature
     * @example
     * var point = turf.point([-75.343, 39.984]);
     *
     * //=point
     */
    function point(coordinates, properties, options) {
        if (options === void 0) { options = {}; }
        if (!coordinates) {
            throw new Error("coordinates is required");
        }
        if (!Array.isArray(coordinates)) {
            throw new Error("coordinates must be an Array");
        }
        if (coordinates.length < 2) {
            throw new Error("coordinates must be at least 2 numbers long");
        }
        if (!isNumber(coordinates[0]) || !isNumber(coordinates[1])) {
            throw new Error("coordinates must contain numbers");
        }
        var geom = {
            type: "Point",
            coordinates: coordinates,
        };
        return feature(geom, properties, options);
    }
    /**
     * Creates a {@link Polygon} {@link Feature} from an Array of LinearRings.
     *
     * @name polygon
     * @param {Array<Array<Array<number>>>} coordinates an array of LinearRings
     * @param {Object} [properties={}] an Object of key-value pairs to add as properties
     * @param {Object} [options={}] Optional Parameters
     * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
     * @param {string|number} [options.id] Identifier associated with the Feature
     * @returns {Feature<Polygon>} Polygon Feature
     * @example
     * var polygon = turf.polygon([[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]], { name: 'poly1' });
     *
     * //=polygon
     */
    function polygon(coordinates, properties, options) {
        if (options === void 0) { options = {}; }
        for (var _i = 0, coordinates_1 = coordinates; _i < coordinates_1.length; _i++) {
            var ring = coordinates_1[_i];
            if (ring.length < 4) {
                throw new Error("Each LinearRing of a Polygon must have 4 or more Positions.");
            }
            for (var j = 0; j < ring[ring.length - 1].length; j++) {
                // Check if first point of Polygon contains two numbers
                if (ring[ring.length - 1][j] !== ring[0][j]) {
                    throw new Error("First and last Position are not equivalent.");
                }
            }
        }
        var geom = {
            type: "Polygon",
            coordinates: coordinates,
        };
        return feature(geom, properties, options);
    }
    /**
     * Convert a distance measurement (assuming a spherical Earth) from a real-world unit into radians
     * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
     *
     * @name lengthToRadians
     * @param {number} distance in real units
     * @param {string} [units="kilometers"] can be degrees, radians, miles, inches, yards, metres,
     * meters, kilometres, kilometers.
     * @returns {number} radians
     */
    function lengthToRadians(distance, units) {
        if (units === void 0) { units = "kilometers"; }
        var factor = factors[units];
        if (!factor) {
            throw new Error(units + " units is invalid");
        }
        return distance / factor;
    }
    /**
     * Converts an angle in radians to degrees
     *
     * @name radiansToDegrees
     * @param {number} radians angle in radians
     * @returns {number} degrees between 0 and 360 degrees
     */
    function radiansToDegrees(radians) {
        var degrees = radians % (2 * Math.PI);
        return (degrees * 180) / Math.PI;
    }
    /**
     * Converts an angle in degrees to radians
     *
     * @name degreesToRadians
     * @param {number} degrees angle between 0 and 360 degrees
     * @returns {number} angle in radians
     */
    function degreesToRadians(degrees) {
        var radians = degrees % 360;
        return (radians * Math.PI) / 180;
    }
    /**
     * isNumber
     *
     * @param {*} num Number to validate
     * @returns {boolean} true/false
     * @example
     * turf.isNumber(123)
     * //=true
     * turf.isNumber('foo')
     * //=false
     */
    function isNumber(num) {
        return !isNaN(num) && num !== null && !Array.isArray(num);
    }

    /**
     * Unwrap a coordinate from a Point Feature, Geometry or a single coordinate.
     *
     * @name getCoord
     * @param {Array<number>|Geometry<Point>|Feature<Point>} coord GeoJSON Point or an Array of numbers
     * @returns {Array<number>} coordinates
     * @example
     * var pt = turf.point([10, 10]);
     *
     * var coord = turf.getCoord(pt);
     * //= [10, 10]
     */
    function getCoord(coord) {
        if (!coord) {
            throw new Error("coord is required");
        }
        if (!Array.isArray(coord)) {
            if (coord.type === "Feature" &&
                coord.geometry !== null &&
                coord.geometry.type === "Point") {
                return coord.geometry.coordinates;
            }
            if (coord.type === "Point") {
                return coord.coordinates;
            }
        }
        if (Array.isArray(coord) &&
            coord.length >= 2 &&
            !Array.isArray(coord[0]) &&
            !Array.isArray(coord[1])) {
            return coord;
        }
        throw new Error("coord must be GeoJSON Point or an Array of numbers");
    }

    // http://en.wikipedia.org/wiki/Haversine_formula
    /**
     * Takes a {@link Point} and calculates the location of a destination point given a distance in
     * degrees, radians, miles, or kilometers; and bearing in degrees.
     * This uses the [Haversine formula](http://en.wikipedia.org/wiki/Haversine_formula) to account for global curvature.
     *
     * @name destination
     * @param {Coord} origin starting point
     * @param {number} distance distance from the origin point
     * @param {number} bearing ranging from -180 to 180
     * @param {Object} [options={}] Optional parameters
     * @param {string} [options.units='kilometers'] miles, kilometers, degrees, or radians
     * @param {Object} [options.properties={}] Translate properties to Point
     * @returns {Feature<Point>} destination point
     * @example
     * var point = turf.point([-75.343, 39.984]);
     * var distance = 50;
     * var bearing = 90;
     * var options = {units: 'miles'};
     *
     * var destination = turf.destination(point, distance, bearing, options);
     *
     * //addToMap
     * var addToMap = [point, destination]
     * destination.properties['marker-color'] = '#f00';
     * point.properties['marker-color'] = '#0f0';
     */
    function destination(origin, distance, bearing, options) {
        if (options === void 0) { options = {}; }
        // Handle input
        var coordinates1 = getCoord(origin);
        var longitude1 = degreesToRadians(coordinates1[0]);
        var latitude1 = degreesToRadians(coordinates1[1]);
        var bearingRad = degreesToRadians(bearing);
        var radians = lengthToRadians(distance, options.units);
        // Main
        var latitude2 = Math.asin(Math.sin(latitude1) * Math.cos(radians) +
            Math.cos(latitude1) * Math.sin(radians) * Math.cos(bearingRad));
        var longitude2 = longitude1 +
            Math.atan2(Math.sin(bearingRad) * Math.sin(radians) * Math.cos(latitude1), Math.cos(radians) - Math.sin(latitude1) * Math.sin(latitude2));
        var lng = radiansToDegrees(longitude2);
        var lat = radiansToDegrees(latitude2);
        return point([lng, lat], options.properties);
    }

    /**
     * Takes a {@link Point} and calculates the circle polygon given a radius in degrees, radians, miles, or kilometers; and steps for precision.
     *
     * @name circle
     * @param {Feature<Point>|number[]} center center point
     * @param {number} radius radius of the circle
     * @param {Object} [options={}] Optional parameters
     * @param {number} [options.steps=64] number of steps
     * @param {string} [options.units='kilometers'] miles, kilometers, degrees, or radians
     * @param {Object} [options.properties={}] properties
     * @returns {Feature<Polygon>} circle polygon
     * @example
     * var center = [-75.343, 39.984];
     * var radius = 5;
     * var options = {steps: 10, units: 'kilometers', properties: {foo: 'bar'}};
     * var circle = turf.circle(center, radius, options);
     *
     * //addToMap
     * var addToMap = [turf.point(center), circle]
     */
    function circle(center, radius, options) {
        if (options === void 0) { options = {}; }
        // default params
        var steps = options.steps || 64;
        var properties = options.properties
            ? options.properties
            : !Array.isArray(center) && center.type === "Feature" && center.properties
                ? center.properties
                : {};
        // main
        var coordinates = [];
        for (var i = 0; i < steps; i++) {
            coordinates.push(destination(center, radius, (i * -360) / steps, options).geometry
                .coordinates);
        }
        coordinates.push(coordinates[0]);
        return polygon([coordinates], properties);
    }

    // let center = [-79.43, 43.65]

    const makeCircle = (center, prop) => {
      let radius = 0.22;
      let options = { steps: 30, units: 'kilometers', properties: prop };
      let circle$1 = circle(center, radius, options);
      return circle$1
    };

    let dots$1 = [];
    line1.forEach(obj => {
      let res = makeCircle([obj.geo.lon, obj.geo.lat], { "color": "#f5deb3" });
      dots$1.push(res);
    });
    line2.forEach(obj => {
      dots$1.push(makeCircle([obj.geo.lon, obj.geo.lat], { "color": "#5b7848" }));
    });
    line3.forEach(obj => {
      dots$1.push(makeCircle([obj.geo.lon, obj.geo.lat], { "color": "steelblue" }));
    });
    line4.forEach(obj => {
      dots$1.push(makeCircle([obj.geo.lon, obj.geo.lat], { "color": "#6D5685" }));
    });
    line5.forEach(obj => {
      dots$1.push(makeCircle([obj.geo.lon, obj.geo.lat], { "color": "#e09b75" }));
    });


    const addStops$1 = function (map) {
      // Add the vector tileset as a source.
      map.addSource('stops', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: dots$1

        }
      });
      map.addLayer({
        'id': 'stops',
        'type': 'fill',
        'source': 'stops',
        'paint': {
          "fill-color": ['get', 'color'],
          "fill-opacity": 0.9
        }
      });



      // map.addSource('label', {

      //   type: 'geojson',
      //   data: {
      //     'type': 'FeatureCollection',
      //     'features': [
      //       {
      //         'type': 'Feature',
      //         'properties': {
      //           'icon': 'theatre'
      //         },
      //         'geometry': {
      //           'type': 'Point',
      //           'coordinates': [-79.43, 43.65]
      //         }
      //       },
      //     ]
      //   }
      // })

      // map.addLayer({
      //   'id': 'text',
      //   'type': 'symbol',
      //   'source': 'label',

      //   'layout': {
      //     'icon-image': `theatre-15`,
      //     'icon-allow-overlap': true,
      //     // 'text-field': 'hello',
      //     'text-font': [
      //       'Open Sans Bold',
      //       'Arial Unicode MS Bold'
      //     ],
      //     'text-size': 61,
      //     'text-transform': 'uppercase',
      //     'text-letter-spacing': 0.05,
      //     'text-offset': [0, 1.5],
      //   },
      //   'paint': {
      //     'text-color': 'red',
      //     'text-halo-color': '#fff',
      //     'text-halo-width': 2
      //   }
      // })
      map.loadImage(
        './data/x-emoji.png',
        (error, image) => {
          if (error) throw error

          // Add the image to the map style.
          map.addImage('cat', image);

          // Add a data source containing one point feature.
          map.addSource('point', {
            'type': 'geojson',
            'data': {
              'type': 'FeatureCollection',
              'features': [
                {
                  'type': 'Feature',
                  'geometry': {
                    'type': 'Point',
                    'coordinates': [-79.27028, 43.75028]
                  }
                },
                {
                  'type': 'Feature',
                  'geometry': {
                    'type': 'Point',
                    'coordinates': [-79.27639, 43.76694]
                  }
                },
                {
                  'type': 'Feature',
                  'geometry': {
                    'type': 'Point',
                    'coordinates': [-79.27194, 43.77042]
                  }
                },

                {
                  'type': 'Feature',
                  'geometry': {
                    'type': 'Point',
                    'coordinates': [-79.25167, 43.77492]
                  }
                },
                {
                  'type': 'Feature',
                  'geometry': {
                    'type': 'Point',
                    'coordinates': [-79.25778, 43.77444]
                  }
                }
              ]
            }
          });

          // Add a layer to use the image to represent the data.
          map.addLayer({
            'id': 'points',
            'type': 'symbol',
            'source': 'point', // reference the data source
            'layout': {
              'icon-image': 'cat', // reference the image
              'icon-size': 0.023,
              'icon-allow-overlap': true
            }
          });
        }
      );

    };

    /* 2022/transit-map/Post.svelte generated by Svelte v3.29.0 */
    const file = "2022/transit-map/Post.svelte";

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-1tks5ry-style";
    	style.textContent = ".label.svelte-1tks5ry{position:absolute}.container.svelte-1tks5ry{border:1px solid grey}#map.svelte-1tks5ry{min-width:100vw;min-height:100vh}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCB7IG9uTW91bnQgfSBmcm9tICdzdmVsdGUnXG4gIGltcG9ydCBhZGRXYXJkcyBmcm9tICcuL2xheWVycy9hZGRXYXJkcy5qcydcbiAgLy8gaW1wb3J0IGFkZERvdHMgZnJvbSAnLi9sYXllcnMvYWRkQnVpbGRpbmdzLmpzJ1xuICBpbXBvcnQgYWRkTWFzayBmcm9tICcuL2xheWVycy9hZGRNYXNrLmpzJ1xuICBpbXBvcnQgYWRkVFRDIGZyb20gJy4vbGF5ZXJzL2FkZFRUQy5qcydcbiAgaW1wb3J0IGFkZFN0b3BzIGZyb20gJy4vbGF5ZXJzL2FkZFN0b3BzLmpzJ1xuICBpbXBvcnQgYWRkR3JvdW5kIGZyb20gJy4vbGF5ZXJzL2FkZEdyb3VuZC5qcydcbiAgaW1wb3J0IGFkZFJvdW5kcyBmcm9tICcuL2xheWVycy9hZGRSb3VuZHMuanMnXG4gIGltcG9ydCBtYXBib3hnbCBmcm9tICdtYXBib3gtZ2wnXG4gIG1hcGJveGdsLmFjY2Vzc1Rva2VuID0gJ3BrLmV5SjFJam9pYzNCbGJtTmxjbTF2ZFc1MFlXbHVJaXdpWVNJNklucDVVVlpFWTNjaWZRLmRoLV9TdmtQZ3Y5WU9RWkxHNVpIS2cnXG4gIG9uTW91bnQoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IG1hcCA9IG5ldyBtYXBib3hnbC5NYXAoe1xuICAgICAgY29udGFpbmVyOiAnbWFwJywgLy8gY29udGFpbmVyIElEXG4gICAgICAvLyBzdHlsZTogJ21hcGJveDovL3N0eWxlcy9zcGVuY2VybW91bnRhaW4vY2w4eXN4bGtiMDAwbTE1cTlvM2x1ZDl5aycsXG4gICAgICBjZW50ZXI6IFstNzkuNDMsIDQzLjY1XSxcbiAgICAgIHBpdGNoOiA1NSxcbiAgICAgIGJlYXJpbmc6IDUsXG4gICAgICB6b29tOiAxMSxcbiAgICAgIHByb2plY3Rpb246ICdnbG9iZScsXG4gICAgICBtYXhCb3VuZHM6IFtcbiAgICAgICAgLTc5LjY4NTA3LFxuICAgICAgICA0My40MjA0LCAvL3NvdXRod2VzdFxuICAgICAgICAtNzkuMDM0OSxcbiAgICAgICAgNDQuMDQ5MiwgLy9ub3J0aGVhc3RcbiAgICAgIF0sXG4gICAgfSlcbiAgICBtYXAub24oJ2xvYWQnLCAoKSA9PiB7XG4gICAgICBhZGRNYXNrKG1hcClcbiAgICAgIGFkZEdyb3VuZChtYXApXG4gICAgICBhZGRXYXJkcyhtYXApXG4gICAgICBhZGRUVEMobWFwKVxuICAgICAgLy8gYWRkU3RvcHMobWFwKVxuICAgICAgYWRkUm91bmRzKG1hcClcbiAgICB9KVxuICB9KVxuPC9zY3JpcHQ+XG5cbjxkaXYgc3R5bGU9XCJwb3NpdGlvbjpyZWxhdGl2ZTtcIj5cbiAgPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiPlxuICAgIDxkaXYgaWQ9XCJtYXBcIiAvPlxuICA8L2Rpdj5cbiAgPGRpdiBjbGFzcz1cImxhYmVsXCI+dHJhbnNpdCBzdGF0aW9ucyBieSB3YXJkLCBPY3QgMjAyMjwvZGl2PlxuPC9kaXY+XG5cbjxzdHlsZT5cbiAgLmxhYmVsIHtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gIH1cbiAgLmNvbnRhaW5lciB7XG4gICAgLyogbWFyZ2luOiAzcmVtOyAqL1xuICAgIC8qIHdpZHRoOiAxMDB2dzsgKi9cbiAgICAvKiBtaW4taGVpZ2h0OiA4MDBweDsgKi9cbiAgICBib3JkZXI6IDFweCBzb2xpZCBncmV5O1xuICB9XG4gICNtYXAge1xuICAgIG1pbi13aWR0aDogMTAwdnc7XG4gICAgbWluLWhlaWdodDogMTAwdmg7XG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBOENFLE1BQU0sZUFBQyxDQUFDLEFBQ04sUUFBUSxDQUFFLFFBQVEsQUFDcEIsQ0FBQyxBQUNELFVBQVUsZUFBQyxDQUFDLEFBSVYsTUFBTSxDQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxBQUN4QixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixTQUFTLENBQUUsS0FBSyxDQUNoQixVQUFVLENBQUUsS0FBSyxBQUNuQixDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    function create_fragment(ctx) {
    	let div3;
    	let div1;
    	let div0;
    	let t0;
    	let div2;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div2 = element("div");
    			div2.textContent = "transit stations by ward, Oct 2022";
    			attr_dev(div0, "id", "map");
    			attr_dev(div0, "class", "svelte-1tks5ry");
    			add_location(div0, file, 40, 4, 1159);
    			attr_dev(div1, "class", "container svelte-1tks5ry");
    			add_location(div1, file, 39, 2, 1131);
    			attr_dev(div2, "class", "label svelte-1tks5ry");
    			add_location(div2, file, 42, 2, 1187);
    			set_style(div3, "position", "relative");
    			add_location(div3, file, 38, 0, 1096);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div1);
    			append_dev(div1, div0);
    			append_dev(div3, t0);
    			append_dev(div3, div2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
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
    	validate_slots("Post", slots, []);
    	mapboxgl__default['default'].accessToken = "pk.eyJ1Ijoic3BlbmNlcm1vdW50YWluIiwiYSI6Inp5UVZEY3cifQ.dh-_SvkPgv9YOQZLG5ZHKg";

    	onMount(async () => {
    		const map = new mapboxgl__default['default'].Map({
    				container: "map", // container ID
    				// style: 'mapbox://styles/spencermountain/cl8ysxlkb000m15q9o3lud9yk',
    				center: [-79.43, 43.65],
    				pitch: 55,
    				bearing: 5,
    				zoom: 11,
    				projection: "globe",
    				maxBounds: [-79.68507, 43.4204, -79.0349, 44.0492], //southwest
    				//northeast
    				
    			});

    		map.on("load", () => {
    			addMask(map);
    			addMask$1(map);
    			addWards(map);
    			addTTC(map);

    			// addStops(map)
    			addStops$1(map);
    		});
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		addWards,
    		addMask,
    		addTTC,
    		addStops,
    		addGround: addMask$1,
    		addRounds: addStops$1,
    		mapboxgl: mapboxgl__default['default']
    	});

    	return [];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1tks5ry-style")) add_css();
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

}(mapboxgl));
