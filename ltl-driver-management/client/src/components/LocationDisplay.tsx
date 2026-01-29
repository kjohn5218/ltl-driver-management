import React from 'react';

// Location tooltip component for inline display
interface LocationWithTooltipProps {
  location: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  contact?: string;
}

export const LocationWithTooltip: React.FC<LocationWithTooltipProps> = ({ 
  location, address, city, state, zipCode, contact 
}) => {
  const hasDetails = address || city || state || zipCode || contact;
  
  if (!hasDetails) {
    return <span className="font-medium">{location}</span>;
  }

  return (
    <div className="relative group inline-block">
      <span className="font-medium cursor-help border-b border-dotted border-gray-400">
        {location}
      </span>
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-64 p-3 bg-gray-900 text-white text-xs rounded shadow-lg">
        <div className="space-y-1">
          <div className="font-medium">{location}</div>
          {address && <div>{address}</div>}
          {(city || state || zipCode) && (
            <div>
              {city}{city && (state || zipCode) ? ', ' : ''}
              {state} {zipCode}
            </div>
          )}
          {contact && <div className="pt-1 border-t border-gray-700">Contact: {contact}</div>}
        </div>
        <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

// Location details component for detailed display in modals
interface LocationDetailsProps {
  title: string;
  location: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  contact?: string;
  compact?: boolean;
}

export const LocationDetails: React.FC<LocationDetailsProps> = ({
  title,
  location,
  address,
  city,
  state,
  zipCode,
  contact,
  compact = false
}) => {
  const hasAddressDetails = address || city || state || zipCode;
  
  if (compact) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{title}</label>
        <div className="text-sm text-gray-900">
          <p className="font-medium">{location}</p>
          {address && <p className="text-gray-600">{address}</p>}
          {(city || state || zipCode) && (
            <p className="text-gray-600">
              {city}{city && (state || zipCode) ? ', ' : ''}
              {state} {zipCode}
            </p>
          )}
          {contact && (
            <p className="text-gray-600 text-xs">
              <span className="font-medium">Contact:</span> {contact}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{title}</label>
      <div className="bg-gray-50 p-3 rounded-md">
        <p className="text-sm font-medium text-gray-900 mb-1">{location}</p>
        {address && (
          <p className="text-sm text-gray-600">{address}</p>
        )}
        {(city || state || zipCode) && (
          <p className="text-sm text-gray-600">
            {city}{city && (state || zipCode) ? ', ' : ''}
            {state} {zipCode}
          </p>
        )}
        {contact && (
          <p className="text-sm text-gray-600 mt-1">
            <span className="font-medium">Contact:</span> {contact}
          </p>
        )}
        {!hasAddressDetails && !contact && (
          <p className="text-sm text-gray-400 italic">No address details available</p>
        )}
      </div>
    </div>
  );
};

// Route details component that shows both origin and destination
interface RouteDetailsProps {
  route: {
    name?: string;
    origin: string;
    destination: string;
    distance?: number;
    originAddress?: string;
    originCity?: string;
    originState?: string;
    originZipCode?: string;
    originContact?: string;
    destinationAddress?: string;
    destinationCity?: string;
    destinationState?: string;
    destinationZipCode?: string;
    destinationContact?: string;
  };
  showDistance?: boolean;
  compact?: boolean;
}

export const RouteDetails: React.FC<RouteDetailsProps> = ({
  route,
  showDistance = true,
  compact = false
}) => {
  if (compact) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Linehaul Profile</label>
        <div className="text-sm text-gray-900">
          {route.name && <p className="font-medium">{route.name}</p>}
          <div className="flex items-center text-gray-600">
            <LocationWithTooltip 
              location={route.origin}
              address={route.originAddress}
              city={route.originCity}
              state={route.originState}
              zipCode={route.originZipCode}
              contact={route.originContact}
            />
            <span className="mx-2">→</span>
            <LocationWithTooltip 
              location={route.destination}
              address={route.destinationAddress}
              city={route.destinationCity}
              state={route.destinationState}
              zipCode={route.destinationZipCode}
              contact={route.destinationContact}
            />
          </div>
          {showDistance && route.distance && (
            <p className="text-gray-600">{route.distance} miles</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {route.name && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Linehaul Name</label>
          <p className="text-lg font-semibold text-gray-900">{route.name}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LocationDetails
          title="Origin"
          location={route.origin}
          address={route.originAddress}
          city={route.originCity}
          state={route.originState}
          zipCode={route.originZipCode}
          contact={route.originContact}
        />
        
        <LocationDetails
          title="Destination"
          location={route.destination}
          address={route.destinationAddress}
          city={route.destinationCity}
          state={route.destinationState}
          zipCode={route.destinationZipCode}
          contact={route.destinationContact}
        />
      </div>
      
      {showDistance && route.distance && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Distance</label>
          <p className="text-sm text-gray-900">{route.distance} miles</p>
        </div>
      )}
    </div>
  );
};