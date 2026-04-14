document.addEventListener("DOMContentLoaded", function () {

    /* ===============================
       TS PARTICLES - NEURAL SYSTEM
    =============================== */

    if (typeof tsParticles !== "undefined") {
        tsParticles.load("tsparticles", {
            fullScreen: { enable: false },
            background: { color: "transparent" },
            fpsLimit: 60,
            detectRetina: true,

            particles: {
                number: {
                    value: 90,
                    density: { enable: true, area: 1000 }
                },

                color: { value: ["#3b82f6", "#9333ea"] },

                shape: { type: "circle" },

                opacity: {
                    value: 0.75
                },

                size: {
                    value: { min: 1, max: 3 }
                },

                links: {
                    enable: true,
                    distance: 150,
                    color: "#6366f1",
                    opacity: 0.55,
                    width: 1.5
                },

                move: {
                    enable: true,
                    speed: 1.2,
                    direction: "none",
                    random: false,
                    straight: false,
                    outModes: { default: "bounce" }
                }
            },

            interactivity: {
                events: {
                    onHover: {
                        enable: true,
                        mode: ["grab", "attract"]
                    },
                    onClick: {
                        enable: false
                    }
                },

                modes: {
                    grab: {
                        distance: 180,
                        links: { opacity: 0.7 }
                    },

                    attract: {
                        distance: 220,
                        duration: 0.4,
                        speed: 2
                    }
                }
            }
        });
    }

    /* ===============================
       BACKGROUND PARALLAX
    =============================== */

    const particleLayer = document.getElementById("tsparticles");

    if (particleLayer) {
        let ticking = false;

        window.addEventListener("scroll", () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    particleLayer.style.transform =
                        `translateY(${window.scrollY * 0.12}px) translateZ(0)`;
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }

    /* ===============================
       SERVICE CARD TILT EFFECT
    =============================== */

    const cards = document.querySelectorAll(".service-card");

    cards.forEach(card => {
        card.addEventListener("mousemove", (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * 6;
            const rotateY = ((x - centerX) / centerX) * -6;

            card.style.transform =
                `translateY(-16px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        card.addEventListener("mouseleave", () => {
            card.style.transform = "";
        });
    });

    /* ===============================
       SCROLL FADE-IN
    =============================== */

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.06 });

    document.querySelectorAll(".fade-in").forEach(el => observer.observe(el));

    /* ===============================
       CONTACT PRODUCT AUTO FILL
    =============================== */

    window.selectProduct = function (productName) {
        const contactSection = document.getElementById("contact");
        if (contactSection) {
            contactSection.scrollIntoView({ behavior: "smooth" });
        }

        const textarea = document.querySelector(".contact-form textarea");
        if (textarea) {
            textarea.value =
                "Hi ZyanLabs,\n\nI'm interested in learning more about " +
                productName +
                ". Please share implementation details and next steps.";
        }
    };

    /* ===============================
       BUDGET SLIDER + CURRENCY
    =============================== */

    const ranges = [
        "25,000 – 50,000",
        "50,000 – 1,00,000",
        "1,00,000 – 2,50,000",
        "2,50,000 – 5,00,000",
        "5,00,000 – 10,00,000",
        "10,00,000 – 25,00,000",
        "25,00,000+"
    ];

    const budgetRange = document.getElementById("budgetRange");
    const budgetText = document.getElementById("budgetText");
    const currencySelect = document.getElementById("currencySelect");

    if (budgetRange && budgetText && currencySelect) {

        function updateBudget() {
            const symbol = currencySelect.value;
            budgetText.innerText =
                "My budget is " + symbol + " " + ranges[budgetRange.value];
        }

        budgetRange.addEventListener("input", updateBudget);
        currencySelect.addEventListener("change", updateBudget);

        updateBudget();
    }

    /* ===============================
       ZYAN CHAT
    =============================== */

    const chat = document.querySelector(".zyan-chat");
    const openChat = document.getElementById("openChat");
    const closeChat = document.getElementById("closeChat");
    const chatBody = document.getElementById("chatBody");

    if (chat && openChat && closeChat && chatBody) {

        openChat.addEventListener("click", () => {
            chat.style.display = "flex";
        });

        closeChat.addEventListener("click", () => {
            chat.style.display = "none";
        });

        window.sendMessage = function () {
            const input = document.getElementById("userInput");
            const message = input.value.trim();
            if (!message) return;

            const userDiv = document.createElement("div");
            userDiv.className = "user-message";
            userDiv.innerText = message;
            chatBody.appendChild(userDiv);

            input.value = "";

            setTimeout(() => {
                const botDiv = document.createElement("div");
                botDiv.className = "bot-message";

                const lower = message.toLowerCase();

                if (lower.includes("price")) {
                    botDiv.innerText =
                        "Investment depends on scope. Zyan recommends a short strategy call to define architecture first.";
                } else if (lower.includes("website")) {
                    botDiv.innerText =
                        "We engineer high-performance growth systems — not brochure websites.";
                } else {
                    botDiv.innerText =
                        "Understood. Zyan will help architect the right solution for you.";
                }

                chatBody.appendChild(botDiv);
                chatBody.scrollTop = chatBody.scrollHeight;

            }, 600);
        };
    }

});