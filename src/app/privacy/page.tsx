import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy notice | Daily Reel", robots: { index: false, follow: false } };

// PLACEHOLDER WORDING. It describes what the game actually does today, but it has not been reviewed by legal.
export default function Privacy() {
  return (
    <main className="app">
      <a className="backbar" href="/">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
        Back to the game
      </a>
      <h1 className="brand" style={{ marginBottom: 8 }}>Privacy notice</h1>
      <p className="rg-status" style={{ margin: "4px 0 12px" }}>Placeholder wording. Pending legal review.</p>

      <section className="section">
        <h2>What we keep</h2>
        <ul className="plain">
          <li><b>Your age check.</b> You tap to say you are 18 or over (21 or over in the US). We do not ask for or store a date of birth.</li>
          <li><b>One cookie.</b> A random identifier called <code>dr_pid</code> remembers that you passed the age check and which spins you have used. It lasts a year and is only sent to this game.</li>
          <li><b>Your play.</b> Your spins, points, symbols and weekly tier, linked to that random identifier and not to your name.</li>
          <li><b>Your email, only if you give it.</b> Saved with your tick-box choice to receive reminders when your daily spins are ready.</li>
          <li><b>Your choice about rewards.</b> If you ask to hear when rewards launch, that is saved as a separate choice.</li>
          <li><b>Display settings in your browser.</b> Sound, vibration, whether you have seen the intro, your region and which rewards you would play for. These stay on your device.</li>
        </ul>
      </section>

      <section className="section">
        <h2>Why</h2>
        <p>To run the daily limit, show your progress, and work out whether the game is enjoyable. Our team looks at totals, such as how many players came back, never at individual players.</p>
      </section>

      <section className="section">
        <h2>What we do not do</h2>
        <p>We do not use advertising or tracking cookies, and the game talks only to its own server. In this version we do not send your email to any partner or sponsor.</p>
      </section>

      <section className="section">
        <h2>Your choices</h2>
        <ul className="plain">
          <li>You can play without giving an email.</li>
          <li>Clearing your cookies removes your link to your play on this device.</li>
          <li>How to ask us to delete your email: <i>to be confirmed.</i></li>
        </ul>
      </section>

      <section className="section">
        <h2>Still to be confirmed</h2>
        <ul className="plain">
          <li>How long we keep data after the trial ends.</li>
          <li>Who is responsible for your data, and how to contact them.</li>
          <li>Your rights in your country.</li>
        </ul>
      </section>
    </main>
  );
}
