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
    title: 'sports seasons by city',
    thumb: 'thumb.png'
  }, {
    num: '02',
    title: 'weather by latitude',
    thumb: 'thumb.png'
  }, {
    num: '03',
    title: 'lunar astronauts by age',
    thumb: 'thumb.png'
  }, {
    num: '04',
    title: 'toronto and montreal',
    thumb: 'thumb.png'
  }, {
    num: '05',
    title: '2018 baseball season',
    thumb: 'thumb.png'
  }],
  '2019': [{
    num: '01',
    title: 'nhl seasons by team',
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
    title: 'nhl arenas',
    thumb: 'thumb.png'
  }, {
    num: '07',
    title: 'baseball schedule',
    thumb: 'thumb.png'
  }]
};

},{}],3:[function(_dereq_,module,exports){
!function(){var n={},e=JSON.stringify;function t(e){for(var t=".",c=0;c<e.length;c++)t+=e[c].length+","+e[c];return(n[t]||(n[t]=i(e)))(this,arguments)}var i=function(n){for(var t,i,c,r,s,o=0,u="return ",a="",f="",h=0,l="",g="",d="",v=0,m=function(){c?9===o?(h++&&(u+=","),u+="h("+(f||e(a)),o=0):13===o||0===o&&"..."===a?(0===o?(d||(d=")",l=l?"Object.assign("+l:"Object.assign({}"),l+=g+","+f,g=""):r&&(l+=l?","+(g?"":"{"):"{",g="}",l+=e(r)+":",l+=f||(s||a)&&e(a)||"true",r=""),s=!1):0===o&&(o=13,r=a,a=f="",m(),o=0):(f||(a=a.replace(/^\s*\n\s*|\s*\n\s*$/g,"")))&&(h++&&(u+=","),u+=f||e(a)),a=f=""},p=0;p<n.length;p++){p>0&&(c||m(),f="$["+p+"]",m());for(var O=0;O<n[p].length;O++){if(i=n[p].charCodeAt(O),c){if(39===i||34===i){if(v===i){v=0;continue}if(0===v){v=i;continue}}if(0===v)switch(i){case 62:m(),47!==o&&(u+=l?","+l+g+d:",null"),t&&(u+=")"),c=0,l="",o=1;continue;case 61:o=13,s=!0,r=a,a="";continue;case 47:t||(t=!0,9!==o||a.trim()||(a=f="",o=47));continue;case 9:case 10:case 13:case 32:m(),o=0;continue}}else if(60===i){m(),c=1,d=g=l="",t=s=!1,o=9;continue}a+=n[p].charAt(O)}}return m(),Function("h","$",u)};"undefined"!=typeof module?module.exports=t:self.htm=t}();

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
