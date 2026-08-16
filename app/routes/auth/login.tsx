import { authClient } from '~/utils/auth/client'
import { Button, Card } from '@siemsiem/beerreact'
import i18next from 'i18next'
import zod from 'zod'
import { Link, redirect, useNavigate, useSearchParams } from 'react-router'
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
export async function clientLoader() {
  const { data } = await authClient.getSession()
  if (data?.user) {
    return redirect('/app')
  }
}

export function geti18nAuthMessageByCode(code: string) {
  switch (code) {
    case "USERNAME_IS_INVALID":
      return i18next.t('auth:errors.usernameIsInvalid')
    case "INVALID_EMAIL_OR_PASSWORD":
      return i18next.t('auth:errors.invcreds')
    case "INVALID_USERNAME_OR_PASSWORD":
      return i18next.t('auth:errors.invcreds')
    case "USERNAME_TOO_SHORT":
      return i18next.t('auth:errors.UserShort')
    case "PROVIDER_NOT_ENABLED":
      return i18next.t('auth:errors.ProviderDisabled')
    case "OAUTH_ERROR":
      return i18next.t('auth:errors.AuthError')
    case "PROVIDER_ERROR":
      return i18next.t('auth:errors.AuthError')
    case "OAUTH_EMAIL_MISSING":
      return i18next.t('auth:errors.AuthError')
    case "OAUTH_ACCOUNT_NOT_LINKED":
      return i18next.t('auth:errors.noConnectedAccount')
    case "ACCOUNT_DISABLED":
      return i18next.t('auth:errors.AccountDisabled') // Is anders dan Bans, worden niet veel gebruikt
    default:
      return i18next.t('auth:errors.unknown')
  }
}

export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams();

  useEffect(() => {
    switch (searchParams.get('error')) {
      case 'signup_disabled':
        alert(i18next.t('auth:errors.noConnectedAccount'))
        navigate('/auth/login')
        break;
      case 'account_not_linked':
        alert(i18next.t('auth:errors.noConnectedAccount'))
        navigate('/auth/login')
        break;
    }
  }, [])

  return (
    <div >
      <Card  align='center-align'>
        
        <h4>De Librelearn beta is helaas aleen voor mensen in HackClub</h4>

        <Button
          onClick={async () => {
            const isNative = Capacitor.isNativePlatform();
            if (isNative) {
              const res = await authClient.signIn.social({
                provider: 'Hackclub',
                callbackURL: 'https://librelearn.nl/api/native-callback',
                errorCallbackURL: 'https://librelearn.nl/api/native-callback?error=true',
                disableRedirect: true,
              });
              if (res.data?.url) {
                await Browser.open({ url: res.data.url });
              }
            } else {
              await authClient.signIn.social({
                provider: 'Hackclub',
                callbackURL: '/app',
                errorCallbackURL: '/auth/login',
              });
            }
          }}
        >{i18next.t('auth:loginHC')}</Button>
      </Card>

    </div>
  )

}
