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

    //a very-tiny version of d3-scale's scaleLinear
    const scaleLinear = function (obj, num) {
      let world = obj.world || [];
      let minmax = obj.minmax || [];
      let range = minmax[1] - minmax[0];
      let percent = (num - minmax[0]) / range;
      let size = world[1] - world[0];
      return parseInt(size * percent, 10)
    };

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

    /* 2022/population-growth/xAxis.svelte generated by Svelte v3.29.0 */
    const file = "2022/population-growth/xAxis.svelte";

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-1elq6nq-style";
    	style.textContent = ".bottom.svelte-1elq6nq{height:25px;left:0px;width:100%;border-top:1px solid lightgrey;position:absolute;bottom:-25px}.tick.svelte-1elq6nq{position:absolute;color:grey;font-size:14px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieEF4aXMuc3ZlbHRlIiwic291cmNlcyI6WyJ4QXhpcy5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbiAgZXhwb3J0IGxldCB4U2NhbGUgPSAoKSA9PiB7fVxuICBpbXBvcnQgc3BhY2V0aW1lIGZyb20gJ3NwYWNldGltZSdcblxuICAvLyBsZXQgdGlja3MgPSBbJzE5NjYnLCAnMTk3MicsICcxOTgwLTAxLTAxJywgJzE5OTEtMDEtMDEnLCAnMTk5Ny0wMS0wMScsICcyMDAzLTAxLTAxJywgJzIwMTAnLCAnMjAxNCddIC8vLCAnMjAzMCdcbiAgbGV0IHRpY2tzID0gWycxOTcwLTAxLTAxJywgJzE5ODAtMDEtMDEnLCAnMTk5MC0wMS0wMScsICcyMDAwLTAxLTAxJywgJzIwMTAtMDEtMDEnLCAnMjAyMC0wMS0wMSddIC8vLCAnMjAzMCdcbjwvc2NyaXB0PlxuXG48ZGl2IGNsYXNzPVwiYm90dG9tXCI+XG4gIHsjZWFjaCB0aWNrcyBhcyBzdHJ9XG4gICAgPGRpdiBjbGFzcz1cInJlbCB0aWNrXCIgc3R5bGU9XCJsZWZ0Ont4U2NhbGUoc3RyKX0lOyBib3R0b206MCU7XCI+e3NwYWNldGltZShzdHIpLnllYXIoKX08L2Rpdj5cbiAgey9lYWNofVxuPC9kaXY+XG5cbjxzdHlsZT5cbiAgLmJvdHRvbSB7XG4gICAgaGVpZ2h0OiAyNXB4O1xuICAgIGxlZnQ6IDBweDtcbiAgICB3aWR0aDogMTAwJTtcbiAgICBib3JkZXItdG9wOiAxcHggc29saWQgbGlnaHRncmV5O1xuICAgIC8qIGJhY2tncm91bmQtY29sb3I6IHdoaXRlc21va2U7ICovXG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIGJvdHRvbTogLTI1cHg7XG4gIH1cbiAgLnRpY2sge1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBjb2xvcjogZ3JleTtcbiAgICBmb250LXNpemU6IDE0cHg7XG4gICAgLyogbWFyZ2luLWxlZnQ6IC04cHg7ICovXG4gIH1cbjwvc3R5bGU+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBZUUsT0FBTyxlQUFDLENBQUMsQUFDUCxNQUFNLENBQUUsSUFBSSxDQUNaLElBQUksQ0FBRSxHQUFHLENBQ1QsS0FBSyxDQUFFLElBQUksQ0FDWCxVQUFVLENBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBRS9CLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLE1BQU0sQ0FBRSxLQUFLLEFBQ2YsQ0FBQyxBQUNELEtBQUssZUFBQyxDQUFDLEFBQ0wsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsS0FBSyxDQUFFLElBQUksQ0FDWCxTQUFTLENBQUUsSUFBSSxBQUVqQixDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (10:2) {#each ticks as str}
    function create_each_block(ctx) {
    	let div;
    	let t_value = main$1(/*str*/ ctx[2]).year() + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "rel tick svelte-1elq6nq");
    			set_style(div, "left", /*xScale*/ ctx[0](/*str*/ ctx[2]) + "%");
    			set_style(div, "bottom", "0%");
    			add_location(div, file, 10, 4, 363);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*xScale*/ 1) {
    				set_style(div, "left", /*xScale*/ ctx[0](/*str*/ ctx[2]) + "%");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(10:2) {#each ticks as str}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div;
    	let each_value = /*ticks*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "class", "bottom svelte-1elq6nq");
    			add_location(div, file, 8, 0, 315);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*xScale, ticks, spacetime*/ 3) {
    				each_value = /*ticks*/ ctx[1];
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
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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
    	validate_slots("XAxis", slots, []);

    	let { xScale = () => {
    		
    	} } = $$props;

    	// let ticks = ['1966', '1972', '1980-01-01', '1991-01-01', '1997-01-01', '2003-01-01', '2010', '2014'] //, '2030'
    	let ticks = [
    		"1970-01-01",
    		"1980-01-01",
    		"1990-01-01",
    		"2000-01-01",
    		"2010-01-01",
    		"2020-01-01"
    	]; //, '2030'

    	const writable_props = ["xScale"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<XAxis> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("xScale" in $$props) $$invalidate(0, xScale = $$props.xScale);
    	};

    	$$self.$capture_state = () => ({ xScale, spacetime: main$1, ticks });

    	$$self.$inject_state = $$props => {
    		if ("xScale" in $$props) $$invalidate(0, xScale = $$props.xScale);
    		if ("ticks" in $$props) $$invalidate(1, ticks = $$props.ticks);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [xScale, ticks];
    }

    class XAxis extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1elq6nq-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, { xScale: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "XAxis",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get xScale() {
    		throw new Error("<XAxis>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set xScale(value) {
    		throw new Error("<XAxis>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* 2022/population-growth/yAxis.svelte generated by Svelte v3.29.0 */
    const file$1 = "2022/population-growth/yAxis.svelte";

    function add_css$1() {
    	var style = element("style");
    	style.id = "svelte-1t69a8p-style";
    	style.textContent = ".left.svelte-1t69a8p{position:absolute;top:0px;height:100%;width:40px;left:-45px;padding-right:5px;border-right:1px solid lightgrey;text-align:right}.tick.svelte-1t69a8p{text-align:right;width:35px;position:absolute;color:grey;font-size:16px;height:16px;margin-top:-16px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieUF4aXMuc3ZlbHRlIiwic291cmNlcyI6WyJ5QXhpcy5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbiAgZXhwb3J0IGxldCB5U2NhbGUgPSAoKSA9PiB7fVxuICBpbXBvcnQgc3BhY2V0aW1lIGZyb20gJ3NwYWNldGltZSdcbiAgbGV0IG1heCA9IDMwMDAwMDBcbiAgbGV0IHRpY2tzID0gWzIwMDAwMDAsIDI1MDAwMDAsIDMwMDAwMDBdXG4gIGNvbnN0IGZtdCA9IG4gPT4ge1xuICAgIGlmIChuID4gMTAwMDAwMCkge1xuICAgICAgbiA9IChuIC8gMTAwMDAwMCkudG9Mb2NhbGVTdHJpbmcoKSArICdtJ1xuICAgICAgcmV0dXJuIFN0cmluZyhuKVxuICAgIH1cbiAgICAvLyBpZiAobiA+IDEwMDApIHtcbiAgICAvLyAgIHJldHVybiAobiAvIDEwMDApLnRvTG9jYWxlU3RyaW5nKCkgKyAnaydcbiAgICAvLyB9XG4gICAgcmV0dXJuIG5cbiAgfVxuPC9zY3JpcHQ+XG5cbjxkaXYgY2xhc3M9XCJsZWZ0XCI+XG4gIHsjZWFjaCB0aWNrcyBhcyBufVxuICAgIDxkaXYgY2xhc3M9XCJyZWwgdGlja1wiIHN0eWxlPVwidG9wOnt5U2NhbGUobil9JTtcIj57Zm10KG4pfTwvZGl2PlxuICB7L2VhY2h9XG48L2Rpdj5cblxuPHN0eWxlPlxuICAubGVmdCB7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIHRvcDogMHB4O1xuICAgIGhlaWdodDogMTAwJTtcbiAgICB3aWR0aDogNDBweDtcbiAgICBsZWZ0OiAtNDVweDtcbiAgICBwYWRkaW5nLXJpZ2h0OiA1cHg7XG4gICAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgbGlnaHRncmV5O1xuICAgIC8qIGJhY2tncm91bmQtY29sb3I6IHdoaXRlc21va2U7ICovXG4gICAgdGV4dC1hbGlnbjogcmlnaHQ7XG4gIH1cbiAgLnRpY2sge1xuICAgIHRleHQtYWxpZ246IHJpZ2h0O1xuICAgIHdpZHRoOiAzNXB4O1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBjb2xvcjogZ3JleTtcbiAgICBmb250LXNpemU6IDE2cHg7XG4gICAgaGVpZ2h0OiAxNnB4O1xuICAgIG1hcmdpbi10b3A6IC0xNnB4O1xuICB9XG48L3N0eWxlPlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXdCRSxLQUFLLGVBQUMsQ0FBQyxBQUNMLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLEdBQUcsQ0FBRSxHQUFHLENBQ1IsTUFBTSxDQUFFLElBQUksQ0FDWixLQUFLLENBQUUsSUFBSSxDQUNYLElBQUksQ0FBRSxLQUFLLENBQ1gsYUFBYSxDQUFFLEdBQUcsQ0FDbEIsWUFBWSxDQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUVqQyxVQUFVLENBQUUsS0FBSyxBQUNuQixDQUFDLEFBQ0QsS0FBSyxlQUFDLENBQUMsQUFDTCxVQUFVLENBQUUsS0FBSyxDQUNqQixLQUFLLENBQUUsSUFBSSxDQUNYLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLEtBQUssQ0FBRSxJQUFJLENBQ1gsU0FBUyxDQUFFLElBQUksQ0FDZixNQUFNLENBQUUsSUFBSSxDQUNaLFVBQVUsQ0FBRSxLQUFLLEFBQ25CLENBQUMifQ== */";
    	append_dev(document.head, style);
    }

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (19:2) {#each ticks as n}
    function create_each_block$1(ctx) {
    	let div;
    	let t_value = /*fmt*/ ctx[2](/*n*/ ctx[4]) + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "rel tick svelte-1t69a8p");
    			set_style(div, "top", /*yScale*/ ctx[0](/*n*/ ctx[4]) + "%");
    			add_location(div, file$1, 19, 4, 412);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*yScale*/ 1) {
    				set_style(div, "top", /*yScale*/ ctx[0](/*n*/ ctx[4]) + "%");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(19:2) {#each ticks as n}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div;
    	let each_value = /*ticks*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "class", "left svelte-1t69a8p");
    			add_location(div, file$1, 17, 0, 368);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*yScale, ticks, fmt*/ 7) {
    				each_value = /*ticks*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
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
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
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
    	validate_slots("YAxis", slots, []);

    	let { yScale = () => {
    		
    	} } = $$props;

    	let max = 3000000;
    	let ticks = [2000000, 2500000, 3000000];

    	const fmt = n => {
    		if (n > 1000000) {
    			n = (n / 1000000).toLocaleString() + "m";
    			return String(n);
    		}

    		// if (n > 1000) {
    		//   return (n / 1000).toLocaleString() + 'k'
    		// }
    		return n;
    	};

    	const writable_props = ["yScale"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<YAxis> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("yScale" in $$props) $$invalidate(0, yScale = $$props.yScale);
    	};

    	$$self.$capture_state = () => ({ yScale, spacetime: main$1, max, ticks, fmt });

    	$$self.$inject_state = $$props => {
    		if ("yScale" in $$props) $$invalidate(0, yScale = $$props.yScale);
    		if ("max" in $$props) max = $$props.max;
    		if ("ticks" in $$props) $$invalidate(1, ticks = $$props.ticks);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [yScale, ticks, fmt];
    }

    class YAxis extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1t69a8p-style")) add_css$1();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { yScale: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "YAxis",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get yScale() {
    		throw new Error("<YAxis>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set yScale(value) {
    		throw new Error("<YAxis>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

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

    function area(x0, y0, y1) {
      var x1 = null,
          defined = constant(true),
          context = null,
          curve = curveLinear,
          output = null;

      x0 = typeof x0 === "function" ? x0 : (x0 === undefined) ? x : constant(+x0);
      y0 = typeof y0 === "function" ? y0 : (y0 === undefined) ? constant(0) : constant(+y0);
      y1 = typeof y1 === "function" ? y1 : (y1 === undefined) ? y : constant(+y1);

      function area(data) {
        var i,
            j,
            k,
            n = (data = array(data)).length,
            d,
            defined0 = false,
            buffer,
            x0z = new Array(n),
            y0z = new Array(n);

        if (context == null) output = curve(buffer = path());

        for (i = 0; i <= n; ++i) {
          if (!(i < n && defined(d = data[i], i, data)) === defined0) {
            if (defined0 = !defined0) {
              j = i;
              output.areaStart();
              output.lineStart();
            } else {
              output.lineEnd();
              output.lineStart();
              for (k = i - 1; k >= j; --k) {
                output.point(x0z[k], y0z[k]);
              }
              output.lineEnd();
              output.areaEnd();
            }
          }
          if (defined0) {
            x0z[i] = +x0(d, i, data), y0z[i] = +y0(d, i, data);
            output.point(x1 ? +x1(d, i, data) : x0z[i], y1 ? +y1(d, i, data) : y0z[i]);
          }
        }

        if (buffer) return output = null, buffer + "" || null;
      }

      function arealine() {
        return line().defined(defined).curve(curve).context(context);
      }

      area.x = function(_) {
        return arguments.length ? (x0 = typeof _ === "function" ? _ : constant(+_), x1 = null, area) : x0;
      };

      area.x0 = function(_) {
        return arguments.length ? (x0 = typeof _ === "function" ? _ : constant(+_), area) : x0;
      };

      area.x1 = function(_) {
        return arguments.length ? (x1 = _ == null ? null : typeof _ === "function" ? _ : constant(+_), area) : x1;
      };

      area.y = function(_) {
        return arguments.length ? (y0 = typeof _ === "function" ? _ : constant(+_), y1 = null, area) : y0;
      };

      area.y0 = function(_) {
        return arguments.length ? (y0 = typeof _ === "function" ? _ : constant(+_), area) : y0;
      };

      area.y1 = function(_) {
        return arguments.length ? (y1 = _ == null ? null : typeof _ === "function" ? _ : constant(+_), area) : y1;
      };

      area.lineX0 =
      area.lineY0 = function() {
        return arealine().x(x0).y(y0);
      };

      area.lineY1 = function() {
        return arealine().x(x0).y(y1);
      };

      area.lineX1 = function() {
        return arealine().x(x1).y(y0);
      };

      area.defined = function(_) {
        return arguments.length ? (defined = typeof _ === "function" ? _ : constant(!!_), area) : defined;
      };

      area.curve = function(_) {
        return arguments.length ? (curve = _, context != null && (output = curve(context)), area) : curve;
      };

      area.context = function(_) {
        return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), area) : context;
      };

      return area;
    }

    function sign(x) {
      return x < 0 ? -1 : 1;
    }

    // Calculate the slopes of the tangents (Hermite-type interpolation) based on
    // the following paper: Steffen, M. 1990. A Simple Method for Monotonic
    // Interpolation in One Dimension. Astronomy and Astrophysics, Vol. 239, NO.
    // NOV(II), P. 443, 1990.
    function slope3(that, x2, y2) {
      var h0 = that._x1 - that._x0,
          h1 = x2 - that._x1,
          s0 = (that._y1 - that._y0) / (h0 || h1 < 0 && -0),
          s1 = (y2 - that._y1) / (h1 || h0 < 0 && -0),
          p = (s0 * h1 + s1 * h0) / (h0 + h1);
      return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
    }

    // Calculate a one-sided slope.
    function slope2(that, t) {
      var h = that._x1 - that._x0;
      return h ? (3 * (that._y1 - that._y0) / h - t) / 2 : t;
    }

    // According to https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Representations
    // "you can express cubic Hermite interpolation in terms of cubic Bézier curves
    // with respect to the four values p0, p0 + m0 / 3, p1 - m1 / 3, p1".
    function point(that, t0, t1) {
      var x0 = that._x0,
          y0 = that._y0,
          x1 = that._x1,
          y1 = that._y1,
          dx = (x1 - x0) / 3;
      that._context.bezierCurveTo(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
    }

    function MonotoneX(context) {
      this._context = context;
    }

    MonotoneX.prototype = {
      areaStart: function() {
        this._line = 0;
      },
      areaEnd: function() {
        this._line = NaN;
      },
      lineStart: function() {
        this._x0 = this._x1 =
        this._y0 = this._y1 =
        this._t0 = NaN;
        this._point = 0;
      },
      lineEnd: function() {
        switch (this._point) {
          case 2: this._context.lineTo(this._x1, this._y1); break;
          case 3: point(this, this._t0, slope2(this, this._t0)); break;
        }
        if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
        this._line = 1 - this._line;
      },
      point: function(x, y) {
        var t1 = NaN;

        x = +x, y = +y;
        if (x === this._x1 && y === this._y1) return; // Ignore coincident points.
        switch (this._point) {
          case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
          case 1: this._point = 2; break;
          case 2: this._point = 3; point(this, slope2(this, t1 = slope3(this, x, y)), t1); break;
          default: point(this, this._t0, t1 = slope3(this, x, y)); break;
        }

        this._x0 = this._x1, this._x1 = x;
        this._y0 = this._y1, this._y1 = y;
        this._t0 = t1;
      }
    };

    function MonotoneY(context) {
      this._context = new ReflectContext(context);
    }

    (MonotoneY.prototype = Object.create(MonotoneX.prototype)).point = function(x, y) {
      MonotoneX.prototype.point.call(this, y, x);
    };

    function ReflectContext(context) {
      this._context = context;
    }

    ReflectContext.prototype = {
      moveTo: function(x, y) { this._context.moveTo(y, x); },
      closePath: function() { this._context.closePath(); },
      lineTo: function(x, y) { this._context.lineTo(y, x); },
      bezierCurveTo: function(x1, y1, x2, y2, x, y) { this._context.bezierCurveTo(y1, x1, y2, x2, y, x); }
    };

    function monotoneX(context) {
      return new MonotoneX(context);
    }

    /* 2022/population-growth/shapes/Area.svelte generated by Svelte v3.29.0 */
    const file$2 = "2022/population-growth/shapes/Area.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (28:0) {#each points as p, i}
    function create_each_block$2(ctx) {
    	let circle;
    	let circle_cx_value;
    	let circle_cy_value;
    	let t;

    	const block = {
    		c: function create() {
    			circle = svg_element("circle");
    			t = space();
    			attr_dev(circle, "fill", "steelblue");
    			attr_dev(circle, "cx", circle_cx_value = /*xScale*/ ctx[0](/*p*/ ctx[6].x));
    			attr_dev(circle, "cy", circle_cy_value = /*yScale*/ ctx[1](/*p*/ ctx[6].y));
    			attr_dev(circle, "r", "0.5px");
    			add_location(circle, file$2, 28, 2, 697);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, circle, anchor);
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*xScale, points*/ 9 && circle_cx_value !== (circle_cx_value = /*xScale*/ ctx[0](/*p*/ ctx[6].x))) {
    				attr_dev(circle, "cx", circle_cx_value);
    			}

    			if (dirty & /*yScale, points*/ 10 && circle_cy_value !== (circle_cy_value = /*yScale*/ ctx[1](/*p*/ ctx[6].y))) {
    				attr_dev(circle, "cy", circle_cy_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(circle);
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(28:0) {#each points as p, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let path0;
    	let t0;
    	let path1;
    	let t1;
    	let each_1_anchor;
    	let each_value = /*points*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			path0 = svg_element("path");
    			t0 = space();
    			path1 = svg_element("path");
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    			attr_dev(path0, "d", /*dFill*/ ctx[4]);
    			attr_dev(path0, "fill", /*fill*/ ctx[2]);
    			attr_dev(path0, "stroke", "none");
    			attr_dev(path0, "stroke-width", "0.5%");
    			attr_dev(path0, "shape-rendering", "geometricPrecision");
    			add_location(path0, file$2, 18, 0, 441);
    			attr_dev(path1, "d", /*dLine*/ ctx[5]);
    			attr_dev(path1, "fill", /*fill*/ ctx[2]);
    			attr_dev(path1, "stroke", "steelblue");
    			attr_dev(path1, "stroke-width", "1%");
    			attr_dev(path1, "shape-rendering", "geometricPrecision");
    			attr_dev(path1, "stroke-linecap", "butt");
    			add_location(path1, file$2, 19, 0, 538);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path0, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, path1, anchor);
    			insert_dev(target, t1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*fill*/ 4) {
    				attr_dev(path0, "fill", /*fill*/ ctx[2]);
    			}

    			if (dirty & /*fill*/ 4) {
    				attr_dev(path1, "fill", /*fill*/ ctx[2]);
    			}

    			if (dirty & /*xScale, points, yScale*/ 11) {
    				each_value = /*points*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
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
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path0);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(path1);
    			if (detaching) detach_dev(t1);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
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
    	validate_slots("Area", slots, []);

    	let { xScale = () => {
    		
    	} } = $$props;

    	let { yScale = () => {
    		
    	} } = $$props;

    	let { fill = "#50617A" } = $$props;
    	let { points = [] } = $$props;
    	let dFill = area().x(d => xScale(d.x)).y0(d => yScale(points[0].y)).y1(d => yScale(d.y)).curve(monotoneX)(points);
    	let dLine = line().x(d => xScale(d.x)).y(d => yScale(d.y)).curve(monotoneX)(points);
    	const writable_props = ["xScale", "yScale", "fill", "points"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Area> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("xScale" in $$props) $$invalidate(0, xScale = $$props.xScale);
    		if ("yScale" in $$props) $$invalidate(1, yScale = $$props.yScale);
    		if ("fill" in $$props) $$invalidate(2, fill = $$props.fill);
    		if ("points" in $$props) $$invalidate(3, points = $$props.points);
    	};

    	$$self.$capture_state = () => ({
    		area,
    		line,
    		curveMonotoneX: monotoneX,
    		xScale,
    		yScale,
    		fill,
    		points,
    		dFill,
    		dLine
    	});

    	$$self.$inject_state = $$props => {
    		if ("xScale" in $$props) $$invalidate(0, xScale = $$props.xScale);
    		if ("yScale" in $$props) $$invalidate(1, yScale = $$props.yScale);
    		if ("fill" in $$props) $$invalidate(2, fill = $$props.fill);
    		if ("points" in $$props) $$invalidate(3, points = $$props.points);
    		if ("dFill" in $$props) $$invalidate(4, dFill = $$props.dFill);
    		if ("dLine" in $$props) $$invalidate(5, dLine = $$props.dLine);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [xScale, yScale, fill, points, dFill, dLine];
    }

    class Area extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { xScale: 0, yScale: 1, fill: 2, points: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Area",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get xScale() {
    		throw new Error("<Area>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set xScale(value) {
    		throw new Error("<Area>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get yScale() {
    		throw new Error("<Area>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set yScale(value) {
    		throw new Error("<Area>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fill() {
    		throw new Error("<Area>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fill(value) {
    		throw new Error("<Area>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get points() {
    		throw new Error("<Area>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set points(value) {
    		throw new Error("<Area>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* 2022/population-growth/shapes/Line.svelte generated by Svelte v3.29.0 */
    const file$3 = "2022/population-growth/shapes/Line.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	child_ctx[7] = i;
    	return child_ctx;
    }

    // (28:0) {#each points as p, i}
    function create_each_block$3(ctx) {
    	let circle;
    	let circle_cx_value;
    	let circle_cy_value;
    	let t;

    	const block = {
    		c: function create() {
    			circle = svg_element("circle");
    			t = space();
    			attr_dev(circle, "fill", "steelblue");
    			attr_dev(circle, "cx", circle_cx_value = /*xScale*/ ctx[0](/*p*/ ctx[5].x));
    			attr_dev(circle, "cy", circle_cy_value = /*yScale*/ ctx[1](/*p*/ ctx[5].y));
    			attr_dev(circle, "r", "0.5px");
    			add_location(circle, file$3, 28, 2, 720);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, circle, anchor);
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*xScale, points*/ 5 && circle_cx_value !== (circle_cx_value = /*xScale*/ ctx[0](/*p*/ ctx[5].x))) {
    				attr_dev(circle, "cx", circle_cx_value);
    			}

    			if (dirty & /*yScale, points*/ 6 && circle_cy_value !== (circle_cy_value = /*yScale*/ ctx[1](/*p*/ ctx[5].y))) {
    				attr_dev(circle, "cy", circle_cy_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(circle);
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(28:0) {#each points as p, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let path;
    	let t;
    	let each_1_anchor;
    	let each_value = /*points*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			t = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    			attr_dev(path, "d", /*dLine*/ ctx[3]);
    			attr_dev(path, "fill", "none");
    			attr_dev(path, "stroke", "steelblue");
    			attr_dev(path, "stroke-width", "1%");
    			attr_dev(path, "shape-rendering", "geometricPrecision");
    			attr_dev(path, "stroke-linecap", "butt");
    			add_location(path, file$3, 19, 0, 556);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path, anchor);
    			insert_dev(target, t, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*xScale, points, yScale*/ 7) {
    				each_value = /*points*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
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
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path);
    			if (detaching) detach_dev(t);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
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
    	validate_slots("Line", slots, []);

    	let { xScale = () => {
    		
    	} } = $$props;

    	let { yScale = () => {
    		
    	} } = $$props;

    	let { fill = "#50617A" } = $$props;
    	let { points = [] } = $$props;

    	// let dFill = area()
    	//   .x(d => xScale(d.x))
    	//   .y0(d => yScale(points[0].y))
    	//   .y1(d => yScale(d.y))
    	//   .curve(curveMonotoneX)(points)
    	let dLine = line().x(d => xScale(d.x)).y(d => yScale(d.y)).curve(monotoneX)(points);

    	const writable_props = ["xScale", "yScale", "fill", "points"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Line> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("xScale" in $$props) $$invalidate(0, xScale = $$props.xScale);
    		if ("yScale" in $$props) $$invalidate(1, yScale = $$props.yScale);
    		if ("fill" in $$props) $$invalidate(4, fill = $$props.fill);
    		if ("points" in $$props) $$invalidate(2, points = $$props.points);
    	};

    	$$self.$capture_state = () => ({
    		line,
    		curveMonotoneX: monotoneX,
    		xScale,
    		yScale,
    		fill,
    		points,
    		dLine
    	});

    	$$self.$inject_state = $$props => {
    		if ("xScale" in $$props) $$invalidate(0, xScale = $$props.xScale);
    		if ("yScale" in $$props) $$invalidate(1, yScale = $$props.yScale);
    		if ("fill" in $$props) $$invalidate(4, fill = $$props.fill);
    		if ("points" in $$props) $$invalidate(2, points = $$props.points);
    		if ("dLine" in $$props) $$invalidate(3, dLine = $$props.dLine);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [xScale, yScale, points, dLine, fill];
    }

    class Line extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { xScale: 0, yScale: 1, fill: 4, points: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Line",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get xScale() {
    		throw new Error("<Line>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set xScale(value) {
    		throw new Error("<Line>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get yScale() {
    		throw new Error("<Line>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set yScale(value) {
    		throw new Error("<Line>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fill() {
    		throw new Error("<Line>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fill(value) {
    		throw new Error("<Line>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get points() {
    		throw new Error("<Line>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set points(value) {
    		throw new Error("<Line>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* 2022/population-growth/shapes/Triangle.svelte generated by Svelte v3.29.0 */
    const file$4 = "2022/population-growth/shapes/Triangle.svelte";

    function create_fragment$4(ctx) {
    	let path;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", /*dFill*/ ctx[1]);
    			attr_dev(path, "fill", /*fill*/ ctx[0]);
    			attr_dev(path, "stroke", "none");
    			attr_dev(path, "shape-rendering", "geometricPrecision");
    			add_location(path, file$4, 36, 0, 768);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*fill*/ 1) {
    				attr_dev(path, "fill", /*fill*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
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
    	validate_slots("Triangle", slots, []);

    	let { xScale = () => {
    		
    	} } = $$props;

    	let { yScale = () => {
    		
    	} } = $$props;

    	let { fill = "none" } = $$props;
    	let { isFuture = false } = $$props;
    	let { points = [] } = $$props;

    	// let x = xScale(points[points.length - 1].x)
    	// add rect
    	// let end = xScale('October 24, 2022')
    	let last = points[points.length - 1];

    	if (!isFuture) {
    		points.push({ y: last.y, x: "October 18, 2022" });
    	} else {
    		points.push({ y: last.y, x: "December 31, 2030" });
    	}

    	let dFill = area().x(d => {
    		return xScale(d.x);
    	}).y0(d => yScale(points[0].y)).y1(d => yScale(d.y)).curve(monotoneX)(points);

    	const writable_props = ["xScale", "yScale", "fill", "isFuture", "points"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Triangle> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("xScale" in $$props) $$invalidate(2, xScale = $$props.xScale);
    		if ("yScale" in $$props) $$invalidate(3, yScale = $$props.yScale);
    		if ("fill" in $$props) $$invalidate(0, fill = $$props.fill);
    		if ("isFuture" in $$props) $$invalidate(4, isFuture = $$props.isFuture);
    		if ("points" in $$props) $$invalidate(5, points = $$props.points);
    	};

    	$$self.$capture_state = () => ({
    		area,
    		line,
    		curveMonotoneX: monotoneX,
    		xScale,
    		yScale,
    		fill,
    		isFuture,
    		points,
    		last,
    		dFill
    	});

    	$$self.$inject_state = $$props => {
    		if ("xScale" in $$props) $$invalidate(2, xScale = $$props.xScale);
    		if ("yScale" in $$props) $$invalidate(3, yScale = $$props.yScale);
    		if ("fill" in $$props) $$invalidate(0, fill = $$props.fill);
    		if ("isFuture" in $$props) $$invalidate(4, isFuture = $$props.isFuture);
    		if ("points" in $$props) $$invalidate(5, points = $$props.points);
    		if ("last" in $$props) last = $$props.last;
    		if ("dFill" in $$props) $$invalidate(1, dFill = $$props.dFill);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [fill, dFill, xScale, yScale, isFuture, points];
    }

    class Triangle extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			xScale: 2,
    			yScale: 3,
    			fill: 0,
    			isFuture: 4,
    			points: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Triangle",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get xScale() {
    		throw new Error("<Triangle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set xScale(value) {
    		throw new Error("<Triangle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get yScale() {
    		throw new Error("<Triangle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set yScale(value) {
    		throw new Error("<Triangle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fill() {
    		throw new Error("<Triangle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fill(value) {
    		throw new Error("<Triangle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isFuture() {
    		throw new Error("<Triangle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isFuture(value) {
    		throw new Error("<Triangle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get points() {
    		throw new Error("<Triangle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set points(value) {
    		throw new Error("<Triangle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var points = [
      // { x: 1950, y: 1111836 },
      // { x: 1951, y: 1176622 },
      // { x: 1952, y: 1241408 },
      // { x: 1953, y: 1306194 },
      // { x: 1954, y: 1370980 },
      // { x: 1955, y: 1435766 },
      // { x: 1956, y: 1500552 },
      // { x: 1957, y: 1565337 },
      // { x: 1958, y: 1630123 },
      // { x: 1959, y: 1694909 },
      // { x: 1960, y: 1759695 },
      // { x: 1961, y: 1824481 },
      // { x: 1962, y: 1851006 },
      // { x: 1963, y: 1877531 },
      // { x: 1964, y: 1904055 },
      // { x: 1965, y: 1930580 },
      { x: 1966, y: 1957105 },
      { x: 1967, y: 1983630 },
      { x: 1968, y: 2010155 },
      { x: 1969, y: 2036679 },
      { x: 1970, y: 2063204 },
      { x: 1971, y: 2089729 },
      { x: 1972, y: 2096641 },
      { x: 1973, y: 2103554 },
      { x: 1974, y: 2110466 },
      { x: 1975, y: 2117379 },
      { x: 1976, y: 2124291 },
      { x: 1977, y: 2126912 },
      { x: 1978, y: 2129533 },
      { x: 1979, y: 2132153 },
      { x: 1980, y: 2134774 },
      { x: 1981, y: 2137395 },
      { x: 1982, y: 2148460 },
      { x: 1983, y: 2159525 },
      { x: 1984, y: 2170591 },
      { x: 1985, y: 2181656 },
      { x: 1986, y: 2192721 },
      { x: 1987, y: 2209331 },
      { x: 1988, y: 2225941 },
      { x: 1989, y: 2242551 },
      { x: 1990, y: 2259161 },
      { x: 1991, y: 2275771 },
      { x: 1992, y: 2297701 },
      { x: 1993, y: 2319631 },
      { x: 1994, y: 2341561 },
      { x: 1995, y: 2363491 },
      { x: 1996, y: 2385421 },
      { x: 1997, y: 2404636 },
      { x: 1998, y: 2423850 },
      { x: 1999, y: 2443065 },
      { x: 2000, y: 2462279 },
      { x: 2001, y: 2481494 },
      { x: 2002, y: 2485851 },
      { x: 2003, y: 2490209 },
      { x: 2004, y: 2494566 },
      { x: 2005, y: 2498924 },
      { x: 2006, y: 2503281 },
      { x: 2007, y: 2525637 },
      { x: 2008, y: 2547993 },
      { x: 2009, y: 2570348 },
      { x: 2010, y: 2592704 },
      { x: 2011, y: 2615060 },
      { x: 2012, y: 2638362 },
      { x: 2013, y: 2661664 },
      { x: 2014, y: 2684967 },
      { x: 2015, y: 2708269 },
      { x: 2016, y: 2731571 },
      { x: 2017, y: 2744128 },
      { x: 2018, y: 2756685 },
      { x: 2019, y: 2769242 },
      { x: 2020, y: 2781799 },
      { x: 2021, y: 2794356 },
      // { x: '2021-12-01', y: 2801356 },
      { x: 2022, y: 2814920 },
      // { x: '2021-10-01', y: 2814920 },

      // { x: 2023, y: 2835485 },
      // { x: 2024, y: 2856049 },
      // { x: 2025, y: 2876614 },
      // { x: 2026, y: 2897178 },
      // { x: 2027, y: 2917742 },
      // { x: 2028, y: 2938307 },
      // { x: 2029, y: 2958871 },
      // { x: 2030, y: 2979436 },
      // { x: 2031, y: 3000000 },
    ];

    var terms = [

      {
        date: 'December 5, 1966', //first after merger
        mayor: 'Denison',
        color: '#6699cc',
        mid: 2043204,
        points: [

          { x: 1966, y: 1957105 },
          { x: 1967, y: 1983630 },
          { x: 1968, y: 2010155 },
          { x: 1969, y: 2036679 },
          { x: 1969, y: 2036679 },
          { x: 1970, y: 2063204 },
          { x: 1971, y: 2089729 },
          { x: 1972, y: 2096641 },
        ]
      },
      {
        date: 'December 1, 1972',
        mayor: 'Crombie', // /Beavis
        color: '#705E5C',
        mid: 2129533,
        points: [

          { x: 1972, y: 2096641 },
          { x: 1973, y: 2103554 },
          { x: 1974, y: 2110466 },
          { x: 1975, y: 2117379 },
          { x: 1976, y: 2124291 },
          { x: 1977, y: 2126912 },
          { x: 1978, y: 2129533 },
        ]
      },
      {
        date: 'November 13, 1978',
        mayor: 'Sewell',//'Sewell',
        mid: 2158774,
        color: '#d8b3e6',
        points: [

          { x: 1978, y: 2129533 },
          { x: 1979, y: 2132153 },
          { x: 1980, y: 2134774 },
        ]
      },
      {
        date: 'November 10, 1980',
        mayor: 'Eggleton',
        color: '#d7d5d2',
        mid: 2232551,
        points: [

          { x: 1980, y: 2134774 },
          { x: 1981, y: 2137395 },
          { x: 1982, y: 2148460 },
          { x: 1982, y: 2148460 },
          { x: 1983, y: 2159525 },
          { x: 1984, y: 2170591 },
          { x: 1985, y: 2181656 },
          { x: 1986, y: 2192721 },
          { x: 1987, y: 2209331 },
          { x: 1988, y: 2225941 },
          { x: 1989, y: 2242551 },
          { x: 1990, y: 2259161 },
          { x: 1991, y: 2275771 },
        ]
      },
      {
        date: 'November 12, 1991',
        mayor: 'Rowlands',
        color: '#8BA3A2',
        mid: 2330636,
        points: [

          { x: 1991, y: 2275771 },
          { x: 1992, y: 2297701 },
          { x: 1993, y: 2319631 },
          { x: 1994, y: 2341561 },
        ]
      },
      {
        date: 'November 30, 1994',
        mayor: 'Hall',
        color: '#C4ABAB',
        mid: 2386636,
        points: [
          { x: 1994, y: 2341561 },
          { x: 1995, y: 2363491 },
          { x: 1996, y: 2385421 },
          { x: 1997, y: 2404636 },
        ]
      },
      {
        date: 'November 10, 1997',
        mayor: 'Lastman',
        color: '#C4ABAB',
        mid: 2465851,
        points: [

          { x: 1997, y: 2404636 },
          { x: 1998, y: 2423850 },
          { x: 1999, y: 2443065 },
          { x: 2000, y: 2462279 },

          { x: 2000, y: 2462279 },
          { x: 2001, y: 2481494 },
          { x: 2002, y: 2485851 },
          { x: 2003, y: 2490209 },
        ]
      },
      {
        date: '10 November 2003',
        mayor: 'Miller',
        color: '#8a849a',
        mid: 2552704,
        points: [
          { x: 2003, y: 2490209 },
          { x: 2004, y: 2494566 },
          { x: 2005, y: 2498924 },
          { x: 2006, y: 2503281 },
          { x: 2006, y: 2503281 },
          { x: 2007, y: 2525637 },
          { x: 2008, y: 2547993 },
          { x: 2009, y: 2570348 },
          { x: 2010, y: 2592704 },

        ]
      },
      {
        date: 'October 25, 2010',
        mayor: 'Ford',
        color: '#b5b0bf',
        mid: 2651664,
        points: [

          { x: 2010, y: 2592704 },
          { x: 2011, y: 2615060 },
          { x: 2012, y: 2638362 },
          { x: 2013, y: 2661664 },
          { x: 2014, y: 2684967 },

        ]
      },
      {
        date: 'October 27, 2014',
        mayor: 'Tory',
        color: '#D68881',
        mid: 2759242,
        points: [

          { x: 2014, y: 2684967 },
          { x: 2015, y: 2708269 },
          { x: 2016, y: 2731571 },
          { x: 2017, y: 2744128 },
          { x: 2018, y: 2756685 },

          { x: 2018, y: 2756685 },
          { x: 2019, y: 2769242 },
          { x: 2020, y: 2781799 },
          { x: 2021, y: 2794356 },
          { x: 2022, y: 2814920 },
        ]
      },
      {
        date: 'October 24, 2022',
        mayor: '',
        color: 'lightgrey',
        future: true,
        points: [

          { x: 2022, y: 2814920 },
          { x: 2023, y: 2835485 },
          { x: 2024, y: 2856049 },
          { x: 2025, y: 2876614 },
          { x: 2026, y: 2897178 },
        ]
      },
      {
        date: 'October 24, 2026',
        future: true,
        mayor: '',
        color: 'grey',
        points: [

          { x: 2026, y: 2897178 },
          { x: 2027, y: 2917742 },
          { x: 2028, y: 2938307 },
          { x: 2029, y: 2958871 },
          { x: 2030, y: 2979436 },
        ]
      },

    ];

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

    let combos = {

      // juno: ['blue', 'mud', 'navy', 'slate', 'pink', 'burn'],
      // barrow: ['rouge', 'red', 'orange', 'burnt', 'brown', 'greygreen'],
      // roma: ["#8a849a", "#b5b0bf", 'rose', "lighter", "greygreen", 'mud'],
      // palmer: ['red', 'navy', 'olive', 'pink', 'suede', 'sky'],
      // mark: ["#848f9a", "#9aa4ac", 'slate', "#b0b8bf", 'mud', 'grey'],
      // salmon: ['sky', 'sea', 'fuscia', 'slate', 'mud', 'fudge'],
      // dupont: ['green', 'brown', 'orange', 'red', 'olive', 'blue'],
      // bloor: ['night', 'navy', 'beige', 'rouge', 'mud', 'grey'],
      yukon: ['sky', //denison
        'beige', //crombie
        'red', //sewell
        '#978BA3', //eggleton
        '#8C8C88',//rowlands 
        '', //hall
        '#cc6966',//lastman
        'blue', //miller
        '', //ford
        '#2D85A8'//tory
      ],//'mud', 'slate','brown',
      // david: ['blue', 'green', 'yellow', 'red', 'pink', 'light'],

      // neste: ['mud', 'cherry', 'royal', 'rouge', 'greygreen', 'greypurple'],
      // ken: ["red", "sky", "#c67a53", "greygreen", "#dfb59f", "mud"],
      // slug: ['', '', '', '',]

      // reds: ['#cc6966', '#cc6f66', '#e6b3bc', 'orange']
      // browns: ["#9a9484", "#a39e8f", "#aca89a", "#b6b1a5", "#bfbbb0", "#c8c5bc", "#d1cec7", "#dad8d2", "#e3e2dd"],
      // reds: ["#9a8487", "#a38f92", "#ac9a9d", "#b6a5a8", "#bfb0b3", "#c8bcbe", "#d1c7c8", "#dad2d3", "#e3ddde"],
      // blues: ["#2d5086", "#335b99", "#3966ac", "#4072bf", "#5380c6", "#668ecc", "#799cd2", "#8caad9", "#9fb8df", "#b3c6e6"],
      // reds: ["#862d35", "#99333d", "#ac3944", "#bf404c", "#c6535e", "#cc6670", "#d27982", "#d98c94", "#df9fa6", "#e6b3b7"],
      // greens: ["#2d864c", "#339957", "#39ac62", "#40bf6d", "#53c67b", "#66cc8a", "#79d298", "#8cd9a7", "#9fdfb6", "#b3e6c4"],
      // purples: ["#4e2d86", "#593399", "#6439ac", "#6f40bf", "#7d53c6", "#8c66cc", "#9a79d2", "#a88cd9", "#b79fdf", "#c5b3e6"]
    };

    Object.keys(combos).forEach((k) => {
      combos[k] = combos[k].map((c) => colors[c] || c);
    });

    /* 2022/population-growth/Post.svelte generated by Svelte v3.29.0 */

    const file$5 = "2022/population-growth/Post.svelte";

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-1luaz8f-style";
    	style.textContent = ".top-stat.svelte-1luaz8f{font-size:15px;color:grey;right:-40px;position:absolute;top:-55px;line-height:1.2rem}.col.svelte-1luaz8f{text-align:center;margin-top:4rem}.today.svelte-1luaz8f{height:80%;position:absolute;top:18%;border-left:2px dashed grey}.container.svelte-1luaz8f{position:relative;min-width:600px;aspect-ratio:1.618/1}.mayor.svelte-1luaz8f{position:absolute;font-size:18px;color:grey}svg.svelte-1luaz8f{overflow:visible;position:relative}.all.svelte-1luaz8f{margin:4rem}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUG9zdC5zdmVsdGUiLCJzb3VyY2VzIjpbIlBvc3Quc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG4gIGltcG9ydCBzY2FsZSBmcm9tICcuL2xpYi9zY2FsZS5qcydcbiAgaW1wb3J0IHNwYWNldGltZSBmcm9tICdzcGFjZXRpbWUnXG4gIGltcG9ydCBYQXhpcyBmcm9tICcuL3hBeGlzLnN2ZWx0ZSdcbiAgaW1wb3J0IFlBeGlzIGZyb20gJy4veUF4aXMuc3ZlbHRlJ1xuICBpbXBvcnQgQXJlYSBmcm9tICcuL3NoYXBlcy9BcmVhLnN2ZWx0ZSdcbiAgaW1wb3J0IExpbmUgZnJvbSAnLi9zaGFwZXMvTGluZS5zdmVsdGUnXG4gIGltcG9ydCBUcmlhbmdsZSBmcm9tICcuL3NoYXBlcy9UcmlhbmdsZS5zdmVsdGUnXG4gIGltcG9ydCBwb2ludHMgZnJvbSAnLi9kYXRhL3BvcHVsYXRpb24uanMnXG4gIC8vIGltcG9ydCB0ZXJtcyBmcm9tICcuL2RhdGEvYnktZWxlY3Rpb24uanMnXG4gIGltcG9ydCB0ZXJtcyBmcm9tICcuL2RhdGEvYnktbWF5b3IuanMnXG4gIC8vIGltcG9ydCBmdXR1cmUgZnJvbSAnLi9kYXRhL2Z1dHVyZS5qcydcbiAgaW1wb3J0IGNvbWJvcyBmcm9tICcuL2xpYi9jb21ib3MuanMnXG5cbiAgbGV0IGNvbWJvID0gY29tYm9zLnl1a29uXG4gIHRlcm1zLmZvckVhY2goKG8sIGkpID0+IHtcbiAgICBvLmNvbG9yID0gY29tYm9baV0gfHwgby5jb2xvclxuICB9KVxuXG4gIGxldCBtYXggPSAzMDAwMDAwXG4gIGxldCBtaW4gPSB0ZXJtc1swXS5wb2ludHNbMF0ueVxuICBsZXQgc3RhcnQgPSBzcGFjZXRpbWUodGVybXNbMF0ucG9pbnRzWzBdLnggKyAnLTAxLTAxJylcbiAgbGV0IGVuZCA9IHNwYWNldGltZSgnMjAzMC0wMS0wMScpXG4gIC8vNjMgeWVhcnNcbiAgLy8rMSwwNDIsODk1IHBlb3BsZVxuICAvLyAxNmsgcGVvcGxlIC95ZWFyXG5cbiAgLy8gY29uc29sZS5sb2coc3RhcnQuZGlmZihlbmQsICd5ZWFycycpKVxuICBsZXQgeFNjYWxlID0gc3RyID0+IHNjYWxlKHsgd29ybGQ6IFswLCAxMDBdLCBtaW5tYXg6IFtzdGFydC5lcG9jaCwgZW5kLmVwb2NoXSB9LCBzcGFjZXRpbWUoU3RyaW5nKHN0cikpLmVwb2NoKVxuICBsZXQgeVNjYWxlID0gbiA9PiBzY2FsZSh7IHdvcmxkOiBbMCwgMTAwXSwgbWlubWF4OiBbbWF4LCBtaW5dIH0sIG4pIC8vIHJldmVyc2VkXG5cbiAgbGV0IHRvZGF5WCA9IHhTY2FsZSgnT2N0b2JlciAyNCwgMjAyMicpXG4gIC8vIHBvaW50cyA9IGRhdGFcbjwvc2NyaXB0PlxuXG48ZGl2IGNsYXNzPVwiY29sIGFsbFwiPlxuICA8ZGl2IHN0eWxlPVwiaGVpZ2h0OjUwcHg7IHRleHQtYWxpZ246IGxlZnQ7ICBtYXJnaW4tbGVmdDo0cmVtO21hcmdpbi10b3A6M3JlbTsgY29sb3I6Z3JleTtcIj5cbiAgICBQb3B1bGF0aW9uIGdyb3d0aCBieSBNYXlvclxuICA8L2Rpdj5cbiAgPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiPlxuICAgIDxkaXYgY2xhc3M9XCJ0b3Atc3RhdFwiPjMgbWlsbGlvbjxiciAvPmJ5IDIwMzE8YnIgLz4qPC9kaXY+XG4gICAgPHN2ZyB2aWV3Qm94PVwiMCAwIDEwMCAxMDBcIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwibm9uZVwiIHdpZHRoPVwiMTAwJVwiIGhlaWdodD1cIjEwMCVcIj5cbiAgICAgIDwhLS0gPExpbmUge3BvaW50c30ge3hTY2FsZX0ge3lTY2FsZX0gLz4gLS0+XG4gICAgICA8IS0tIDxBcmVhIHtmdXR1cmV9IHt4U2NhbGV9IHt5U2NhbGV9IGZpbGw9XCJsaWdodGdyZXlcIiAvPiAtLT5cblxuICAgICAgeyNlYWNoIHRlcm1zIGFzIHRlcm0sIGl9XG4gICAgICAgIDxUcmlhbmdsZSBwb2ludHM9e3Rlcm0ucG9pbnRzfSB7eFNjYWxlfSB7eVNjYWxlfSBmaWxsPXt0ZXJtLmNvbG9yIHx8ICdsaWdodGdyZXknfSBpc0Z1dHVyZT17dGVybS5mdXR1cmV9IC8+XG4gICAgICB7L2VhY2h9XG4gICAgICA8bGluZVxuICAgICAgICB4MT17eFNjYWxlKDIwMDAwMDApfVxuICAgICAgICB5MT17eVNjYWxlKHRlcm1zWzBdLnBvaW50c1swXS55KX1cbiAgICAgICAgeDI9e3hTY2FsZSgnMjAzMCcpfVxuICAgICAgICB5Mj17eVNjYWxlKDMwMDAwMDApfVxuICAgICAgICBzdHJva2Utd2lkdGg9XCIwLjUlXCJcbiAgICAgICAgc3Ryb2tlPVwiZ3JleVwiXG4gICAgICAgIHN0cm9rZS1kYXNoYXJyYXk9XCIxXCJcbiAgICAgIC8+XG4gICAgPC9zdmc+XG4gICAgPFhBeGlzIHt4U2NhbGV9IC8+XG4gICAgPFlBeGlzIHt5U2NhbGV9IC8+XG4gICAgPGRpdiBjbGFzcz1cInRvZGF5XCIgc3R5bGU9XCJsZWZ0Ont4U2NhbGUoJ09jdG9iZXIgMjQsIDIwMjInKSArIDAuM30lO1wiIC8+XG4gICAgeyNlYWNoIHRlcm1zIGFzIHRlcm0sIGl9XG4gICAgICA8ZGl2IGNsYXNzPVwibWF5b3JcIiBzdHlsZT1cImNvbG9yOnt0ZXJtLmNvbG9yfTsgIGxlZnQ6e3RvZGF5WCArIDJ9JTsgdG9wOnt5U2NhbGUodGVybS5taWQpfSU7XCI+XG4gICAgICAgIHt0ZXJtLm1heW9yfVxuICAgICAgPC9kaXY+XG4gICAgICA8IS0tIHsjaWYgIXRlcm0uZnV0dXJlICYmIGkgPiAwfVxuICAgICAgICA8ZGl2XG4gICAgICAgICAgY2xhc3M9XCJib3R0b20tbGluZVwiXG4gICAgICAgICAgc3R5bGU9XCJiYWNrZ3JvdW5kLWNvbG9yOnt0ZXJtLmNvbG9yfTsgbWFyZ2luLWxlZnQ6LTE1cHg7XG4gICAgICAgICAgd2lkdGg6ezEwfXB4OyBcbiAgICAgICAgICBsZWZ0Ont4U2NhbGUodGVybS5wb2ludHNbMF0ueCl9JTtcIlxuICAgICAgICAvPlxuICAgICAgey9pZn0gLS0+XG4gICAgICA8IS0tIDxkaXYgY2xhc3M9XCJ0b2RheVwiIHN0eWxlPVwibGVmdDp7eFNjYWxlKHRlcm0ucG9pbnRzWzBdLngpfSU7XCIgLz4gLS0+XG4gICAgey9lYWNofVxuICA8L2Rpdj5cbjwvZGl2PlxuXG48c3R5bGU+XG4gIC50b3Atc3RhdCB7XG4gICAgZm9udC1zaXplOiAxNXB4O1xuICAgIGNvbG9yOiBncmV5O1xuICAgIHJpZ2h0OiAtNDBweDtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgdG9wOiAtNTVweDtcbiAgICBsaW5lLWhlaWdodDogMS4ycmVtO1xuICB9XG4gIC5jb2wge1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBtYXJnaW4tdG9wOiA0cmVtO1xuICB9XG4gIC50b2RheSB7XG4gICAgaGVpZ2h0OiA4MCU7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIHRvcDogMTglO1xuICAgIGJvcmRlci1sZWZ0OiAycHggZGFzaGVkIGdyZXk7XG4gIH1cbiAgLmNvbnRhaW5lciB7XG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgIC8qIGJvcmRlcjogMXB4IHNvbGlkIGdyZXk7ICovXG4gICAgLyogbWFyZ2luOiAzcmVtOyAqL1xuICAgIG1pbi13aWR0aDogNjAwcHg7XG4gICAgLyogcGFkZGluZy1sZWZ0OiA0MHB4OyAqL1xuICAgIGFzcGVjdC1yYXRpbzogMS42MTgvMTsgLyogZ29sZGVuICovXG4gIH1cbiAgLm1heW9yIHtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgZm9udC1zaXplOiAxOHB4O1xuICAgIGNvbG9yOiBncmV5O1xuICB9XG5cbiAgc3ZnIHtcbiAgICBvdmVyZmxvdzogdmlzaWJsZTtcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gIH1cbiAgLmFsbCB7XG4gICAgbWFyZ2luOiA0cmVtO1xuICB9XG48L3N0eWxlPlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQStFRSxTQUFTLGVBQUMsQ0FBQyxBQUNULFNBQVMsQ0FBRSxJQUFJLENBQ2YsS0FBSyxDQUFFLElBQUksQ0FDWCxLQUFLLENBQUUsS0FBSyxDQUNaLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLEdBQUcsQ0FBRSxLQUFLLENBQ1YsV0FBVyxDQUFFLE1BQU0sQUFDckIsQ0FBQyxBQUNELElBQUksZUFBQyxDQUFDLEFBQ0osVUFBVSxDQUFFLE1BQU0sQ0FDbEIsVUFBVSxDQUFFLElBQUksQUFDbEIsQ0FBQyxBQUNELE1BQU0sZUFBQyxDQUFDLEFBQ04sTUFBTSxDQUFFLEdBQUcsQ0FDWCxRQUFRLENBQUUsUUFBUSxDQUNsQixHQUFHLENBQUUsR0FBRyxDQUNSLFdBQVcsQ0FBRSxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQUFDOUIsQ0FBQyxBQUNELFVBQVUsZUFBQyxDQUFDLEFBQ1YsUUFBUSxDQUFFLFFBQVEsQ0FHbEIsU0FBUyxDQUFFLEtBQUssQ0FFaEIsWUFBWSxDQUFFLEtBQUssQ0FBQyxDQUFDLEFBQ3ZCLENBQUMsQUFDRCxNQUFNLGVBQUMsQ0FBQyxBQUNOLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLFNBQVMsQ0FBRSxJQUFJLENBQ2YsS0FBSyxDQUFFLElBQUksQUFDYixDQUFDLEFBRUQsR0FBRyxlQUFDLENBQUMsQUFDSCxRQUFRLENBQUUsT0FBTyxDQUNqQixRQUFRLENBQUUsUUFBUSxBQUNwQixDQUFDLEFBQ0QsSUFBSSxlQUFDLENBQUMsQUFDSixNQUFNLENBQUUsSUFBSSxBQUNkLENBQUMifQ== */";
    	append_dev(document.head, style);
    }

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	child_ctx[10] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	child_ctx[10] = i;
    	return child_ctx;
    }

    // (46:6) {#each terms as term, i}
    function create_each_block_1(ctx) {
    	let triangle;
    	let current;

    	triangle = new Triangle({
    			props: {
    				points: /*term*/ ctx[8].points,
    				xScale: /*xScale*/ ctx[0],
    				yScale: /*yScale*/ ctx[1],
    				fill: /*term*/ ctx[8].color || "lightgrey",
    				isFuture: /*term*/ ctx[8].future
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(triangle.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(triangle, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(triangle.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(triangle.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(triangle, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(46:6) {#each terms as term, i}",
    		ctx
    	});

    	return block;
    }

    // (62:4) {#each terms as term, i}
    function create_each_block$4(ctx) {
    	let div;
    	let t0_value = /*term*/ ctx[8].mayor + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(div, "class", "mayor svelte-1luaz8f");
    			set_style(div, "color", /*term*/ ctx[8].color);
    			set_style(div, "left", /*todayX*/ ctx[2] + 2 + "%");
    			set_style(div, "top", /*yScale*/ ctx[1](/*term*/ ctx[8].mid) + "%");
    			add_location(div, file$5, 62, 6, 2122);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			insert_dev(target, t1, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(62:4) {#each terms as term, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div4;
    	let div0;
    	let t1;
    	let div3;
    	let div1;
    	let t2;
    	let br0;
    	let t3;
    	let br1;
    	let t4;
    	let t5;
    	let svg;
    	let line;
    	let line_x__value;
    	let line_y__value;
    	let line_x__value_1;
    	let line_y__value_1;
    	let t6;
    	let xaxis;
    	let t7;
    	let yaxis;
    	let t8;
    	let div2;
    	let t9;
    	let current;
    	let each_value_1 = terms;
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	xaxis = new XAxis({
    			props: { xScale: /*xScale*/ ctx[0] },
    			$$inline: true
    		});

    	yaxis = new YAxis({
    			props: { yScale: /*yScale*/ ctx[1] },
    			$$inline: true
    		});

    	let each_value = terms;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div0 = element("div");
    			div0.textContent = "Population growth by Mayor";
    			t1 = space();
    			div3 = element("div");
    			div1 = element("div");
    			t2 = text("3 million");
    			br0 = element("br");
    			t3 = text("by 2031");
    			br1 = element("br");
    			t4 = text("*");
    			t5 = space();
    			svg = svg_element("svg");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			line = svg_element("line");
    			t6 = space();
    			create_component(xaxis.$$.fragment);
    			t7 = space();
    			create_component(yaxis.$$.fragment);
    			t8 = space();
    			div2 = element("div");
    			t9 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			set_style(div0, "height", "50px");
    			set_style(div0, "text-align", "left");
    			set_style(div0, "margin-left", "4rem");
    			set_style(div0, "margin-top", "3rem");
    			set_style(div0, "color", "grey");
    			add_location(div0, file$5, 36, 2, 1139);
    			add_location(br0, file$5, 40, 35, 1332);
    			add_location(br1, file$5, 40, 48, 1345);
    			attr_dev(div1, "class", "top-stat svelte-1luaz8f");
    			add_location(div1, file$5, 40, 4, 1301);
    			attr_dev(line, "x1", line_x__value = /*xScale*/ ctx[0](2000000));
    			attr_dev(line, "y1", line_y__value = /*yScale*/ ctx[1](terms[0].points[0].y));
    			attr_dev(line, "x2", line_x__value_1 = /*xScale*/ ctx[0]("2030"));
    			attr_dev(line, "y2", line_y__value_1 = /*yScale*/ ctx[1](3000000));
    			attr_dev(line, "stroke-width", "0.5%");
    			attr_dev(line, "stroke", "grey");
    			attr_dev(line, "stroke-dasharray", "1");
    			add_location(line, file$5, 48, 6, 1732);
    			attr_dev(svg, "viewBox", "0 0 100 100");
    			attr_dev(svg, "preserveAspectRatio", "none");
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "class", "svelte-1luaz8f");
    			add_location(svg, file$5, 41, 4, 1363);
    			attr_dev(div2, "class", "today svelte-1luaz8f");
    			set_style(div2, "left", /*xScale*/ ctx[0]("October 24, 2022") + 0.3 + "%");
    			add_location(div2, file$5, 60, 4, 2015);
    			attr_dev(div3, "class", "container svelte-1luaz8f");
    			add_location(div3, file$5, 39, 2, 1273);
    			attr_dev(div4, "class", "col all svelte-1luaz8f");
    			add_location(div4, file$5, 35, 0, 1115);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div0);
    			append_dev(div4, t1);
    			append_dev(div4, div3);
    			append_dev(div3, div1);
    			append_dev(div1, t2);
    			append_dev(div1, br0);
    			append_dev(div1, t3);
    			append_dev(div1, br1);
    			append_dev(div1, t4);
    			append_dev(div3, t5);
    			append_dev(div3, svg);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(svg, null);
    			}

    			append_dev(svg, line);
    			append_dev(div3, t6);
    			mount_component(xaxis, div3, null);
    			append_dev(div3, t7);
    			mount_component(yaxis, div3, null);
    			append_dev(div3, t8);
    			append_dev(div3, div2);
    			append_dev(div3, t9);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*terms, xScale, yScale*/ 3) {
    				each_value_1 = terms;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						transition_in(each_blocks_1[i], 1);
    						each_blocks_1[i].m(svg, line);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks_1.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (dirty & /*terms, todayX, yScale*/ 6) {
    				each_value = terms;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$4(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$4(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div3, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			transition_in(xaxis.$$.fragment, local);
    			transition_in(yaxis.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks_1 = each_blocks_1.filter(Boolean);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out(each_blocks_1[i]);
    			}

    			transition_out(xaxis.$$.fragment, local);
    			transition_out(yaxis.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			destroy_each(each_blocks_1, detaching);
    			destroy_component(xaxis);
    			destroy_component(yaxis);
    			destroy_each(each_blocks, detaching);
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

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Post", slots, []);
    	let combo = combos.yukon;

    	terms.forEach((o, i) => {
    		o.color = combo[i] || o.color;
    	});

    	let max = 3000000;
    	let min = terms[0].points[0].y;
    	let start = main$1(terms[0].points[0].x + "-01-01");
    	let end = main$1("2030-01-01");

    	//63 years
    	//+1,042,895 people
    	// 16k people /year
    	// console.log(start.diff(end, 'years'))
    	let xScale = str => scaleLinear(
    		{
    			world: [0, 100],
    			minmax: [start.epoch, end.epoch]
    		},
    		main$1(String(str)).epoch
    	);

    	let yScale = n => scaleLinear({ world: [0, 100], minmax: [max, min] }, n); // reversed
    	let todayX = xScale("October 24, 2022");
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Post> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		scale: scaleLinear,
    		spacetime: main$1,
    		XAxis,
    		YAxis,
    		Area,
    		Line,
    		Triangle,
    		points,
    		terms,
    		combos,
    		combo,
    		max,
    		min,
    		start,
    		end,
    		xScale,
    		yScale,
    		todayX
    	});

    	$$self.$inject_state = $$props => {
    		if ("combo" in $$props) combo = $$props.combo;
    		if ("max" in $$props) max = $$props.max;
    		if ("min" in $$props) min = $$props.min;
    		if ("start" in $$props) start = $$props.start;
    		if ("end" in $$props) end = $$props.end;
    		if ("xScale" in $$props) $$invalidate(0, xScale = $$props.xScale);
    		if ("yScale" in $$props) $$invalidate(1, yScale = $$props.yScale);
    		if ("todayX" in $$props) $$invalidate(2, todayX = $$props.todayX);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [xScale, yScale, todayX];
    }

    class Post extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1luaz8f-style")) add_css$2();
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Post",
    			options,
    			id: create_fragment$5.name
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
