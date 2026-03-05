import { Helmet } from 'react-helmet-async';
import { SITE_URL, DEFAULT_TITLE, DEFAULT_DESCRIPTION } from '../config';

interface SeoHeadProps {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
}

export default function SeoHead({ title, description, path = '', noIndex }: SeoHeadProps) {
  const fullTitle = title ? `${title} | Подводная охота` : DEFAULT_TITLE;
  const fullDescription = description || DEFAULT_DESCRIPTION;
  const cleanPath = path.replace(/^\//, '');
  const url = cleanPath ? `${SITE_URL.replace(/\/$/, '')}/${cleanPath}` : SITE_URL.replace(/\/$/, '');

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDescription} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="ru_BY" />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
    </Helmet>
  );
}
