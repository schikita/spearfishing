import { Helmet } from 'react-helmet-async';
import { SITE_URL, DEFAULT_TITLE, DEFAULT_DESCRIPTION, OG_IMAGE, SITE_NAME } from '../config';

interface SeoHeadProps {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
  image?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export default function SeoHead({ title, description, path = '', noIndex, image, jsonLd }: SeoHeadProps) {
  const fullTitle = title
    ? title.includes('Подводная охота')
      ? title
      : `${title} | Подводная охота`
    : DEFAULT_TITLE;
  const fullDescription = description || DEFAULT_DESCRIPTION;
  const cleanPath = path.replace(/^\//, '');
  const url = cleanPath ? `${SITE_URL.replace(/\/$/, '')}/${cleanPath}` : SITE_URL.replace(/\/$/, '');
  const ogImage = image || OG_IMAGE;
  const imageType = ogImage.endsWith('.jpg') || ogImage.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDescription} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="ru_BY" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:type" content={imageType} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDescription} />
      <meta name="twitter:image" content={ogImage} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
