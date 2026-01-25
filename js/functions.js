/* *******************************************************
 * filename : functions.js
 * description : 전체적으로 사용되는 JS
 * date : 2022-03-14
******************************************************** */

/* ************************
  * 브라우저를 체크할때 사용하는 함수
  * return browser(브라우저name)
  ************************ */
function detectBrowser() {
    var agent = navigator.userAgent.toLowerCase();
    var browser;

    if ((agent.indexOf('msie') > -1) || (agent.indexOf('trident') > -1) || (agent.indexOf('edge') > -1)) {
        browser = 'ie'
    } else if (agent.indexOf('firefox') > -1) {
        browser = 'firefox'
    } else if (agent.indexOf('opr') > -1) {
        browser = 'opera'
    } else if (agent.indexOf('chrome') > -1) {
        browser = 'chrome'
    } else if (agent.indexOf('safari') > -1) {
        browser = 'safari'
    }

    return browser;
}

/* ************************
 * IE 버전을 체크할때 사용하는 함수
 * return : IE 아닐때 false / IE 일때 9,10,11,"edge"
 ************************ */
function ieVersionCheck() {
    var word;
    var version = "N/A";
    var agent = navigator.userAgent.toLowerCase();
    var name = navigator.appName;

    // IE old version ( IE 10 or Lower ) 
    if (name == "Microsoft Internet Explorer") word = "msie ";
    else {
        // IE 11 
        if (agent.search("trident") > -1) word = "trident/.*rv:";
        // Microsoft Edge  
        else if (agent.search("edge/") > -1) word = "edge/";
    }
    var reg = new RegExp(word + "([0-9]{1,})(\\.{0,}[0-9]{0,1})");
    if (reg.exec(agent) != null) version = RegExp.$1 + RegExp.$2;

    if (version != "NaN" && version < 12) {
        return parseInt(version)
    } else if (word === "edge/") {
        return false;
    } else {
        return false;
    }
}

/* ************************
 * OS 체크 함수
 * android/ios 체크할때 사용
 ************************ */
function detectOS() {
    var agent = navigator.userAgent.toLowerCase();
    var osCheck;

    if (agent.indexOf('android') > -1) {
        return "android";
    } else if (agent.indexOf("iphone") > -1 || agent.indexOf("ipad") > -1 || agent.indexOf("ipod") > -1 || agent.indexOf("macintosh") > -1) {
        return "ios";
    } else {
        return "other";
    }

    return osCheck;
}

/* ************************
 * 모바일 체크 함수
 * return : 모바일 true / PC false
 * Ipad Safari userAgent 변경으로 인해 if문 추가 (2020-07-17)
 * Mac Os - Big Sur, Safari(14.0) Macintosh 로 체크되어 mobile로 분류되는 이슈로 가로사이즈 조건문 추가(2021-06-15)
 ************************ */
function isMobile() {
    var UserAgent = navigator.userAgent;
    if (UserAgent.match(/iPhone|iPad|iPad|Android|Windows CE|BlackBerry|Symbian|Windows Phone|webOS|Opera Mini|Opera Mobi|POLARIS|IEMobile|lgtelecom|nokia|SonyEricsson/i) != null || UserAgent.match(/LG|SAMSUNG|Samsung/) != null) {
        return true;
    } else {
        // Ipad Safari Browser
        if (detectIpad()) {
            return true;
        } else {
            return false;
        }
    }
}
function detectIpad() {
    var userAgent = navigator.userAgent || navigator.vendor || window.opera;
    // Lying iOS13 iPad
    if (userAgent.match(/Macintosh/i) !== null && getWindowWidth() < 1025) {
        // need to distinguish between Macbook and iPad
        var canvas = document.createElement("canvas");
        if (canvas !== null) {
            var context = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (context) {
                var info = context.getExtension("WEBGL_debug_renderer_info");
                if (info) {
                    var renderer = context.getParameter(info.UNMASKED_RENDERER_WEBGL);
                    if (renderer.indexOf("Apple") !== -1)
                        return true;
                }
            }
        }
    }
    return false;
}

/* ************************
  * window 팝업 오픈 함수
  * @param src : "팝업 페이지 주소"
  * @param title : "팝업 페이지 타이틀"
  * @param option : "width=너비, height=높이, left=x축 위치, top=y축 위치, resizable=리사이즈 여부, scrollbars=스크롤바 여부, status=상태 표시줄 여부"
  ************************ */
function winPopupOpen(src, title, option) {
    window.open(src, title, option);
}

/* ************************
 * 브라우저의 가로값, 세로값 측정 함수
 * return 가로값/세로값
 ************************ */
/* 임의의 영역을 만들어 스크롤바 크기 측정 */
function getScrollBarWidth() {
    if ($(document).height() > $(window).height()) {
        $('body').append('<div id="fakescrollbar" style="width:50px;height:50px;overflow:hidden;position:absolute;top:-200px;left:-200px;"></div>');
        fakeScrollBar = $('#fakescrollbar');
        fakeScrollBar.append('<div style="height:100px;">&nbsp;</div>');
        var w1 = fakeScrollBar.find('div').innerWidth();
        fakeScrollBar.css('overflow-y', 'scroll');
        var w2 = $('#fakescrollbar').find('div').html('html is required to init new width.').innerWidth();
        fakeScrollBar.remove();
        return (w1 - w2);
    }
    return 0;
}
/* 브라우저 가로, 세로크기 측정 */
function getWindowWidth() {
    return $(window).outerWidth() + getScrollBarWidth();
}
function getWindowHeight() {
    return $(window).height();
}

/* ************************
 * 브라우저의 스크롤바의 수직 위치 측정 함수
 * return 스크롤바 위치 값
 ************************ */
function getScrollTop() {
    return $(window).scrollTop();
}

/* ************************
 * 브라우저의 스크롤을 이동시키는 함수
 * @param top : 이동지점
 * @param speed : 이동속도
 ************************ */
function moveScrollTop(top, speed) {
    $("html, body").animate({ scrollTop: top }, speed, "easeInOutExpo");
}

/* ************************
 * object toggleClass 함수
 * @param object : 적용되야할 선택자
 * @param className : toggleClass Name
 ************************ */
/* addClass Active */
function addClassName(object, className) {
    $(object).addClass(className);
}
function removeClassName(object, className) {
    $(object).removeClass(className);
}

/* ************************
  * 갯수체크 함수
  * @param selector : 선택자
  * 1개이상 있으면 return true
  ************************ */
$.exists = function (selector) {
    return ($(selector).length > 0);
}

/* ************************
  * magnificPopup Plugin ( 모달팝업갤러리 )
  * jquery.magnific-popup.js 필요
  ************************ */
function magnificPopup(popupGallery) {
    $(popupGallery).magnificPopup({
        delegate: 'a',
        type: 'image',
        closeOnContentClick: true,
        closeBtnInside: true,
        fixedContentPos: true,
        mainClass: 'mfp-with-zoom',
        removalDelay: 500, //delay removal by X to allow out-animation
        callbacks: {
            beforeOpen: function () {
                // just a hack that adds mfp-anim class to markup 
                this.st.image.markup = this.st.image.markup.replace('mfp-figure', 'mfp-figure mfp-with-anim');
                this.st.mainClass = "mfp-zoom-in"; // this.st.el.attr('data-effect');
            }
        },
        closeOnContentClick: true,
        midClick: true, // allow opening popup on middle mouse click. Always set it to true if you don't provide alternative source.
    });
}

/* ************************
  * mCustomScrollbar Plugin ( 스크롤바 커스텀 )
  * jquery.mCustomScrollbar.concat.min.js 필요
  * @param selector : 선택자
  ************************ */
/* Custom Scrollbar Plugin (x,y) */
function customScrollX(scrollObject) {
    $(scrollObject).mCustomScrollbar({
        axis: "x",
        theme: "dark"
    });
}
function customScrollY(scrollObject) {
    $(scrollObject).mCustomScrollbar({
        axis: "y",
        theme: "dark",
        callbacks: {
            onInit: () => bugFix(scrollObject)
        }
    });
}
// 최신제이쿼리에서 y축 안되는 오류 해결
function bugFix(scrollbar) {
    const draggerRail = $(scrollbar).find(".mCSB_draggerRail");
    const draggerContainer = $(scrollbar).find(".mCSB_draggerContainer");
    if (draggerRail.length > 0 && draggerRail.parent().hasClass("mCSB_dragger")) {
        draggerContainer.append(draggerRail);
    }
}

/* ************************
  * PHP 주소 Parameter
  * @param strParamName : 가져올 파라미터값
  ************************ */
/* PHP Get Parameter  */
function getParameter(strParamName) {
    var arrResult = null;
    if (strParamName) {
        arrResult = location.search.match(new RegExp("[&?]" + strParamName + "=(.*?)(&|$)"));
    }
    return arrResult && arrResult[1] ? arrResult[1] : null;
}
function toAnchorParameter(anchor) {
    if (getParameter(anchor)) {
        var anchorConTop = $("#" + getParameter(anchor) + "").offset().top;
        var headerHeight = $("#header").height();
        moveScrollTop(anchorConTop - headerHeight, 500);
    }
}

/* ************************
  * 순차적으로 active클래스가 붙는 함수
  * @param activeList : 선택자
  ************************ */
/* Active cycle */
function rollingActive(activeList) {
    $(activeList).each(function (index) {
        $itemList = $(this);
        $item = $itemList.find(".list-item");
        itemLength = $item.length;
        startNum = 0;
        rollingSpeed = $itemList.data("rolling-time");

        function visualTime() {
            if (startNum < (itemLength - 1)) {
                startNum++;
            } else {
                startNum = 0;
            }
            visualPlay();
        }
        function visualPlay() {
            $item.each(function (id) {
                if (id == startNum) {
                    $(this).addClass("active"); // li에 클래스 붙이기
                } else {
                    $(this).removeClass("active");
                }
            });
        };
        visualPlay();
        visual_timer = setInterval(visualTime, rollingSpeed);
    });
}

rollingActive(".exdevice-function-wrap .function-list-box, .exsurvey-acitve-list-box, .chatbot-active-list-box");

function rollingActiveSvg(activeListSvg) {
    $(activeListSvg).each(function (index) {
        $itemList2 = $(this);
        $item2 = $itemList2.find(".rolling-txt");
        itemLength2 = $item2.length;
        startNum2 = 0;
        rollingSpeed2 = $itemList2.data("rolling-time2");

        function visualTime2() {
            if (startNum2 < (itemLength2 - 1)) {
                startNum2++;
            } else {
                startNum2 = 0;
            }
            visualPlay2();
        }
        function visualPlay2() {
            $item2.each(function (id) {
                if (id == startNum2) {
                    $(this).addClass("active"); // li에 클래스 붙이기
                } else {
                    $(this).removeClass("active");
                }
            });
        };
        visualPlay2();
        visual_timer = setInterval(visualTime2, rollingSpeed2);
    });
}

/* ************************
  * 스크롤값에 따라 클래스가 붙는 함수
  * @param object : 선택자
  * @param fixedStartTop : 클래스가 붙는 시작되는지점
  * @param className : 붙여야하는 클래스이름
  * getScrollTop() 함수 필요
  ************************ */
/* Fixed Object */
function objectFixed(object, fixedStartTop, className) {
    if (getScrollTop() > fixedStartTop) {
        if (!($(object).hasClass(className))) {
            $(object).addClass(className);
        }
    } else {
        if ($(object).hasClass(className)) {
            $(object).removeClass(className);
        }
    }
}
function objectFixedSubNav(object, fixedStartTop, className, className02) {
    if (getScrollTop() > fixedStartTop) {
        if (!($(object).hasClass(className))) {
            $(object).addClass(className);
            $(object).removeClass(className02);
        }
    } else {
        if ($(object).hasClass(className)) {
            $(object).removeClass(className);
            $(object).addClass(className02);
        }
    }
}

/* ************************
  * splittingText : 텍스트 Split 함수
  *  @param object : 선택자
  * splittingTextDelay : Split 텍스트 delay
  * @param object : 선택자
  * @param speed : speed 간격
  * @param delay_speed : delay시간
  ************************ */
function splittingText(object) {
    var split_word;
    var splitWordEvent = {
        settings: {
            letters: $(object),
        },
        init: function () {
            split_word = this.settings;
            this.bindEvents();
        },
        bindEvents: function () {
            split_word.letters.html(function (i, el) {
                var word_item = $.trim(el).split("");
                // console.log(word_item);
                return '<em class="char">' + word_item.join('</em><em class="char">') + '</em>';
            });
        },
    };
    splitWordEvent.init();
}
function splittingTextDelay(object, speed, delay_speed) {
    var splitLength = $(object).find(".char").length;
    for (var i = 0; i < splitLength; i++) {
        if ($(object).data("css-property") == "animation") {
            $(object).find(".char").eq(i).css("animation-delay", delay_speed + (i * speed) + "s");
        } else if ($(object).data("css-property") == "transition") {
            $(object).find(".char").eq(i).css("transition-delay", delay_speed + (i * speed) + "s");
        }
    }
}

/* ************************
  * object의 offset 체크 함수
  *  @param object : 선택자
  * return : offset.top 값
  ************************ */
function checkOffset(object) {
    return $(object).offset().top;
}

/* ************************
  * 상단에 fixed를 되고있는 object의 높이값 체크 함수
  * return : top-fixed 되고있는 높이의 total값
  ************************ */
function checkFixedHeight() {
    var fixedTotalHeight = null;
    for (var i = 0; i < $(".top-fixed").length; i++) {
        var fixedTotalHeight = fixedTotalHeight + $(".top-fixed").eq(i).outerHeight();
    }
    return fixedTotalHeight;
}

/* ************************
  * event 최적화(requestAnimationFrame)
  ************************ */
function toFit(cb, _ref) {
    var _ref$dismissCondition = _ref.dismissCondition,
        dismissCondition = _ref$dismissCondition === void 0 ? function () {
            return false;
        } : _ref$dismissCondition,
        _ref$triggerCondition = _ref.triggerCondition,
        triggerCondition = _ref$triggerCondition === void 0 ? function () {
            return true;
        } : _ref$triggerCondition;

    if (!cb) {
        throw Error('Invalid required arguments');
    }

    var tick = false;
    return function () {
        //  console.log('scroll call')
        if (tick) {
            return;
        }

        tick = true;
        return requestAnimationFrame(function () {
            if (dismissCondition()) {
                tick = false;
                return;
            }

            if (triggerCondition()) {
                //console.log('real call')
                tick = false;
                return cb();
            }
        });
    };
}

/* ************************
 * html Scroll Controls
 * return true( 스크롤막을때 ) / false( 스크롤사용할때 )
 * $.exists 함수 필요
 ************************ */
function htmlScrollControl(toggle) {
    if (toggle) {
        // 스크롤 막을때
        if ($.exists('#fullpage') || $.exists('.fp-responsive')) {
            $.fn.fullpage.setAllowScrolling(false);
            $.fn.fullpage.setKeyboardScrolling(false);
        } else {
            $("html").css({
                "margin-right": getScrollBarWidth(),
                "overflow-y": "hidden"
            });
            if ($("html").is(".smooth-srolling")) {
                smoothScroll_destory();
            }
        }
    } else {
        // 스크롤 다시사용할때
        if ($.exists('#fullpage') || $.exists('.fp-responsive')) {
            $.fn.fullpage.setAllowScrolling(true);
            $.fn.fullpage.setKeyboardScrolling(true);
        } else {
            $("html").css({
                "margin-right": "0",
                "overflow-y": "scroll"
            });
            if ($("html").is(".smooth-srolling")) {
                smoothScroll();
            }
        }
    }
}

/* ************************
 * CSS Variable 100vh Setting
 ************************ */
function set100Vh() {
    document.documentElement.style.setProperty('--full-height', window.innerHeight + 'px');
};
// window.addEventListener('resize', set100Vh);

/* ************************
* 익스플로러 엣지 전환 소스
* 익스플로러 브라우저 업데이트 안내 팝업
************************ */
function convertToEdge() {
    if (/MSIE \d|Trident.*rv:/.test(navigator.userAgent)) {
        window.location = 'microsoft-edge:' + window.location;
        setTimeout(function () {
            top.window.open('about:blank', '_self').close();
            top.window.opener = self;
            top.self.close();
        }, 1);
    }
}
function popupUpdateBrowser() {
    var popupBrowser = '';
    popupBrowser += '<article id="browserUpgradePopup">';
    popupBrowser += '<div class="browser-upgrade-popup-dim"></div>';
    popupBrowser += '<div class="browser-upgrade-popup-inner">';
    popupBrowser += '<button class="browser-popup-close-btn" title="close"><i class="xi-close-thin"></i></button>';
    popupBrowser += '<span class="browser-popup-caution-icon"><i class="xi-error-o"></i></span><h2 class="browser-popup-tit"><b>브라우저 업데이트</b> 안내</h2><p class="browser-popup-txt">현재 사용중인 브라우저는 곧 지원이 중단됩니다. <br>원활한 서비스를 제공받기 위해<br><b>보안과 속도가 강화된 브라우저로 업그레이드</b> 하시기 바랍니다.</p>';
    popupBrowser += '</div>';
    popupBrowser += '</article>';
    $("body").append(popupBrowser);
    $(document).on("click", ".browser-popup-close-btn", function () {
        $("#browserUpgradePopup").hide();
        return false;
    });
}

/* ************************
 * smooth Scroll
 * gsap.min.js, ScrollToPlugin.min.js
 ************************ */
// Check Passive Support
function smoothScroll_passive() {
    var supportsPassive = false;
    try {
        document.addEventListener("test", null, { get passive() { supportsPassive = true } });
    } catch (e) { }
    return supportsPassive;
}

// Start smooth Scroll
function smoothScroll() {
    if (isMobile() || detectOS() === "ios") return;
    var $window = $(window);
    if (smoothScroll_passive()) {
        window.addEventListener("wheel", smoothScroll_scrolling, { passive: false });
    } else {
        $window.on("mousewheel DOMMouseScroll", smoothScroll_scrolling);
    }
    $("html").addClass("smooth-srolling");
}

// Scroll Event
function smoothScroll_scrolling(event) {
    event.preventDefault();
    var $window = $(window);
    var scrollTime = 1.5;
    // var scrollDistance = $window.height() / 2.5;
    var delta = 0;
    if (smoothScroll_passive()) {
        var scrollDistance = $window.height() / 2;
        delta = event.wheelDelta / 120 || -event.originalEvent.detail / 3;
    } else {
        var scrollDistance = $window.height() / 2.5;
        if (typeof event.originalEvent.deltaY != "undefined") {
            delta = -event.originalEvent.deltaY / 120;
        } else {
            delta = event.originalEvent.wheelDelta / 120 || -event.originalEvent.detail / 3;
        }
    }

    var scrollTop = $window.scrollTop();
    var finalScroll = scrollTop - parseInt(delta * scrollDistance);
    winScrolling = gsap.to($window, scrollTime, {
        scrollTo: { y: finalScroll, autoKill: true },
        ease: Power4.easeOut,
        overwrite: 5
    });
}

// Destroy smooth Scroll
function smoothScroll_destory(event) { 
    if (isMobile() || detectOS() === "ios") return;
    if (smoothScroll_passive()) {
        window.removeEventListener("wheel", smoothScroll_scrolling);
    } else {
        $(window).off("mousewheel DOMMouseScroll", smoothScroll_scrolling);
    }
    gsap.killTweensOf($(window), { scrollTo: true });
}