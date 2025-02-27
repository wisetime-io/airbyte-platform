import React, { createContext, useCallback, useContext, useState } from "react";
import { FieldErrors } from "react-hook-form";
import { useIntl } from "react-intl";

import { FormConnectionFormValues, useInitialFormValues } from "components/connection/ConnectionForm/formConfig";

import {
  useSourceDefinitionVersion,
  useDestinationDefinitionVersion,
  useGetSourceDefinitionSpecification,
  useGetDestinationDefinitionSpecification,
  useSourceDefinition,
  useDestinationDefinition,
} from "core/api";
import {
  ActorDefinitionVersionRead,
  DestinationDefinitionRead,
  DestinationDefinitionSpecificationRead,
  SourceDefinitionRead,
  SourceDefinitionSpecificationRead,
  WebBackendConnectionRead,
} from "core/api/types/AirbyteClient";
import { FormError, generateMessageFromError } from "core/utils/errorStatusMessage";

import { useExperiment } from "../Experiment";

export type ConnectionFormMode = "create" | "edit" | "readonly";

export type ConnectionOrPartialConnection =
  | WebBackendConnectionRead
  | (Partial<WebBackendConnectionRead> & Pick<WebBackendConnectionRead, "syncCatalog" | "source" | "destination">);

interface ConnectionServiceProps {
  connection: ConnectionOrPartialConnection;
  mode: ConnectionFormMode;
  schemaError?: Error | null;
  refreshSchema: () => Promise<void>;
}

interface ConnectionFormHook {
  connection: ConnectionOrPartialConnection;
  mode: ConnectionFormMode;
  sourceDefinition: SourceDefinitionRead;
  sourceDefinitionVersion: ActorDefinitionVersionRead;
  sourceDefinitionSpecification: SourceDefinitionSpecificationRead;
  destDefinition: DestinationDefinitionRead;
  destDefinitionVersion: ActorDefinitionVersionRead;
  destDefinitionSpecification: DestinationDefinitionSpecificationRead;
  initialValues: FormConnectionFormValues;
  schemaError?: Error | null;
  refreshSchema: () => Promise<void>;
  setSubmitError: (submitError: FormError | null) => void;
  getErrorMessage: (formValid: boolean, errors?: FieldErrors<FormConnectionFormValues>) => string | JSX.Element | null;
}

const useConnectionForm = ({
  connection,
  mode,
  schemaError,
  refreshSchema,
}: ConnectionServiceProps): ConnectionFormHook => {
  const {
    source: { sourceId, sourceDefinitionId },
    destination: { destinationId, destinationDefinitionId },
  } = connection;

  const sourceDefinition = useSourceDefinition(sourceDefinitionId);
  const sourceDefinitionVersion = useSourceDefinitionVersion(sourceId);
  const sourceDefinitionSpecification = useGetSourceDefinitionSpecification(sourceDefinitionId, connection.sourceId);

  const destDefinition = useDestinationDefinition(destinationDefinitionId);
  const destDefinitionVersion = useDestinationDefinitionVersion(destinationId);
  const destDefinitionSpecification = useGetDestinationDefinitionSpecification(
    destinationDefinitionId,
    connection.destinationId
  );

  const initialValues = useInitialFormValues(connection, destDefinitionVersion, mode === "edit");
  const { formatMessage } = useIntl();
  const [submitError, setSubmitError] = useState<FormError | null>(null);
  const isSimplifiedCreation = useExperiment("connection.simplifiedCreation", true);

  const getErrorMessage = useCallback<ConnectionFormHook["getErrorMessage"]>(
    (formValid, errors) => {
      if (submitError) {
        return generateMessageFromError(submitError, formatMessage);
      }

      if (!formValid) {
        const hasNoStreamsSelectedError = errors?.syncCatalog?.streams?.message === "connectionForm.streams.required";
        const validationErrorMessage = isSimplifiedCreation
          ? "connectionForm.validation.creationError"
          : "connectionForm.validation.error";
        return formatMessage({
          id: hasNoStreamsSelectedError ? "connectionForm.streams.required" : validationErrorMessage,
        });
      }

      return null;
    },
    [formatMessage, submitError, isSimplifiedCreation]
  );

  return {
    connection,
    mode,
    sourceDefinition,
    sourceDefinitionVersion,
    sourceDefinitionSpecification,
    destDefinition,
    destDefinitionVersion,
    destDefinitionSpecification,
    initialValues,
    schemaError,
    refreshSchema,
    setSubmitError,
    getErrorMessage,
  };
};

const ConnectionFormContext = createContext<ConnectionFormHook | null>(null);

export const ConnectionFormServiceProvider: React.FC<React.PropsWithChildren<ConnectionServiceProps>> = ({
  children,
  ...props
}) => {
  const data = useConnectionForm(props);
  return <ConnectionFormContext.Provider value={data}>{children}</ConnectionFormContext.Provider>;
};

export const useConnectionFormService = () => {
  const context = useContext(ConnectionFormContext);
  if (context === null) {
    throw new Error("useConnectionFormService must be used within a ConnectionFormProvider");
  }
  return context;
};
