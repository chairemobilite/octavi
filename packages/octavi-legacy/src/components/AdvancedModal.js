import React from "react";

import ConfirmModal from "chaire-lib-frontend/lib/components/modal/ConfirmModal";

// Compatibility adapter for legacy callers. New code should use ConfirmModal directly.
export const AdvancedModal = (props) => (
  <ConfirmModal
    isOpen={props.isOpen !== false}
    closeModal={props.closeModal}
    title={props.title || ""}
    cancelAction={props.cancelAction}
    confirmAction={props.confirmAction}
    showCancelButton={props.showCancelButton}
    showConfirmButton={props.showConfirmButton}
    cancelButtonLabel={props.cancelButtonLabel}
    confirmButtonLabel={props.confirmButtonLabel}
    cancelButtonColor={props.cancelButtonColor}
    confirmButtonColor={props.confirmButtonColor}
  >
    {props.container}
  </ConfirmModal>
);

export default AdvancedModal;
