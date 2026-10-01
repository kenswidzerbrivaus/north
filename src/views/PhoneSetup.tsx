import { useEffect, useState } from 'react'
import {
  applyAppShields,
  authorizeScreenTime,
  clearAppShields,
  nativeAvailable,
  nativePlatform,
  nativeUsage,
  pickLockedApps,
  setAsAndroidLauncher,
} from '../lib/native'
import { isIosDevice, isStandaloneApp } from '../lib/install'
import { useStore } from '../store'

export function PhoneSetup() {
  const { state, updateAttention } = useStore()
  const native = nativeAvailable()
  const platform = nativePlatform()
  const ios = isIosDevice()
  const android = /Android/i.test(navigator.userAgent)
  const standalone = isStandaloneApp()
  const st = state.attention.screenTime
  const [msg, setMsg] = useState('')
  const [usage, setUsage] = useState(st.lastUsage)

  useEffect(() => {
    if (!native) return
    void nativeUsage().then((u) => {
      if (!u) return
      const lastUsage = { ...u, at: new Date().toISOString() }
      setUsage(lastUsage)
      updateAttention((a) => ({ ...a, screenTime: { ...a.screenTime, lastUsage } }))
    })
  }, [native, updateAttention])

  const authorize = async () => {
    const r = await authorizeScreenTime()
    if (r?.ok || r?.authorized) {
      updateAttention((a) => ({ ...a, screenTime: { ...a.screenTime, authorized: true } }))
      setMsg('Screen Time is on. Pick the apps to block.')
      return
    }
    setMsg('Screen Time lives in the native Sepho app. Install it from Xcode (native/ios), then tap this again.')
  }

  const pick = async () => {
    const r = await pickLockedApps()
    if (r?.selection) {
      updateAttention((a) => ({ ...a, screenTime: { ...a.screenTime, authorized: true, selection: r.selection ?? '' } }))
      await applyAppShields({ selection: r.selection, detox: state.attention.detox.active })
      setMsg(`Shielding ${r.count ?? 0} apps at the system level.`)
      return
    }
    setMsg('App picker needs the native Sepho build with the Screen Time entitlement.')
  }

  return (
    <section className="card stack">
      <h2>Phone home</h2>
      <p className="muted">
        iPhone cannot let a website replace SpringBoard. Sepho does what Blank-style launchers do: a text home, iOS widgets, Screen
        Time shields, and Phone.app / Messages.app as real apps. Android can set Sepho as the default launcher and read Usage
        Stats.
      </p>

      {native ? (
        <p className="kicker">Native Sepho · {platform === 'ios' ? 'Screen Time' : 'Usage Stats'}</p>
      ) : (
        <p className="kicker">{standalone ? 'Home Screen app' : 'Browser'} · system locks need the native build</p>
      )}

      {usage ? (
        <p className="muted">
          Device use: {usage.essentialMin} min essential · {usage.otherMin} min other
          {usage.at ? ` · ${new Date(usage.at).toLocaleTimeString()}` : ''}
        </p>
      ) : (
        <p className="muted">Usage Stats / Screen Time reports appear here once the native app is installed.</p>
      )}

      <button className="btn" type="button" onClick={() => void authorize()}>
        Turn on Screen Time
      </button>
      <button className="btn" type="button" onClick={() => void pick()}>
        Choose apps to lock
      </button>
      <button
        className="btn-ghost"
        type="button"
        onClick={() =>
          void applyAppShields({ selection: st.selection, detox: true }).then((r) =>
            setMsg(r?.ok ? 'Detox shield on — Phone and Messages stay allowed.' : 'Install native Sepho to shield other apps.'),
          )
        }
      >
        Apply system detox
      </button>
      <button
        className="btn-ghost"
        type="button"
        onClick={() =>
          void clearAppShields().then((r) => setMsg(r?.ok ? 'Shields cleared.' : 'No native shield to clear.'))
        }
      >
        Clear system locks
      </button>
      {android ? (
        <button className="btn" type="button" onClick={() => void setAsAndroidLauncher()}>
          Set as default home app
        </button>
      ) : null}

      {ios ? (
        <>
          <p className="kicker">Make the iPhone home quiet</p>
          <ol className="install-steps">
            <li>
              {standalone ? 'Sepho is already on the Home Screen.' : 'In Safari: Share → Add to Home Screen, then open that icon.'}
            </li>
            <li>Long-press the Home Screen → Edit → add the Sepho widgets (clock + text list) to page 1. Native build required for widgets.</li>
            <li>Tap the page dots → uncheck every other page so only the quiet page remains. Apps stay in the App Library.</li>
            <li>Settings → Home Screen & App Library → hide the Dock, or leave Phone and Messages in the Dock.</li>
            <li>Settings → Screen Time → App Limits for anything you also lock in Sepho, until the native app is installed.</li>
          </ol>
        </>
      ) : null}

      {android ? (
        <>
          <p className="kicker">Android home</p>
          <ol className="install-steps">
            <li>Install the Sepho APK from native/android.</li>
            <li>When Android asks, set Sepho as the default Home app. That replaces the icon grid.</li>
            <li>Grant Usage access: Settings → Apps → Special app access → Usage access → Sepho.</li>
            <li>Optional: Digital Wellbeing → app timers for anything still reachable outside Sepho.</li>
          </ol>
        </>
      ) : null}

      {msg ? <p className="kicker">{msg}</p> : null}
    </section>
  )
}
