update public.notification_rules
set
  name = 'User access notifications',
  updated_at = timezone('utc', now())
where trigger in ('user-access-invite', 'user-password-reset')
  and name = 'User access self-service notifications';
