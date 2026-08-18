-- Add image_url column to public.courts if not already present
alter table public.courts add column if not exists image_url text;

-- Update existing default courts with sample high-res court images
update public.courts
set image_url = 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=1200&auto=format&fit=crop'
where id = '11111111-1111-4111-8111-111111111111' and (image_url is null or image_url = '');

update public.courts
set image_url = 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=1200&auto=format&fit=crop'
where id = '22222222-2222-4222-8222-222222222222' and (image_url is null or image_url = '');

update public.courts
set image_url = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop'
where id = '33333333-3333-4333-8333-333333333333' and (image_url is null or image_url = '');
