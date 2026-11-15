(()=>{const $=s=>document.querySelector(s);
const t=$('.nav-toggle'),n=$('#site-nav');
if(t&&n){t.addEventListener('click',()=>{const o=n.classList.toggle('open');t.setAttribute('aria-expanded',o)});
n.addEventListener('click',e=>{if(e.target.closest('a')){n.classList.remove('open');t.setAttribute('aria-expanded',false)}})}
// Trailer: set data-youtube-id on .trailer in index.html to enable. Loads only after click (no third-party requests before).
const tr=$('.trailer');if(tr){const id=tr.dataset.youtubeId,b=tr.querySelector('button');
if(id){b.disabled=false;b.lastChild.textContent='Play trailer';b.addEventListener('click',()=>{
tr.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1" title="Don’t Feed The Geese trailer" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>'})}}
// Lightbox + easter egg
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{const d=document.getElementById(b.dataset.open);d.showModal()}));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));
// News: day cards with date menu and arrows
const nw=$('.news');if(nw){const cards=[...nw.querySelectorAll('.day')],tabs=$('.news-tabs');
const go=c=>nw.scrollTo({left:c.offsetLeft-nw.offsetLeft,behavior:'smooth'});
cards.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.textContent=c.querySelector('time').textContent;b.addEventListener('click',()=>go(c));tabs.appendChild(b)});
const mark=()=>{let i=0;cards.forEach((c,k)=>{if(c.offsetLeft-nw.offsetLeft<=nw.scrollLeft+10)i=k});[...tabs.children].forEach((b,k)=>b.setAttribute('aria-current',k===i))};
document.querySelectorAll('.news-nav').forEach(b=>b.addEventListener('click',()=>nw.scrollBy({left:+b.dataset.dir*(cards[0].offsetWidth+19),behavior:'smooth'})));
nw.addEventListener('scroll',mark,{passive:true});mark()}
})();
