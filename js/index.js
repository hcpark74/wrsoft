var swiper2;
let pageFullPageNum = 1;
let isPc = true;
let cursor = document.querySelector('#custom-cursor');

if ($(window).width() < 1024) {
	isPc = false;
};

window.addEventListener('resize', function () {
	let _isPc;

	if ($(window).width() < 1024) {
		_isPc = false;
	} else {
		_isPc = true;
	};

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
		}
	}
});

$(window).scroll(function () {
	if ($(this).scrollTop() > 300) {
		$('.top-btn-t').fadeIn();
	} else {
		$('.top-btn-t').fadeOut();
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

document.addEventListener("DOMContentLoaded", function () {
	// If header/footer are already in DOM, init immediately
	if (document.querySelector('#nav-btn')) {
		initUI();
	}

	$(".reference .btn-wrap button").click(function () {
		$(this).parent().parent().next(".swiper-container").hide();
		$(".control-box").hide();
		$(".swiper-pagination-s").hide();
		$(".btn-contents").show();
	});

	// 메인비주얼 슬라이드 
	if ($(".main-visual-swiper").attr("data-slide-effect") == "slide") {
		effect = "slide"
	} else if ($(".main-visual-swiper").attr("data-slide-effect") == "fade") {
		effect = "fade"
	}
	var main_visual_progress = null;
	setTimeout(function () {
		main_visual_swiper();
	}, 100);

	let swiper;

	function main_visual_swiper() {
		var interleaveOffset = 0.75;
		swiper = new Swiper('.main-visual-swiper', {
			loop: true,
			speed: 0,
			draggable: false,
			effect: effect,
			allowTouchMove: false,
			watchSlidesProgress: true,
			pagination: {
				el: '.main-visual-pagination',
				clickable: true,
				renderBullet: function (index, className) {
					let idx = (index + 1) > 9 ? index + 1 : '0' + (index + 1);
					let str = '<div class="duration"><div class="bar spot-duration-bar"></div></div>'
						+ '<div class="bullet-title ell">' + $('.main-visual-txt2').eq(index + 1).text() + '</div>';
					return '<div class="' + className + ' swiper-pagination-bullet-' + index + ' mouse-effect" data-cursor="click" style="width:' + 100 / this.slides.length + '%;">' + str + "</div>";
				},
			},
			on: {
				init: function () {
					setTimeout(function () {
						main_visual_transition(true);
					})
				},
				progress: function () {
					var swiper = this;
					for (var i = 0; i < swiper.slides.length; i++) {
						var slideProgress = swiper.slides[i].progress;
						var innerOffset = swiper.width * interleaveOffset;
						var innerTranslate = slideProgress * innerOffset;
						if ($(".main-visual-swiper").attr("data-slide-effect") == "slide") {
							TweenMax.set(swiper.slides[i].querySelector(".slide-inner"), {
								x: innerTranslate,
							});
						}
					}
				},
				slideChangeTransitionStart: function () {
					main_visual_transition(true);
				},
				touchStart: function () {
					var swiper = this;
					for (var i = 0; i < swiper.slides.length; i++) {
						swiper.slides[i].style.transition = "";
					}
				},
				setTransition: function (speed) {
					var swiper = this;
					for (var i = 0; i < swiper.slides.length; i++) {
						swiper.slides[i].style.transition = speed + "ms";
						swiper.slides[i].querySelector(".slide-inner").style.transition =
							speed + "ms";
					}
				}
			}
		});
	};

	function main_visual_transition(flag) {
		main_visual_state(6000);
	};

	// 일반 슬라이드일 경우와 영상 슬라이드일 경우 각각 progress bar 시간 수정
	function main_visual_state(speed) {
		var $progress = $('.main-visual').find('.swiper-pagination-bullet-active').find('.spot-duration-bar');
		if (main_visual_progress != null) { main_visual_progress.kill(); }
		// progressBar Init
		$('.main-visual').find('.main-visual-pagination').find(".spot-duration-bar").css({ "width": "0" });
		// progressBar Animation
		main_visual_progress = TweenMax.fromTo($progress, parseInt(speed / 1000), {
			width: '0%'
		}, {
			width: '100%',
			ease: Power0.easeNone,
			onComplete: function () {
				if ($('.main-visual-swiper')[0].swiper) {
					if ($('.main-visual-swiper')[0].swiper.activeIndex === 0) {
						$('.main-visual-swiper')[0].swiper.slideTo(1);
					} else if ($('.main-visual-swiper')[0].swiper.activeIndex === 1) {
						$('.main-visual-swiper')[0].swiper.slideTo(2);
					} else {
						$('.main-visual-swiper')[0].swiper.slideTo(0);
					}
				}
			},
		});
	};

	// Section01
	// Control Buttons
	const startButton = document.getElementById('start');
	const stopButton = document.getElementById('stop');

	// Pause Animation
	function pauseAnimation() {
		document.querySelectorAll('.swiper-slide-active .main-visual-txt1').forEach((el) => {
			el.classList.add('paused');
		});
		document.querySelectorAll('.swiper-slide-active .main-visual-txt2').forEach((el) => {
			el.classList.add('paused');
		});
		document.querySelectorAll('.main-visual-txt-box .main-visual-txt1').forEach((el) => {
			el.classList.add('paused');
		});

		main_visual_progress.pause();
	};

	// Start Autoplay
	startButton.addEventListener('click', () => {
		document.querySelectorAll('.swiper-slide-active .main-visual-txt1').forEach((el) => {
			el.classList.remove('paused');
		});
		document.querySelectorAll('.swiper-slide-active .main-visual-txt2').forEach((el) => {
			el.classList.remove('paused');
		});
		document.querySelectorAll('.main-visual-txt-box .main-visual-txt1').forEach((el) => {
			el.classList.remove('paused');
		});
		main_visual_progress.play();
		startButton.style.display = 'none';
		stopButton.style.display = '';
	});

	startButton.style.display = 'none';

	// Stop Autoplay
	stopButton.addEventListener('click', () => {
		pauseAnimation(); // 애니메이션 중지
		startButton.style.display = '';
		stopButton.style.display = 'none';
	});

	/* 브라우저 가로, 세로크기 측정 */
	function getWindowWidth() {
		return $(window).outerWidth() + getScrollBarWidth();
	};

	if ($.exists('#fullpage') && $(window).width() >= 1024) {
		var $fullPage = $("#fullpage");
		var $fullPageSection = $fullPage.children("section");
		var tabletWidth = 1024;

		$fullPage.fullpage({
			css3: true,
			fitToSection: false,
			navigation: true,
			scrollBar: false,
			scrollingSpeed: 1000,
			responsiveWidth: tabletWidth + 1,
			responsiveHeight: 750,
			onLeave: function (origin, destination, direction) {
				setTimeout(function () {
					$("section").eq(destination - 1).addClass("animated");
				}, 200);

				let _degree = 180;

				if (destination == 1) {
					//$('#mainContent1').addClass('down');
					$("#header").removeClass("black");
					_degree = 0;

				} else if (destination == 2) {
					$("#header").addClass("black");

					$('#main01').removeClass('up down');

				} else if (destination == 3) {
					const $topBtn = document.querySelector('.top-btn');

					$topBtn.classList.remove('last-page');

					//$('#mainContent1').addClass('up');
					if (!$('#main03').hasClass('animated')) {
						countUpAnimation();
					}

					$("#header").removeClass("black");

					$fullPage.fullpage.setAllowScrolling(false);

					if (getWindowWidth() > tabletWidth + 1) {
						fullpageScroll();
						$('.fullpage-inner-scroll').on('scroll', { passive: true }, fullpageScroll);
					}
				} else if (destination == 4) {
					const $topBtn = document.querySelector('.top-btn');

					$topBtn.classList.add('last-page');

					if (!$('#mainContentBottom').hasClass('animated')) {
						countUpAnimation2();
					}

					// $('#mainContentBottom').addClass('pre-animated');
					$("#header").removeClass("black");

					$fullPage.fullpage.setAllowScrolling(false);

					if (getWindowWidth() > tabletWidth + 1) {
						fullpageScrollBottom();
						$('.fullpage-inner-scroll-bottom').on('scroll', { passive: true }, fullpageScrollBottom);
					}
				}

				pageFullPageNum = destination;

				$('.top-btn .inner-circle > svg').css("transform", "translate(-50%, -50%) scale(0.65) rotate(" + _degree + "deg)");
			}
		});
	};

	function countUpAnimation() {
		var countObj = $("[data-countUp]");	// count 될 object 추가
		countObj.each(function (index) {
			numValue = $(countObj[index]).text();
			numSpeed = 5;	// 각각 커스텀할 경우 data-speed 추가
			numIntType = parseInt(numValue.replace(/,/g, ''));

			// Speed Custom
			if ($(countObj[index]).data("speed")) {
				delay = $(countObj[index]).data("speed");
			} else {
				delay = numSpeed;
			}

			// Check Type
			if (numValue.indexOf(",") != -1) {
				isSeparator = count_options;
			} else {
				isSeparator = options_separator;
			}

			var upAnimation = new CountUp(countObj[index], 0, numIntType, 0, delay, isSeparator);

			upAnimation.start();
		});
	};

	function countUpAnimation2() {
		var countObj2 = $("[data-countUp2]");	// count 될 object 추가
		countObj2.each(function (index) {
			numValue = $(countObj2[index]).text();
			numSpeed = 5;	// 각각 커스텀할 경우 data-speed 추가
			numIntType = parseInt(numValue.replace(/,/g, ''));

			// Speed Custom
			if ($(countObj2[index]).data("speed")) {
				delay = $(countObj2[index]).data("speed");
			} else {
				delay = numSpeed;
			}

			// Check Type
			if (numValue.indexOf(",") != -1) {
				isSeparator = count_options;
			} else {
				isSeparator = options_separator;
			}

			var upAnimation = new CountUp(countObj2[index], 0, numIntType, 0, delay, isSeparator);

			upAnimation.start();
		});
	};

	// Section03
	function fullpageScroll() {
		var fullpageInnerScrollTop = $('.fullpage-inner-scroll').scrollTop();
		// tit-box 위치고정
		var fullpageTitTop = $('#main01').height() + $('#main02').height();
		// ir 위치찾기
		var fullpageIrHeight = $('#main01').height() + $('#main02').height() + $('#main03').height();

		if (fullpageInnerScrollTop <= 0) {
			$('.fullpage-inner-scroll').bind('wheel', function (event) {
				if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
					// scroll up
					if ($('#main03').hasClass('active')) {
						$.fn.fullpage.moveTo(2);
					}
					$.fn.fullpage.setAllowScrolling(true);
				}
			});
			// 좌측 타이틀박스 고정
			$('.main-scroll-fixed').css({
				'position': 'fixed',
				'top': 'calc(' + fullpageTitTop + 'px )',
				'left': '100px',
			});

		} else if ((fullpageInnerScrollTop + $('.fullpage-inner-scroll').height() + 1) >= $('.fullpage-inner-scroll-con').height()) {
			$('.fullpage-inner-scroll').bind('wheel', function (event) {
				if (!(event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0)) {
					// scroll up
					if ($('#main03').hasClass('active')) {
						$.fn.fullpage.moveTo(4);
					}
				}
			});
			// 좌측 타이틀박스 고정
			$('.main-scroll-fixed').css({
				'position': 'fixed',
				'top': 'calc(' + fullpageTitTop + 'px )',
				'left': '100px',
			});
		} else {
			$('.main-scroll-fixed').css({
				'position': 'fixed',
				'top': 'calc(' + fullpageTitTop + 'px )',
				'left': '100px',
			});

			$('.fullpage-inner-scroll').off('wheel');
		}
	};

	function fullpageScrollBottom() {
		var fullpageBottomScrollTop = $('.fullpage-inner-scroll-bottom').scrollTop();

		if (fullpageBottomScrollTop <= 0) {
			$('.fullpage-inner-scroll-bottom').bind('wheel', function (event) {
				if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
					// scroll up
					if ($('#mainContentBottom').hasClass('active')) {
						event.preventDefault();
						$.fn.fullpage.moveTo(3);
					}
				}
			});

		} else if ((fullpageBottomScrollTop + $('.fullpage-inner-scroll-bottom').height() - 50) >= ($('.fullpage-inner-scroll-con-bottom').height() - $('#mainFooter').height())) {
			$('#mainQuickBtn').css({
				'bottom': 'calc(' + (fullpageBottomScrollTop - $('#mainFooter').height()) + 'px - 23rem)',
				'transition': 'none'
			});
		} else {
			$('.fullpage-inner-scroll-bottom').off('wheel');
		}
	};

	// Section04
	// swiper
	swiper2 = new Swiper('.main-success .swiper-container', {
		infinite: true,
		slidesPerView: 'auto',
		spaceBetween: -380,
		loop: false,
		loopAdditionalSlides: 1,
		pagination: {
			el: ".swiper-pagination-s",
			type: "progressbar",
		},
		loop: true,
		navigation: {
			nextEl: ".swiper-button-next-s",
			prevEl: ".swiper-button-prev-s",
		},
		speed: 1000,
		autoplay: {
			delay: 2500,
			disableOnInteraction: false,
		},
		breakpoints: {
			360: {
				slidesPerView: 1,
				spaceBetween: -80,
			},
			480: {
				slidesPerView: 2,
				spaceBetween: -20,
			},
			768: {
				slidesPerView: 2,
				spaceBetween: -140,
			},
			1024: {
				slidesPerView: 3,
				spaceBetween: -280,
			},
			1280: {
				slidesPerView: 4,
				spaceBetween: -300,
			}
		}
	});

	swiper2.autoplay.start();

	var flag = true;

	$(".pause-btn").click(function () {
		$(this).toggleClass("on");
		if (flag) {
			swiper.autoplay.stop();
			flag = false;
		} else {
			swiper.autoplay.start();
			flag = true;
		}
	})
	// var mSuccessBox = document.querySelector('.main-success');

	//animation
	var $section = $('.ani'),
		bodyScroll, windowHeight, windowHeight2;

	function sectionAni() {
		bodyScroll = $(document).scrollTop(),
			windowHeight = $(window).height() / 1.15;
		windowHeight2 = $(window).height() / 3;

		$section.each(function () {
			if (bodyScroll >= $(this).offset().top + 80 - windowHeight && bodyScroll < $(this).offset().top + $(this).height()) {
				$(this).addClass('on');
				$(this).addClass('subOn');
			} else {
				$(this).removeClass('on');
			}
		});
	};

	$(function () {
		sectionAni();
	});

	$(window).on('scroll', function () {
		sectionAni();
	});

	$('.top-btn').click(function (e) {
		if (pageFullPageNum === 1) {
			$.fn.fullpage.moveTo(2);
		} else {
			$('.fullpage-inner-scroll').scrollTop(0).off('wheel');
			$.fn.fullpage.moveTo(1);
			$.fn.fullpage.setAllowScrolling(true);
		}
	});

	$('.top-btn-t').click(function () {
		$('body, html').animate({
			scrollTop: 0
		}, 800);
		return false;
	});

});

window.addEventListener('componentsLoaded', initUI);
