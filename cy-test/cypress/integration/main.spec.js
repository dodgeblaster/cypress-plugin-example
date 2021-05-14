context('Main', () => {
    beforeEach(() => {
        /**
         * If there is data left from previous failed
         * tests, this confirm:clean task will throw
         * and error.
         *
         * This stops a team from running future tests
         * until the resources are cleaned up
         *
         */
        cy.task('confirm:clean')
        cy.visit('/')
    })

    it('can create and remove notes', () => {
        cy.intercept('POST', '/dev/api/createnote').as('createnote')
        cy.intercept('POST', '/dev/api/removenote').as('removenote')

        cy.get('[data-cy=create-button]').click()

        /**
         * Will wait on create note api call and run a task
         * which sets a flag in our teststate db that this
         * test resource exists
         *
         */
        cy.wait('@createnote').then((interception) => {
            cy.log(interception.response.body.id)
            cy.task('testResourcesFlag:set', interception.response.body.id)
        })

        cy.get('[data-cy=list] li:nth-child(1)').click()

        /**
         * Will wait on the remove note api call and run a task
         * which removes the flag in our teststate db, letting us
         * know that the test has completed and cleaned up all
         * its artifacts
         *
         * If the test fails before this point, our teststate db
         * will have a flag indicating that there is lingering
         * resources from a failed test
         *
         */
        cy.wait('@removenote').then((interception) => {
            cy.log(interception.response.body.id)
            cy.task('testResourcesFlag:remove', interception.response.body.id)
        })
    })
})
