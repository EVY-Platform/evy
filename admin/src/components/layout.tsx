import Head from 'next/head'
import Image from 'next/image'
import styles from './layout.module.css'
import utilStyles from '../styles/utils.module.css'
import Link from 'next/link'

export const siteTitle = 'Frodo Admin Portal'
const siteName = 'One platform to rule them all'
const logoImageUrl = 'https://funko.com/dw/image/v2/BGTS_PRD/on/demandware.static/-/Sites-funko-master-catalog/default/dw250569fc/images/funko/13551-PX-1TM-1.png?sw=800&sh=800'

export default function Layout({
  children,
  home
}: {
  children: React.ReactNode
  home?: boolean
}) {
  return (
    <div className={styles.container}>
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <meta
          name="description"
          content={siteName}
        />
        <meta
          property="og:image"
          content={logoImageUrl}
        />
        <meta name="og:title" content={siteTitle} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <header className={styles.header}>
        {home ? (
          <>
            <Image
              priority
              src={logoImageUrl}
              className={utilStyles.borderCircle}
              height={144}
              width={144}
              alt={siteName}
            />
            <h1 className={utilStyles.heading2Xl}>{siteName}</h1>
          </>
        ) : (
          <>
            <Link href="/">
              <Image
                priority
                src={logoImageUrl}
                className={utilStyles.borderCircle}
                height={108}
                width={108}
                alt={siteName}
              />
            </Link>
            <h2 className={utilStyles.headingLg}>
              <Link href="/" className={utilStyles.colorInherit}>
                {siteName}
              </Link>
            </h2>
          </>
        )}
      </header>
      <main>{children}</main>
      {!home && (
        <div className={styles.backToHome}>
          <Link href="/">← Back to home</Link>
        </div>
      )}
    </div>
  )
}
