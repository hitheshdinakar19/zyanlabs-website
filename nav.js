const btn = document.getElementById('navToggle');
const nav = document.querySelector('header nav');

btn.addEventListener('click', () => {
    nav.classList.toggle('nav-open');
    btn.classList.toggle('is-open');
});

nav.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
        nav.classList.remove('nav-open');
        btn.classList.remove('is-open');
    })
);
