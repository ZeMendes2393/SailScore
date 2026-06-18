'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { submitDemoRequest } from '@/lib/api';

export default function BookDemoForm() {
  const t = useTranslations('landing.demoForm');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [clubName, setClubName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        toast.success(t('successEmailed'));
      } else {
        toast.success(t('successReceived'));
      }
      setFullName('');
      setEmail('');
      setClubName('');
      setPhone('');
      setMessage('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('errorGeneric');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="ss-demo-form" onSubmit={onSubmit} noValidate>
      <div className="ss-field">
        <label htmlFor="ss-demo-name">{t('nameLabel')}</label>
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
        <label htmlFor="ss-demo-email">{t('emailLabel')}</label>
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
        <label htmlFor="ss-demo-club">{t('clubLabel')}</label>
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
        <label htmlFor="ss-demo-phone">{t('phoneLabel')}</label>
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
        <label htmlFor="ss-demo-message">{t('messageLabel')}</label>
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
          {loading ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  );
}
