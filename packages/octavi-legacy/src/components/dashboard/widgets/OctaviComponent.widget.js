import { withTranslation } from 'react-i18next';

export const OctaviFilterResultInner = (props) => (
    props.value === 'no_data' ?
        props.t('octavi:NoData') :
        !Number.isNaN(props.value) ?
            new Intl.NumberFormat(props.i18n.language).format(props.value) :
            props.t('octavi:Error')
);

export const OctaviFilterResult = withTranslation(['main', 'octavi'])(OctaviFilterResultInner);