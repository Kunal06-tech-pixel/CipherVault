import type { VaultItem } from '@ciphervault/contracts'

function dispatch(element: HTMLInputElement): void {
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function visible(input: HTMLInputElement): boolean {
  const style = getComputedStyle(input)
  return !input.disabled && !input.readOnly && style.display !== 'none' && style.visibility !== 'hidden'
}

function fill(item: VaultItem): boolean {
  const password = [...document.querySelectorAll<HTMLInputElement>('input[type="password"]')].find(visible)
  if (!password) return false
  const form = password.form ?? document
  const username = [...form.querySelectorAll<HTMLInputElement>('input')].find((input) =>
    visible(input) && input !== password && ['email', 'text', ''].includes(input.type) &&
    /user|email|login/i.test(`${input.name} ${input.id} ${input.autocomplete}`))
  if (username) { username.focus(); username.value = String(item.fields.username ?? ''); dispatch(username) }
  password.focus(); password.value = String(item.fields.password ?? ''); dispatch(password)
  return true
}

chrome.runtime.onMessage.addListener((message: { type: string; item?: VaultItem }, _sender, respond) => {
  if (message.type === 'fill' && message.item) respond({ filled: fill(message.item) })
})

document.addEventListener('submit', (event) => {
  const form = event.target
  if (!(form instanceof HTMLFormElement)) return
  const password = form.querySelector<HTMLInputElement>('input[type="password"]')?.value
  if (!password) return
  const username = [...form.querySelectorAll<HTMLInputElement>('input')].find((input) =>
    ['email', 'text'].includes(input.type) && /user|email|login/i.test(`${input.name} ${input.id} ${input.autocomplete}`))?.value ?? ''
  void chrome.runtime.sendMessage({ type: 'login-candidate', url: location.href, username, password })
}, true)
