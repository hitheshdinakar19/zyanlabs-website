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
       API BASE URL + SOCKET
    =============================== */

    const API_BASE = "http://localhost:5000";
    const socket   = io(API_BASE);

    // Persistent client ID — generated once, stored in localStorage,
    // survives page refresh so chat history loads on every return visit.
    function getClientId() {
        let id = localStorage.getItem("zyan_client_id");
        if (!id) {
            id = "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
            localStorage.setItem("zyan_client_id", id);
        }
        return id;
    }
    const clientId = getClientId();

    // Tell the server our identity on every (re)connect
    socket.on("connect", () => socket.emit("join", { clientId }));

    /* ===============================
       CONTACT FORM — API SUBMIT
    =============================== */

    const contactForm = document.querySelector(".contact-form");

    if (contactForm) {
        contactForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const selects   = contactForm.querySelectorAll("select");
            const service   = selects[0] ? selects[0].value : "";
            const budget    = selects[1] ? selects[1].value : "";
            const name      = contactForm.querySelector("input[type='text']")?.value.trim()  || "";
            const email     = contactForm.querySelector("input[type='email']")?.value.trim() || "";
            const message   = contactForm.querySelector("textarea")?.value.trim()            || "";

            const submitBtn = contactForm.querySelector("button[type='submit']");
            if (submitBtn) {
                submitBtn.disabled    = true;
                submitBtn.textContent = "Sending…";
            }

            try {
                const res  = await fetch(`${API_BASE}/api/contact`, {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ name, email, service, budget, message }),
                });
                const data = await res.json();

                if (data.success) {
                    alert("Message sent! We'll be in touch shortly.");
                    contactForm.reset();
                } else {
                    alert("Error sending message. Please try again.");
                }
            } catch {
                alert("Error sending message. Please check your connection.");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled    = false;
                    submitBtn.textContent = "Request Strategy Call";
                }
            }
        });
    }

    /* ===============================
       ZYAN CHAT — SOCKET.IO
    =============================== */

    const chatWidget   = document.getElementById("zyanChat");
    const openChatBtn  = document.getElementById("openChat");
    const closeChatBtn = document.getElementById("closeChat");
    const chatBody     = document.getElementById("chatBody");

    // Append a bubble — available immediately so socket events can use it
    function appendBubble(text, role) {
        if (!chatBody) return;
        const div = document.createElement("div");
        div.className = `chat-msg ${role}`;
        div.textContent = text;
        chatBody.appendChild(div);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    // Soft reply chime for admin replies
    let _chatAudioCtx = null;

    function playReplyChime() {
        try {
            if (!_chatAudioCtx) {
                _chatAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx  = _chatAudioCtx;
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            // Softer ascending chime: 550 Hz → 770 Hz over 220 ms
            osc.type = "sine";
            osc.frequency.setValueAtTime(550, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(770, ctx.currentTime + 0.11);

            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.22);
        } catch (_) {
            // Fail silently if AudioContext is blocked
        }
    }

    // Load full chat history on (re)connect — renders all past messages from DB
    socket.on("chat history", ({ messages }) => {
        if (!chatBody || !messages || !messages.length) return;
        chatBody.innerHTML = "";
        messages.forEach(({ sender, text }) => {
            appendBubble(text, sender === "admin" ? "bot" : "user");
        });
    });

    // Real-time admin reply — welcome is in history, so always play chime here
    socket.on("chat message", ({ sender, msg }) => {
        appendBubble(msg, sender === "admin" ? "bot" : "user");
        if (sender === "admin") playReplyChime();
    });

    if (chatWidget && openChatBtn && closeChatBtn && chatBody) {

        // Toggle open / close
        openChatBtn.addEventListener("click", () => {
            chatWidget.classList.toggle("open");
            if (chatWidget.classList.contains("open")) {
                document.getElementById("userInput")?.focus();
            }
        });

        closeChatBtn.addEventListener("click", () => {
            chatWidget.classList.remove("open");
        });

        // Send message via socket — NO auto-reply (admin handles it)
        window.sendMessage = function () {
            const input   = document.getElementById("userInput");
            const message = input.value.trim();
            if (!message) return;

            input.value = "";
            appendBubble(message, "user");
            socket.emit("chat message", { msg: message });
        };

        // Enter key to send
        document.getElementById("userInput")?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") sendMessage();
        });
    }

});