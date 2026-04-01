import { useState } from 'react'

import { buildUberWebLink } from '../models/uberBixiModel'

export function useUberBixiController() {
  const [searchLocation, setSearchLocation] = useState(null)

  const requestUberFromSearchLocation = () => {
    if (!searchLocation) {
      return
    }

    window.open(buildUberWebLink(searchLocation), '_blank', 'noopener,noreferrer')
  }

  return {
    searchLocation,
    setSearchLocation,
    requestUberFromSearchLocation,
  }
}
