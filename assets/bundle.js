(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(_dereq_,module,exports){
"use strict";

function _templateObject2() {
  var data = _taggedTemplateLiteral(["<h3 style=\"margin-left:1rem;\">", "</h3>"]);

  _templateObject2 = function _templateObject2() {
    return data;
  };

  return data;
}

function _templateObject() {
  var data = _taggedTemplateLiteral(["<a href=\"", "\" class=\"left mw20 m3\" style=\"cursor:pointer;\">\n    <div class=\"\">\n      <span class=\"link\">", "</span>\n    </div>\n    <img class=\"block\" style=\"margin-left:95px; max-width:450px; max-height:100px;\" src=\"", "\" />\n    </a>\n    "]);

  _templateObject = function _templateObject() {
    return data;
  };

  return data;
}

function _taggedTemplateLiteral(strings, raw) { if (!raw) { raw = strings.slice(0); } return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var htm = _dereq_('htm');

var h = htm.bind(_dereq_('vhtml'));

var manifest = _dereq_('./manifest');

var el = document.querySelector('#stage');
var years = Object.keys(manifest).sort().reverse();
var result = [];
years.forEach(function (y) {
  var posts = manifest[y].reverse().map(function (o) {
    var path = y + '/' + o.num;
    return h(_templateObject(), path, o.title, path + '/' + o.thumb);
  });
  result.push(h(_templateObject2(), y));
  result = result.concat(posts);
});
el.innerHTML = result.join(' ');

},{"./manifest":2,"htm":3,"vhtml":4}],2:[function(_dereq_,module,exports){
"use strict";

module.exports = {
  2018: [{
    num: 'sports-by-city',
    title: 'Sports seasons by city',
    thumb: 'thumb.png'
  }, {
    num: 'weather-by-latitude',
    title: 'Weather by latitude',
    thumb: 'thumb.png'
  }, {
    num: 'lunar-astronauts',
    title: 'Lunar astronauts by age',
    thumb: 'thumb.png'
  }, // {
  //   num: '04',
  //   title: 'Toronto and montreal',
  //   thumb: 'thumb.png',
  // },
  {
    num: 'baseball-season',
    title: '2018 baseball season',
    thumb: 'thumb.png'
  }],
  2019: [{
    num: 'nhl-team-performance',
    title: 'NHL performance by team',
    thumb: 'thumb.png'
  }, {
    num: 'nhl-history',
    title: 'History of the NHL',
    thumb: 'thumb.png'
  }, {
    num: 'rain-in-toronto',
    title: 'Rain in Toronto',
    thumb: 'thumb.png'
  }, {
    num: 'break-up-the-year',
    title: 'Break-up the year',
    thumb: 'thumb.png'
  }, // {
  //   num: '05',
  //   title: 'Reading all of wikipedia',
  //   thumb: 'thumb.png',
  // },
  {
    num: 'nhl-arenas',
    title: 'NHL arenas',
    thumb: 'thumb.png'
  }, {
    num: 'baseball-schedule',
    title: 'Baseball schedule',
    thumb: 'thumb.png'
  }, {
    num: 'generations-of-people',
    title: 'Generations of people',
    thumb: 'thumb.png'
  }, {
    num: 'daylight-by-latitude',
    title: 'Daylight by latitude',
    thumb: 'thumb.jpg'
  }, {
    num: 'ontario-landfills',
    title: 'Ontario Landfills',
    thumb: 'thumb.png'
  }, {
    num: 'ontario-line',
    title: 'Ontario Line Map',
    thumb: 'thumb.png'
  }],
  2020: [{
    num: 'ontario-covid',
    title: 'Causes of death in Ontario',
    thumb: 'thumb.png'
  }, {
    num: 'daylight-savings-changes',
    title: 'Daylight Savings times',
    thumb: 'thumb.png'
  }, {
    num: 'year-in-toronto',
    title: 'The Year in Toronto',
    thumb: 'thumb.png'
  }, {
    num: 'skydome-roof-by-year',
    title: 'Skydome roof',
    thumb: 'thumb.png'
  }, {
    num: 'toronto-streets',
    title: 'Toronto street-map',
    thumb: 'thumb.png'
  }, {
    num: 'mayors-of-toronto',
    title: 'Mayors of Toronto',
    thumb: 'thumb.png'
  }, {
    num: 'rocket-launches',
    title: 'Rocket Launches',
    thumb: 'thumb.png'
  }, {
    num: 'nhl-playoffs',
    title: 'NHL playoffs by year',
    thumb: 'thumb.png'
  }, {
    num: 'leafs-roster',
    title: 'Toronto Maple leafs roster',
    thumb: 'thumb.png'
  }, {
    num: 'leafs-budget',
    title: 'Toronto Maple leafs budget',
    thumb: 'thumb.png'
  }, {
    num: 'population-of-canada',
    title: 'Population of Canada',
    thumb: 'thumb.png'
  }, {
    num: 'covid-as-skydome',
    title: 'Covid as percentage of skydome',
    thumb: 'thumb.jpg'
  }, {
    num: 'population-of-ontario',
    title: 'Population of Ontario',
    thumb: 'thumb.jpg'
  }, {
    num: 'toronto-budget',
    title: 'Toronto City budget',
    thumb: 'thumb.png'
  }, {
    num: 'cbc-radio-schedule',
    title: 'CBC Radio 1 Schedule',
    thumb: 'thumb.png'
  }, {
    num: 'earth-as-pie',
    title: 'Earth as a pie-chart',
    thumb: 'thumb.png'
  }, {
    num: 'cerb-budget',
    title: "CERB and Canada's budget",
    thumb: 'thumb.png'
  }, {
    num: 'cerb-population',
    title: "CERB and Canada's population",
    thumb: 'thumb.png'
  }, {
    num: 'covid-income',
    title: "Canada's income during COVID",
    thumb: 'thumb.png'
  }, {
    num: 'sunset-direction',
    title: 'Sunset direction by year',
    thumb: 'thumb.png'
  }, {
    num: 'computer-history',
    title: 'Computer programming timeline',
    thumb: 'thumb.png'
  }, {
    num: 'governments-of-canada',
    title: 'Governments of Canada',
    thumb: 'thumb.png'
  }, {
    num: 'transit-projects-canada',
    title: 'Public Transit in Canada',
    thumb: 'thumb.png'
  }, {
    num: 'stanley-cups-in-canada',
    title: 'Stanley Cups in Canada',
    thumb: 'thumb.png'
  }, {
    num: 'climates-canada',
    title: 'Climates in Canada',
    thumb: 'thumb.png'
  }, {
    num: 'snowfall-in-canada',
    title: 'Snowfall in Canada',
    thumb: 'thumb.png'
  }, {
    num: 'computers-and-typewriters',
    title: 'Computers and Typewriters',
    thumb: 'thumb.png'
  }]
};

},{}],3:[function(_dereq_,module,exports){
!function(){var n=function(t,e,s,u){var r;e[0]=0;for(var h=1;h<e.length;h++){var p=e[h++],a=e[h]?(e[0]|=p?1:2,s[e[h++]]):e[++h];3===p?u[0]=a:4===p?u[1]=Object.assign(u[1]||{},a):5===p?(u[1]=u[1]||{})[e[++h]]=a:6===p?u[1][e[++h]]+=a+"":p?(r=t.apply(a,n(t,a,s,["",null])),u.push(r),a[0]?e[0]|=2:(e[h-2]=0,e[h]=r)):u.push(a)}return u},t=new Map,e=function(e){var s=t.get(this);return s||(s=new Map,t.set(this,s)),(s=n(this,s.get(e)||(s.set(e,s=function(n){for(var t,e,s=1,u="",r="",h=[0],p=function(n){1===s&&(n||(u=u.replace(/^\s*\n\s*|\s*\n\s*$/g,"")))?h.push(0,n,u):3===s&&(n||u)?(h.push(3,n,u),s=2):2===s&&"..."===u&&n?h.push(4,n,0):2===s&&u&&!n?h.push(5,0,!0,u):s>=5&&((u||!n&&5===s)&&(h.push(s,0,u,e),s=6),n&&(h.push(s,n,0,e),s=6)),u=""},a=0;a<n.length;a++){a&&(1===s&&p(),p(a));for(var o=0;o<n[a].length;o++)t=n[a][o],1===s?"<"===t?(p(),h=[h],s=3):u+=t:4===s?"--"===u&&">"===t?(s=1,u=""):u=t+u[0]:r?t===r?r="":u+=t:'"'===t||"'"===t?r=t:">"===t?(p(),s=1):s&&("="===t?(s=5,e=u,u=""):"/"===t&&(s<5||">"===n[a][o+1])?(p(),3===s&&(h=h[0]),s=h,(h=h[0]).push(2,0,s),s=0):" "===t||"\t"===t||"\n"===t||"\r"===t?(p(),s=2):u+=t),3===s&&"!--"===u&&(s=4,h=h[0])}return p(),h}(e)),s),arguments,[])).length>1?s:s[0]};"undefined"!=typeof module?module.exports=e:self.htm=e}();

},{}],4:[function(_dereq_,module,exports){
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.vhtml = factory());
}(this, (function () { 'use strict';

var emptyTags = ['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

var esc = function esc(str) {
	return String(str).replace(/[&<>"']/g, function (s) {
		return '&' + map[s] + ';';
	});
};
var map = { '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos' };
var setInnerHTMLAttr = 'dangerouslySetInnerHTML';
var DOMAttributeNames = {
	className: 'class',
	htmlFor: 'for'
};

var sanitized = {};

function h(name, attrs) {
	var stack = [],
	    s = '';
	attrs = attrs || {};
	for (var i = arguments.length; i-- > 2;) {
		stack.push(arguments[i]);
	}

	if (typeof name === 'function') {
		attrs.children = stack.reverse();
		return name(attrs);
	}

	if (name) {
		s += '<' + name;
		if (attrs) for (var _i in attrs) {
			if (attrs[_i] !== false && attrs[_i] != null && _i !== setInnerHTMLAttr) {
				s += ' ' + (DOMAttributeNames[_i] ? DOMAttributeNames[_i] : esc(_i)) + '="' + esc(attrs[_i]) + '"';
			}
		}
		s += '>';
	}

	if (emptyTags.indexOf(name) === -1) {
		if (attrs[setInnerHTMLAttr]) {
			s += attrs[setInnerHTMLAttr].__html;
		} else while (stack.length) {
			var child = stack.pop();
			if (child) {
				if (child.pop) {
					for (var _i2 = child.length; _i2--;) {
						stack.push(child[_i2]);
					}
				} else {
					s += sanitized[child] === true ? child : esc(child);
				}
			}
		}

		s += name ? '</' + name + '>' : '';
	}

	sanitized[s] = true;
	return s;
}

return h;

})));


},{}]},{},[1]);
