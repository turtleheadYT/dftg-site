const form = document.querySelector('form');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  const status = document.getElementById('status');
  button.disabled = true;
  status.textContent = 'Signing in…';
  try {
    const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: document.getElementById('password').value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    location.reload();
  } catch (error) { status.textContent = error.message; button.disabled = false; }
});
