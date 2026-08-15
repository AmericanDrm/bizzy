import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useRegisterModal } from '@/contexts/ModalStackContext';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import SettingsModal from '@/components/SettingsModal';
import MessageTemplatesModal from '@/components/MessageTemplatesModal';
import EmailTemplatesModal from '@/components/EmailTemplatesModal';
import LayoutCustomizationModal from '@/components/LayoutCustomizationModal';
import FAQModal from '@/components/FAQModal';
import LegalModal from '@/components/LegalModal';
import EmailSettingsModal from '@/components/EmailSettingsModal';
import SmsSetupModal from '@/components/SmsSetupModal';
import ClientPortalSettingsModal from '@/components/ClientPortalSettingsModal';
import JobTypesModal from '@/components/JobTypesModal';
import CallerIdHandler from '@/components/CallerIdHandler';
import ClientModal from '@/components/ClientModal';
import ScheduleModal from '@/components/ScheduleModal';
import EstimateModal from '@/components/EstimateModal';
import InvoiceModal from '@/components/InvoiceModal';
import DocumentTemplatesModal from '@/components/DocumentTemplatesModal';

export default function GlobalSettingsManager() {
  const { settingsOpen, closeSettings } = useSettings();
  const { startWalkthrough } = useWalkthrough();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [templatesVisible, setTemplatesVisible] = useState(false);
  const [emailTemplatesVisible, setEmailTemplatesVisible] = useState(false);
  const [layoutCustomizationVisible, setLayoutCustomizationVisible] = useState(false);
  const [faqVisible, setFaqVisible] = useState(false);
  const [legalVisible, setLegalVisible] = useState(false);
  const [legalType, setLegalType] = useState<'terms' | 'privacy'>('privacy');
  const [emailSettingsVisible, setEmailSettingsVisible] = useState(false);
  const [smsSetupVisible, setSmsSetupVisible] = useState(false);
  const [clientPortalSettingsVisible, setClientPortalSettingsVisible] = useState(false);
  const [jobTypesVisible, setJobTypesVisible] = useState(false);
  const [documentTemplatesVisible, setDocumentTemplatesVisible] = useState(false);
  const [openedFromSettings, setOpenedFromSettings] = useState(false);

  const [callerScheduleVisible, setCallerScheduleVisible] = useState(false);
  const [callerEstimateVisible, setCallerEstimateVisible] = useState(false);
  const [callerInvoiceVisible, setCallerInvoiceVisible] = useState(false);
  const [callerClientVisible, setCallerClientVisible] = useState(false);
  const [callerClientPhone, setCallerClientPhone] = useState('');
  const [callerPrefill, setCallerPrefill] = useState<{
    clientId?: string;
    clientName?: string;
    phone?: string;
    address?: string;
  } | null>(null);

  const handleCallerSchedule = useCallback((clientId: string, clientName: string, phone: string, address: string) => {
    setCallerPrefill({ clientId, clientName, phone, address });
    setCallerScheduleVisible(true);
  }, []);

  const handleCallerEstimate = useCallback((clientId: string, clientName: string) => {
    setCallerPrefill({ clientId, clientName });
    setCallerEstimateVisible(true);
  }, []);

  const handleCallerInvoice = useCallback((clientId: string, clientName: string) => {
    setCallerPrefill({ clientId, clientName });
    setCallerInvoiceVisible(true);
  }, []);

  const handleCallerCreateClient = useCallback((phone: string) => {
    setCallerClientPhone(phone);
    setCallerClientVisible(true);
  }, []);

  useEffect(() => {
    if (settingsOpen) {
      setSettingsVisible(true);
      closeSettings();
    }
  }, [settingsOpen]);

  const returnToSettings = useCallback(() => {
    setOpenedFromSettings(false);
    setTimeout(() => setSettingsVisible(true), 200);
  }, []);

  const handleSubModalClose = useCallback((setter: (v: boolean) => void) => {
    setter(false);
    if (openedFromSettings) {
      returnToSettings();
    }
  }, [openedFromSettings, returnToSettings]);

  const openFromSettings = useCallback((setter: (v: boolean) => void) => {
    setOpenedFromSettings(true);
    setter(true);
  }, []);

  const closeTemplates = useCallback(() => handleSubModalClose(setTemplatesVisible), [handleSubModalClose]);
  const closeEmailTemplates = useCallback(() => handleSubModalClose(setEmailTemplatesVisible), [handleSubModalClose]);
  const closeLayoutCustomization = useCallback(() => handleSubModalClose(setLayoutCustomizationVisible), [handleSubModalClose]);
  const closeFaq = useCallback(() => handleSubModalClose(setFaqVisible), [handleSubModalClose]);
  const closeLegal = useCallback(() => handleSubModalClose(setLegalVisible), [handleSubModalClose]);
  const closeEmailSettings = useCallback(() => handleSubModalClose(setEmailSettingsVisible), [handleSubModalClose]);
  const closeSmsSetup = useCallback(() => handleSubModalClose(setSmsSetupVisible), [handleSubModalClose]);
  const closeClientPortal = useCallback(() => handleSubModalClose(setClientPortalSettingsVisible), [handleSubModalClose]);
  const closeJobTypes = useCallback(() => handleSubModalClose(setJobTypesVisible), [handleSubModalClose]);
  const closeDocTemplates = useCallback(() => handleSubModalClose(setDocumentTemplatesVisible), [handleSubModalClose]);

  useRegisterModal('gsm-settings', settingsVisible, () => setSettingsVisible(false));
  useRegisterModal('gsm-templates', templatesVisible, closeTemplates);
  useRegisterModal('gsm-email-templates', emailTemplatesVisible, closeEmailTemplates);
  useRegisterModal('gsm-layout', layoutCustomizationVisible, closeLayoutCustomization);
  useRegisterModal('gsm-faq', faqVisible, closeFaq);
  useRegisterModal('gsm-legal', legalVisible, closeLegal);
  useRegisterModal('gsm-email-settings', emailSettingsVisible, closeEmailSettings);
  useRegisterModal('gsm-sms-setup', smsSetupVisible, closeSmsSetup);
  useRegisterModal('gsm-client-portal', clientPortalSettingsVisible, closeClientPortal);
  useRegisterModal('gsm-job-types', jobTypesVisible, closeJobTypes);
  useRegisterModal('gsm-doc-templates', documentTemplatesVisible, closeDocTemplates);
  useRegisterModal('gsm-caller-client', callerClientVisible, () => setCallerClientVisible(false));
  useRegisterModal('gsm-caller-schedule', callerScheduleVisible, () => setCallerScheduleVisible(false));
  useRegisterModal('gsm-caller-estimate', callerEstimateVisible, () => setCallerEstimateVisible(false));
  useRegisterModal('gsm-caller-invoice', callerInvoiceVisible, () => setCallerInvoiceVisible(false));

  return (
    <>
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onOpenMessageTemplates={() => openFromSettings(setTemplatesVisible)}
        onOpenEmailTemplates={() => openFromSettings(setEmailTemplatesVisible)}
        onOpenLayoutCustomization={() => openFromSettings(setLayoutCustomizationVisible)}
        onOpenFAQ={() => openFromSettings(setFaqVisible)}
        onOpenWalkthrough={() => startWalkthrough('settings')}
        onOpenLegal={() => {
          setLegalType('privacy');
          openFromSettings(setLegalVisible);
        }}
        onOpenEmailSettings={() => openFromSettings(setEmailSettingsVisible)}
        onOpenSmsSetup={() => openFromSettings(setSmsSetupVisible)}
        onOpenClientPortal={() => openFromSettings(setClientPortalSettingsVisible)}
        onOpenJobTypes={() => openFromSettings(setJobTypesVisible)}
        onOpenDocumentTemplates={() => openFromSettings(setDocumentTemplatesVisible)}
      />

      <MessageTemplatesModal
        visible={templatesVisible}
        onClose={closeTemplates}
      />

      <EmailTemplatesModal
        visible={emailTemplatesVisible}
        onClose={closeEmailTemplates}
      />

      <LayoutCustomizationModal
        visible={layoutCustomizationVisible}
        onClose={closeLayoutCustomization}
      />

      <FAQModal visible={faqVisible} onClose={closeFaq} />

      <LegalModal
        visible={legalVisible}
        onClose={closeLegal}
        type={legalType}
      />

      <EmailSettingsModal
        visible={emailSettingsVisible}
        onClose={closeEmailSettings}
      />

      <SmsSetupModal
        visible={smsSetupVisible}
        onClose={closeSmsSetup}
      />

      <ClientPortalSettingsModal
        visible={clientPortalSettingsVisible}
        onClose={closeClientPortal}
      />

      <JobTypesModal
        visible={jobTypesVisible}
        onClose={closeJobTypes}
      />

      <DocumentTemplatesModal
        visible={documentTemplatesVisible}
        onClose={closeDocTemplates}
      />

      <CallerIdHandler
        onScheduleClient={handleCallerSchedule}
        onEstimateClient={handleCallerEstimate}
        onInvoiceClient={handleCallerInvoice}
        onCreateClient={handleCallerCreateClient}
      />

      {callerClientVisible && (
        <ClientModal
          visible={callerClientVisible}
          client={null}
          prefillPhone={callerClientPhone}
          onClose={() => {
            setCallerClientVisible(false);
            setCallerClientPhone('');
          }}
          onSave={() => {
            setCallerClientVisible(false);
            setCallerClientPhone('');
          }}
        />
      )}

      {callerScheduleVisible && (
        <ScheduleModal
          visible={callerScheduleVisible}
          onClose={() => {
            setCallerScheduleVisible(false);
            setCallerPrefill(null);
          }}
          onSave={() => {
            setCallerScheduleVisible(false);
            setCallerPrefill(null);
          }}
          prefillFromClient={callerPrefill ? {
            clientId: callerPrefill.clientId,
            clientName: callerPrefill.clientName,
            phone: callerPrefill.phone,
            address: callerPrefill.address,
          } : null}
        />
      )}

      {callerEstimateVisible && (
        <EstimateModal
          visible={callerEstimateVisible}
          estimate={null}
          onClose={() => {
            setCallerEstimateVisible(false);
            setCallerPrefill(null);
          }}
          onSave={() => {
            setCallerEstimateVisible(false);
            setCallerPrefill(null);
          }}
          prefill={callerPrefill?.clientId ? { clientId: callerPrefill.clientId } : null}
        />
      )}

      {callerInvoiceVisible && (
        <InvoiceModal
          visible={callerInvoiceVisible}
          invoice={null}
          onClose={() => {
            setCallerInvoiceVisible(false);
            setCallerPrefill(null);
          }}
          onSave={() => {
            setCallerInvoiceVisible(false);
            setCallerPrefill(null);
          }}
          prefill={callerPrefill?.clientId ? { clientId: callerPrefill.clientId, items: [] } : null}
        />
      )}
    </>
  );
}
