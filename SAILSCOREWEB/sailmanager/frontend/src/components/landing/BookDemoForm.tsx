'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { submitDemoRequest } from '@/lib/api';

export default function BookDemoForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [clubName, setClubName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot.trim()) {
      toast.success('Thanks — we will get back to you.');
      return;
    }
    setLoading(true);
    try {
      const res = await submitDemoRequest({
        full_name: fullName.trim(),
        email: email.trim(),
        club_name: clubName.trim(),
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
      });
      if (res.emailed) {
        toast.success('Request sent. We will contact you shortly.');
      } else {
        toast.success('Request received. We will get back to you soon.');
      }
      setFullName('');
      setEmail('');
      setClubName('');
      setPhone('');
      setMessage('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="ss-demo-form" onSubmit={onSubmit} noValidate>
      <div className="ss-demo-form-hp" aria-hidden="true">
        <label htmlFor="ss-demo-company">Company</label>
        <input
          id="ss-demo-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      <div className="ss-field">
        <label htmlFor="ss-demo-name">Your name</label>
        <input
          id="ss-demo-name"
          name="full_name"
          type="text"
          required
          maxLength={120}
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="ss-field">
        <label htmlFor="ss-demo-email">Work email</label>
        <input
          id="ss-demo-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="ss-field">
        <label htmlFor="ss-demo-club">Club or organization</label>
        <input
          id="ss-demo-club"
          name="club_name"
          type="text"
          required
          maxLength={200}
          autoComplete="organization"
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
        />
      </div>
      <div className="ss-field">
        <label htmlFor="ss-demo-phone">Phone (optional)</label>
        <input
          id="ss-demo-phone"
          name="phone"
          type="tel"
          maxLength={40}
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="ss-field">
        <label htmlFor="ss-demo-message">What would you like to see? (optional)</label>
        <textarea
          id="ss-demo-message"
          name="message"
          rows={3}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <div className="ss-demo-actions">
        <button type="submit" className="ss-btn ss-btn-primary" disabled={loading}>
          {loading ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </form>
  );
}
