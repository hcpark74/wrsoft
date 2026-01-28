let isPc = true;
let cursor = document.querySelector('#custom-cursor');

if ($(window).width() < 1024) {
    isPc = false;
}
window.addEventListener('resize', function () {
    let _isPc;

    if ($(window).width() < 1024) {
        _isPc = false;
    } else {
        _isPc = true;
    }

    if (isPc !== _isPc) {
        if ($(window).width() < 1024) {
            isPc = false;
            $(".gnb-navigation-wrapper > div > ul > li")
                .removeClass('active')
                .children(".gnb-2dep").slideUp();
            $('#custom-cursor').remove();
        } else {
            isPc = true;
            $(".gnb-navigation-wrapper > div > ul > li")
                .addClass('active')
                .children(".gnb-2dep").slideDown();
            $('.gnb-2dep').css('display', '');

            $('.top-btn-t').hide();
        }

    }
});

$(window).scroll(function () {
    const scrollTop = $(this).scrollTop();
    const scrollHeight = $(document).height();
    const windowHeight = $(window).height();
    const sections = $('section');
    const $arrow = $('.top-btn .inner-circle > svg.down');

    let nextSectionTop = -1;
    sections.each(function () {
        const sectionTop = $(this).offset().top;
        if (sectionTop > scrollTop + 50) {
            nextSectionTop = sectionTop;
            return false;
        }
    });

    if (nextSectionTop === -1 || scrollTop + windowHeight >= scrollHeight - 150) {
        // 더 이상 내려갈 섹션이 없거나 하단 도달: 화살표 위쪽 (180도)
        $arrow.css("transform", "translate(-50%, -50%) scale(0.65) rotate(180deg)");
    } else {
        // 이동 가능 섹션 존재: 화살표 아래쪽 (0도)
        $arrow.css("transform", "translate(-50%, -50%) scale(0.65) rotate(0deg)");
    }
});

function initUI() {
    const isMobile = () => $(window).width() < 1024;

    $(".gnb-navigation-wrapper > div > ul > li").off('click').on('click', function (e) {
        if (isMobile()) {
            let _isActive = $(this).hasClass("active")

            $(".gnb-navigation-wrapper > div > ul > li").removeClass('active');
            $(".gnb-navigation-wrapper > div > ul > li").children(".gnb-2dep").slideUp();

            if (!_isActive) {
                $(this).addClass('active');
                $(this).children(".gnb-2dep").slideDown();
            }
        }
    });

    // gnb 메뉴 열고 닫기
    $("#nav-btn").off('click').on('click', function () {
        if (isMobile()) {
            $(".gnb-navigation-wrapper > div > ul > li")
                .removeClass('active')
                .children(".gnb-2dep").slideUp();
        } else {
            $(".gnb-navigation-wrapper > div > ul > li")
                .addClass('active')
                .children(".gnb-2dep").slideDown();
        }

        $(this).toggleClass("nav-open");
        $(".gnb-navigation-wrapper").toggle();
        $(".top-btn").css("z-index", "3");
    });

    // mouse-hover
    $('.gnb-navigation-wrapper .site-map > li').off('mouseover mouseleave').on('mouseover', function () {
        $(this).parent('ul').addClass('sitemap-over');
        $(this).addClass('on');
    }).on('mouseleave', function () {
        $(this).parent('ul').removeClass('sitemap-over');
        $(this).removeClass('on');
    });

    // 마우스 커스텀
    document.body.style.cursor = 'none';

    const customCursor = document.querySelector(".curser-wrap");
    if (customCursor) {
        $(document).off('mousemove').on('mousemove', function (e) {
            gsap.to(customCursor, {
                x: e.clientX,
                y: e.clientY,
                xPercent: -50,
                yPercent: -50,
                duration: 0.1,
                opacity: 1,
            });
        });

        //마우스 a태그 호버시
        const customCursor2 = document.querySelector(".curser-wrap .cursor");
        if (customCursor2) {
            $('body a, body button').off('mouseenter mouseleave').on('mouseenter', function () {
                gsap.to(customCursor2, 0.1, { scale: 0.3 });
            }).on('mouseleave', function () {
                gsap.to(customCursor2, 0.1, { scale: 1 });
            });
        }
    }

    //마우스 이벤트
    const mouseEventIcon = document.querySelector('.curser-wrap i');
    if (mouseEventIcon) {
        const mouseTl = gsap.timeline({
            paused: true,
        });

        mouseTl.to('.curser-wrap i', 0.1, { opacity: 1 }, "a");

        $('.mouse-event').off('mouseenter mouseleave').on('mouseenter', function () {
            mouseTl.play();
        }).on('mouseleave', function () {
            mouseTl.reverse();
        });
    }
}

document.addEventListener("DOMContentLoaded", function () {
    // If header/footer are already in DOM, init immediately
    if (document.querySelector('#nav-btn')) {
        initUI();
    }

    $(".reference .btn-wrap button").click(function () {
        $(this).parent().parent().next(".swiper-container").hide();
        $(".control-box").hide();
        $(".swiper-pagination-s").hide();
        $(".btn-contents").css("display", "flex");
    });

    //smooth scroll
    // 메뉴 
    var didScroll;
    var lastScrollTop = 0;
    var delta = 5;
    var navbarHeight = 0;

    $(window).scroll(function (event) {
        didScroll = true;
    });

    setInterval(function () {
        if (didScroll) {
            hasScrolled();
            didScroll = false;
        }
    }, 250);

    function hasScrolled() {
        var st = $(this).scrollTop();

        if (Math.abs(lastScrollTop - st) <= delta)
            return;
        if (st > lastScrollTop && st > navbarHeight) {
            // Scroll Down
            $('#header').removeClass('scroll-up').addClass('scroll-down');
        } else {
            if ($(window).scrollTop() <= 100 && st <= 100) {
                $('#header').removeClass('scroll-down').removeClass('scroll-up');
            } else if (st + $(window).height() < $(document).height()) {
                $('#header').removeClass('scroll-down').addClass('scroll-up');
            }
        }
        lastScrollTop = st;
    };

    // 순차적으로 active 클래스가 붙는 함수
    function rollingActive() {
        let idx = 1;

        setInterval(() => {
            idx = idx % 5;

            $('#recruit_li_0, #recruit_li_1, #recruit_li_2, #recruit_li_3, #recruit_li_4').removeClass('active');
            $('#recruit_li_' + idx).addClass('active');

            idx++;
        }, 3000);
    };

    rollingActive();

    function welfareActive() {
        let idx = 1;

        setInterval(() => {
            idx = idx % 6;

            $('#welfare_li_0, #welfare_li_1, #welfare_li_2, #welfare_li_3, #welfare_li_4, #welfare_li_5').removeClass('active');
            $('#welfare_li_' + idx).addClass('active');

            idx++;
        }, 3000);
    };

    welfareActive();

    function referenceActive() {
        let idx = 1;

        setInterval(() => {
            idx = idx % 14;

            $('#referenceBox_0, #referenceBox_1, #referenceBox_2, #referenceBox_3, #referenceBox_4, #referenceBox_5,#referenceBox_6, #referenceBox_7, #referenceBox_8,#referenceBox_9, #referenceBox_10, #referenceBox_11,#referenceBox_12, #referenceBox_13, #referenceBox_14').removeClass('active');
            $('#referenceBox_' + idx).addClass('active');

            idx++;
        }, 3000);
    };

    referenceActive();

    function referenceActive_1() {
        let idx = 1;

        setInterval(() => {
            idx = idx % 10;

            $('#referenceBox1_0, #referenceBox1_1, #referenceBox1_2, #referenceBox1_3, #referenceBox1_4, #referenceBox1_5,#referenceBox1_6, #referenceBox1_7, #referenceBox1_8,#referenceBox1_9').removeClass('active');
            $('#referenceBox1_' + idx).addClass('active');

            idx++;
        }, 3000);
    };

    referenceActive_1();

    function referenceActive_2() {
        let idx = 1;

        setInterval(() => {
            idx = idx % 11;

            $('#referenceBox2_0, #referenceBox2_1, #referenceBox2_2, #referenceBox2_3, #referenceBox2_4, #referenceBox2_5,#referenceBox2_6, #referenceBox2_7, #referenceBox2_8,#referenceBox2_9, #referenceBox2_10').removeClass('active');
            $('#referenceBox2_' + idx).addClass('active');

            idx++;
        }, 3000);
    };

    referenceActive_2();

    function referenceActive_3() {
        let idx = 1;

        setInterval(() => {
            idx = idx % 7;

            $('#referenceBox3_0, #referenceBox3_1, #referenceBox3_2, #referenceBox3_3, #referenceBox3_4, #referenceBox3_5,#referenceBox3_6').removeClass('active');
            $('#referenceBox3_' + idx).addClass('active');

            idx++;
        }, 3000);
    };

    referenceActive_3();

    function referenceActive_4() {
        let idx = 1;

        setInterval(() => {
            idx = idx % 2;

            $('#referenceBox4_0, #referenceBox4_1').removeClass('active');
            $('#referenceBox4_' + idx).addClass('active');

            idx++;
        }, 3000);
    };

    referenceActive_4();


    //scroll animation
    $('[data-scroll]').each(function (i) {
        var triggerObject = $(this).offset().top + 60;
        //var triggerObject = $(this).offset().top + $(this).outerHeight()/3 + 60;
        var scrollViewOffset = $(window).scrollTop() + $(window).height();
        if (scrollViewOffset > triggerObject) {
            $(this).addClass("animated");
        }
        else {
            $(this).removeClass('animated');
        }
    });

    $(window).on('scroll', function () {
        $('[data-scroll]').each(function (i) {
            var triggerObject = $(this).offset().top + 60;
            var scrollViewOffset = $(window).scrollTop() + $(window).height();
            if (scrollViewOffset > triggerObject) {
                $(this).addClass("animated");
            }
            else {
                $(this).removeClass('animated');
            }
        });
    });

    // Unified top button click handler (works for both main and sub pages)
    $(document).on('click', '.top-btn, .top-btn a, .top-btn .inner-circle, .top-btn-t', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const scrollTop = $(window).scrollTop();
        const scrollHeight = $(document).height();
        const windowHeight = $(window).height();
        const sections = $('section'); // 서브 페이지의 섹션들

        let nextSectionTop = -1;

        // 현재 스크롤 위치보다 아래에 있는 첫 번째 섹션을 찾음
        sections.each(function () {
            const sectionTop = $(this).offset().top;
            if (sectionTop > scrollTop + 50) { // 50px 여유를 두어 현재 섹션 판정 방지
                nextSectionTop = sectionTop;
                return false; // 가장 가까운 섹션을 찾으면 루프 종료
            }
        });

        if (scrollTop + windowHeight >= scrollHeight - 150 || nextSectionTop === -1) {
            // 하단에 있거나 더 이상 내려갈 섹션이 없을 때는 맨 위로 이동
            $('body, html').animate({
                scrollTop: 0
            }, 800);
        } else {
            // 다음 섹션으로 이동
            $('body, html').animate({
                scrollTop: nextSectionTop
            }, 600);
        }

        return false;
    });

    function triggerScrollObject() {
        $("[data-scroll]").each(function () {
            var $scrollElem = $(this);
            var scrollElemOffset = $(this).data("scroll-offset") ? $(this).data("scroll-offset") : startOffset;
            $scrollElem.waypoint(function (direction) {
                if (direction === "down") {
                    $scrollElem.addClass('animated');
                }/*else if ( direction === "up") {
					$scrollElem.removeClass('animated');
				}*/
            },
                {
                    triggerOnce: false,
                    offset: scrollElemOffset
                });
        });
    };
    triggerScrollObject();

    historyScrollEvent();

    const urlParams = new URL(location.href).searchParams;
    const selectedBtn = urlParams.get('btn');

    if (selectedBtn != null && selectedBtn != '') {
        $('#' + selectedBtn).trigger('click');
    }

});

function changeReference(type) {
    $('.btn-contents > .content').hide();
    $('#' + type).css({ "display": "flex", "animation": "fadeUp 1s ease forwards" });
    $('.btn-wrap button').removeClass('on');
    $('#' + type + 'Btn').addClass('on');
};

function changeSolution(type) {
    $('.bottom > .bottom-content').hide();
    $('.bottom > .bottom-content.' + type + '').show();
    $('.solution-content button').removeClass('on');
    $('#' + type + 'Btn').addClass('on');
};

function historyScrollEvent() {
    const companyDetailList = document.querySelectorAll('.company-detail');

    window.addEventListener('scroll', () => {
        let nearCompanyDetail = null;
        let minDistance = 999999;

        companyDetailList.forEach((companyDetail) => {
            let distance = Math.abs(window.scrollY - companyDetail.offsetTop - 1270);
            if (minDistance > distance) {
                nearCompanyDetail = companyDetail;
                minDistance = distance;
            }

            companyDetail?.classList.remove('active');
        });

        nearCompanyDetail?.classList.add('active');

        $(".company-detail.active").parent(".history-year-list").siblings(".number-sticky").css("color", "black");
    });
}

window.addEventListener('componentsLoaded', initUI);
