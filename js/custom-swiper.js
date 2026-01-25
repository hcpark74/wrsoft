document.addEventListener("DOMContentLoaded", function () {
    // swiper
    // swiper2 = new Swiper('.reference .sub-02 .swiper-container', {
    //     infinite: true,
    //     spaceBetween: -380,
    //     slidePerView: 'auto',
    //     observer: true,
    //     observeParents: true,
    //     effect: 'slide',
    //     pagination: {
    //         el: ".swiper-pagination-s",
    //         type: "progressbar",
    //     },
    //     loop: false,
    //     loopAdditionalSlides:1,
    //     navigation: {
    //         nextEl: ".swiper-button-next-s",
    //         prevEl: ".swiper-button-prev-s",
    //     },
    //     speed: 1500,
    //     autoplay: {
    //         delay: 2500,
    //         disableOnInteraction: false,
    //     },
    //     breakpoints: {
    //         360: {
    //             slidesPerView: 1,
    //             spaceBetween: 30,
    //         },
    //         480: {
    //             slidesPerView: 2,
    //             spaceBetween: 100,
    //         },
    //         768: {
    //             slidesPerView: 2,
    //             spaceBetween: 130,
    //         },
    //         900: {
    //             slidesPerView: 3,
    //             spaceBetween: 130,
    //         },
    //         1024: {
    //             slidesPerView: 3,
    //             spaceBetween: 50,
    //         },
    //         1280: {
    //             slidesPerView: 5,
    //             spaceBetween: -380,
    //         }
    //     }
    // });

    // swiper2.autoplay.start();

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
    }
    $(function () {
        sectionAni();
    });
    $(window).on('scroll', function () {
        sectionAni();
    });

    // swiper
    // client
    swiper = new Swiper('.reference .sub-02 .card-slider', {
        slidePerView: 'auto',
        spaceBetween: 30,
        // observeParents: true,
        centeredSlides: true,
        loop: true,
        // loopAdditionalSlides:1,
        loopedSlides: 2,
        freeMode : false,
        effect: 'slide',
        pagination: {
            el: ".swiper-pagination-s",
            type: "progressbar",
        },
        navigation: {
            nextEl: ".swiper-button-next-s",
            prevEl: ".swiper-button-prev-s",
        },
        speed: 2000,
        autoplay: {
            delay: 2500,
            disableOnInteraction: false,
        },
        breakpoints: {
            360: {
                slidesPerView: 1,
                spaceBetween: 10,
            },
            480: {
                slidesPerView: 1,
                spaceBetween: 100,
            },
            768: {
                slidesPerView: 3,
                spaceBetween: 170,
            },
            1024: {
                slidesPerView: 4,
                spaceBetween: 130,
            },
            1280: {
                slidesPerView: 4,
                spaceBetween: 70,
            }
        }
    });

    swiper.autoplay.start();

    var flag = true;

    $(".pause-btn").click(function() {
        $(this).toggleClass("on");
        if (flag) {
            swiper.autoplay.stop();
            flag = false;
        } else {
            swiper.autoplay.start();
            flag= true;
        }
    });

    $(".flex-box > button").click(function () {
        $(".pause-btn").hide();
    });
});

