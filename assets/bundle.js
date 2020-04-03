(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(_dereq_,module,exports){
"use strict";

function _templateObject2() {
  var data = _taggedTemplateLiteral(["<h3 class=\"\">", "</h3>"]);

  _templateObject2 = function _templateObject2() {
    return data;
  };

  return data;
}

function _templateObject() {
  var data = _taggedTemplateLiteral(["<a href=\"", "\" class=\"left mw20 m3\" >\n    <div class=\"\">\n      <span class=\"olive\" >", "</span>\n      <span class=\"link\"> / ", "</span>\n    </div>\n    <img class=\"block\" style=\"margin-left:95px; max-width:450px; max-height:100px;\" src=\"", "\" />\n    </a>\n    "]);

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
  var posts = manifest[y].map(function (o) {
    var path = y + '/' + o.num;
    return h(_templateObject(), path, o.num, o.title, path + '/' + o.thumb);
  });
  result.push(h(_templateObject2(), y));
  result = result.concat(posts);
});
el.innerHTML = result.join(' ');

},{"./manifest":2,"htm":3,"vhtml":4}],2:[function(_dereq_,module,exports){
"use strict";

module.exports = {
  '2018': [{
    num: '01',
    title: 'Sports seasons by city',
    thumb: 'thumb.png'
  }, {
    num: '02',
    title: 'Weather by latitude',
    thumb: 'thumb.png'
  }, {
    num: '03',
    title: 'Lunar astronauts by age',
    thumb: 'thumb.png'
  }, {
    num: '04',
    title: 'Toronto and montreal',
    thumb: 'thumb.png'
  }, {
    num: '05',
    title: '2018 baseball season',
    thumb: 'thumb.png'
  }],
  '2019': [{
    num: '01',
    title: 'NHL performance by team',
    thumb: 'thumb.png'
  }, {
    num: '02',
    title: 'History of the NHL',
    thumb: 'thumb.png'
  }, {
    num: '03',
    title: 'Rain in Toronto',
    thumb: 'thumb.png'
  }, {
    num: '04',
    title: 'Break-up the year',
    thumb: 'thumb.png'
  }, {
    num: '05',
    title: 'Reading all of wikipedia',
    thumb: 'thumb.png'
  }, {
    num: '06',
    title: 'NHL arenas',
    thumb: 'thumb.png'
  }, {
    num: '07',
    title: 'Baseball schedule',
    thumb: 'thumb.png'
  }, {
    num: '08',
    title: 'Generations of people',
    thumb: 'thumb.png'
  }, {
    num: '09',
    title: 'Daylight by latitude',
    thumb: 'thumb.jpg'
  }],
  '2020': [{
    num: '01',
    title: 'Causes of death in Ontario',
    thumb: 'thumb.png'
  }]
};

},{}],3:[function(_dereq_,module,exports){
!function(){var n=function(t,e,r,u){for(var o=1;o<e.length;o++){var f=e[o++],s="number"==typeof f?r[f]:f;1===e[o]?u[0]=s:2===e[o]?(u[1]=u[1]||{})[e[++o]]=s:3===e[o]?u[1]=Object.assign(u[1]||{},s):u.push(e[o]?t.apply(null,n(t,s,r,["",null])):s)}return u},t=function(n){for(var t,e,r=1,u="",o="",f=[0],s=function(n){1===r&&(n||(u=u.replace(/^\s*\n\s*|\s*\n\s*$/g,"")))?f.push(n||u,0):3===r&&(n||u)?(f.push(n||u,1),r=2):2===r&&"..."===u&&n?f.push(n,3):2===r&&u&&!n?f.push(!0,2,u):4===r&&e&&(f.push(n||u,2,e),e=""),u=""},p=0;p<n.length;p++){p&&(1===r&&s(),s(p));for(var h=0;h<n[p].length;h++)t=n[p][h],1===r?"<"===t?(s(),f=[f],r=3):u+=t:o?t===o?o="":u+=t:'"'===t||"'"===t?o=t:">"===t?(s(),r=1):r&&("="===t?(r=4,e=u,u=""):"/"===t?(s(),3===r&&(f=f[0]),r=f,(f=f[0]).push(r,4),r=0):" "===t||"\t"===t||"\n"===t||"\r"===t?(s(),r=2):u+=t)}return s(),f},e="function"==typeof Map,r=e?new Map:{},u=e?function(n){var e=r.get(n);return e||r.set(n,e=t(n)),e}:function(n){for(var e="",u=0;u<n.length;u++)e+=n[u].length+"-"+n[u];return r[e]||(r[e]=t(n))},o=function(t){var e=n(this,u(t),arguments,[]);return e.length>1?e:e[0]};"undefined"!=typeof module?module.exports=o:self.htm=o}();

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

var sanitized = {};

function h(name, attrs) {
	var stack = [];
	for (var i = arguments.length; i-- > 2;) {
		stack.push(arguments[i]);
	}

	if (typeof name === 'function') {
		(attrs || (attrs = {})).children = stack.reverse();
		return name(attrs);
	}

	var s = '<' + name;
	if (attrs) for (var _i in attrs) {
		if (attrs[_i] !== false && attrs[_i] != null) {
			s += ' ' + esc(_i) + '="' + esc(attrs[_i]) + '"';
		}
	}

	if (emptyTags.indexOf(name) === -1) {
		s += '>';

		while (stack.length) {
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

		s += '</' + name + '>';
	} else {
		s += '>';
	}

	sanitized[s] = true;
	return s;
}

return h;

})));


},{}]},{},[1]);
