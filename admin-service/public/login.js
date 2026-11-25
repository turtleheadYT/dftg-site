const form = document.querySelector('form');
const status = document.getElementById('status');
status.setAttribute('tabindex', '-1');
if (new URLSearchParams(location.search).has('signedin')) {
  status.dataset.error = 'true';
  status.textContent = 'Your sign-in session was not kept. Open this admin address directly in a normal browser tab and allow cookies for this site, then try again.';
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  status.dataset.error = 'false';
  button.disabled = true;
  status.textContent = 'Signing in…';
  try {
    const response = await fetch('/api/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: document.getElementById('password').value }), signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const session = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (session.status === 401) throw new Error('Your password was accepted, but this browser did not keep the sign-in session. Open this admin address directly in a normal browser tab and allow cookies for this site, then try again.');
    if (!session.ok) throw new Error('Could not verify your sign-in session. Please try again.');
    location.replace('/PT_home/admin/?signedin=1');
  } catch (error) {
    status.dataset.error = 'true';
    status.textContent = error.name === 'TimeoutError' ? 'Sign-in took too long. The service may be waking up; please try again.' : error.message;
    button.disabled = false;
    status.focus();
  }
});
